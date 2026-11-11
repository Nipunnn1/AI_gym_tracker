/**
 * INTEGRATION TESTS — /api/growth and /api/coaching
 *
 * Why: these endpoints feed every Dashboard card. Their maths depends on
 * time-window SQL queries (last 72 h / 7 / 14 / 30 days), so the tests insert
 * rows with explicit timestamps into a real database and check the numbers.
 */
const request = require('supertest');
const app = require('../../server');
const { Session, PersonalRecord, useCleanDatabase, daysAgo } = require('../helpers/db');

useCleanDatabase();

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);

describe('GET /api/growth/daily-mission', () => {
    test('uses baseline goals for a new user', async () => {
        const { body } = await request(app).get('/api/growth/daily-mission').expect(200);
        expect(body).toEqual({ missionTitle: 'Daily Domination', repsGoal: 48, minutesGoal: 12, qualityGoal: 80, rewardXp: 120 });
    });

    test('scales goals from the last 7 days only', async () => {
        await Session.bulkCreate([
            { exerciseId: 'squat', count: 700, qualityScore: 90, duration: 7 * 60 * 20, timestamp: daysAgo(1) },
            { exerciseId: 'squat', count: 9999, qualityScore: 10, duration: 99999, timestamp: daysAgo(20) }, // outside window
        ]);
        const { body } = await request(app).get('/api/growth/daily-mission').expect(200);
        expect(body).toMatchObject({ repsGoal: 120, minutesGoal: 23, qualityGoal: 92 });
    });
});

describe('GET /api/growth/ghost-target', () => {
    test('requires exerciseId', async () => {
        await request(app).get('/api/growth/ghost-target').expect(400);
    });

    test('default target when there is no history', async () => {
        const { body } = await request(app).get('/api/growth/ghost-target?exerciseId=squat').expect(200);
        expect(body).toMatchObject({ exerciseId: 'squat', targetReps: 10, targetQuality: 80 });
    });

    test('targets 5% above the best session', async () => {
        await Session.bulkCreate([
            { exerciseId: 'squat', count: 20, qualityScore: 88.4 },
            { exerciseId: 'squat', count: 10, qualityScore: 99 },
            { exerciseId: 'curl', count: 100, qualityScore: 99 },
        ]);
        const { body } = await request(app).get('/api/growth/ghost-target?exerciseId=squat').expect(200);
        expect(body).toMatchObject({ targetReps: 21, targetQuality: 88, challengeText: 'Beat your best 20 reps at 88% quality.' });
    });
});

describe('GET /api/growth/comeback-plan', () => {
    test('new user', async () => {
        const { body } = await request(app).get('/api/growth/comeback-plan').expect(200);
        expect(body).toMatchObject({ status: 'new', daysInactive: 0 });
    });

    test('active user', async () => {
        await Session.create({ exerciseId: 'squat', count: 5, timestamp: hoursAgo(30) });
        const { body } = await request(app).get('/api/growth/comeback-plan').expect(200);
        expect(body).toMatchObject({ status: 'active', daysInactive: 1 });
    });

    test('3+ days inactive needs a comeback', async () => {
        await Session.create({ exerciseId: 'squat', count: 5, timestamp: hoursAgo(24 * 4 + 1) });
        const { body } = await request(app).get('/api/growth/comeback-plan').expect(200);
        expect(body).toMatchObject({ status: 'comeback_needed', daysInactive: 4 });
    });
});

describe('GET /api/growth/leaderboard', () => {
    test('ranks users by total reps and labels anonymous sessions', async () => {
        await Session.bulkCreate([
            { userId: 'alice', exerciseId: 'squat', count: 30, qualityScore: 90 },
            { userId: 'alice', exerciseId: 'curl', count: 30, qualityScore: 80 },
            { userId: 'bob', exerciseId: 'squat', count: 50, qualityScore: 70 },
            { exerciseId: 'squat', count: 5, qualityScore: 100 },
        ]);
        const { body } = await request(app).get('/api/growth/leaderboard').expect(200);
        expect(body.leaderboard).toEqual([
            { rank: 1, userId: 'alice', totalReps: 60, avgQuality: 85 },
            { rank: 2, userId: 'bob', totalReps: 50, avgQuality: 70 },
            { rank: 3, userId: 'solo-athlete', totalReps: 5, avgQuality: 100 },
        ]);
    });

    test('filters by exercise', async () => {
        await Session.bulkCreate([
            { userId: 'alice', exerciseId: 'curl', count: 30 },
            { userId: 'bob', exerciseId: 'squat', count: 50 },
        ]);
        const { body } = await request(app).get('/api/growth/leaderboard?exerciseId=curl').expect(200);
        expect(body.leaderboard.map((r) => r.userId)).toEqual(['alice']);
    });
});

describe('GET /api/growth/readiness', () => {
    test('fresh when nothing in the last 72 hours', async () => {
        await Session.create({ exerciseId: 'squat', count: 5, timestamp: hoursAgo(100) });
        const { body } = await request(app).get('/api/growth/readiness').expect(200);
        expect(body).toMatchObject({ readinessScore: 78, status: 'fresh', recentSessionCount: 0 });
    });

    test('high recent load lowers readiness to recover', async () => {
        await Session.bulkCreate(Array.from({ length: 12 }, () => ({ exerciseId: 'squat', count: 10, qualityScore: 60, duration: 1800, timestamp: hoursAgo(5) })));
        const { body } = await request(app).get('/api/growth/readiness').expect(200);
        // 72 + round((60-75)/2) - min(25, 24 + 15) = 72 - 7 - 25 = 40
        expect(body).toMatchObject({ readinessScore: 40, status: 'recover', recentSessionCount: 12 });
    });

    test('one great short session gives peak readiness', async () => {
        await Session.create({ exerciseId: 'squat', count: 10, qualityScore: 100, duration: 60, timestamp: hoursAgo(2) });
        const { body } = await request(app).get('/api/growth/readiness').expect(200);
        // 72 + round(12.5) - round(2 + 0.5) = 72 + 13 - 3 = 82
        expect(body).toMatchObject({ readinessScore: 82, status: 'peak' });
    });
});

describe('GET /api/growth/smart-plan', () => {
    test('falls back to default exercises with the balanced frame', async () => {
        const { body } = await request(app).get('/api/growth/smart-plan').expect(200);
        expect(body.goal).toBe('balanced');
        expect(body.exercises.map((e) => e.exerciseId)).toEqual(['squat', 'pushup', 'curl']);
        expect(body.exercises[0]).toMatchObject({ sets: 3, targetReps: 12, restSeconds: 45 });
    });

    test('targets the 3 lowest-volume exercises of the last 30 days', async () => {
        await Session.bulkCreate([
            { exerciseId: 'squat', count: 100 }, { exerciseId: 'curl', count: 5 }, { exerciseId: 'lunge', count: 20 },
            { exerciseId: 'pushup', count: 50 }, { exerciseId: 'crunch', count: 1, timestamp: daysAgo(60) },
        ]);
        const { body } = await request(app).get('/api/growth/smart-plan?goal=strength').expect(200);
        expect(body.goal).toBe('strength');
        expect(body.exercises.map((e) => e.exerciseId)).toEqual(['curl', 'lunge', 'pushup']);
        expect(body.exercises[0]).toMatchObject({ sets: 4, targetReps: 8 });
    });

    test('unknown goal falls back to balanced', async () => {
        const { body } = await request(app).get('/api/growth/smart-plan?goal=nonsense').expect(200);
        expect(body.goal).toBe('balanced');
    });
});

describe('GET /api/growth/monetization-signals', () => {
    test('engaged, high-quality user', async () => {
        await Session.bulkCreate(Array.from({ length: 6 }, () => ({ exerciseId: 'squat', count: 10, qualityScore: 90, timestamp: daysAgo(1) })));
        const { body } = await request(app).get('/api/growth/monetization-signals').expect(200);
        expect(body).toMatchObject({ conversionLikelihood: 'high', triggers: ['consistency_streak', 'performance_oriented'] });
    });

    test('new user', async () => {
        const { body } = await request(app).get('/api/growth/monetization-signals').expect(200);
        expect(body).toMatchObject({ conversionLikelihood: 'medium', triggers: ['new_habit_building', 'guidance_needed'] });
    });
});

describe('/api/coaching (no Gemini key, as in production)', () => {
    test('advice welcomes a user with no sessions', async () => {
        const { body } = await request(app).get('/api/coaching/advice').expect(200);
        expect(body.advice).toMatch(/Welcome!/);
    });

    test('advice reports demo mode once there is history', async () => {
        await Session.create({ exerciseId: 'squat', count: 5 });
        await PersonalRecord.create({ exerciseId: 'squat', maxReps: 5 });
        const { body } = await request(app).get('/api/coaching/advice').expect(200);
        expect(body.advice).toMatch(/demo mode/);
    });

    test('generate-program validates input', async () => {
        await request(app).post('/api/coaching/generate-program').send({ goal: 'strength' }).expect(400);
    });

    test('generate-program fails cleanly without an AI key', async () => {
        const { body } = await request(app)
            .post('/api/coaching/generate-program')
            .send({ goal: 'strength', timeAvailable: 20, difficulty: 'beginner' })
            .expect(500);
        expect(body.error).toBe('Failed to generate program');
    });
});
