# Testing

The app has three very different kinds of code: pure logic in the browser (pose maths, rep counting), an Express + Postgres API, and an ML pipeline (YOLO → ONNX → nutrition CSV). One kind of test can't cover all three well, so the suite has three layers. Each layer catches a different class of bug.

| Layer | What runs | Count | Time |
|---|---|---|---|
| **Unit** | Single modules, with collaborators mocked | 109 frontend + 25 backend | ~5 s |
| **Integration** | Real Express routes + Sequelize models on a real, throwaway **Postgres 17** | 69 | ~12 s |
| **System** | The real `node server.js` process and the production `next build`, driven over HTTP | 13 backend + 4 frontend | ~25 s + build |

All 220 tests pass. 5 of them are marked `test.failing`: each one records a confirmed defect (see [Defects found](#defects-found)). Once a defect is fixed, Jest reports its test so you can remove the marker.

## How to run

```bash
# frontend
npm test                 # unit tests for src/lib
npm run test:system      # next build + system tests against `next start`
npm run typecheck        # tsc --noEmit

# backend (from server/)
npm test                 # unit + integration + system
npm run test:unit
npm run test:integration
npm run test:system

# everything
npm run test:all         # from the repo root
```

The tests don't need Docker or a Postgres installation. The integration and system layers start an embedded PostgreSQL 17 server (`embedded-postgres`, the same major version as Supabase in production) on a random localhost port, inside a temp directory that's deleted afterwards.

> **Production safety:** `server/.env` contains the production `DATABASE_URL`. `tests/helpers/safeEnv.js` sets every database variable before the app loads (dotenv never overrides a variable that is already set), and it **refuses to run** if the database host isn't `localhost`/`127.0.0.1`. The Gemini key is blanked too, so tests never cost money or call external APIs.

---

## 1. Unit tests: why they're needed

**Purpose:** prove each piece of logic is correct on its own, with fast, deterministic, hand-checkable inputs.

The core feature (counting reps and judging form) is pure maths running ~30 times a second on noisy webcam data. A one-degree mistake in `calculateAngle`, or a missing hysteresis band in the state machine, silently corrupts rep counts, quality scores, personal records and the leaderboard. You can't see these bugs by clicking through the UI, and they're cheap to pin down in isolation.

| File | What it checks |
|---|---|
| `src/lib/biomechanics.test.ts` | 2D/3D joint angles (right, straight, closed, reflex folding, symmetry), distances, midpoints, torso lean, body orientation, landmark extraction, joint visibility, velocity tracking |
| `src/lib/repCounter.test.ts` | Integrity of all 12 exercise configs; the rep state machine in both directions (curl vs overhead press); hysteresis against jitter; partial reps not counted; the ±12° tolerance boundaries; progress; form rules (warnings only near endpoints, errors always), including knee cave, hip sag/pike and body swing |
| `src/lib/workoutPrograms.test.ts` | Every program references real exercises; a full warm-up → sets → rest → next exercise → cool-down → complete walk-through; immutability; summary payload matches the `/api/workout-logs` contract |
| `src/lib/workoutTimer.test.ts` | Countdown, completion, pause/resume and formatting, using a fake clock |
| `src/lib/streaks.test.ts` | Calendar streak logic (gaps, several sessions per day, week/month windows) and achievement thresholds |
| `src/lib/obsessionEngine.test.ts` | Dashboard XP, level, momentum, streak and daily-quest formulas |
| `server/tests/unit/nutritionLookup.test.js` | CSV loads; every row parses into valid macros; case- and whitespace-insensitive matching; empty or unknown names |
| `server/tests/unit/aiCoach.test.js` | Gemini SDK **mocked**: demo mode without a key, prompt contents, JSON extraction from markdown, malformed JSON, API failure |
| `server/tests/unit/foodDetector.test.js` | ONNX runtime **mocked**: letterbox preprocessing (640×640, grey padding, channel order); confidence threshold; per-class NMS; best-class selection; the model loads only once |

## 2. Integration tests: why they're needed

**Purpose:** prove the components work *together*: HTTP routing, request parsing, ORM queries, real SQL and side effects between models.

Most of the API's behaviour lives in database queries: date-window filters (last 72 h, 7, 14 and 30 days), ordering, pagination, JSONB columns, a unique index, and personal records updated as a side effect of saving a session. Mocking the database would hide exactly the bugs that matter here, such as SQL that's wrong, Postgres-specific types, or index violations. So these tests use real Postgres 17 and call the routes through Supertest.

| File | What it checks |
|---|---|
| `sessions.test.js` | Saving with the exact payload `WebCamFeed.tsx` sends; JSONB round-trip; PR create/update (each "best" tracked independently, per user); filters, date range and pagination; stats, streaks, achievements, ISO-week trends, by-exercise and history; delete/404; invalid input stores nothing |
| `recordsAndLogs.test.js` | PR list, get and delete per user; the database enforces one PR per (user, exercise); a workout-log payload shaped like `getWorkoutSummary()`; stats ignore incomplete programs; by-program grouping |
| `growthAndCoaching.test.js` | Daily mission, ghost target, comeback plan, leaderboard, readiness score, smart plan and monetisation signals, each with timestamped data inside and outside its window; coaching in demo mode (production has no Gemini key) |
| `nutrition.test.js` | Upload → detector (stubbed) → CSV lookup; missing file, non-image and >10 MB uploads; detector failure returns a clean 500; checks that the detector's classes match the dataset |
| `app.test.js` | `/health`; CORS for the separately hosted frontend; schema created on first request; 404s; malformed JSON → 400; **database down → 503** (not a crash), and the next request retries |

## 3. System tests: why they're needed

**Purpose:** prove the deployable artefacts work as a whole, the way a user and Vercel run them.

Unit and integration tests import the code in-process. They can't catch startup and configuration errors, files missing from the deployment (the 50 MB ONNX model, WASM binaries, the CSV), broken native modules (`sharp`), or a frontend that fails to compile or bundle. They also don't test the real ML model, and they don't run a user journey that crosses many endpoints.

**Backend:** `server/tests/system/backend.system.test.js` starts `node server.js` as a child process and talks to it only over HTTP.
- Startup: boots, connects to Postgres, model file present, CORS sent to browsers.
- **User journey:** save three workouts → history → stats → streak → personal records → ghost target → leaderboard → readiness → log a program → delete a session.
- Data isolation between users; every endpoint the Dashboard calls on load returns 200 with JSON.
- Load: 20 concurrent saves, none lost.
- **Real ONNX model:** a plain image goes through the full pipeline; PNG with alpha is accepted; corrupt bytes give a clean 500 and the server stays up; **the sample idli photo is recognised as Idli (confidence > 0.5, no false positives) and returns its calories** (this check runs only when `nutrition/test_food.jpg` exists locally, because the photo isn't committed); warm inference stays within a 10 s budget.

**Frontend:** `tests/system/frontend.system.test.js` runs `next build` (TypeScript, React Compiler, Tailwind 4, Turbopack), then `next start`.
- The home page is server-rendered with its main sections.
- Every JS/CSS asset the page references is served (200).
- Unknown routes return 404; the favicon is served.

**Not covered (by design):** a real browser driving the webcam/MediaPipe flow, which would need Playwright and a fake camera feed. The logic behind that flow is covered by the unit tests, and its network contract by the integration and system tests.

---

## Defects found

| # | Severity | Where | Problem | Test |
|---|---|---|---|---|
| 1 | **High** | `server/routes/sessions.js` `updatePersonalRecords` | **Lost updates under concurrency.** The PR row is read, changed in JS, then saved. 10 parallel saves for the same exercise were recorded as only 2–3 sessions (reproduced 3/3 runs). The live frontend sends no `userId`, so all anonymous visitors share one PR row per exercise, which makes this reachable in production. Fix: an atomic `UPDATE … SET total = total + $1, max = GREATEST(max, $2)`, or `SELECT … FOR UPDATE` in a transaction. | system: *concurrent saves … keep personal-record totals consistent* |
| 2 | **High** | Detector ↔ nutrition CSV | **Only 2 of the 12 detectable foods have nutrition data.** Idli and Pizza match; Apple, Chapathi, Chicken Gravy, Fries, Rice, Soda, Tomato, Vada, banana and burger all return "No exact nutritional record was found." Fix: a label → dish-name alias map, or add/rename the CSV rows. | integration: *every food the model can detect has nutrition data* |
| 3 | Low | `src/lib/repCounter.ts` `updateExercise` | Progress is `|down − angle| / range`, so moving *past* the "down" end (e.g. a fully straight arm at 179° when down = 160°) makes the progress bar climb again (~15%). Fix: clamp on the correct side. | unit: *progress stays at 0 when moving past the 'down' endpoint* |
| 4 | Low (latent) | `src/lib/workoutTimer.ts` `tickTimer` | After pause → resume, the countdown jumps back up (it uses `totalSeconds − elapsed` instead of the remaining time at resume). The timer isn't wired into the UI yet. | unit: *resuming after a pause continues from the paused value* |
| 5 | Low (latent) | `src/lib/streaks.ts` `computeStreaks` | The code comment says a streak may continue from yesterday (and the backend and `obsessionEngine` both allow this), but this function returns 0 if the user hasn't trained today. Not used by the UI yet. | unit: *streak continuing until yesterday is still current* |

Other observations (not tracked by a test):
- Invalid input to `POST /api/sessions` and `POST /api/workout-logs` returns **500** instead of **400**. Nothing is stored, but clients can't tell bad input apart from a server error.
- `GET /api/sessions`, the leaderboard and other endpoints return **all users' data** when `userId` is omitted, and the frontend never sends one. That's acceptable for a single-user demo, but it needs auth before real multi-user use.
- Food detection takes **~5 s per photo** on single-threaded WASM, which is noticeable for interactive use.
- `npm run lint` reports 11 existing errors in `Dashboard.tsx`/`WebCamFeed.tsx` (`any` types, `@ts-ignore`, unescaped quotes). They don't affect the build or the tests.
