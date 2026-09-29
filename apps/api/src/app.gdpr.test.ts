import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/prisma', async () => {
  const fakeModule = await import('./test/fake-prisma');
  return { prisma: fakeModule.createFakePrisma() };
});

import { createApp } from './app';
import { auth, registerAndLogin, type AuthedUser } from './test/api';
import { getFakeDb, resetFakeDb } from './test/fake-prisma';

const app = createApp();

let user: AuthedUser;

async function seedUserData(): Promise<void> {
  const partner = await request(app).post('/api/partners').set(auth(user)).send({ name: 'Alex' });
  expect(partner.status).toBe(201);

  const position = await request(app)
    .post('/api/positions')
    .set(auth(user))
    .send({ name: 'My pose', category: 'ADVANCED' });
  expect(position.status).toBe(201);

  const event = await request(app)
    .post('/api/events')
    .set(auth(user))
    .send({
      title: 'Экспортное событие',
      date: '2020-10-10T12:00:00.000Z',
      rating: 4,
      partnerIds: [partner.body.partner.id],
      positionIds: [position.body.position.id],
    });
  expect(event.status).toBe(201);

  const wish = await request(app)
    .post('/api/wishlist')
    .set(auth(user))
    .send({ customName: 'Хочу попробовать' });
  expect(wish.status).toBe(201);
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('POST /api/export/json', () => {
  it('returns full dump as attachment without password hash', async () => {
    await seedUserData();

    const res = await request(app).post('/api/export/json').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('.json');

    expect(res.body.format).toBe('xtracker-export');
    expect(res.body.version).toBe(1);
    expect(res.body.user.id).toBe(user.userId);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].title).toBe('Экспортное событие');
    expect(res.body.events[0].rating).toBe(4);
    expect(res.body.partners).toHaveLength(1);
    expect(res.body.positions).toHaveLength(1);
    expect(res.body.wishlist).toHaveLength(1);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('$2b$');
  });

  it('requires authorization', async () => {
    const res = await request(app).post('/api/export/json');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/export/csv', () => {
  it('streams events section with header and rows', async () => {
    await seedUserData();

    const res = await request(app).post('/api/export/csv').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('.csv');

    expect(res.text).toMatch(/^id,date,eventType/);
    expect(res.text).toContain('Экспортное событие');
    expect(res.text.split(/\r?\n/)).toHaveLength(2); // header + 1 event
  });
});

describe('DELETE /api/settings/data (GDPR)', () => {
  it('wipes user data + photo rows but keeps the account', async () => {
    await seedUserData();
    expect(getFakeDb().events).toHaveLength(1);
    expect(getFakeDb().profiles).toHaveLength(1);

    // без подтверждения → 400
    const noConfirm = await request(app).delete('/api/settings/data').set(auth(user)).send({});
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.error.code).toBe('VALIDATION_ERROR');

    // неверное подтверждение → 400
    const wrongConfirm = await request(app)
      .delete('/api/settings/data')
      .set(auth(user))
      .send({ confirm: 'yes' });
    expect(wrongConfirm.status).toBe(400);

    // данные ещё на месте
    expect(getFakeDb().events).toHaveLength(1);

    const ok = await request(app)
      .delete('/api/settings/data')
      .set(auth(user))
      .send({ confirm: 'DELETE' });
    expect(ok.status).toBe(200);
    expect(ok.body.userRetained).toBe(true);
    expect(ok.body.deleted).toMatchObject({
      events: 1,
      partners: 1,
      positions: 1,
      wishlists: 1,
      profile: 1,
    });

    // данные удалены, аккаунт остался
    const db = getFakeDb();
    expect(db.events).toHaveLength(0);
    expect(db.partners).toHaveLength(0);
    expect(db.positions).toHaveLength(0);
    expect(db.wishlists).toHaveLength(0);
    expect(db.profiles).toHaveLength(0);
    expect(db.users).toHaveLength(1);
    expect(db.users[0].id).toBe(user.userId);

    // юзер всё ещё может войти, но данные пусты
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'correct-horse-battery-1' });
    expect(login.status).toBe(200);

    const events = await request(app).get('/api/events').set(auth(user));
    expect(events.body.total).toBe(0);

    const stats = await request(app).get('/api/statistics/overview').set(auth(user));
    expect(stats.body.totalEvents).toBe(0);
  });
});
