# InterviewPilot API

NestJS + Prisma + PostgreSQL backend for InterviewPilot. Handles authentication, interview lifecycle, AI generation, resume parsing, the coding runner, and dashboard aggregation.

## Stack

- **NestJS 11** (REST, SSE streaming)
- **Prisma** ORM on **PostgreSQL**
- **@clerk/backend** for token verification
- **OpenAI** (`gpt-4o-mini`) for interview conversation, reports, and resume analysis

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL, OPENAI_API_KEY, CLERK_SECRET_KEY
npm install
npm run db:generate       # prisma generate
npm run db:push           # sync schema to the database (dev)
npm run start:dev         # http://localhost:3001
```

Required environment variables (validated at boot): `DATABASE_URL`, `OPENAI_API_KEY`, `CLERK_SECRET_KEY`. Optional: `PORT` (default 3001), `FRONTEND_URL` (CORS origin), `NODE_ENV`.

## Module map

| Module | Responsibility |
|--------|----------------|
| `auth` | Clerk token verification guard + `@CurrentUser()` decorator |
| `interviews` | Interview lifecycle, SSE messaging, completion/report, coding submissions |
| `ai` | OpenAI calls (opening, streaming reply, report, resume analysis) + response normalization |
| `coding` | Problem catalog and the sandboxed test runner |
| `resume` | Upload, text extraction (PDF/DOCX/TXT), AI analysis |
| `dashboard` | Aggregated stats from real data |
| `common` | Global exception filter, health check, env validation, request typing |

## Code execution safety

`CodingService` runs candidate code in a worker thread. Inside the worker each test case executes in a fresh `vm` context created with `codeGeneration: { strings: false }` and no host objects in scope, so the classic realm escape (`Object.constructor('return this')()`) throws instead of reaching the host. The worker has strict `resourceLimits` and is force-terminated on timeout. `node:vm` alone is not a security boundary — the worker isolation is what makes running untrusted input safe. Only JavaScript/TypeScript are executed; other languages return an unsupported-language result.

## Testing

```bash
npm test           # unit tests
npm run test:e2e   # health endpoint (Prisma mocked)
npm run lint       # eslint
npm run build      # nest build
```

The unit suite covers sandbox isolation (escape/`require`/timeout), the daily-streak calculation, and AI report/resume normalization — none require a database or an OpenAI key.
