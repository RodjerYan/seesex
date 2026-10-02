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

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('Wishlist', () => {
  it('creates entries, marks complete/uncomplete and deletes', async () => {
    const created = await request(app)
      .post('/api/wishlist')
      .set(auth(user))
      .send({ customName: 'Try the lotus', customCategory: 'ADVANCED' });
    expect(created.status).toBe(201);
    expect(created.body.entry.isCompleted).toBe(false);
    const id = created.body.entry.id as string;

    const completed = await request(app)
      .put(`/api/wishlist/${id}/complete`)
      .set(auth(user))
      .send({});
    expect(completed.status).toBe(200);
    expect(completed.body.entry.isCompleted).toBe(true);
    expect(completed.body.entry.completedAt).toBeTruthy();

    const unchecked = await request(app)
      .put(`/api/wishlist/${id}/complete`)
      .set(auth(user))
      .send({ completed: false });
    expect(unchecked.status).toBe(200);
    expect(unchecked.body.entry.isCompleted).toBe(false);
    expect(unchecked.body.entry.completedAt).toBeNull();

    const list = await request(app).get('/api/wishlist').set(auth(user));
    expect(list.body.entries).toHaveLength(1);

    const removed = await request(app).delete(`/api/wishlist/${id}`).set(auth(user));
    expect(removed.status).toBe(204);
    expect(getFakeDb().wishlists).toHaveLength(0);
  });

  it('validates entry payload (customName обязателен)', async () => {
    const empty = await request(app).post('/api/wishlist').set(auth(user)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
  });
});
