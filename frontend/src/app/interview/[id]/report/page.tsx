'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApiAuth } from '@/hooks/use-api-auth';

interface Report {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  codingScore?: number;
  systemDesignScore?: number;
  behavioralScore?: number;
  strengths: string[];
  weaknesses: string[];
  knowledgeGaps: string[];
  topicsToRevise: string[];
  mistakes: string[];
  learningRoadmap: { topic: string; priority: string; resources: string[] }[];
  readinessPercent: number;
  summary: string;
}

interface Interview {
  id: string;
  role: string;
  type: string;
  difficulty: string;
  report: Report;
}

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useApiAuth();
  const [interview, setInterview] = useState<Interview | null>(null);

  useEffect(() => {
    authFetch<Interview>(`/interviews/${id}`).then(setInterview).catch(console.error);
  }, [authFetch, id]);

  if (!interview?.report) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 items-center justify-center p-20 text-slate-400">
          Loading report...
        </div>
      </>
    );
  }

  const r = interview.report;
  const scores = [
    { label: 'Communication', value: r.communicationScore },
    { label: 'Technical', value: r.technicalScore },
    { label: 'Confidence', value: r.confidenceScore },
    { label: 'Problem Solving', value: r.problemSolvingScore },
    ...(r.codingScore != null ? [{ label: 'Coding', value: r.codingScore }] : []),
    ...(r.behavioralScore != null ? [{ label: 'Behavioral', value: r.behavioralScore }] : []),
    ...(r.systemDesignScore != null ? [{ label: 'System Design', value: r.systemDesignScore }] : []),
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
        <div className="mb-8 text-center">
          <p className="text-sm text-slate-400">{interview.role} · {interview.type} · {interview.difficulty}</p>
          <h1 className="mt-2 text-4xl font-bold">Interview Report</h1>
          <div className="mt-4 inline-flex flex-col items-center">
            <span className="text-6xl font-bold text-indigo-400">{Math.round(r.overallScore)}</span>
            <span className="text-slate-400">Overall Score</span>
            <p className="mt-2 text-lg text-emerald-400">
              {Math.round(r.readinessPercent)}% interview ready
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {scores.map(({ label, value }) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{label}</span>
                  <span>{Math.round(value)}</span>
                </div>
                <Progress value={value} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-slate-300">{r.summary}</p>
          </CardContent>
        </Card>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-emerald-400">Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {r.strengths.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-red-400">Weaknesses</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
                {r.weaknesses.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader><CardTitle>Knowledge Gaps & Topics to Revise</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">
              {r.knowledgeGaps.map((g) => (
                <span key={g} className="rounded-full bg-red-950/50 px-3 py-1 text-sm text-red-300">{g}</span>
              ))}
            </div>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
              {r.topicsToRevise.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </CardContent>
        </Card>

        {r.learningRoadmap?.length > 0 && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Learning Roadmap</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {r.learningRoadmap.map((item) => (
                <div key={item.topic} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.topic}</span>
                    <span className="text-xs uppercase text-indigo-400">{item.priority}</span>
                  </div>
                  {item.resources?.length > 0 && (
                    <ul className="mt-2 list-inside list-disc text-xs text-slate-400">
                      {item.resources.map((res) => <li key={res}>{res}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center gap-4">
          <Link href="/interview/setup">
            <Button size="lg">Practice Again</Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    </>
  );
}
