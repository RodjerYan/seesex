import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Интеграционные тесты работают на in-memory фейке Prisma (живая БД не нужна).
vi.mock('./lib/prisma', async () => {
  const fakeModule = await import('./test/fake-prisma');
  return { prisma: fakeModule.createFakePrisma() };
});

import { createApp } from './app';
import { generateTotpCode } from './lib/totp';
import { getFakeDb, resetFakeDb } from './test/fake-prisma';

const app = createApp();
const PASSWORD = 'correct-horse-battery-1';
const ALLOWED_ORIGIN = 'http://localhost:5173';

let emailCounter = 0;
function uniqueEmail(): string {
  emailCounter += 1;
  return `user${emailCounter}@example.com`;
}

interface AuthedUser {
  email: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
}

async function register(email: string, password: string = PASSWORD): Promise<void> {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(201);
}

async function registerAndLogin(): Promise<AuthedUser> {
  const email = uniqueEmail();
  await register(email);
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return {
    email,
    userId: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

beforeEach(() => {
  resetFakeDb();
});

describe('GET /api/health', () => {
  it('returns ok without rate-limit headers (health is outside /api limiter)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'xtracker-api' });
    // health endpoint is outside the /api rate limiter — no ratelimit headers
    expect(res.headers['ratelimit']).toBeUndefined();
  });
});

describe('POST /api/auth/register', () => {
  it('creates user with default profile and never returns password hash', async () => {
    const email = uniqueEmail();
    const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.id).toBeTruthy();
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('$2b$');

    const db = getFakeDb();
    expect(db.users).toHaveLength(1);
    expect(db.profiles).toHaveLength(1);
    expect(db.profiles[0].userId).toBe(db.users[0].id);
    expect(db.users[0].passwordHash).not.toBe(PASSWORD);
  });

  it('returns 409 on duplicate email and 400 on invalid payload', async () => {
    const email = uniqueEmail();
    await register(email);

    const dup = await request(app).post('/api/auth/register').send({ email, password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const short = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: 'short' });
    expect(short.status).toBe(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');

    const badEmail = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: PASSWORD });
    expect(badEmail.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('issues access (15m) + refresh tokens', async () => {
    const auth = await registerAndLogin();
    expect(auth.accessToken).toBeTruthy();
    expect(auth.refreshToken).toBeTruthy();
    const decoded = JSON.parse(
      Buffer.from(auth.accessToken.split('.')[1], 'base64url').toString('utf8'),
    ) as { purpose: string; exp: number; iat: number };
    expect(decoded.purpose).toBe('access');
    expect(decoded.exp - decoded.iat).toBe(900);
    // сессия сохранена (userAgent/ipHash — опционально)
    expect(getFakeDb().sessions).toHaveLength(1);
    expect(getFakeDb().sessions[0].userId).toBe(auth.userId);
    expect(getFakeDb().refreshTokens).toHaveLength(1);
  });

  it('rejects wrong password / unknown email with 401', async () => {
    const email = uniqueEmail();
    await register(email);

    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'totally-wrong-pass' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: PASSWORD });
    expect(unknown.status).toBe(401);
  });
});

describe('POST /api/auth/refresh + logout', () => {
  it('rotates refresh token and rejects reuse of the old one', async () => {
    const auth = await registerAndLogin();

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: auth.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).not.toBe(auth.refreshToken);

    // старый refresh помечен revoked → повторное использование 401
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: auth.refreshToken });
    expect(reuse.status).toBe(401);

    // новый refresh работает
    const again = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken as string });
    expect(again.status).toBe(200);
  });

  it('logout revokes refresh token (204) and kills further refresh', async () => {
    const auth = await registerAndLogin();

    const out = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ refreshToken: auth.refreshToken });
    expect(out.status).toBe(204);
    expect(getFakeDb().sessions).toHaveLength(0);
    expect(getFakeDb().refreshTokens[0].revokedAt).not.toBeNull();

    const after = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: auth.refreshToken });
    expect(after.status).toBe(401);
  });
});

describe('requireAuth middleware', () => {
  it('rejects missing/invalid Bearer token with 401', async () => {
    const noToken = await request(app).get('/api/auth/sessions');
    expect(noToken.status).toBe(401);

    const badToken = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', 'Bearer garbage.token.value');
    expect(badToken.status).toBe(401);

    const wrongScheme = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', 'Basic dXNlcjpwYXNz');
    expect(wrongScheme.status).toBe(401);
  });

  it('lists own sessions with valid access token', async () => {
    const auth = await registerAndLogin();
    const res = await request(app)
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].id).toBeTruthy();
  });
});

describe('DELETE /api/auth/sessions/:id', () => {
  it('closes own session, 403 for foreign, 404 for unknown', async () => {
    const owner = await registerAndLogin();
    const foreign = await registerAndLogin();

    const ownerSessionId = getFakeDb().sessions.find((s) => s.userId === owner.userId)?.id;
    expect(ownerSessionId).toBeTruthy();

    // чужая сессия → 403
    const foreignTry = await request(app)
      .delete(`/api/auth/sessions/${ownerSessionId}`)
      .set('Authorization', `Bearer ${foreign.accessToken}`);
    expect(foreignTry.status).toBe(403);

    // неизвестная → 404
    const unknown = await request(app)
      .delete('/api/auth/sessions/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(unknown.status).toBe(404);

    // своя → 204
    const own = await request(app)
      .delete(`/api/auth/sessions/${ownerSessionId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(own.status).toBe(204);
    expect(getFakeDb().sessions.some((s) => s.id === ownerSessionId)).toBe(false);
  });
});

describe('TOTP 2FA (setup → verify → login)', () => {
  it('enables 2FA and gates login behind tmpToken + code', async () => {
    const auth = await registerAndLogin();

    const setup = await request(app)
      .post('/api/auth/totp/setup')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();
    expect(String(setup.body.otpauthUrl)).toMatch(/^otpauth:\/\/totp\//);
    // секрет ещё НЕ сохранён в БД
    expect(getFakeDb().users[0].totpSecret).toBeNull();

    const code = await generateTotpCode(setup.body.secret as string);
    const verify = await request(app)
      .post('/api/auth/totp/verify')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ code, setupToken: setup.body.setupToken as string });
    expect(verify.status).toBe(200);
    expect(verify.body.accessToken).toBeTruthy();
    expect(verify.body.refreshToken).toBeTruthy();
    expect(getFakeDb().users[0].totpSecret).toBe(setup.body.secret);

    // Теперь login не выдаёт access до проверки кода
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: auth.email, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.requires2FA).toBe(true);
    expect(login.body.accessToken).toBeUndefined();
    expect(login.body.tmpToken).toBeTruthy();

    const tmpCode = await generateTotpCode(setup.body.secret as string);
    const step2 = await request(app)
      .post('/api/auth/totp/verify')
      .set('Authorization', `Bearer ${login.body.tmpToken as string}`)
      .send({ code: tmpCode });
    expect(step2.status).toBe(200);
    expect(step2.body.accessToken).toBeTruthy();
    expect(step2.body.refreshToken).toBeTruthy();
  });

  it('rejects wrong TOTP code without persisting the secret', async () => {
    const auth = await registerAndLogin();
    const setup = await request(app)
      .post('/api/auth/totp/setup')
      .set('Authorization', `Bearer ${auth.accessToken}`);
    expect(setup.status).toBe(200);

    const bad = await request(app)
      .post('/api/auth/totp/verify')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ code: '000000', setupToken: setup.body.setupToken as string });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_TOTP_CODE');
    // секрет не сохранён — verify не прошёл
    expect(getFakeDb().users[0].totpSecret).toBeNull();

    // без access/tmp токена — 401
    const noAuth = await request(app).post('/api/auth/totp/verify').send({ code: '123456' });
    expect(noAuth.status).toBe(401);
  });
});

describe('security middleware', () => {
  it('applies strict CORS whitelist', async () => {
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();

    const allowed = await request(app).get('/api/health').set('Origin', ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('sets security headers (helmet) and rejects malformed JSON', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    const csp = res.headers['content-security-policy'] ?? '';
    // Статика SPA раздаётся этим же сервером → 'self'; запреты сохранены.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();

    const bad = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_JSON');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/definitely-missing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
