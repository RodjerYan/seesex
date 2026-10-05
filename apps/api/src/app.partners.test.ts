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

async function createPartner(token: AuthedUser, name: string): Promise<string> {
  const res = await request(app).post('/api/partners').set(auth(token)).send({ name });
  expect(res.status).toBe(201);
  return res.body.partner.id as string;
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('Partners CRUD + primary', () => {
  it('creates, updates, deletes partners and switches primary flag', async () => {
    const first = await createPartner(user, 'Alex');
    const second = await createPartner(user, 'Sam');

    const created = await request(app)
      .post('/api/partners')
      .set(auth(user))
      .send({ name: 'Kim', isPrimary: true });
    expect(created.status).toBe(201);
    expect(created.body.partner.isPrimary).toBe(true);

    const listBefore = await request(app).get('/api/partners').set(auth(user));
    expect(listBefore.body.partners).toHaveLength(3);

    const makeSecondPrimary = await request(app)
      .put(`/api/partners/${second}/primary`)
      .set(auth(user));
    expect(makeSecondPrimary.status).toBe(200);
    expect(makeSecondPrimary.body.partner.isPrimary).toBe(true);

    const after = await request(app).get('/api/partners').set(auth(user));
    const kim = after.body.partners.find(
      (p: { id: string; name: string }) => p.id !== second && p.name === 'Kim',
    );
    expect(kim.isPrimary).toBe(false); // снят в транзакции

    const updated = await request(app)
      .put(`/api/partners/${first}`)
      .set(auth(user))
      .send({ nickname: 'Al', customFields: { zodiac: 'leo' } });
    expect(updated.status).toBe(200);
    expect(updated.body.partner.nickname).toBe('Al');
    expect(updated.body.partner.customFields).toEqual({ zodiac: 'leo' });

    const stranger = await registerAndLogin(app);
    const foreign = await request(app).get(`/api/partners/${first}`).set(auth(stranger));
    expect(foreign.status).toBe(404);

    const deleted = await request(app).delete(`/api/partners/${first}`).set(auth(user));
    expect(deleted.status).toBe(204);
    expect(getFakeDb().partners).toHaveLength(2);
  });
});

