import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Интеграционные тесты работают на in-memory фейке Prisma (живая БД не нужна).
vi.mock('./lib/prisma', async () => {
  const fakeModule = await import('./test/fake-prisma');
  return { prisma: fakeModule.createFakePrisma() };
});

import { createApp } from './app';
import { config } from './lib/config';
import { auth, registerAndLogin, type AuthedUser } from './test/api';
import { getFakeDb, resetFakeDb } from './test/fake-prisma';

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;

let user: AuthedUser;

async function createEvent(
  token: AuthedUser,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await request(app).post('/api/events').set(auth(token)).send(body);
  expect(res.status).toBe(201);
  return res.body.event as Record<string, unknown>;
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('Events CRUD', () => {
  it('creates, reads, updates and deletes an event (401 без токена, 404 для чужих)', async () => {
    const anon = await request(app).post('/api/events').send({ date: '2020-01-01T10:00:00.000Z' });
    expect(anon.status).toBe(401);

    const created = await createEvent(user, {
      title: 'First',
      eventType: 'SEX',
      date: '2020-01-01T10:00:00.000Z',
      duration: 30,
      rating: 5,
    });
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('occurred');
    expect(created.notes).toBeNull();

    const fetched = await request(app).get(`/api/events/${created.id}`).set(auth(user));
    expect(fetched.status).toBe(200);
    expect(fetched.body.event.title).toBe('First');

    const updated = await request(app)
      .put(`/api/events/${created.id}`)
      .set(auth(user))
      .send({ title: 'Renamed' });
    expect(updated.status).toBe(200);
    expect(updated.body.event.title).toBe('Renamed');
    expect(updated.body.event.rating).toBe(5); // частичный update не трогает остальное

    const list = await request(app).get('/api/events').set(auth(user));
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.events).toHaveLength(1);

    const stranger = await registerAndLogin(app);
    const foreign = await request(app).get(`/api/events/${created.id}`).set(auth(stranger));
    expect(foreign.status).toBe(404);

    const deleted = await request(app).delete(`/api/events/${created.id}`).set(auth(user));
    expect(deleted.status).toBe(204);

    const gone = await request(app).get(`/api/events/${created.id}`).set(auth(user));
    expect(gone.status).toBe(404);
    expect(getFakeDb().events).toHaveLength(0);
  });

  it('filters list by date range, eventType and partnerId', async () => {
    const partnerRes = await request(app)
      .post('/api/partners')
      .set(auth(user))
      .send({ name: 'Alex' });
    expect(partnerRes.status).toBe(201);
    const partnerId = partnerRes.body.partner.id as string;

    await createEvent(user, {
      eventType: 'SEX',
      date: '2020-06-01T12:00:00.000Z',
      partnerIds: [partnerId],
    });
    await createEvent(user, { eventType: 'KISS', date: '2021-06-01T12:00:00.000Z' });

    const byRange = await request(app)
      .get('/api/events')
      .query({ dateFrom: '2020-01-01', dateTo: '2020-12-31' })
      .set(auth(user));
    expect(byRange.status).toBe(200);
    expect(byRange.body.total).toBe(1);
    expect(byRange.body.events[0].eventType).toBe('SEX');

    const byType = await request(app)
      .get('/api/events')
      .query({ eventType: 'KISS' })
      .set(auth(user));
    expect(byType.body.total).toBe(1);
    expect(byType.body.events[0].eventType).toBe('KISS');

    const byPartner = await request(app).get('/api/events').query({ partnerId }).set(auth(user));
    expect(byPartner.body.total).toBe(1);
    expect(byPartner.body.events[0].eventType).toBe('SEX');

    const byGroup = await request(app)
      .get('/api/events')
      .query({ groupCalendarId: 'no-such-calendar' })
      .set(auth(user));
    expect(byGroup.body.total).toBe(0);

    const paged = await request(app)
      .get('/api/events')
      .query({ limit: 1, offset: 1 })
      .set(auth(user));
    expect(paged.body.total).toBe(2);
    expect(paged.body.events).toHaveLength(1);
    expect(paged.body.offset).toBe(1);
  });

  it('rejects unknown relation ids with 400 VALIDATION-related codes', async () => {
    const badPartner = await request(app)
      .post('/api/events')
      .set(auth(user))
      .send({ date: '2020-01-01T00:00:00.000Z', partnerIds: ['no-such-partner'] });
    expect(badPartner.status).toBe(400);
    expect(badPartner.body.error.code).toBe('PARTNER_NOT_FOUND');
  });
});

describe('GET /api/events/calendar', () => {
  it('groups events by day with occurred / planned / turndown statuses', async () => {
    await createEvent(user, { title: 'Past', date: new Date(Date.now() - DAY_MS).toISOString() });
    await createEvent(user, { title: 'Future', date: new Date(Date.now() + DAY_MS).toISOString() });
    await createEvent(user, {
      title: 'Refused',
      eventType: 'TURNDOWN',
      date: new Date(Date.now() - DAY_MS).toISOString(),
    });

    const res = await request(app)
      .get('/api/events/calendar')
      .query({ from: '2000-01-01', to: '2100-01-01' })
      .set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.days.length).toBe(2); // вчера (2 события) + завтра

    const all = res.body.days.flatMap(
      (day: { date: string; events: { status: string; title: string }[] }) => day.events,
    );
    expect(all).toHaveLength(3);
    const statuses = all.map((event: { status: string }) => event.status);
    expect(statuses).toContain('occurred');
    expect(statuses).toContain('planned');
    expect(statuses).toContain('turndown');
    for (const day of res.body.days) {
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('Event photos', () => {
  it('uploads photos and serves them via /api/files only to owner', async () => {
    const created = await createEvent(user, { date: '2020-02-02T10:00:00.000Z' });
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

    const upload = await request(app)
      .post(`/api/events/${created.id}/photos`)
      .set(auth(user))
      .attach('photo', png, { filename: 'shot.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    expect(upload.body.photos).toHaveLength(1);

    const filePath = upload.body.photos[0].filePath as string;
    expect(filePath.startsWith('events/')).toBe(true);
    expect(upload.body.photos[0].url).toContain('/api/files?path=');

    const url = `/api/files?path=${encodeURIComponent(filePath)}`;

    // без токена → 401
    const anon = await request(app).get(url);
    expect(anon.status).toBe(401);

    // чужой юзер → 404 (владелец другой)
    const stranger = await registerAndLogin(app);
    const foreign = await request(app).get(url).set(auth(stranger));
    expect(foreign.status).toBe(404);

    // владелец → 200 + image/png
    const own = await request(app).get(url).set(auth(user));
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('image/png');
    expect(own.body.length ?? own.body).toBeTruthy();

    // path traversal → 404
    const traversal = await request(app)
      .get(`/api/files?path=${encodeURIComponent('events/../../package.json')}`)
      .set(auth(user));
    expect(traversal.status).toBe(404);
  });

  it('rejects multipart upload without files with 400 NO_FILES', async () => {
    const created = await createEvent(user, { date: '2020-03-03T10:00:00.000Z' });
    const res = await request(app)
      .post(`/api/events/${created.id}/photos`)
      .set(auth(user))
      .field('caption', 'no file');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILES');
  });
});

describe('Event.notes encryption', () => {
  it('stores notes encrypted at rest and returns plaintext to the owner', async () => {
    const originalKey = config.ENCRYPTION_KEY;
    config.ENCRYPTION_KEY = 'event-notes-encryption-key-0123456789';
    try {
      const created = await createEvent(user, {
        date: '2020-04-04T10:00:00.000Z',
        notes: 'top secret заметки',
      });

      const row = getFakeDb().events.find((event) => event.id === created.id);
      expect(row).toBeTruthy();
      expect(String(row?.notes)).toMatch(/^enc:v1:/);
      expect(String(row?.notes)).not.toContain('top secret');

      const fetched = await request(app).get(`/api/events/${created.id}`).set(auth(user));
      expect(fetched.body.event.notes).toBe('top secret заметки');
    } finally {
      config.ENCRYPTION_KEY = originalKey;
    }
  });
});
