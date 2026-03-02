# Brainosaur

Full-stack student learning analytics app with:
- React + Vite frontend (`src/`)
- Node API server (`server.js`)
- Supabase-backed user persistence (Postgres + Auth + Storage)
- OpenAI-powered insights and topic quiz generation from uploaded files

## Run Locally

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Fill in `.env` values (especially Supabase + OpenAI).

Start backend:

```bash
npm run dev:api
```

Start frontend:

```bash
npm run dev:ui
```

Or run both together (cross-platform: Windows/macOS/Linux):

```bash
npm run dev:full
```

Open:
- `http://localhost:5173`

## Supabase Setup (Required for account persistence)

1. Create a Supabase project at https://supabase.com.
2. In Supabase, go to `SQL Editor` and run [`supabase/schema.sql`](supabase/schema.sql).
3. In `Authentication > Providers > Email`, enable Email/Password.
4. In `Authentication > Settings`, disable email confirmation for local testing (or keep enabled if you handle verification flow).
5. In `Project Settings > API`, copy:
- `Project URL` -> `SUPABASE_URL`
- `anon public` key -> `SUPABASE_ANON_KEY`
- `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY`
6. Add those to `.env`.
7. Ensure the storage bucket `study-files` exists (the SQL script creates it).
8. Restart backend after changing env vars.

## What Is Persisted Per User

When user signs in with the same email/password (on onboarding), data is loaded from Supabase and restored:
- Profile + modules + topic mastery state
- Study sessions, tab events, quiz attempts
- Uploaded topic documents
- AI-generated quizzes and quiz attempts/results

## Topic Upload + AI Quiz Flow

1. Open a topic page.
2. Use **Upload Documents** to upload topic files.
3. Click **Generate Quiz** to build quiz questions from extracted file text.
4. Submit quiz and review correctness.
5. Refresh/re-login with the same account: documents and quizzes remain available.

## API Endpoints

Existing analytics endpoints:
- `GET /api/state`
- `POST /api/profile`
- `POST /api/study-session/start`
- `POST /api/study-session/stop`
- `POST /api/tab-event`
- `POST /api/topic/add`
- `POST /api/topic/delete`
- `POST /api/quiz/submit`
- `GET /api/quizzes/due`
- `POST /api/exam-plan`
- `GET /api/readiness`
- `POST /api/insights/generate`
- `POST /api/onboarding/persona`

New auth/document/AI-quiz endpoints:
- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/topic/files/upload`
- `GET /api/topic/files?moduleName=...&topicName=...`
- `POST /api/topic/quiz/generate`
- `POST /api/topic/quiz/submit`
- `GET /api/topic/quizzes?moduleName=...&topicName=...`

## Notes

- If Supabase env vars are missing, backend falls back to local file mode (`data/app-data.json`) for development.
- Quiz generation supports `.pdf`, `.docx`, `.pptx`, `.txt`, `.md`, `.csv`, and source code files.
- Quality depends on readable embedded text (scanned/image-only PDFs may still yield limited extraction).
- If OpenAI key is missing, AI insights/quiz generation fall back to heuristic mode where applicable.
