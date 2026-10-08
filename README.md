# InterviewPilot — AI Mock Interview Platform

InterviewPilot runs realistic mock software-engineering interviews. An AI interviewer works through a
structured question plan built from your role, interview type and chosen topics, probes your answers
with follow-ups, and finishes with a rubric-based report that explains every score: what you did well,
what you missed, and what a stronger answer would have contained.

```
frontend/   Next.js 16, React 19, TypeScript, Tailwind, Clerk
backend/    NestJS 11, Prisma, PostgreSQL, any OpenAI-compatible model (OpenAI or local via Ollama)
```

## What it does

| Area | What is implemented |
|------|---------------------|
| Interview setup | Role, experience, type (Technical, HR, Behavioral, Engineering management, Mixed), difficulty, interviewer personality, technical topics, optional resume context, exam mode |
| Interview engine | Deterministic question plan per interview; the model phrases questions and decides on follow-ups within a per-personality budget; visible progress (“Question 3 of 6 · React”); the interviewer closes the interview when the plan is done |
| Answers | Text, or voice via the browser’s speech recognition; interviewer replies stream token by token and can be read aloud |
| Evaluation | Anchored 1–5 rubric per dimension with rationale and evidence, per-question feedback with a stronger-answer outline, deterministic overall score and readiness (see below) |
| Coding round | Monaco editor, JavaScript/TypeScript executed in a sandbox against visible and hidden tests, per-problem progressive hints; the best run per problem feeds the report |
| Progress | Dashboard with score trend, readiness, streak, practice time, and weak areas that carry into your next interview plan |
| Resume | PDF/DOCX/TXT upload, text extraction, AI summary; the interviewer asks about your actual projects |
| Exam mode | No hints; focus changes and pastes are recorded and shown (not scored) in the report |

## How an interview works

1. **Plan.** When an interview starts, the backend builds a plan deterministically
   (`backend/src/interviews/interview-plan.ts`): e.g. a Technical interview is a resume deep-dive (if a
   resume is available) plus questions rotating through your topics, each with a different angle (core
   concepts, applied problem, trade-offs, debugging). Behavioral and management interviews draw from a
   fixed set of competencies (Ownership, Conflict Resolution, Decision Making, …). Areas you previously
   struggled with are scheduled first.
2. **Turns.** For every answer the model receives the plan, where the interview currently is, and which
   moves are allowed. It must start its reply with a control tag — `[[FOLLOW_UP]]`, `[[NEXT]]` or
   `[[END]]` — that the server strips from the stream and uses to advance the plan. The server enforces
   the follow-up budget (1–3 per question depending on the personality), so the model cannot loop on one
   topic or end early.
3. **Completion.** When the plan is done the interviewer wraps up and the UI offers to generate the
   report. You can also end early; an interview with no answers is closed without a report.

### Reliability guarantees for a live session

- An answer and its reply are saved atomically **before** the stream is confirmed, so a refresh never
  loses a turn.
- Every answer carries a client-generated id. If the connection drops and the candidate retries, the
  server replays the saved reply instead of creating a duplicate turn.
- If the model fails (outage, timeout, a stream that stalls for 20s, empty output), nothing is saved and
  the answer stays in the input box with a Retry button.
- Concurrent writes (two tabs, a double-submit, ending while a reply streams) are rejected with `409`
  and guarded in the database by optimistic concurrency on the interview row.
- Report generation is idempotent. If the evaluator returns unusable output it is retried once and
  otherwise fails with `503` — the interview stays open and nothing fabricated is stored.
- The interview timer is derived from the server’s start time, so it survives a refresh.

## How scoring works

The evaluator model rates each applicable dimension, and each answered question, on an anchored scale:

| Rating | Meaning |
|--------|---------|
| 1 | No meaningful answer, “I don’t know”, off-topic, or fundamentally wrong |
| 2 | Partial answer with major gaps or errors |
| 3 | Adequate — core idea correct, meets the baseline for the level, lacks depth |
| 4 | Strong — correct and well reasoned, minor gaps |
| 5 | Exceptional — complete, precise, insightful trade-offs |

Every rating must come with a rationale and evidence from the transcript. The output is validated
(`backend/src/interviews/evaluation.ts`) and all headline numbers are then computed by the server:

- **Dimension score** = rating × 20.
- **Coding score** = mean over attempted problems of the best pass rate — measured by tests, never by the model.
- **Overall score** = weighted mean of the dimensions that were assessed. Dimensions that do not apply
  are left empty rather than given a made-up value (an HR screen has no technical score).

| Type | Weights (relative) |
|------|--------------------|
| Technical | technical 35 · problem solving 25 · communication 15 · composure 10 · system design 15* · coding 20* |
| Mixed | technical 25 · problem solving 15 · experience/impact 15 · communication 15 · composure 10 · system design 10* · coding 15* |
| Behavioral | experience/impact 40 · communication 25 · judgment 20 · composure 15 |
| HR | communication 35 · experience/impact 35 · composure 30 |
| Engineering management | experience/impact 30 · judgment 25 · technical 15 · communication 20 · composure 10 |

\* only when a design question was answered / a coding problem was attempted.

- **Readiness** = overall score × share of planned questions answered. Stopping after 3 of 6 questions
  caps readiness at half the overall score.
- **Weak areas** use a closed vocabulary (the technical topics plus competencies). A rating ≤ 2 on a
  question adds a strike to its topic and a rating ≥ 4 removes one, so improved areas drop out of the
  practice plan and the next interview plan.

## Security

- **Authentication** is enforced globally (`APP_GUARD`); only `/api/health` is public. Identity comes
  from the verified Clerk token (`sub`) with an `azp` check against the frontend origin.
- **Isolation.** Every query is scoped to the authenticated user; another user’s interview id returns
  `404`. The integration suite checks this for every interview endpoint.
- **Rate limiting** per user (`@nestjs/throttler`), with tighter limits on AI and code-execution routes.
- **Prompt injection.** Topics are validated against a fixed list; candidate answers and resume text
  are passed as delimited, untrusted data; the evaluator is instructed to ignore instructions in the
  transcript, and the headline numbers are computed server-side from validated ratings.
- **Code execution** runs in a worker thread with memory limits and a hard timeout, inside a `vm`
  context with string code generation disabled and no host objects. Hidden test inputs, expected
  values, outputs and error messages are never returned to the client.
- **Errors** are returned as consistent JSON without stack traces or provider details. Secrets live
  only in `.env` files, which are git-ignored.

## Getting started

Prerequisites: Node.js 20.9+, PostgreSQL 14+, a [Clerk](https://clerk.com) application, and either an
OpenAI API key or a local model server such as [Ollama](https://ollama.com).

```bash
cp backend/.env.example backend/.env          # DATABASE_URL, CLERK_SECRET_KEY, model settings
cp frontend/.env.example frontend/.env.local  # Clerk publishable key, API URL

cd backend
npm install
npm run db:deploy       # apply migrations (use `npm run db:migrate` while changing the schema)
npm run start:dev       # http://localhost:3001

cd ../frontend
npm install
npm run dev             # http://localhost:3000
```

### Running without a paid API

Any OpenAI-compatible endpoint works. With Ollama:

```bash
ollama pull llama3.1
# backend/.env
OPENAI_BASE_URL="http://localhost:11434/v1"
AI_MODEL="llama3.1"
# OPENAI_API_KEY can be omitted
```

Use an instruction-tuned, **non-reasoning** model. Reasoning models (e.g. `qwen3`) spend the output
budget on hidden thinking; the app detects the resulting empty replies and shows a retryable error, but
interviews will not progress. Smaller local models also follow the reply protocol less reliably than
hosted models; the server compensates (an untagged reply counts as a follow-up and the budget forces
progress), but question quality depends on the model.

### Environment variables

| Variable | Where | Required | Purpose |
|----------|-------|----------|---------|
| `DATABASE_URL` | backend | yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | backend, frontend | yes | Clerk server key |
| `OPENAI_API_KEY` | backend | unless `OPENAI_BASE_URL` is set | Hosted OpenAI key |
| `OPENAI_BASE_URL` | backend | no | OpenAI-compatible endpoint, e.g. Ollama |
| `AI_MODEL` | backend | no | Model name (default `gpt-4o-mini`) |
| `FRONTEND_URL` | backend | in production | CORS origin and accepted token audience |
| `PORT` | backend | no | API port (default 3001) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | yes | Clerk publishable key |
| `NEXT_PUBLIC_API_URL` | frontend | no | API base URL (default `http://localhost:3001`) |

## API

All routes are under `/api` and require `Authorization: Bearer <Clerk token>` except the health check.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + database check (public) |
| GET | `/interviews/config` | Options for the setup form |
| POST | `/interviews` | Start an interview (builds the plan, returns the opening question) |
| GET | `/interviews` | List your interviews |
| GET | `/interviews/:id` | Transcript, plan agenda, progress, report, coding runs, events |
| POST | `/interviews/:id/message` | Answer; SSE stream of `{content}` deltas, then `{turn}` or `{error}`, then `[DONE]`. Send `clientMessageId` for idempotent retries |
| POST | `/interviews/:id/complete` | End and evaluate (idempotent) → `{status, report}` |
| POST | `/interviews/:id/events` | Record an exam-mode event |
| POST | `/interviews/:id/coding` | Run and record a coding attempt |
| POST | `/resume/upload` | Upload a resume (PDF/DOCX/TXT, ≤5MB) |
| GET | `/resume`, `/resume/active` | Your resumes / the active one |
| GET | `/dashboard` | Aggregated progress |
| GET | `/coding/problems`, `/coding/problems/:id` | Problem catalog (hidden tests stripped) |
| POST | `/coding/run` | Practice run outside an interview |

## Testing

```bash
cd backend
npm test                 # unit tests: plan, reply protocol, scoring, sandbox, env validation
TEST_DATABASE_URL=postgresql://... npm run test:e2e
                         # HTTP + PostgreSQL integration: lifecycle, retries, concurrency,
                         # data isolation, AI failures, rate limits (truncates tables — use a
                         # disposable database)
npm run lint:check && npm run typecheck && npm run build

cd ../frontend
npm test                 # SSE parsing and the streaming client contract
npm run lint && npm run typecheck && npm run build
```

The language model is replaced by a scripted fake in tests, so no API key is needed. GitHub Actions
(`.github/workflows/ci.yml`) runs all of the above against a PostgreSQL service, and also verifies that
the migrations match `schema.prisma`.

## Deployment

- **Backend**: any Node host (Railway, Render, Fly). Run `npm run db:deploy` on release, set
  `NODE_ENV=production` and `FRONTEND_URL`.
- **Frontend**: Vercel or any Next.js host.
- **Database**: managed PostgreSQL (Neon, Supabase, Railway).

## Known limitations

- Rate limits and the in-flight-turn guard are in memory, per instance. Multiple API instances stay
  correct (the database guards prevent duplicate or interleaved turns), but limits are per instance and
  a second instance can start a duplicate model call. A shared store (Redis) would fix both.
- Only JavaScript and TypeScript are executed. The coding catalog is small (four problems).
- Voice input relies on the browser’s speech recognition (Chrome/Edge); there is no server-side speech-to-text.
- Exam-mode signals (window blur, paste) are easy to evade and are informational only.
- Scores come from a single evaluator call. The rubric, validation and deterministic aggregation make
  them explainable and stable, but repeated evaluations of the same transcript can still differ by a
  rating point on some dimensions.
- The daily streak uses the server’s time zone.

## Roadmap

- Shared rate-limit / lock store for multi-instance deployments
- More coding problems; Python execution via an isolated runner (e.g. Piston)
- Evaluation calibration set: graded transcripts used as a regression test for prompt changes
- Interview history pagination

## License

MIT © SantoshThkr — see [LICENSE](LICENSE).
