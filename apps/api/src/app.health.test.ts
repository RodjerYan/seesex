import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Интеграционные тесты работают на in-memory фейке Prisma (живая БД не нужна).
vi.mock('./lib/prisma', async () => {
  const fakeModule = await import('./test/fake-prisma');
  return { prisma: fakeModule.createFakePrisma() };
});

import { createApp } from './app';
import { auth, registerAndLogin, type AuthedUser } from './test/api';
import { getFakeDb, resetFakeDb } from './test/fake-prisma';

const app = createApp();

let user: AuthedUser;

async function createEvent(
  token: AuthedUser,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await request(app).post('/api/events').set(auth(token)).send(body);
  expect(res.status).toBe(201);
  return res.body.event as Record<string, unknown>;
}

/** Создаёт device-токен через JWT-роут и возвращает строку токена. */
async function createDeviceToken(token: AuthedUser): Promise<string> {
  const res = await request(app)
    .post('/api/health/token')
    .set(auth(token))
    .send({ action: 'create' });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

function applePost(deviceToken: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/health/apple')
    .set('Authorization', `Bearer ${deviceToken}`)
    .send(body);
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('POST /api/health/apple — обогащение события пробами Apple Health', () => {
  it('enriches event: avg/max heartRate + sum activeEnergy, samples outside window ignored', async () => {
    const event = await createEvent(user, {
      eventType: 'SEX',
      date: '2020-01-01T10:00:00.000Z',
      duration: 30,
    });
    const deviceToken = await createDeviceToken(user);

    const res = await applePost(deviceToken, {
      eventId: event.id,
      samples: [
        { type: 'heartRate', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:10:00.000Z', value: 80 },
        { type: 'heartRate', start: '2020-01-01T10:15:00.000Z', end: '2020-01-01T10:20:00.000Z', value: 100 },
        { type: 'activeEnergy', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:20:00.000Z', value: 100.5 },
        { type: 'activeEnergy', start: '2020-01-01T10:20:00.000Z', end: '2020-01-01T10:29:00.000Z', value: 80.2 },
        // Вне окна события (после duration=30 мин) — не учитывается.
        { type: 'heartRate', start: '2020-01-01T12:00:00.000Z', end: '2020-01-01T12:01:00.000Z', value: 180 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      eventId: event.id,
      heartRate: 90, // round((80+100)/2)
      heartRateMax: 100,
      calories: 181, // round(100.5 + 80.2)
      source: 'apple',
    });

    const row = getFakeDb().events.find((item) => item.id === event.id);
    expect(row?.heartRate).toBe(90);
    expect(row?.heartRateMax).toBe(100);
    expect(row?.calories).toBe(181);

    // lastSyncAt пишется на device-токен при каждом успешном приёме.
    const tokens = getFakeDb().deviceTokens;
    expect(tokens).toHaveLength(1);
    expect(tokens[0].lastSyncAt).toBeInstanceOf(Date);

    const status = await request(app).get('/api/health/token').set(auth(user));
    expect(status.status).toBe(200);
    expect(status.body.hasToken).toBe(true);
    expect(status.body.lastSyncAt).toBeTruthy();
  });

  it('rejects foreign/unknown event with 404 EVENT_NOT_FOUND and bad/missing token with 401', async () => {
    const own = await createEvent(user, { date: '2020-01-01T10:00:00.000Z', duration: 30 });
    const deviceToken = await createDeviceToken(user);

    const sample = {
      type: 'heartRate',
      start: '2020-01-01T10:05:00.000Z',
      end: '2020-01-01T10:10:00.000Z',
      value: 80,
    };

    // Чужое событие: отвечаем как за несуществующее — не раскрываем чужие данные.
    const stranger = await registerAndLogin(app);
    const foreign = await createEvent(stranger, { date: '2020-01-01T10:00:00.000Z' });
    const foreignRes = await applePost(deviceToken, { eventId: foreign.id, samples: [sample] });
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body.error.code).toBe('EVENT_NOT_FOUND');
    // Чужое событие не изменилось.
    const foreignRow = getFakeDb().events.find((item) => item.id === foreign.id);
    expect(foreignRow?.heartRate).toBeNull();

    // Несуществующее событие.
    const missing = await applePost(deviceToken, {
      eventId: '00000000-0000-4000-8000-000000000000',
      samples: [sample],
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('EVENT_NOT_FOUND');

    // Неверный device-token.
    const badToken = await applePost('xth_deadbeefdeadbeefdeadbeefdeadbeef', {
      eventId: own.id,
      samples: [sample],
    });
    expect(badToken.status).toBe(401);
    expect(badToken.body.error.code).toBe('INVALID_DEVICE_TOKEN');

    // Без заголовка Authorization вовсе.
    const noAuth = await request(app)
      .post('/api/health/apple')
      .send({ eventId: own.id, samples: [sample] });
    expect(noAuth.status).toBe(401);

    // JWT вместо device-токена — тоже не подходит.
    const asJwt = await request(app)
      .post('/api/health/apple')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ eventId: own.id, samples: [sample] });
    expect(asJwt.status).toBe(401);
    expect(asJwt.body.error.code).toBe('INVALID_DEVICE_TOKEN');
  });

  it('validates body: empty samples → 400, malformed sample → 400', async () => {
    const event = await createEvent(user, { date: '2020-01-01T10:00:00.000Z', duration: 30 });
    const deviceToken = await createDeviceToken(user);

    const empty = await applePost(deviceToken, { eventId: event.id, samples: [] });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const badType = await applePost(deviceToken, {
      eventId: event.id,
      samples: [{ type: 'steps', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:10:00.000Z', value: 10 }],
    });
    expect(badType.status).toBe(400);
    expect(badType.body.error.code).toBe('VALIDATION_ERROR');

    // Invalid Date ("abc") обязан отсекаться валидацией (400), а не падать в Prisma (500)
    const badDate = await applePost(deviceToken, {
      eventId: event.id,
      samples: [{ type: 'heartRate', start: 'abc', end: '2020-01-01T10:10:00.000Z', value: 80 }],
    });
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.code).toBe('VALIDATION_ERROR');

    const badRange = await applePost(deviceToken, {
      eventId: event.id,
      samples: [{ type: 'heartRate', start: '2020-01-01T10:10:00.000Z', end: '2020-01-01T10:05:00.000Z', value: 80 }],
    });
    expect(badRange.status).toBe(400);
  });

  it('falls back to MET formula when only heartRate samples are present', async () => {
    // duration=30, SEX (MET=5.0) → kcal = 5.0 * 3.5 * 70 / 200 * 30 = 183.75 → 184.
    const event = await createEvent(user, {
      eventType: 'SEX',
      date: '2020-01-01T10:00:00.000Z',
      duration: 30,
    });
    const deviceToken = await createDeviceToken(user);

    const res = await applePost(deviceToken, {
      eventId: event.id,
      samples: [
        { type: 'heartRate', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:10:00.000Z', value: 70 },
        { type: 'heartRate', start: '2020-01-01T10:20:00.000Z', end: '2020-01-01T10:25:00.000Z', value: 72 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('formula');
    expect(res.body.heartRate).toBe(71);
    expect(res.body.heartRateMax).toBe(72);
    expect(res.body.calories).toBe(184);

    // MET зависит от eventType: TURNDOWN (MET=4.0) → 4.9 * 30 = 147.
    const turndown = await createEvent(user, {
      eventType: 'TURNDOWN',
      date: '2020-01-02T10:00:00.000Z',
      duration: 30,
    });
    const res2 = await applePost(deviceToken, {
      eventId: turndown.id,
      samples: [
        { type: 'heartRate', start: '2020-01-02T10:05:00.000Z', end: '2020-01-02T10:10:00.000Z', value: 80 },
      ],
    });
    expect(res2.body.calories).toBe(147);
    expect(res2.body.source).toBe('formula');
  });

  it('uses ±60 min radius around startDate when event has no duration', async () => {
    // duration=null → окно [startDate-60min, startDate+60min] (спека H1).
    const event = await createEvent(user, { date: '2020-01-01T10:00:00.000Z' });
    const deviceToken = await createDeviceToken(user);

    const res = await applePost(deviceToken, {
      eventId: event.id,
      samples: [
        { type: 'heartRate', start: '2020-01-01T10:30:00.000Z', end: '2020-01-01T10:40:00.000Z', value: 90 },
        // За пределами радиуса 60 мин — игнорируется.
        { type: 'heartRate', start: '2020-01-01T12:30:00.000Z', end: '2020-01-01T12:40:00.000Z', value: 150 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.heartRate).toBe(90);
    expect(res.body.heartRateMax).toBe(90);
    expect(res.body.source).toBe('formula');
    // durationMin из события = 60 при null → round(5 * 3.5 * 70 / 200 * 60) = 368.
    expect(res.body.calories).toBe(368);
  });

  it('returns ok:false and changes nothing when no samples fall into the window', async () => {
    const event = await createEvent(user, {
      eventType: 'SEX',
      date: '2020-01-01T10:00:00.000Z',
      duration: 30,
    });
    const deviceToken = await createDeviceToken(user);

    const res = await applePost(deviceToken, {
      eventId: event.id,
      samples: [
        // Вне окна события [10:00, 10:30] — ни одна проба не подходит.
        { type: 'heartRate', start: '2020-01-01T12:00:00.000Z', end: '2020-01-01T12:05:00.000Z', value: 80 },
        { type: 'activeEnergy', start: '2020-01-01T13:00:00.000Z', end: '2020-01-01T13:10:00.000Z', value: 50 },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: false,
      eventId: event.id,
      heartRate: null,
      heartRateMax: null,
      calories: null,
      source: null,
      reason: 'no_samples_in_window',
    });

    // Событие не изменилось, lastSyncAt не тронут — ничего не меняем.
    const row = getFakeDb().events.find((item) => item.id === event.id);
    expect(row?.heartRate).toBeNull();
    expect(row?.heartRateMax).toBeNull();
    expect(row?.calories).toBeNull();
    expect(getFakeDb().deviceTokens[0].lastSyncAt).toBeNull();
  });
});

describe('Device token routes (/api/health/token)', () => {
  it('reports empty status, creates token, caps at 3 and revokes all', async () => {
    const initial = await request(app).get('/api/health/token').set(auth(user));
    expect(initial.status).toBe(200);
    expect(initial.body).toEqual({ hasToken: false, tokensCount: 0, lastSyncAt: null });

    const first = await createDeviceToken(user);
    expect(first.startsWith('xth_')).toBe(true);
    expect(first).toHaveLength(4 + 48); // префикс + 48 hex-символов (спека H2)

    const afterCreate = await request(app).get('/api/health/token').set(auth(user));
    expect(afterCreate.body).toMatchObject({ hasToken: true, tokensCount: 1, lastSyncAt: null });

    // Ещё 3 создания → всего 4, но максимум 3 активных (старейший вытеснен).
    const second = await createDeviceToken(user);
    const third = await createDeviceToken(user);
    const fourth = await createDeviceToken(user);
    expect(getFakeDb().deviceTokens).toHaveLength(3);

    // Старейший (first) вытеснен → его токен больше не авторизуется.
    const evicted = await applePost(first, {
      eventId: '00000000-0000-4000-8000-000000000000',
      samples: [{ type: 'heartRate', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:10:00.000Z', value: 80 }],
    });
    expect(evicted.status).toBe(401);
    expect(evicted.body.error.code).toBe('INVALID_DEVICE_TOKEN');

    // Актуальные токены работают (404 = прошли авторизацию, но нет события).
    for (const token of [second, third, fourth]) {
      const probe = await applePost(token, {
        eventId: '00000000-0000-4000-8000-000000000000',
        samples: [{ type: 'heartRate', start: '2020-01-01T10:05:00.000Z', end: '2020-01-01T10:10:00.000Z', value: 80 }],
      });
      expect(probe.status).toBe(404);
    }

    const revoked = await request(app)
      .post('/api/health/token')
      .set(auth(user))
      .send({ action: 'revoke' });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toEqual({ ok: true });
    expect(getFakeDb().deviceTokens).toHaveLength(0);

    const afterRevoke = await request(app).get('/api/health/token').set(auth(user));
    expect(afterRevoke.body).toEqual({ hasToken: false, tokensCount: 0, lastSyncAt: null });
  });

  it('requires JWT and valid action: 401 anon, 400 unknown action', async () => {
    const anon = await request(app).post('/api/health/token').send({ action: 'create' });
    expect(anon.status).toBe(401);

    const anonGet = await request(app).get('/api/health/token');
    expect(anonGet.status).toBe(401);

    const badAction = await request(app)
      .post('/api/health/token')
      .set(auth(user))
      .send({ action: 'rotate' });
    expect(badAction.status).toBe(400);
    expect(badAction.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps tokens isolated per user', async () => {
    await createDeviceToken(user);
    const stranger = await registerAndLogin(app);

    const strangerStatus = await request(app).get('/api/health/token').set(auth(stranger));
    expect(strangerStatus.body).toEqual({ hasToken: false, tokensCount: 0, lastSyncAt: null });

    const revoke = await request(app)
      .post('/api/health/token')
      .set(auth(stranger))
      .send({ action: 'revoke' });
    expect(revoke.status).toBe(200);
    expect(revoke.body).toEqual({ ok: true });
    expect(getFakeDb().deviceTokens).toHaveLength(1);
  });
});
