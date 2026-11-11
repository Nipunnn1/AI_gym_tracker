/**
 * INTEGRATION TESTS — /api/personal-records and /api/workout-logs
 *
 * Why: verifies routing + query building + the unique (userId, exerciseId)
 * index on a real database, and that a workout summary produced by the
 * frontend's getWorkoutSummary() is accepted and aggregated correctly.
 */
const request = require('supertest');
const app = require('../../server');
const { PersonalRecord, WorkoutLog, useCleanDatabase, daysAgo } = require('../helpers/db');

useCleanDatabase();

describe('/api/personal-records', () => {
    beforeEach(async () => {
        await PersonalRecord.bulkCreate([
            { userId: 'u1', exerciseId: 'squat', maxReps: 20 },
            { userId: 'u1', exerciseId: 'curl', maxReps: 12 },
            { userId: 'u2', exerciseId: 'squat', maxReps: 40 },
        ]);
    });

    test('lists records sorted by exercise, filtered by user', async () => {
        const { body } = await request(app).get('/api/personal-records?userId=u1').expect(200);
        expect(body.map((r) => r.exerciseId)).toEqual(['curl', 'squat']);
    });

    test('gets one exercise for one user', async () => {
        const { body } = await request(app).get('/api/personal-records/squat?userId=u2').expect(200);
        expect(body.maxReps).toBe(40);
    });

    test('404 for an exercise without a record', async () => {
        await request(app).get('/api/personal-records/lunge').expect(404);
    });

    test('delete resets only that user\'s record', async () => {
        await request(app).delete('/api/personal-records/squat?userId=u1').expect(200);
        expect(await PersonalRecord.count({ where: { exerciseId: 'squat' } })).toBe(1);
        await request(app).delete('/api/personal-records/squat?userId=u1').expect(404);
    });

    test('database enforces one record per (user, exercise)', async () => {
        await expect(PersonalRecord.create({ userId: 'u1', exerciseId: 'squat' })).rejects.toThrow();
    });
});

describe('/api/workout-logs', () => {
    // Shape produced by getWorkoutSummary() in src/lib/workoutPrograms.ts
    const summary = {
        programId: 'beginner_full_body',
        programName: 'Beginner Full Body',
        totalReps: 120,
        qualityScore: 92,
        durationSeconds: 900,
        exerciseBreakdown: { squat: [12, 12, 10] },
        formErrors: { squat: 4 },
    };

    test('saves a program summary (completed defaults to true)', async () => {
        const { body } = await request(app).post('/api/workout-logs').send(summary).expect(201);
        expect(body).toMatchObject({ ...summary, completed: true, userId: null });
    });

    test('lists logs newest first with pagination', async () => {
        await WorkoutLog.bulkCreate([
            { ...summary, totalReps: 1, completedAt: daysAgo(2) },
            { ...summary, totalReps: 2, completedAt: daysAgo(1) },
            { ...summary, totalReps: 3, completedAt: daysAgo(0) },
        ]);
        const { body } = await request(app).get('/api/workout-logs?limit=2').expect(200);
        expect(body.total).toBe(3);
        expect(body.logs.map((l) => l.totalReps)).toEqual([3, 2]);
    });

    test('stats ignore incomplete programs', async () => {
        await WorkoutLog.bulkCreate([
            { ...summary, completed: true, totalReps: 100, qualityScore: 90, durationSeconds: 600 },
            { ...summary, programId: 'other', programName: 'Other', completed: true, totalReps: 50, qualityScore: 80, durationSeconds: 300 },
            { ...summary, completed: false, totalReps: 999 },
        ]);
        const { body } = await request(app).get('/api/workout-logs/stats').expect(200);
        expect(body).toEqual({ programsCompleted: 2, totalReps: 150, totalDurationSeconds: 900, avgQuality: 85, uniqueProgramCount: 2 });
    });

    test('stats are zeroed when nothing is completed', async () => {
        const { body } = await request(app).get('/api/workout-logs/stats').expect(200);
        expect(body.programsCompleted).toBe(0);
    });

    test('by-program groups completions', async () => {
        await WorkoutLog.bulkCreate([
            { ...summary, completed: true, qualityScore: 90 },
            { ...summary, completed: true, qualityScore: 70 },
            { ...summary, programId: 'other', programName: 'Other', completed: true },
        ]);
        const { body } = await request(app).get('/api/workout-logs/by-program').expect(200);
        expect(body[0]).toMatchObject({ programId: 'beginner_full_body', timesCompleted: 2, avgQuality: 80, totalReps: 240 });
        expect(body).toHaveLength(2);
    });

    test('rejects a log without the required programId', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const res = await request(app).post('/api/workout-logs').send({ programName: 'x' });
        console.error.mockRestore();
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(await WorkoutLog.count()).toBe(0);
    });
});
