# Brainosaur

Full-stack student learning analytics app with:
- Existing Node backend (`server.js`) and `/api/*` endpoints preserved
- New Figma-exported React/Vite UI integrated from ZIP (`src/`)

## Run

Install dependencies:
```bash
npm install
```

Run backend (API):
```bash
npm run dev:api
```

Run new frontend UI:
```bash
npm run dev:ui
```

Open UI at:
- `http://localhost:5173`

Optional single server static build:
```bash
npm run build:ui
npm run dev:api
```
Then open `http://localhost:3000`.

## Environment

Create `.env` from `.env.example`:
```bash
cp .env.example .env
```

Set:
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-4.1-mini` (or your preferred model)
- `PORT=3000`
- `HOST=127.0.0.1`

## Preserved Backend Endpoints

All original endpoints are kept:
- `GET /api/state`
- `POST /api/profile`
- `POST /api/study-session/start`
- `POST /api/study-session/stop`
- `POST /api/tab-event`
- `POST /api/quiz/submit`
- `GET /api/quizzes/due`
- `POST /api/exam-plan`
- `POST /api/insights/generate`

Added for new UI support:
- `POST /api/topic/add`
- `GET /api/readiness`

## UI-to-API Mapping

- Onboarding/Profile save -> `/api/profile`
- Start/stop study session -> `/api/study-session/start|stop`
- Tab/focus logging -> `/api/tab-event`
- Topic quiz submit -> `/api/quiz/submit`
- Spaced repetition queue -> `/api/quizzes/due` + topic review dates
- Exam planning/readiness -> `/api/exam-plan` + `/api/readiness`
- AI action plan -> `/api/insights/generate`

## Notes

- If API key is missing, insights fall back to heuristic mode.
- Backend serves built `dist/` first (if present), otherwise `public/` fallback page.
