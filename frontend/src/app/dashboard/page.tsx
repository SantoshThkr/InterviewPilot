'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Flame, Clock, Target, TrendingUp, Mic } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApiAuth } from '@/hooks/use-api-auth';

interface DashboardStats {
  readinessScore: number;
  averageScore: number;
  totalInterviews: number;
  streak: number;
  hoursPracticed: number;
  weakTopics: { topic: string; count: number }[];
  recentInterviews: {
    id: string;
    role: string;
    type: string;
    difficulty: string;
    status: string;
    score?: number;
    createdAt: string;
  }[];
  scoreHistory: { date: string; score: number; type: string }[];
  codingProgress: { total: number; passed: number; passRate: number };
  behavioralProgress: number;
  practicePlan: { topic: string; priority: string; suggestion: string }[];
}

export default function DashboardPage() {
  const { authFetch } = useApiAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch<DashboardStats>('/dashboard')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  if (loading) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 items-center justify-center p-20 text-slate-400">
          Loading dashboard...
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-slate-400">Track your interview readiness</p>
          </div>
          <Link href="/interview/setup">
            <Button className="gap-2">
              <Mic className="h-4 w-4" /> New Interview
            </Button>
          </Link>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Interview Readiness</CardDescription>
              <CardTitle className="text-3xl">{stats?.readinessScore ?? 0}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={stats?.readinessScore ?? 0} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Average Score
              </CardDescription>
              <CardTitle className="text-3xl">{stats?.averageScore ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Flame className="h-3 w-3" /> Streak
              </CardDescription>
              <CardTitle className="text-3xl">{stats?.streak ?? 0} days</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Hours Practiced
              </CardDescription>
              <CardTitle className="text-3xl">{stats?.hoursPracticed ?? 0}h</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Score Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {stats?.scoreHistory && stats.scoreHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.scoreHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString()}
                      stroke="#64748b"
                      fontSize={12}
                    />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  Complete interviews to see your progress
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-400" /> Practice Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.practicePlan ?? []).length > 0 ? (
                stats!.practicePlan.map((item) => (
                  <div key={item.topic} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.topic}</span>
                      <span
                        className={`text-xs uppercase ${
                          item.priority === 'high' ? 'text-red-400' : 'text-amber-400'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{item.suggestion}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No weak areas detected yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weak Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(stats?.weakTopics ?? []).map((t) => (
                  <span
                    key={t.topic}
                    className="rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1 text-sm text-red-300"
                  >
                    {t.topic} ({t.count})
                  </span>
                ))}
                {(stats?.weakTopics ?? []).length === 0 && (
                  <span className="text-sm text-slate-500">Complete interviews to identify gaps</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Interviews</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(stats?.recentInterviews ?? []).map((i) => (
                <Link
                  key={i.id}
                  href={i.status === 'COMPLETED' ? `/interview/${i.id}/report` : `/interview/${i.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 p-3 transition-colors hover:bg-slate-900"
                >
                  <div>
                    <p className="font-medium">{i.role}</p>
                    <p className="text-xs text-slate-400">
                      {i.type} · {i.difficulty}
                    </p>
                  </div>
                  {i.score != null && (
                    <span className="text-lg font-semibold text-indigo-400">{Math.round(i.score)}</span>
                  )}
                </Link>
              ))}
              {(stats?.recentInterviews ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No interviews yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
