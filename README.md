# InterviewPilot — AI Mock Interview Platform

A full-stack AI-powered interview preparation platform that simulates real software engineering interviews with resume-based questions, live voice mode, coding rounds, adaptive learning, and detailed performance reports.

## Architecture

```
FullstackApp/
├── frontend/     Next.js 16, React, TypeScript, Tailwind, shadcn/ui, Clerk
└── backend/      NestJS, Prisma, PostgreSQL, OpenAI
```

## Features Implemented

| Feature | Status |
|---------|--------|
| Resume upload & AI analysis | ✅ |
| Role, experience, difficulty selection | ✅ |
| Interview types (Technical, HR, Behavioral, Managerial, Mixed) | ✅ |
| 8 interviewer personalities (Google, Amazon, Strict, etc.) | ✅ |
| AI streaming interview with deep follow-ups | ✅ |
| Live voice (speech-to-text + text-to-speech) | ✅ |
| Monaco coding editor with test cases | ✅ |
| Anti-cheating (focus loss, copy/paste detection) | ✅ |
| Performance reports with learning roadmap | ✅ |
| Adaptive weak-area tracking | ✅ |
| Dashboard with scores, streak, practice plan | ✅ |
| Interview history | ✅ |

## Prerequisites

- Node.js 20+
- PostgreSQL database
- [Clerk](https://clerk.com) account
- [OpenAI](https://platform.openai.com) API key

## Setup

### 1. Database

Create a PostgreSQL database and copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/interview_platform"
OPENAI_API_KEY="sk-..."
CLERK_SECRET_KEY="sk_test_..."
FRONTEND_URL="http://localhost:3000"
```

Edit `frontend/.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 2. Backend

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run start:dev
```

API runs at `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000`

## API Endpoints

All endpoints except `/api/health` require a Clerk `Authorization: Bearer <token>` header. The authenticated identity is derived from the verified token — client-supplied user headers are never trusted. Every query is scoped to the authenticated user.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + database check (public) |
| GET | `/api/interviews/config` | Interview configuration options |
| POST | `/api/interviews` | Start new interview |
| GET | `/api/interviews` | List the user's interviews |
| GET | `/api/interviews/:id` | Get interview with messages, report, submissions |
| POST | `/api/interviews/:id/message` | Send answer (SSE stream) |
| POST | `/api/interviews/:id/complete` | End interview & generate report (idempotent) |
| POST | `/api/interviews/:id/events` | Record a proctoring event |
| POST | `/api/interviews/:id/coding` | Submit a coding attempt |
| POST | `/api/resume/upload` | Upload resume (PDF/DOCX/TXT, ≤5MB) |
| GET | `/api/resume` | List uploaded resumes |
| GET | `/api/resume/active` | Get the active resume |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/coding/problems` | List coding problems |
| GET | `/api/coding/problems/:id` | Get one problem (hidden tests stripped) |
| POST | `/api/coding/run` | Run code against test cases |

## Security notes

- **Code execution**: candidate JavaScript/TypeScript runs in a dedicated worker thread inside a `vm` context created with code generation disabled and no host objects in scope. The worker has hard memory limits and is force-terminated on timeout, so untrusted code cannot reach the host process, `require`, or the network, and cannot hang the API. Python/Java/C++ are accepted by the editor but not executed server-side (a Piston/Judge0 integration is the intended path).
- **Auth**: identity comes from the verified Clerk token (`sub`); the backend upserts a local user and only calls the Clerk API when a user is first seen.
- **Errors**: a global exception filter returns consistent JSON and never leaks stack traces, Prisma internals, or provider errors.
- **AI resilience**: OpenAI calls have a timeout and bounded retries; streaming failures send an error frame and persist nothing, so a failed turn can be retried cleanly.

## Testing

```bash
cd backend
npm test        # unit tests (sandbox isolation, streak, report normalization)
npm run test:e2e   # health endpoint (mocked Prisma)
```

## Deployment

- **Frontend**: Deploy to [Vercel](https://vercel.com) — set env vars from `.env.example`
- **Backend**: Deploy to [Railway](https://railway.app) or [Render](https://render.com)
- **Database**: Use Railway PostgreSQL, Supabase, or Neon

## Production considerations

- Add API rate limiting (e.g. `@nestjs/throttler`) before public exposure, especially on the AI and code-run endpoints.
- Pin `FRONTEND_URL` in production so CORS is not permissive.
- Add pagination to interview history once volume grows.
- Run `prisma migrate deploy` against the production database (the local dev setup uses `prisma db push`).

## Project Roadmap

- [ ] Piston/Judge0 integration for Python/Java/C++ execution
- [ ] Rate limiting on AI + code-execution endpoints
- [ ] Fullscreen exam mode
- [ ] WebRTC video simulation
- [ ] Company-specific question banks
- [ ] Peer mock interviews
