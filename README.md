# LearnPulse AI (Hackathon MVP)

A full-stack MVP for your prompt:
- Learning state model per module/topic
- Weekly + spaced repetition quiz logic
- Retention decay + learning gain update
- Burnout risk + focus efficiency scoring
- Exam readiness prediction
- OpenAI-powered actionable insights

## Quick Start

1. Create env file:
```bash
cp .env.example .env
```

2. Add your OpenAI API key in `.env`.

3. Run app:
```bash
npm run dev
```

4. Open:
`http://localhost:3000`

## OpenAI Integration Walkthrough

The integration is server-side in `server.js` via `/api/insights/generate`.

### 1) Store secrets on backend
- Use `OPENAI_API_KEY` in `.env`
- Never expose this key in frontend code

### 2) Send structured student state to the model
`buildInsightsWithOpenAI()` sends:
- topic mastery + decay-adjusted mastery
- recent quiz attempts
- focus/distraction/help events
- burnout/focus metrics
- exam readiness

### 3) Force actionable output shape
Prompt asks for strict JSON:
- `summary` (string)
- `actions` (array of 5 concrete tasks)

### 4) Fallback logic if API unavailable
If key is missing or parse fails, app returns heuristic recommendations so demo still works.

## Data Model (stored in `data/app-data.json`)

- `profile`: university, year, course, module list
- `modules[moduleName].topics[topicName]`
  - `mastery`, `estimatedMasteryNow`, `lastQuizAt`, `nextReviewAt`, `history`
- `studySessions`: start/stop timestamps
- `tabEvents`: URL + event type (`learning/help/distraction/neutral`)
- `quizAttempts`: pre/post scores, confidence, AI usage, suggested next quiz type
- `examPlans`: exam date + coverage

## Scoring Formulas Used

- Learning gain:
`(postQuizScore - preQuizScore) / (100 - preQuizScore)`

- Mastery update:
`newMastery = oldMastery + gain*2.5 + confidenceAdj + aiAdj - retentionDecay`

- Retention decay:
`daysSinceLastInteraction * 0.04 * ((11 - mastery)/10)` capped at `2.5`

- Burnout risk (0-100):
combines long sessions, unstable scores, and downward performance trend

- Focus efficiency (0-100):
weighted mix of focused-tab ratio + quiz accuracy

- Exam readiness (0-100):
weighted mix of mastery mean, topic coverage, and time pressure

## What to Improve Next (for judging)

1. Real browser tab tracking
- Build a Chrome extension to emit tab events to `/api/tab-event`
- Keep this explicit and consent-based

2. Better quiz generation
- Add `/api/quiz/generate` with OpenAI JSON schema output
- Pull from module/topic notes or LMS exports

3. Careless vs conceptual error detector
- Add question-level metadata: error type, response time, confidence mismatch

4. Long-term adaptation
- Add per-student drift detector and weekly model re-baseline

## Resource Use Recommendation

From your provided resources, the most useful for this project:
- OpenAI Cookbook (best practices for structured outputs + evals)
- Azure OpenAI Chat Baseline (if you need enterprise deployment quickly)
- Weights & Biases Weave (if you want traceable experiments/evaluations)

Most other links are generic/alternative-model ecosystems and not needed for a hackathon MVP unless you pivot stacks.
