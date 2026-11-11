/**
 * SYSTEM TESTS — the production-built frontend
 *
 * Why: unit tests cover the logic in src/lib, but not whether the app actually
 * compiles, type-checks, bundles (React Compiler, Tailwind 4, MediaPipe) and
 * serves. This runs against the output of `next build` using `next start`, the
 * same artefacts Vercel deploys. Run via `npm run test:system` (builds first).
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS test run directly by Jest */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const PORT = 3600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let log = "";

beforeAll(async () => {
    if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
        throw new Error("No production build found. Run `npm run build` first (npm run test:system does this).");
    }
    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
    server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", "127.0.0.1"], { cwd: ROOT });
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`next start timed out:\n${log}`)), 60000);
        const onData = (c) => {
            log += c;
            if (/ready|started server|Local:/i.test(log)) {
                clearTimeout(timer);
                resolve();
            }
        };
        server.stdout.on("data", onData);
        server.stderr.on("data", onData);
        server.on("exit", (code) => reject(new Error(`next exited with ${code}:\n${log}`)));
    });
}, 90000);

afterAll(() => {
    if (server && server.exitCode === null) server.kill();
});

let html;

test("home page is server-rendered with the main sections", async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    html = await res.text();
    for (const text of ["Live Training Zone", "Performance Analytics", "MediaPipe BlazePose"]) {
        expect(html).toContain(text);
    }
});

test("every JS and CSS asset referenced by the page is served", async () => {
    const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))];
    expect(assets.length).toBeGreaterThan(0);
    const statuses = await Promise.all(assets.map(async (a) => [a, (await fetch(BASE + a)).status]));
    expect(statuses.filter(([, s]) => s !== 200)).toEqual([]);
});

test("unknown routes return the 404 page", async () => {
    expect((await fetch(`${BASE}/definitely-not-a-page`)).status).toBe(404);
});

test("favicon is served", async () => {
    expect((await fetch(`${BASE}/favicon.ico`)).status).toBe(200);
});
