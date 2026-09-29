import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./lib/prisma', async () => {
  const fakeModule = await import('./test/fake-prisma');
  return { prisma: fakeModule.createFakePrisma() };
});

import { createApp } from './app';
import { auth, registerAndLogin, type AuthedUser } from './test/api';
import { resetFakeDb } from './test/fake-prisma';

const app = createApp();

let owner: AuthedUser;
let member: AuthedUser;
let stranger: AuthedUser;

async function createCalendar(token: AuthedUser, name = 'Наш календарь'): Promise<string> {
  const res = await request(app).post('/api/group-calendars').set(auth(token)).send({ name });
  expect(res.status).toBe(201);
  expect(res.body.calendar.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  return res.body.calendar.id as string;
}

beforeEach(async () => {
  resetFakeDb();
  owner = await registerAndLogin(app);
  member = await registerAndLogin(app);
  stranger = await registerAndLogin(app);
});

describe('Group calendars', () => {
  it('creates with unique 8-char invite code, joins by code, rejects duplicates', async () => {
    const calendarId = await createCalendar(owner);

    const mine = await request(app).get('/api/group-calendars').set(auth(owner));
    expect(mine.status).toBe(200);
    expect(mine.body.calendars).toHaveLength(1);
    expect(mine.body.calendars[0].role).toBe('OWNER');
    expect(mine.body.calendars[0].memberCount).toBe(1);

    const othersBefore = await request(app).get('/api/group-calendars').set(auth(member));
    expect(othersBefore.body.calendars).toHaveLength(0);

    const detail = await request(app).get(`/api/group-calendars/${calendarId}`).set(auth(owner));
    const inviteCode = detail.body.calendar.inviteCode as string;
    expect(inviteCode).toHaveLength(8);
    expect(detail.body.calendar.createdBy).toBe(owner.userId);

    const strangerView = await request(app)
      .get(`/api/group-calendars/${calendarId}`)
      .set(auth(stranger));
    expect(strangerView.status).toBe(404); // код не виден постороннему

    const joined = await request(app)
      .post('/api/group-calendars/join')
      .set(auth(member))
      .send({ inviteCode });
    expect(joined.status).toBe(200);
    expect(joined.body.calendar.memberCount).toBe(2);
    expect(joined.body.calendar.role).toBe('MEMBER');

    const duplicate = await request(app)
      .post('/api/group-calendars/join')
      .set(auth(member))
      .send({ inviteCode });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ALREADY_MEMBER');

    const unknownCode = await request(app)
      .post('/api/group-calendars/join')
      .set(auth(stranger))
      .send({ inviteCode: 'ZZZZZZZZ' });
    expect(unknownCode.status).toBe(404);
  });

  it('shares group events with members only (list + /events endpoint)', async () => {
    const calendarId = await createCalendar(owner);
    const detail = await request(app).get(`/api/group-calendars/${calendarId}`).set(auth(owner));
    const inviteCode = detail.body.calendar.inviteCode as string;
    await request(app).post('/api/group-calendars/join').set(auth(member)).send({ inviteCode });

    const created = await request(app)
      .post(`/api/group-calendars/${calendarId}/events`)
      .set(auth(owner))
      .send({ title: 'Вместе', date: '2020-09-09T20:00:00.000Z', rating: 5 });
    expect(created.status).toBe(201);
    expect(created.body.event.groupCalendarId).toBe(calendarId);

    // участник видит событие в общем списке и в /events
    const memberEvents = await request(app)
      .get(`/api/group-calendars/${calendarId}/events`)
      .set(auth(member));
    expect(memberEvents.status).toBe(200);
    expect(memberEvents.body.events).toHaveLength(1);
    expect(memberEvents.body.events[0].title).toBe('Вместе');

    const memberList = await request(app)
      .get('/api/events')
      .query({ groupCalendarId: calendarId })
      .set(auth(member));
    expect(memberList.body.total).toBe(1);

    // посторонний — 404 на деталях/событиях, пусто в своём списке
    const strangerEvents = await request(app)
      .get(`/api/group-calendars/${calendarId}/events`)
      .set(auth(stranger));
    expect(strangerEvents.status).toBe(404);

    const strangerList = await request(app)
      .get('/api/events')
      .query({ groupCalendarId: calendarId })
      .set(auth(stranger));
    expect(strangerList.body.total).toBe(0);

    // участник не может писать в календарь, в который не вступил — а владелец может
    const strangerWrite = await request(app)
      .post(`/api/group-calendars/${calendarId}/events`)
      .set(auth(stranger))
      .send({ date: '2020-09-10T20:00:00.000Z' });
    expect(strangerWrite.status).toBe(404);
  });

  it('leave removes membership and access, owner keeps calendar', async () => {
    const calendarId = await createCalendar(owner);
    const detail = await request(app).get(`/api/group-calendars/${calendarId}`).set(auth(owner));
    await request(app)
      .post('/api/group-calendars/join')
      .set(auth(member))
      .send({ inviteCode: detail.body.calendar.inviteCode });

    const left = await request(app)
      .delete(`/api/group-calendars/${calendarId}/leave`)
      .set(auth(member));
    expect(left.status).toBe(204);

    const afterLeave = await request(app)
      .get(`/api/group-calendars/${calendarId}`)
      .set(auth(member));
    expect(afterLeave.status).toBe(404);

    const leaveAgain = await request(app)
      .delete(`/api/group-calendars/${calendarId}/leave`)
      .set(auth(member));
    expect(leaveAgain.status).toBe(404);

    const ownerView = await request(app).get(`/api/group-calendars/${calendarId}`).set(auth(owner));
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.calendar.memberCount).toBe(1);

    const ownerList = await request(app).get('/api/group-calendars').set(auth(member));
    expect(ownerList.body.calendars).toHaveLength(0);
  });
});
