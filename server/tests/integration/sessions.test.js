/**
 * INTEGRATION TESTS — /api/sessions (+ personal-record side effects)
 *
 * Why: these endpoints combine Express routing, request parsing, Sequelize
 * queries (filters, ordering, pagination, JSONB columns) and a second model
 * (PersonalRecord) updated as a side effect. Mocks would hide SQL/ORM mistakes,
 * so the tests run against a real Postgres 17 — the same major version as prod.
 */
const request = require('supertest');
const app = require('../../server');
const { Session, PersonalRecord, useCleanDatabase, daysAgo } = require('../helpers/db');

useCleanDatabase();

// Exactly what WebCamFeed.tsx sends when the user clicks "Save workout"
const frontendPayload = { exerciseId: 'squat', count: 12, qualityScore: 94, duration: 75 };

describe('POST /api/sessions', () => {
    test('stores the session with defaults and returns 201', async () => {
        const res = await request(app).post('/api/sessions').send(frontendPayload).expect(201);
        expect(res.body).toMatchObject({
            ...frontendPayload, userId: null, programId: null, setBreakdown: [], formErrorCount: 0, formErrorDetails: {},
        });
        expect(res.body.id).toEqual(expect.any(Number));
        expect(await Session.count()).toBe(1);
    });

    test('round-trips JSONB columns', async () => {
        const body = { ...frontendPayload, setBreakdown: [5, 4, 3], formErrorDetails: { 'knee-cave': 2 } };
        const { body: saved } = await request(app).post('/api/sessions').send(body).expect(201);
        const row = await Session.findByPk(saved.id);
        expect(row.setBreakdown).toEqual([5, 4, 3]);
        expect(row.formErrorDetails).toEqual({ 'knee-cave': 2 });
    });

    test('first session creates a personal record', async () => {
        await request(app).post('/api/sessions').send({ ...frontendPayload, userId: 'u1' }).expect(201);
        const pr = await PersonalRecord.findOne({ where: { userId: 'u1', exerciseId: 'squat' } });
        expect(pr).toMatchObject({ maxReps: 12, bestQuality: 94, longestDuration: 75, totalReps: 12, totalSessions: 1 });
    });

    test('later sessions update bests and totals independently', async () => {
        const post = (b) => request(app).post('/api/sessions').send({ exerciseId: 'squat', userId: 'u1', ...b }).expect(201);
        await post({ count: 10, qualityScore: 90, duration: 60 });
        await post({ count: 15, qualityScore: 80, duration: 50 }); // more reps, worse quality, shorter
        await post({ count: 8, qualityScore: 97, duration: 120 });
        const pr = await PersonalRecord.findOne({ where: { userId: 'u1', exerciseId: 'squat' } });
        expect(pr).toMatchObject({ maxReps: 15, bestQuality: 97, longestDuration: 120, totalReps: 33, totalSessions: 3 });
    });

    test('anonymous sessions (no userId, as the current frontend sends) also accumulate one PR row', async () => {
        await request(app).post('/api/sessions').send(frontendPayload).expect(201);
        await request(app).post('/api/sessions').send({ ...frontendPayload, count: 20 }).expect(201);
        const prs = await PersonalRecord.findAll({ where: { exerciseId: 'squat' } });
        expect(prs).toHaveLength(1);
        expect(prs[0]).toMatchObject({ userId: null, maxReps: 20, totalSessions: 2 });
    });

    test('PRs are tracked per user', async () => {
        await request(app).post('/api/sessions').send({ ...frontendPayload, userId: 'a', count: 5 }).expect(201);
        await request(app).post('/api/sessions').send({ ...frontendPayload, userId: 'b', count: 50 }).expect(201);
        const a = await PersonalRecord.findOne({ where: { userId: 'a' } });
        expect(a.maxReps).toBe(5);
    });

    test('rejects a session without exerciseId and stores nothing', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const res = await request(app).post('/api/sessions').send({ count: 3 });
        console.error.mockRestore();
        // NOTE: the API answers 500 for this client error; 400 would be more accurate.
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(await Session.count()).toBe(0);
    });
});

describe('GET /api/sessions', () => {
    beforeEach(async () => {
        await Session.bulkCreate([
            { userId: 'u1', exerciseId: 'squat', count: 10, qualityScore: 90, duration: 60, timestamp: daysAgo(3) },
            { userId: 'u1', exerciseId: 'curl', count: 12, qualityScore: 85, duration: 40, timestamp: daysAgo(2) },
            { userId: 'u2', exerciseId: 'squat', count: 20, qualityScore: 70, duration: 90, timestamp: daysAgo(1) },
            { userId: 'u1', exerciseId: 'squat', count: 14, qualityScore: 95, duration: 70, timestamp: daysAgo(0) },
        ]);
    });

    test('returns newest first with total count', async () => {
        const { body } = await request(app).get('/api/sessions').expect(200);
        expect(body.total).toBe(4);
        expect(body.limit).toBe(50);
        expect(body.sessions.map((s) => s.count)).toEqual([14, 20, 12, 10]);
    });

    test('filters by user and exercise', async () => {
        const { body } = await request(app).get('/api/sessions?userId=u1&exerciseId=squat').expect(200);
        expect(body.total).toBe(2);
        expect(body.sessions.every((s) => s.userId === 'u1' && s.exerciseId === 'squat')).toBe(true);
    });

    test('filters by date range', async () => {
        const { body } = await request(app)
            .get(`/api/sessions?from=${daysAgo(2, 0).toISOString()}&to=${daysAgo(1, 23).toISOString()}`)
            .expect(200);
        expect(body.sessions.map((s) => s.count)).toEqual([20, 12]);
    });

    test('paginates', async () => {
        const { body } = await request(app).get('/api/sessions?limit=2&offset=1').expect(200);
        expect(body).toMatchObject({ total: 4, limit: 2, offset: 1 });
        expect(body.sessions.map((s) => s.count)).toEqual([20, 12]);
    });
});

describe('analytics endpoints', () => {
    test('stats on an empty database', async () => {
        const { body } = await request(app).get('/api/sessions/stats').expect(200);
        expect(body).toEqual({ totalSessions: 0, totalReps: 0, totalDuration: 0, avgQuality: 0, perfectSessions: 0, exercisesCovered: 0 });
    });

    test('stats aggregate across sessions and respect userId', async () => {
        await Session.bulkCreate([
            { userId: 'u1', exerciseId: 'squat', count: 10, qualityScore: 92, duration: 60 },
            { userId: 'u1', exerciseId: 'curl', count: 20, qualityScore: 81, duration: 30 },
            { userId: 'u2', exerciseId: 'pushup', count: 99, qualityScore: 99, duration: 99 },
        ]);
        const { body } = await request(app).get('/api/sessions/stats?userId=u1').expect(200);
        expect(body).toEqual({ totalSessions: 2, totalReps: 30, totalDuration: 90, avgQuality: 86.5, perfectSessions: 1, exercisesCovered: 2 });
    });

    test('streaks: current run from today and longest historical run', async () => {
        await Session.bulkCreate([0, 1, 2, 10, 11, 12, 13].map((d) => ({ exerciseId: 'squat', count: 5, timestamp: daysAgo(d) })));
        const { body } = await request(app).get('/api/sessions/streaks').expect(200);
        expect(body).toEqual({ currentStreakDays: 3, longestStreakDays: 4, activeDays: 7 });
    });

    test('streaks: a run ending yesterday is still current', async () => {
        await Session.bulkCreate([1, 2].map((d) => ({ exerciseId: 'squat', count: 5, timestamp: daysAgo(d) })));
        const { body } = await request(app).get('/api/sessions/streaks').expect(200);
        expect(body.currentStreakDays).toBe(2);
    });

    test('achievements unlock on thresholds', async () => {
        await Session.bulkCreate(Array.from({ length: 10 }, (_, i) => ({ exerciseId: 'squat', count: 100, qualityScore: i === 0 ? 96 : 80 })));
        const { body } = await request(app).get('/api/sessions/achievements').expect(200);
        const byKey = Object.fromEntries(body.achievements.map((a) => [a.key, a]));
        expect(byKey.first_session.unlocked).toBe(true);
        expect(byKey.grind_10_sessions.unlocked).toBe(true);
        expect(byKey.grind_100_sessions).toMatchObject({ unlocked: false, progress: 10 });
        expect(byKey.rep_beast_1k).toMatchObject({ unlocked: true, progress: 1000 });
        expect(byKey.quality_master.unlocked).toBe(true);
    });

    test('trends group by ISO week and project next week', async () => {
        await Session.bulkCreate([
            { exerciseId: 'squat', count: 10, timestamp: new Date('2026-01-05T10:00:00Z') }, // 2026-W02
            { exerciseId: 'squat', count: 15, timestamp: new Date('2026-01-07T10:00:00Z') }, // 2026-W02
            { exerciseId: 'squat', count: 40, timestamp: new Date('2026-01-12T10:00:00Z') }, // 2026-W03
        ]);
        const { body } = await request(app).get('/api/sessions/trends').expect(200);
        expect(body.points).toEqual([{ week: '2026-W02', reps: 25 }, { week: '2026-W03', reps: 40 }]);
        expect(body.projectedNextWeekReps).toBe(55);
    });

    test('by-exercise breakdown is sorted by total reps', async () => {
        await Session.bulkCreate([
            { exerciseId: 'curl', count: 10, qualityScore: 80, duration: 30 },
            { exerciseId: 'squat', count: 30, qualityScore: 90, duration: 60 },
            { exerciseId: 'curl', count: 5, qualityScore: 100, duration: 30 },
        ]);
        const { body } = await request(app).get('/api/sessions/by-exercise').expect(200);
        expect(body.map((e) => [e.exerciseId, e.totalSessions, e.totalReps, e.avgQuality, e.totalDuration])).toEqual([
            ['squat', 1, 30, 90, 60],
            ['curl', 2, 15, 90, 60],
        ]);
    });

    test('history groups by day within the requested window', async () => {
        await Session.bulkCreate([
            { exerciseId: 'squat', count: 10, qualityScore: 80, timestamp: daysAgo(1, 8) },
            { exerciseId: 'curl', count: 6, qualityScore: 100, timestamp: daysAgo(1, 18) },
            { exerciseId: 'squat', count: 99, timestamp: daysAgo(40) },
        ]);
        const { body } = await request(app).get('/api/sessions/history?days=30').expect(200);
        expect(body).toEqual([{ date: daysAgo(1).toISOString().slice(0, 10), sessionCount: 2, totalReps: 16, avgQuality: 90 }]);
    });
});

describe('DELETE /api/sessions/:id', () => {
    test('deletes an existing session', async () => {
        const s = await Session.create({ exerciseId: 'squat', count: 5 });
        await request(app).delete(`/api/sessions/${s.id}`).expect(200, { message: 'Session deleted', id: String(s.id) });
        expect(await Session.count()).toBe(0);
    });

    test('404 for an unknown id', async () => {
        await request(app).delete('/api/sessions/999999').expect(404);
    });
});
