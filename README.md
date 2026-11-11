# 🏋️ AI Gym Tracker – Real-Time Exercise Tracking & Nutrition Assistant

An AI-powered fitness app that counts reps and checks exercise form from a webcam in real time, and identifies food from a photo to return its nutritional values. It is deployed in production on Vercel with a managed Postgres database on Supabase and continuous deployment from GitHub.

**Live app:** https://ai-gym-trainer-gamma.vercel.app
**Live API:** https://ai-gym-trainer-backend.vercel.app/health

---

## ✨ Features

### 💪 Real-Time Exercise Tracking
- Pose estimation in the browser with **MediaPipe Pose**, so video never leaves the user's device.
- Rep counting for 12 exercises: squat, push-up, lunge, bicep curl, overhead press, lateral raise, tricep extension, calf raise, crunch, leg raise, high knees and jumping jacks.
- Form checks computed from joint angles (for example knee cave, hip sag, back arch, partial reps and elbow drift), feeding a per-session quality score.
- Sessions, personal records, streaks, achievements and trends are stored in Postgres.

### 🍎 AI Food Detection + Nutrition Lookup
- A custom-trained **YOLO** model detects 12 food classes (Apple, Chapathi, Chicken Gravy, Fries, Idli, Pizza, Rice, Soda, Tomato, Vada, Banana, Burger).
- The model is exported to **ONNX** and runs inside the Node.js API, so no Python runtime is needed in production.
- Each detected food is matched against an Indian food nutrition dataset to return calories, protein, carbohydrates and fats.

### 📈 Progress and Motivation
- Daily missions, comeback plans, readiness scores, "ghost" targets from past performance and a leaderboard.
- Optional AI coaching advice and program generation (requires a `GEMINI_API_KEY`; not enabled in the live deployment).

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Computer vision (browser) | MediaPipe Pose, custom biomechanics and rep-counting logic |
| Backend API | Node.js, Express 5 |
| Database | PostgreSQL 17 on Supabase, accessed via Sequelize ORM |
| Food detection | YOLO (Ultralytics) → ONNX, run with `onnxruntime-web` (WebAssembly) and `sharp` for image preprocessing |
| Hosting | Vercel (frontend and backend as separate projects) |
| CI/CD | GitHub → Vercel Git integration (preview deploys on branches, production on `main`) |
| Testing | Jest, Supertest |

---

## 🧠 System Architecture

```text
 ┌──────────────────────────── Browser ────────────────────────────┐
 │  Next.js dashboard                                               │
 │  Webcam → MediaPipe Pose → rep counter + form checks (on-device) │
 └───────────────┬──────────────────────────────────┬───────────────┘
                 │ session data (JSON)              │ food photo (multipart)
                 ▼                                  ▼
 ┌────────────────────────── Express API (Vercel, sin1) ───────────┐
 │  /api/sessions, /api/personal-records,      /api/nutrition/detect│
 │  /api/workout-logs, /api/growth              │                   │
 │            │                                 ▼                   │
 │            │                     YOLO (ONNX) via onnxruntime-web │
 │            │                                 │                   │
 │            │                                 ▼                   │
 │            │                     Nutrition lookup (CSV dataset)  │
 └────────────┼─────────────────────────────────────────────────────┘
              ▼
 ┌──────────────────────────────┐
 │ Supabase Postgres (Singapore)│
 │ via transaction pooler :6543 │
 └──────────────────────────────┘
```

Pose estimation runs on the client to keep latency low and video private. The server handles only persistence and food detection.

---

## 🚀 Deployment and Operations

This project is deployed the way I would deploy for a client: reproducible environments, managed infrastructure, least-privilege access and automated releases.

| Area | Setup |
|---|---|
| Frontend | Vercel project `ai-gym-trainer` (Next.js preset) |
| Backend | Vercel project `ai-gym-trainer-backend` (root directory `server/`; Express app exported as a serverless function) |
| Region | Backend functions pinned to `sin1` (Singapore) to sit next to the database and cut query latency |
| Database | Supabase Postgres, connected through the transaction-mode pooler, which suits short-lived serverless connections |
| Access control | Backend uses a dedicated `ai_gym_app` database role that owns only the app's tables; row-level security is enabled so the public Supabase Data API cannot read them |
| Secrets | Stored as Vercel environment variables (marked sensitive), never committed |
| CI/CD | Push to a branch → preview deployment; merge to `main` → production deployment |
| Releases | New features are verified on a preview URL before being merged to `main` |

### Engineering decisions and trade-offs

| Problem | Constraint | Decision | Trade-off |
|---|---|---|---|
| Food detection ran a local Python script with a Windows-only path | Vercel's Node runtime has no Python, and a PyTorch install is far beyond function size limits | Exported YOLO to ONNX and reimplemented letterbox preprocessing and NMS in JavaScript | Roughly 6–10 s per photo on a single CPU core; results match the Python version (same label, confidence within 0.2%) |
| ONNX export doubled the model to 104 MB | GitHub rejects files over 100 MB | Stored weights in fp16 with cast nodes, restoring fp32 at load time (52 MB) | No accuracy loss, since the original weights were already fp16 |
| `onnxruntime-node` ships native binaries for every OS (294 MB) | Serverless bundle size limits | Used `onnxruntime-web` (WebAssembly, 14 MB runtime) | Slower than native inference, but portable to any Node host |
| The server exited if the database was down and wrote uploads to disk | Serverless functions are stateless with a read-only filesystem | Lazy, cached DB connection with a 503 fallback; uploads kept in memory | The first request after a cold start pays the connection cost |
| Local Postgres with existing user data | Data had to move to a managed database without loss | `pg_dump` → single-transaction load into Supabase, with sequences preserved and row counts verified | One-off migration; future schema changes still go through Sequelize |

### Adapting to a client's stack

The components are decoupled, so each piece can be swapped for whatever a client already runs:

| Component | Current | Swaps cleanly to |
|---|---|---|
| Database | Supabase Postgres | Any Postgres (AWS RDS/Aurora, Google Cloud SQL, Azure Database, Neon) by changing `DATABASE_URL` |
| API hosting | Vercel Functions | AWS Lambda, Google Cloud Run, Azure Functions/App Service or a Docker container (the Express app is exported and also runs with `node server.js`) |
| Model runtime | `onnxruntime-web` in Node | ONNX Runtime for Python, C#, Java or native Node; TensorRT/OpenVINO for GPU or edge; or in the browser |
| Frontend | Vercel | Any Node host or static/CDN hosting; the API URL is set by `NEXT_PUBLIC_API_URL` |

---

## 📂 Project Structure

```text
AI_gym_tracker/
├── src/                          # Next.js frontend
│   ├── app/                      # App Router pages and layout
│   ├── components/
│   │   ├── Dashboard.tsx         # Main dashboard and nutrition UI
│   │   └── WebCamFeed.tsx        # Webcam + MediaPipe pose tracking
│   └── lib/
│       ├── biomechanics.ts       # Joint angles, alignment, symmetry
│       ├── repCounter.ts         # Exercise definitions, rep and form logic
│       ├── workoutPrograms.ts    # Guided workout programs
│       └── streaks.ts, workoutTimer.ts, obsessionEngine.ts
│
├── server/                       # Express API (deployed as its own Vercel project)
│   ├── server.js                 # App setup; exported for serverless, listens locally
│   ├── db/index.js               # Sequelize connection (DATABASE_URL or PG_* vars)
│   ├── models/                   # Session, WorkoutLog, PersonalRecord
│   ├── routes/                   # sessions, workoutLogs, personalRecords, growth, coaching, nutrition
│   ├── services/
│   │   ├── foodDetector.js       # ONNX YOLO inference: letterbox, run, NMS
│   │   ├── nutritionLookup.js    # CSV nutrition matching
│   │   └── aiCoach.js            # Optional Gemini coaching
│   ├── ml/food.onnx              # Exported food detection model
│   ├── tests/                    # Jest + Supertest
│   └── vercel.json               # Function region
│
├── nutrition/
│   ├── data/Indian_Food_Nutrition_Processed.csv
│   ├── best.pt                   # Original YOLO weights (source for ONNX export)
│   ├── yolo.py                   # Original Python inference script (reference only)
│   └── test_food.jpg             # Sample image for testing
│
└── .vercelignore                 # Keeps model weights and local files out of deploy uploads
```

---

## ⚙️ Running Locally

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL (local) or a connection string to a hosted Postgres database

Python is **not** required. Food detection runs in Node.

### 1. Clone and install

```bash
git clone https://github.com/Nipunnn1/AI_gym_tracker.git
cd AI_gym_tracker
npm install            # frontend
cd server && npm install && cd ..
```

### 2. Configure environment variables

`server/.env`:

```env
PORT=5000
# Either a full connection string...
DATABASE_URL=postgresql://user:password@host:6543/postgres
PGSSLMODE=require
# ...or local connection parts
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=postgres
PG_USER=postgres
PG_PASSWORD=your_password
# Optional: AI coaching
GEMINI_API_KEY=
```

`.env.local` (frontend, optional; defaults to `http://localhost:5000`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Tables are created automatically on first start (`sequelize.sync()`).

### 3. Start both apps

```bash
cd server && npm run dev     # API on http://localhost:5000
npm run dev                  # in another terminal, from the project root: frontend on http://localhost:3000
```

---

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Service health |
| GET / POST | `/api/sessions` | List or save exercise sessions |
| GET | `/api/sessions/stats`, `/streaks`, `/achievements`, `/trends`, `/history`, `/by-exercise` | Session analytics |
| GET / POST | `/api/workout-logs` | Guided workout program logs |
| GET | `/api/personal-records` | Personal records per exercise |
| GET | `/api/growth/daily-mission`, `/readiness`, `/comeback-plan`, `/leaderboard`, `/smart-plan` | Motivation and planning |
| POST | `/api/nutrition/detect` | Upload a food photo (`multipart/form-data`, field `image`) and get detections with nutrition |
| GET | `/api/nutrition/health` | Confirms the model file is present |

Example:

```bash
curl -F "image=@nutrition/test_food.jpg" https://ai-gym-trainer-backend.vercel.app/api/nutrition/detect
```

```json
{
  "success": true,
  "detections": [
    {
      "food": "Idli",
      "confidence": 0.9341,
      "nutrition": { "found": true, "calories": 137.54, "protein": 4.64, "carbohydrates": 28.18, "fats": 0.33 }
    }
  ]
}
```

---

## 🧪 Testing

220 tests in three layers: unit, integration (against a throwaway local Postgres 17) and system (the real server process, the real ONNX model and the production Next.js build). No Docker or local Postgres needed.

```bash
npm test                          # frontend unit tests (src/lib)
npm run test:system               # next build + frontend system tests
cd server && npm test             # backend unit + integration + system
npm run test:all                  # everything (from the repo root)
```

See [TESTING.md](TESTING.md) for why each layer exists, what it covers, and the defects the tests found.

---

## ⚠️ Limitations

- Food detection covers 12 trained classes and identifies the food type, not portion size, so nutrition values are per dataset entry, not per plate.
- Food inference takes several seconds per photo on serverless CPU.
- Exercise tracking accuracy depends on lighting, camera angle and full-body visibility.
- The app is single-user: there is no authentication yet, and sessions are not tied to accounts.

## 🔮 Roadmap

- User accounts with Supabase Auth and per-user row-level security policies.
- Portion-size estimation and daily nutrition summaries.
- Model evaluation report (precision, recall, mAP) and more food classes.
- Faster inference, either by moving detection to the browser (ONNX Runtime Web with WebGPU) or by using a GPU-backed endpoint.

---

## 👨‍💻 Author

**Nipun Kamineni**: [GitHub @Nipunnn1](https://github.com/Nipunnn1)

## 📄 License

No license has been specified yet. Add a `LICENSE` file before presenting the project as open source, and make sure it is compatible with the licenses of the model and dataset.
