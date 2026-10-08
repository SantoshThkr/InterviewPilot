# InterviewPilot API

NestJS + Prisma + PostgreSQL backend: authentication, the interview engine, evaluation, resume
parsing, the coding sandbox, and dashboard aggregation. See the [root README](../README.md) for how
interviews and scoring work.

## Setup

```bash
cp .env.example .env      # DATABASE_URL, CLERK_SECRET_KEY, OPENAI_API_KEY or OPENAI_BASE_URL
npm install
npm run db:deploy         # apply migrations
npm run start:dev         # http://localhost:3001
```

Configuration is validated at boot (`src/common/env.validation.ts`): `DATABASE_URL`, `CLERK_SECRET_KEY`,
and either `OPENAI_API_KEY` or `OPENAI_BASE_URL` are required; `FRONTEND_URL` is required when
`NODE_ENV=production`. Optional: `AI_MODEL` (default `gpt-4o-mini`), `PORT` (default 3001).

## Module map

| Path | Responsibility |
|------|----------------|
| `auth/` | Global Clerk token guard, `@Public()`, per-user rate-limit tracker |
| `interviews/interview-plan.ts` | Deterministic question plan, turn state, allowed moves (pure) |
| `interviews/turn-protocol.ts` | Strips the `[[FOLLOW_UP]]/[[NEXT]]/[[END]]` tag from the streamed reply (pure) |
| `interviews/evaluation.ts` | Rubric, validation of evaluator output, deterministic scoring, weak-area deltas (pure) |
| `interviews/interviews.service.ts` | Lifecycle: create, idempotent streamed turns, completion, events, coding attempts |
| `ai/chat-provider.ts` | The single model seam (any OpenAI-compatible API), with timeouts and stream stall detection |
| `ai/prompts.ts` | Every prompt, with untrusted input delimited |
| `ai/ai.service.ts` | Opening (with deterministic fallback), turn streaming, evaluation with retry, resume analysis |
| `coding/` | Problem catalog with hints, sandboxed runner (JS/TS), hidden-test redaction |
| `resume/` | Upload, text extraction (PDF/DOCX/TXT), analysis |
| `dashboard/` | Aggregated stats from real data |
| `common/` | Exception filter, SSE writer, health check, env validation |

## Database

Migrations live in `prisma/migrations` and are the source of truth (`npm run db:migrate` to create one
while developing, `npm run db:deploy` to apply). Interview plans and per-message turn metadata are
stored in existing JSON columns (`Interview.config`, `InterviewMessage.metadata`); reports store their
per-dimension and per-question breakdown in `InterviewReport.dimensions` / `questionFeedback`.

## Code execution safety

`CodingService` runs candidate code in a worker thread. Inside the worker each test case executes in a
fresh `vm` context created with `codeGeneration: { strings: false }` and no host objects in scope, so the
classic realm escape (`Object.constructor('return this')()`) throws instead of reaching the host. The
worker has strict `resourceLimits` and is force-terminated on timeout. `node:vm` alone is not a security
boundary — the worker isolation is what makes running untrusted input safe. TypeScript is transpiled
with the real compiler before running. Only JavaScript and TypeScript are accepted.

## Testing

```bash
npm test                                   # unit tests (no database or API key)
TEST_DATABASE_URL=postgresql://... npm run test:e2e   # integration tests; truncates tables
npm run lint:check
npm run typecheck
npm run build
```

The integration suite boots the full `AppModule` over HTTP against PostgreSQL with a scripted fake
model and a mocked Clerk verifier (the real guard still runs). It covers the interview lifecycle, SSE
framing, idempotent retries, concurrent answers and completions, AI failures and malformed evaluator
output, per-user data isolation on every interview endpoint, and rate limiting.
