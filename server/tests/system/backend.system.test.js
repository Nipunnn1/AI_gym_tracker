/**
 * SYSTEM TESTS — the real backend process, end to end
 *
 * Why: unit and integration tests import the app in-process. This layer starts
 * `node server.js` exactly as `npm start` does — its own process, real port,
 * real Postgres, the real 50 MB ONNX model and WebAssembly runtime — and drives
 * it over HTTP with the same payloads the frontend sends. It catches problems
 * the other layers can't: startup/config errors, missing files or native
 * modules, model loading, and whole user journeys across several endpoints.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { assertLocalDatabase } = require('../helpers/safeEnv');

const SERVER_DIR = path.join(__dirname, '..', '..');
const SAMPLE_FOOD = path.join(SERVER_DIR, '..', 'nutrition', 'test_food.jpg'); // idli photo, kept out of git
const PORT = 5600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let serverLog = '';

function startServer() {
    const env = {
        ...process.env,
        PORT: String(PORT),
        DATABASE_URL: `${process.env.TEST_PG_BASE_URL}/gym_system`,
        PGSSLMODE: 'disable',
        GEMINI_API_KEY: '',
    };
    assertLocalDatabase(env.DATABASE_URL);
    server = spawn(process.execPath, ['server.js'], { cwd: SERVER_DIR, env });
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`server did not start:\n${serverLog}`)), 45000);
        const onData = (chunk) => {
            serverLog += chunk;
            if (serverLog.includes(`running on port ${PORT}`)) {
                clearTimeout(timer);
                resolve();
            }
        };
        server.stdout.on('data', onData);
        server.stderr.on('data', onData);
        server.on('exit', (code) => reject(new Error(`server exited with ${code}:\n${serverLog}`)));
    });
}

const api = async (method, url, body) => {
    const res = await fetch(BASE + url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};

const uploadImage = (buffer, filename = 'food.jpg', type = 'image/jpeg') => {
    const form = new FormData();
    form.append('image', new Blob([buffer], { type }), filename);
    return fetch(`${BASE}/api/nutrition/detect`, { method: 'POST', body: form });
};

beforeAll(startServer, 60000);
afterAll(() => {
    if (server && server.exitCode === null) server.kill();
});

describe('startup and configuration', () => {
    test('process boots, connects to Postgres and serves /health', async () => {
        expect(serverLog).toContain('Postgres Connected');
        const { status, body } = await api('GET', '/health');
        expect(status).toBe(200);
        expect(body.status).toBe('active');
    });

    test('ONNX model file ships with the server', async () => {
        const { body } = await api('GET', '/api/nutrition/health');
        expect(body.modelExists).toBe(true);
    });

    test('CORS headers are sent to browsers', async () => {
        const res = await fetch(`${BASE}/health`, { headers: { Origin: 'https://example.com' } });
        expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });
});

describe('user journey: train, save, review progress', () => {
    const user = `system-${Date.now()}`;

    test('saving workouts (WebCamFeed payload) updates history, stats, PRs and leaderboard', async () => {
        // 1. three workouts saved from the webcam screen
        for (const [exerciseId, count, qualityScore, duration] of [['squat', 12, 92, 70], ['squat', 15, 86, 80], ['curl', 10, 98, 40]]) {
            const { status } = await api('POST', '/api/sessions', { userId: user, exerciseId, count, qualityScore, duration });
            expect(status).toBe(201);
        }

        // 2. dashboard loads history
        const list = await api('GET', `/api/sessions?userId=${user}`);
        expect(list.body.total).toBe(3);
        expect(list.body.sessions[0].exerciseId).toBe('curl'); // newest first

        // 3. stats and streak
        const stats = await api('GET', `/api/sessions/stats?userId=${user}`);
        expect(stats.body).toMatchObject({ totalSessions: 3, totalReps: 37, totalDuration: 190, perfectSessions: 2, exercisesCovered: 2 });
        const streaks = await api('GET', `/api/sessions/streaks?userId=${user}`);
        expect(streaks.body).toMatchObject({ currentStreakDays: 1, activeDays: 1 });

        // 4. personal records were updated as a side effect
        const pr = await api('GET', `/api/personal-records/squat?userId=${user}`);
        expect(pr.body).toMatchObject({ maxReps: 15, bestQuality: 92, totalReps: 27, totalSessions: 2 });

        // 5. growth features reflect the new data
        const ghost = await api('GET', `/api/growth/ghost-target?userId=${user}&exerciseId=squat`);
        expect(ghost.body.targetReps).toBe(16);
        const board = await api('GET', '/api/growth/leaderboard');
        expect(board.body.leaderboard.find((r) => r.userId === user)).toMatchObject({ totalReps: 37 });
        const readiness = await api('GET', `/api/growth/readiness?userId=${user}`);
        expect(readiness.body.recentSessionCount).toBe(3);

        // 6. a completed program is logged
        const log = await api('POST', '/api/workout-logs', {
            userId: user, programId: 'beginner_full_body', programName: 'Beginner Full Body',
            totalReps: 37, qualityScore: 92, durationSeconds: 190, exerciseBreakdown: { squat: [12, 15], curl: [10] }, formErrors: {},
        });
        expect(log.status).toBe(201);
        const logStats = await api('GET', `/api/workout-logs/stats?userId=${user}`);
        expect(logStats.body).toMatchObject({ programsCompleted: 1, totalReps: 37 });

        // 7. user deletes a mistaken session
        const del = await api('DELETE', `/api/sessions/${list.body.sessions[0].id}`);
        expect(del.status).toBe(200);
        expect((await api('GET', `/api/sessions?userId=${user}`)).body.total).toBe(2);
    });

    test('data is isolated between users', async () => {
        const other = await api('GET', `/api/sessions/stats?userId=someone-else-${Date.now()}`);
        expect(other.body.totalSessions).toBe(0);
    });

    test('every endpoint the Dashboard calls on load answers 200 with JSON', async () => {
        const urls = [
            '/api/sessions', '/api/sessions/achievements', '/api/sessions/trends', '/api/growth/daily-mission',
            '/api/growth/comeback-plan', '/api/growth/leaderboard', '/api/growth/readiness',
            '/api/growth/smart-plan?goal=balanced', '/api/growth/monetization-signals', '/api/growth/ghost-target?exerciseId=squat',
            '/api/coaching/advice',
        ];
        const results = await Promise.all(urls.map((u) => api('GET', u)));
        results.forEach((r, i) => expect([urls[i], r.status]).toEqual([urls[i], 200]));
    });

    test('handles a burst of concurrent saves without losing sessions', async () => {
        const burstUser = `burst-${Date.now()}`;
        const responses = await Promise.all(
            Array.from({ length: 20 }, (_, i) => api('POST', '/api/sessions', { userId: burstUser, exerciseId: `ex${i}`, count: 5, qualityScore: 90, duration: 30 }))
        );
        expect(responses.every((r) => r.status === 201)).toBe(true);
        expect((await api('GET', `/api/sessions/stats?userId=${burstUser}`)).body.totalSessions).toBe(20);
    });

    // KNOWN DEFECT (reproduced 3/3 runs: 10 parallel saves → totalSessions 2-3):
    // updatePersonalRecords() in routes/sessions.js does read → modify in JS →
    // save, so concurrent requests overwrite each other's totals (lost update).
    // The live frontend sends no userId, so all anonymous visitors share one PR
    // row per exercise, which makes this reachable in production. Fix with an
    // atomic UPDATE (increment / GREATEST) or a row lock inside a transaction.
    test.failing('concurrent saves for the same exercise keep personal-record totals consistent', async () => {
        const raceUser = `race-${Date.now()}`;
        await Promise.all(
            Array.from({ length: 10 }, () => api('POST', '/api/sessions', { userId: raceUser, exerciseId: 'squat', count: 5, qualityScore: 90, duration: 30 }))
        );
        const pr = await api('GET', `/api/personal-records/squat?userId=${raceUser}`);
        expect(pr.body).toMatchObject({ totalSessions: 10, totalReps: 50 });
    });
});

describe('food photo → nutrition (real ONNX model)', () => {
    test('a plain image runs through the full model pipeline', async () => {
        const blank = await sharp({ create: { width: 480, height: 360, channels: 3, background: '#808080' } }).jpeg().toBuffer();
        const started = Date.now();
        const res = await uploadImage(blank);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(Array.isArray(body.detections)).toBe(true);
        expect(Date.now() - started).toBeLessThan(30000); // includes cold model load
    }, 60000);

    test('PNG with alpha channel is accepted', async () => {
        const png = await sharp({ create: { width: 200, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const res = await uploadImage(png, 'food.png', 'image/png');
        expect(res.status).toBe(200);
    });

    test('corrupt image bytes give a clean 500, and the server stays up', async () => {
        const res = await uploadImage(Buffer.from('definitely not a jpeg'));
        expect(res.status).toBe(500);
        expect((await res.json()).success).toBe(false);
        expect((await api('GET', '/health')).status).toBe(200);
    });

    (fs.existsSync(SAMPLE_FOOD) ? test : test.skip)('recognises idli in a real photo and returns its nutrition', async () => {
        const res = await uploadImage(fs.readFileSync(SAMPLE_FOOD));
        const body = await res.json();
        expect(res.status).toBe(200);
        const idli = body.detections.find((d) => d.food === 'Idli');
        expect(idli).toBeDefined();
        expect(idli.confidence).toBeGreaterThan(0.5);
        expect(idli.nutrition).toMatchObject({ found: true, calories: 137.54 });
        expect(body.detections.filter((d) => d.food !== 'Idli')).toEqual([]); // no false positives
    });

    // Budget, not a benchmark: single-threaded WASM inference measured ~5 s per
    // photo on a laptop. This guards against large regressions only.
    test('warm inference stays within a 10 s budget', async () => {
        const img = await sharp({ create: { width: 640, height: 640, channels: 3, background: '#a0522d' } }).jpeg().toBuffer();
        const started = Date.now();
        expect((await uploadImage(img)).status).toBe(200);
        expect(Date.now() - started).toBeLessThan(10000);
    });
});
