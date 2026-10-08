'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, CircleSlash, Info, ShieldAlert, XCircle } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApiAuth } from '@/hooks/use-api-auth';
import type {
  CodingSubmission,
  Interview,
  InterviewReport,
  QuestionFeedback,
  ReportDimension,
} from '@/lib/types';
import { formatDuration } from '@/lib/utils';

const RATING_LABEL: Record<number, string> = {
  1: 'Not demonstrated',
  2: 'Major gaps',
  3: 'Meets the bar',
  4: 'Strong',
  5: 'Exceptional',
};

function ratingTone(rating: number | null) {
  if (rating === null) return 'text-slate-400';
  if (rating >= 4) return 'text-emerald-400';
  if (rating === 3) return 'text-amber-300';
  return 'text-red-400';
}

/** Scores for reports created before per-dimension rationales existed. */
function legacyDimensions(r: InterviewReport): ReportDimension[] {
  const entries: [string, string, number | null][] = [
    ['communication', 'Communication', r.communicationScore],
    ['technical', 'Technical', r.technicalScore],
    ['confidence', 'Confidence', r.confidenceScore],
    ['problemSolving', 'Problem solving', r.problemSolvingScore],
    ['coding', 'Coding', r.codingScore],
    ['behavioral', 'Behavioral', r.behavioralScore],
    ['systemDesign', 'System design', r.systemDesignScore],
  ];
  return entries
    .filter(([, , score]) => score !== null && score !== undefined)
    .map(([key, label, score]) => ({
      key,
      label,
      description: '',
      rating: null,
      score,
      weight: 0,
      rationale: '',
      evidence: [],
      source: 'evaluator' as const,
    }));
}

function BulletList({ items, empty }: { items: string[]; empty?: string }) {
  if (items.length === 0) {
    return empty ? <p className="text-sm text-slate-500">{empty}</p> : null;
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DimensionRow({ d, totalWeight }: { d: ReportDimension; totalWeight: number }) {
  const weightPct = totalWeight > 0 && d.weight > 0 ? Math.round((d.weight / totalWeight) * 100) : null;
  return (
    <div className="rounded-lg border border-slate-800 p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{d.label}</p>
          {d.description && <p className="text-xs text-slate-500">{d.description}</p>}
        </div>
        <div className="text-right text-sm">
          {d.rating !== null ? (
            <span className={ratingTone(d.rating)}>
              {d.rating}/5 · {RATING_LABEL[d.rating]}
            </span>
          ) : (
            <span className="text-slate-300">{Math.round(d.score ?? 0)}/100</span>
          )}
          {weightPct !== null && (
            <span className="ml-2 text-xs text-slate-500">{weightPct}% of overall</span>
          )}
        </div>
      </div>
      <Progress value={d.score ?? 0} aria-label={`${d.label} score`} />
      {d.rationale && <p className="mt-3 text-sm text-slate-300">{d.rationale}</p>}
      {d.evidence.length > 0 && (
        <ul className="mt-2 space-y-1">
          {d.evidence.map((e) => (
            <li key={e} className="border-l-2 border-slate-700 pl-3 text-xs italic text-slate-400">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionFeedback }) {
  return (
    <div className="rounded-lg border border-slate-800 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Q{q.planIndex + 1} · <span className="text-indigo-300">{q.focus}</span>
        </p>
        {q.answered ? (
          <span className={`text-sm ${ratingTone(q.rating)}`}>
            {q.rating !== null ? `${q.rating}/5 · ${RATING_LABEL[q.rating]}` : 'Not rated'}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-sm text-slate-500">
            <CircleSlash className="h-4 w-4" /> Not answered
          </span>
        )}
      </div>
      {q.question && <p className="mb-3 text-sm text-slate-400">&ldquo;{q.question}&rdquo;</p>}
      {q.answered && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> What went well
            </p>
            <BulletList items={q.strengths} empty="Nothing notable." />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-red-400">
              <XCircle className="h-3.5 w-3.5" /> What was missing
            </p>
            <BulletList items={q.gaps} empty="No major gaps." />
          </div>
        </div>
      )}
      {q.betterAnswer && (
        <div className="mt-3 rounded-md bg-slate-900 p-3">
          <p className="mb-1 text-xs font-medium uppercase text-indigo-300">A stronger answer</p>
          <p className="text-sm text-slate-300">{q.betterAnswer}</p>
        </div>
      )}
    </div>
  );
}

function bestAttempts(subs: CodingSubmission[]) {
  const best = new Map<string, CodingSubmission & { attempts: number }>();
  for (const s of subs) {
    const prev = best.get(s.problemId);
    const rate = s.testsTotal > 0 ? s.testsPassed / s.testsTotal : 0;
    const prevRate = prev && prev.testsTotal > 0 ? prev.testsPassed / prev.testsTotal : -1;
    best.set(s.problemId, {
      ...(rate >= prevRate ? s : prev!),
      attempts: (prev?.attempts ?? 0) + 1,
      hintsUsed: Math.max(prev?.hintsUsed ?? 0, s.hintsUsed),
    });
  }
  return [...best.values()];
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useApiAuth();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authFetch<Interview>(`/interviews/${id}`)
      .then((data) => active && setInterview(data))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [authFetch, id]);

  if (loading) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 items-center justify-center p-8 text-slate-400" role="status">
          Loading report…
        </div>
      </>
    );
  }

  if (error || !interview?.report) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-slate-300">
            {error ?? 'No report is available for this interview yet.'}
          </p>
          <div className="flex gap-3">
            {interview?.status === 'IN_PROGRESS' && (
              <Button asChild>
                <Link href={`/interview/${id}`}>Return to interview</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const r = interview.report;
  const dimensions = r.dimensions?.length ? r.dimensions : legacyDimensions(r);
  const totalWeight = dimensions.reduce((sum, d) => sum + (d.score !== null ? d.weight : 0), 0);
  const questions = r.questionFeedback ?? [];
  const answered = questions.filter((q) => q.answered).length;
  const planned = interview.plan.length;
  const coding = bestAttempts(interview.codingSubs);
  const focusLost = interview.events.filter((e) => e.type === 'FOCUS_LOST').length;
  const pastes = interview.events.filter((e) => e.type === 'COPY_PASTE').length;
  const roadmap = r.learningRoadmap ?? [];

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <div className="mb-8 text-center">
          <p className="text-sm text-slate-400">
            {interview.role} · {interview.type} · {interview.difficulty}
            {interview.durationSecs ? ` · ${formatDuration(interview.durationSecs)}` : ''}
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Interview Report</h1>
          <div className="mt-4 inline-flex flex-col items-center">
            <span className="text-6xl font-bold text-indigo-400">{Math.round(r.overallScore)}</span>
            <span className="text-slate-400">Overall score</span>
            <p className="mt-2 text-lg text-emerald-400">
              {Math.round(r.readinessPercent)}% interview ready
            </p>
          </div>
          {r.dimensions?.length ? (
            <p className="mx-auto mt-4 flex max-w-xl items-start gap-2 text-left text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Each dimension is rated 1–5 against a fixed rubric (×20 = score). The overall score
                is their weighted average using the weights shown below; coding comes from automated
                tests. Readiness is the overall score scaled by how much of the interview you
                completed{planned > 0 ? ` (${answered} of ${planned} questions answered)` : ''}.
              </span>
            </p>
          ) : null}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Score breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dimensions.map((d) => (
              <DimensionRow key={d.key} d={d} totalWeight={totalWeight} />
            ))}
          </CardContent>
        </Card>

        {r.summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-slate-300">{r.summary}</p>
            </CardContent>
          </Card>
        )}

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-emerald-400">Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList items={r.strengths} empty="No clear strengths identified yet." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-red-400">Areas to improve</CardTitle>
            </CardHeader>
            <CardContent>
              <BulletList items={r.weaknesses} empty="Nothing major to improve." />
            </CardContent>
          </Card>
        </div>

        {questions.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Question by question</CardTitle>
              <CardDescription>How each answer was rated, and what a stronger one would include.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((q) => (
                <QuestionCard key={q.planIndex} q={q} />
              ))}
            </CardContent>
          </Card>
        )}

        {(r.knowledgeGaps.length > 0 || r.mistakes.length > 0 || r.topicsToRevise.length > 0) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Knowledge gaps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.topicsToRevise.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.topicsToRevise.map((t) => (
                    <span key={t} className="rounded-full bg-red-950/50 px-3 py-1 text-sm text-red-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <BulletList items={r.knowledgeGaps} />
              {r.mistakes.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-slate-400">Mistakes</p>
                  <BulletList items={r.mistakes} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {roadmap.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Practice plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {roadmap.map((item) => {
                const actions = item.actions ?? item.resources ?? [];
                return (
                  <div key={item.topic} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.topic}</span>
                      <span className="text-xs uppercase text-indigo-400">{item.priority}</span>
                    </div>
                    {actions.length > 0 && (
                      <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
                        {actions.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {coding.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Coding round</CardTitle>
              <CardDescription>Best run per problem, measured by automated tests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {coding.map((s) => (
                <div
                  key={s.problemId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 p-3 text-sm"
                >
                  <span>
                    {s.problemTitle} <span className="text-slate-500">({s.difficulty}, {s.language})</span>
                  </span>
                  <span className={s.testsPassed === s.testsTotal ? 'text-emerald-400' : 'text-amber-300'}>
                    {s.testsPassed}/{s.testsTotal} tests · {s.attempts} run{s.attempts === 1 ? '' : 's'} ·{' '}
                    {s.hintsUsed} hint{s.hintsUsed === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {interview.config?.examMode && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" /> Exam integrity
              </CardTitle>
              <CardDescription>Recorded during exam mode. Not factored into the score.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-300">
              {focusLost + pastes === 0
                ? 'No focus changes or pastes were recorded.'
                : `${focusLost} focus change${focusLost === 1 ? '' : 's'} and ${pastes} paste${pastes === 1 ? '' : 's'} were recorded.`}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/interview/setup">Practice again</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
