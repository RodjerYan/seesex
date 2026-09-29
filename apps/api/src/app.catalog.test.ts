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

/** Системная позиция «из сида» — не принадлежит текущему юзеру. */
function seedSystemPosition(id: string, name: string, category: string): void {
  getFakeDb().positions.push({
    id,
    userId: 'system-seed',
    name,
    category,
    iconName: null,
    isCustom: false,
    isSystem: true,
  });
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('Positions', () => {
  it('supports own positions but blocks system ones with 403', async () => {
    seedSystemPosition('sys-1', 'Missionary', 'STANDARD');

    const created = await request(app)
      .post('/api/positions')
      .set(auth(user))
      .send({ name: 'My pose', category: 'ADVANCED' });
    expect(created.status).toBe(201);
    expect(created.body.position.isCustom).toBe(true);
    expect(created.body.position.isSystem).toBe(false);
    const ownId = created.body.position.id as string;

    const systemUpdate = await request(app)
      .put('/api/positions/sys-1')
      .set(auth(user))
      .send({ name: 'Hacked' });
    expect(systemUpdate.status).toBe(403);
    expect(systemUpdate.body.error.code).toBe('SYSTEM_POSITION');

    const systemDelete = await request(app).delete('/api/positions/sys-1').set(auth(user));
    expect(systemDelete.status).toBe(403);
    expect(getFakeDb().positions.some((p) => p.id === 'sys-1')).toBe(true);

    const ownUpdate = await request(app)
      .put(`/api/positions/${ownId}`)
      .set(auth(user))
      .send({ name: 'My pose v2' });
    expect(ownUpdate.status).toBe(200);
    expect(ownUpdate.body.position.name).toBe('My pose v2');

    const ownDelete = await request(app).delete(`/api/positions/${ownId}`).set(auth(user));
    expect(ownDelete.status).toBe(204);
    expect(getFakeDb().positions).toHaveLength(1); // осталась только системная
  });

  it('lists system positions with pagination and category filter, categories endpoint', async () => {
    seedSystemPosition('sys-1', 'Missionary', 'STANDARD');
    seedSystemPosition('sys-2', 'Doggy', 'STANDARD');
    seedSystemPosition('sys-3', 'Lotus', 'ADVANCED');

    const paged = await request(app)
      .get('/api/positions/system')
      .query({ limit: 2, offset: 0 })
      .set(auth(user));
    expect(paged.status).toBe(200);
    expect(paged.body.total).toBe(3);
    expect(paged.body.positions).toHaveLength(2);
    expect(paged.body.limit).toBe(2);

    const filtered = await request(app)
      .get('/api/positions/system')
      .query({ category: 'ADVANCED' })
      .set(auth(user));
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.positions[0].name).toBe('Lotus');

    const own = await request(app)
      .post('/api/positions')
      .set(auth(user))
      .send({ name: 'Custom one', category: 'KINKY' });
    expect(own.status).toBe(201);

    const categories = await request(app).get('/api/positions/categories').set(auth(user));
    expect(categories.status).toBe(200);
    expect(categories.body.categories).toEqual(
      expect.arrayContaining(['ADVANCED', 'KINKY', 'STANDARD']),
    );

    const all = await request(app).get('/api/positions').set(auth(user));
    expect(all.body.positions).toHaveLength(4); // 3 системных + своя
  });
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

  it('validates entry payload (positionId или customName обязателен)', async () => {
    const empty = await request(app).post('/api/wishlist').set(auth(user)).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const unknownPosition = await request(app)
      .post('/api/wishlist')
      .set(auth(user))
      .send({ positionId: 'no-such-position' });
    expect(unknownPosition.status).toBe(400);
    expect(unknownPosition.body.error.code).toBe('POSITION_NOT_FOUND');
  });
});
