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

async function createEvent(body: Record<string, unknown>): Promise<void> {
  const res = await request(app).post('/api/events').set(auth(user)).send(body);
  expect(res.status).toBe(201);
}

beforeEach(async () => {
  resetFakeDb();
  user = await registerAndLogin(app);
});

describe('Statistics', () => {
  it('overview returns real non-empty aggregates', async () => {
    await request(app).post('/api/partners').set(auth(user)).send({ name: 'Alex' });

    await createEvent({
      eventType: 'SEX',
      date: '2020-05-01T12:00:00.000Z',
      rating: 5,
      duration: 60,
      calories: 100,
    });
    await createEvent({
      eventType: 'KISS',
      date: '2020-06-01T12:00:00.000Z',
      rating: 3,
      duration: 30,
      calories: 0,
    });

    const res = await request(app).get('/api/statistics/overview').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(2);
    expect(res.body.avgRating).toBe(4);
    expect(res.body.avgDurationMinutes).toBe(45);
    expect(res.body.totalCalories).toBe(100);
    expect(res.body.firstEventDate).toBeTruthy();
    expect(res.body.lastEventDate).toBeTruthy();
    expect(res.body.eventsByType).toHaveLength(2);
    expect(res.body.eventsByType[0]).toMatchObject({ eventType: 'SEX', count: 1 });
    expect(res.body.partnersCount).toBe(1);
    expect(res.body.wishlist).toEqual({ total: 0, completed: 0 });
  });

  it('frequency buckets events by month with intervals', async () => {
    await createEvent({ date: '2020-05-10T12:00:00.000Z' });
    await createEvent({ date: '2020-05-20T12:00:00.000Z' });
    await createEvent({ date: '2020-06-15T12:00:00.000Z' });

    const res = await request(app).get('/api/statistics/frequency').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.activeMonths).toBe(2);
    expect(res.body.byMonth).toEqual([
      { month: '2020-05', count: 2 },
      { month: '2020-06', count: 1 },
    ]);
    expect(res.body.avgPerMonth).toBe(1.5);
    expect(res.body.avgIntervalDays).toBeGreaterThan(0);
    expect(res.body.busiestMonth).toEqual({ month: '2020-05', count: 2 });
  });

  it('ratings distribution comes from groupBy(rating)', async () => {
    await createEvent({ date: '2020-07-01T12:00:00.000Z', rating: 5, duration: 40 });
    await createEvent({ date: '2020-07-02T12:00:00.000Z', rating: 5, duration: 20 });
    await createEvent({ date: '2020-07-03T12:00:00.000Z', rating: 2, duration: 10 });

    const res = await request(app).get('/api/statistics/ratings').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.avgRating).toBe(4);
    expect(res.body.ratedEvents).toBe(3);
    const five = res.body.distribution.find((row: { rating: number }) => row.rating === 5);
    const two = res.body.distribution.find((row: { rating: number }) => row.rating === 2);
    expect(five).toMatchObject({ rating: 5, count: 2, avgDurationMinutes: 30 });
    expect(two).toMatchObject({ rating: 2, count: 1, avgDurationMinutes: 10 });
  });

  it('partners/custom aggregate relations and date range', async () => {
    const partner = await request(app).post('/api/partners').set(auth(user)).send({ name: 'Alex' });

    await createEvent({
      date: '2020-08-01T12:00:00.000Z',
      rating: 4,
      partnerIds: [partner.body.partner.id],
    });

    const byPartner = await request(app).get('/api/statistics/partners').set(auth(user));
    expect(byPartner.status).toBe(200);
    expect(byPartner.body.totalEvents).toBe(1);
    expect(byPartner.body.partners[0]).toMatchObject({ name: 'Alex', count: 1, avgRating: 4 });

    const customInRange = await request(app)
      .get('/api/statistics/custom')
      .query({ from: '2020-01-01', to: '2020-12-31' })
      .set(auth(user));
    expect(customInRange.status).toBe(200);
    expect(customInRange.body.totalEvents).toBe(1);

    const customOutOfRange = await request(app)
      .get('/api/statistics/custom')
      .query({ from: '2021-01-01', to: '2021-12-31' })
      .set(auth(user));
    expect(customOutOfRange.body.totalEvents).toBe(0);
  });

  it('periods aggregates cycle entries of own partners', async () => {
    const partner = await request(app).post('/api/partners').set(auth(user)).send({ name: 'Alex' });
    const partnerId = partner.body.partner.id as string;

    const db = getFakeDb();
    db.periodTrackings.push({
      id: 'pt-1',
      partnerId,
      lastPeriodStart: new Date('2020-09-01T00:00:00.000Z'),
      averageCycleLength: 28,
      averagePeriodLength: 5,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    db.periodEntries.push(
      {
        id: 'pe-1',
        periodTrackingId: 'pt-1',
        startDate: new Date('2020-09-01T00:00:00.000Z'),
        endDate: new Date('2020-09-05T00:00:00.000Z'),
        symptoms: null,
        notes: null,
        createdAt: new Date(),
      },
      {
        id: 'pe-2',
        periodTrackingId: 'pt-1',
        startDate: new Date('2020-09-29T00:00:00.000Z'),
        endDate: null,
        symptoms: null,
        notes: null,
        createdAt: new Date(),
      },
    );

    const res = await request(app).get('/api/statistics/periods').set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.totalEntries).toBe(2);
    expect(res.body.avgCycleLengthDays).toBe(28);
    expect(res.body.avgPeriodLengthDays).toBe(5);
    expect(res.body.lastPeriodStart).toBeTruthy();
    expect(res.body.trackings).toHaveLength(1);
    expect(res.body.trackings[0].partnerId).toBe(partnerId);
  });
});
