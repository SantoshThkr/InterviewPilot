'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiAuth } from '@/hooks/use-api-auth';

interface InterviewConfig {
  roles: string[];
  experienceLevels: string[];
  interviewTypes: string[];
  technicalTopics: string[];
  difficultyLevels: string[];
  personalities: string[];
}

export default function InterviewSetupPage() {
  const router = useRouter();
  const { authFetch } = useApiAuth();
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState('Full Stack Developer');
  const [experience, setExperience] = useState('2-5 years');
  const [type, setType] = useState('MIXED');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [personality, setPersonality] = useState('Neutral');
  const [topics, setTopics] = useState<string[]>(['JavaScript', 'React', 'System Design']);
  const [includeCoding, setIncludeCoding] = useState(true);
  const [includeResume, setIncludeResume] = useState(true);
  const [examMode, setExamMode] = useState(false);

  useEffect(() => {
    authFetch<InterviewConfig>('/interviews/config').then(setConfig).catch(console.error);
  }, [authFetch]);

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const startInterview = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<{ interview: { id: string } }>('/interviews', {
        method: 'POST',
        body: JSON.stringify({
          role,
          experience,
          type,
          difficulty,
          personality,
          topics,
          includeCoding,
          includeResume,
          examMode,
        }),
      });
      router.push(`/interview/${result.interview.id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to start interview. Please try again.',
      );
      setLoading(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">Configure Interview</h1>
        <p className="mb-8 text-slate-400">
          Customize your mock interview to match your target role and company style.
        </p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role & Experience</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Role</label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(config?.roles ?? []).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Experience</label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(config?.experienceLevels ?? []).map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interview Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-400">Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(config?.interviewTypes ?? []).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-400">Difficulty</label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(config?.difficultyLevels ?? []).map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm text-slate-400">Interviewer Personality</label>
                <Select value={personality} onValueChange={setPersonality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(config?.personalities ?? []).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Topics</CardTitle>
              <CardDescription>Select areas to focus on</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(config?.technicalTopics ?? []).map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      topics.includes(topic)
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Include resume-based questions', value: includeResume, set: setIncludeResume },
                { label: 'Include coding round', value: includeCoding, set: setIncludeCoding },
                { label: 'Exam mode (no hints, stricter)', value: examMode, set: setExamMode },
              ].map(({ label, value, set }) => (
                <label key={label} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={startInterview}
            disabled={loading || topics.length === 0}
          >
            {loading ? 'Starting…' : 'Start Interview'}
          </Button>
          {topics.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              Select at least one topic to begin.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
