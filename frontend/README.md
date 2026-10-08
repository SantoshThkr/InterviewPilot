# InterviewPilot Web

Next.js 16 (App Router) frontend for InterviewPilot. See the [root README](../README.md) for setup and
how the product works.

```bash
cp .env.example .env.local   # NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_API_URL
npm install
npm run dev                  # http://localhost:3000

npm test                     # vitest: SSE parsing and the streaming client
npm run lint
npm run typecheck
npm run build
```

| Path | Purpose |
|------|---------|
| `src/app/interview/[id]/page.tsx` | Live interview: streaming replies, idempotent retries, progress, voice, exam mode |
| `src/app/interview/[id]/report/page.tsx` | Report: dimension rationale and evidence, per-question feedback, coding, integrity |
| `src/lib/api.ts`, `src/lib/sse.ts` | API client and the SSE turn protocol |
| `src/hooks/use-voice.ts` | Speech recognition / synthesis with cleanup |
| `src/proxy.ts` | Clerk route protection (Next 16 `proxy`, formerly `middleware`) |
