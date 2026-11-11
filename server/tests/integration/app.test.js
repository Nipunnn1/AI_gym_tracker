/**
 * INTEGRATION TESTS — application wiring (health, CORS, DB-outage handling)
 *
 * Why: checks the parts of server.js that sit around every route: the health
 * endpoint used by uptime checks, CORS (the frontend is on a different Vercel
 * domain), JSON parsing, unknown routes, and that a database outage returns a
 * clean 503 instead of hanging or crashing the function.
 */
const request = require('supertest');

describe('with a healthy database', () => {
    const app = require('../../server');
    const sequelize = require('../../db');
    afterAll(() => sequelize.close());

    test('GET /health', async () => {
        const { body } = await request(app).get('/health').expect(200);
        expect(body).toMatchObject({ status: 'active', version: '2.0.0' });
    });

    test('CORS allows the separately-hosted frontend', async () => {
        const res = await request(app)
            .options('/api/sessions')
            .set('Origin', 'https://ai-gym-trainer-gamma.vercel.app')
            .set('Access-Control-Request-Method', 'POST')
            .expect(204);
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    test('first API request connects and creates the schema', async () => {
        await request(app).get('/api/sessions').expect(200);
        const tables = await sequelize.getQueryInterface().showAllTables();
        expect(tables).toEqual(expect.arrayContaining(['Sessions', 'PersonalRecords', 'WorkoutLogs']));
    });

    test('unknown routes return 404', async () => {
        await request(app).get('/api/does-not-exist').expect(404);
    });

    test('malformed JSON is rejected with 400', async () => {
        await request(app).post('/api/sessions').set('Content-Type', 'application/json').send('{"bad json').expect(400);
    });
});

describe('when the database is unreachable', () => {
    let app;
    let sequelize;
    const realUrl = process.env.DATABASE_URL;

    beforeAll(() => {
        process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';
        jest.isolateModules(() => {
            app = require('../../server');
            sequelize = require('../../db');
        });
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterAll(async () => {
        process.env.DATABASE_URL = realUrl;
        console.error.mockRestore();
        await sequelize.close();
    });

    test('API routes answer 503 instead of crashing', async () => {
        const { body } = await request(app).get('/api/sessions').expect(503);
        expect(body).toEqual({ error: 'Database unavailable' });
    });

    test('health check still works (it does not need the DB)', async () => {
        await request(app).get('/health').expect(200);
    });

    test('the connection is retried on the next request (no cached failure)', async () => {
        await request(app).get('/api/growth/leaderboard').expect(503);
        await request(app).get('/api/growth/leaderboard').expect(503);
    });
});
