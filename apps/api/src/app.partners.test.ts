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
const PHOTO = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

let user: AuthedUser;

async function createPartner(token: AuthedUser, name: string): Promise<string> {
  const res = await request(app).post('/api/partners').set(auth(token)).send({ name });
  expect(res.status).toBe(201);
  return res.body.partner.id as string;
}

async function uploadPhoto(token: AuthedUser, partnerId: string, filename: string) {
  return request(app)
    .post(`/api/partners/${partnerId}/photos`)
    .set(auth(token))
    .attach('file', PHOTO, { filename, contentType: 'image/png' });
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

describe('Partner photos', () => {
  it('allows up to MAX_PHOTOS_PER_PARTNER (3) and rejects the 4th with 400', async () => {
    const partnerId = await createPartner(user, 'Alex');

    for (let i = 1; i <= 3; i += 1) {
      const res = await uploadPhoto(user, partnerId, `photo-${i}.png`);
      expect(res.status).toBe(201);
      expect(res.body.photos).toHaveLength(i);
    }
    expect(getFakeDb().partnerPhotos).toHaveLength(3);

    const fourth = await uploadPhoto(user, partnerId, 'photo-4.png');
    expect(fourth.status).toBe(400);
    expect(fourth.body.error.code).toBe('PHOTO_LIMIT_EXCEEDED');

    // лишняя запись не создана
    expect(getFakeDb().partnerPhotos).toHaveLength(3);
    const fetched = await request(app).get(`/api/partners/${partnerId}`).set(auth(user));
    expect(fetched.body.partner.photos).toHaveLength(3);
  });

  it('deletes a photo record and returns 404 for unknown photo', async () => {
    const partnerId = await createPartner(user, 'Alex');
    const upload = await uploadPhoto(user, partnerId, 'only.png');
    expect(upload.status).toBe(201);
    const photoId = upload.body.photos[0].id as string;

    const missing = await request(app)
      .delete(`/api/partners/${partnerId}/photos/00000000-0000-4000-8000-000000000000`)
      .set(auth(user));
    expect(missing.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/partners/${partnerId}/photos/${photoId}`)
      .set(auth(user));
    expect(removed.status).toBe(204);
    expect(getFakeDb().partnerPhotos).toHaveLength(0);

    const fetched = await request(app).get(`/api/partners/${partnerId}`).set(auth(user));
    expect(fetched.body.partner.photos).toHaveLength(0);
  });

  it('rejects non-image upload with 400 INVALID_FILE_TYPE', async () => {
    const partnerId = await createPartner(user, 'Alex');
    const res = await request(app)
      .post(`/api/partners/${partnerId}/photos`)
      .set(auth(user))
      .attach('file', Buffer.from('not an image'), {
        filename: 'evil.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    expect(getFakeDb().partnerPhotos).toHaveLength(0);
  });
});
