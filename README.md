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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/interviews/config` | Interview configuration options |
| POST | `/api/interviews` | Start new interview |
| GET | `/api/interviews/:id` | Get interview with messages |
| POST | `/api/interviews/:id/message` | Send answer (SSE stream) |
| POST | `/api/interviews/:id/complete` | End interview & generate report |
| POST | `/api/resume/upload` | Upload resume (PDF/DOCX/TXT) |
| GET | `/api/dashboard` | Dashboard stats |
| GET | `/api/coding/problems` | List coding problems |
| POST | `/api/coding/run` | Run code against test cases |

## Deployment

- **Frontend**: Deploy to [Vercel](https://vercel.com) — set env vars from `.env.example`
- **Backend**: Deploy to [Railway](https://railway.app) or [Render](https://render.com)
- **Database**: Use Railway PostgreSQL, Supabase, or Neon

## Project Roadmap

- [ ] Piston/Judge0 integration for Python/Java/C++ execution
- [ ] Fullscreen exam mode
- [ ] WebRTC video simulation
- [ ] Company-specific question banks
- [ ] Peer mock interviews
