'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppNav } from '@/components/layout/app-nav';
import { Card, CardContent } from '@/components/ui/card';
import { useApiAuth } from '@/hooks/use-api-auth';

interface Interview {
  id: string;
  role: string;
  type: string;
  difficulty: string;
  personality: string;
  status: string;
  createdAt: string;
  report?: { overallScore: number; readinessPercent: number };
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  ABANDONED: 'Ended without answers',
};

export default function HistoryPage() {
  const { authFetch } = useApiAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch<Interview[]>('/interviews')
      .then(setInterviews)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold">Interview History</h1>

        {loading && <p className="text-sm text-slate-400">Loading history…</p>}

        {error && !loading && (
          <Card>
            <CardContent className="p-8 text-center text-red-300">{error}</CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {!loading && !error && interviews.map((i) => (
            <Link key={i.id} href={i.report ? `/interview/${i.id}/report` : `/interview/${i.id}`}>
              <Card className="transition-colors hover:border-indigo-800">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{i.role}</p>
                    <p className="text-sm text-slate-400">
                      {i.type} · {i.difficulty} · {i.personality}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(i.createdAt).toLocaleString()} · {STATUS_LABELS[i.status] ?? i.status}
                    </p>
                  </div>
                  {i.report && (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-indigo-400">
                        {Math.round(i.report.overallScore)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {Math.round(i.report.readinessPercent)}% ready
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          {!loading && !error && interviews.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                No interviews yet. Start your first mock interview!
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
