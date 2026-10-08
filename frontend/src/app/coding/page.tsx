'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ArrowLeft, Clock, Lightbulb, Play, RotateCcw } from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiAuth } from '@/hooks/use-api-auth';
import { formatDuration } from '@/lib/utils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
};

interface ProblemSummary {
  id: string;
  title: string;
  difficulty: string;
}

interface Problem extends ProblemSummary {
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: Record<string, string>;
  languages: string[];
  hints: string[];
}

interface TestResult {
  passed: boolean;
  visible: boolean;
  error?: string;
  input?: unknown;
  expected?: unknown;
  actual?: unknown;
}

function CodingPageContent() {
  const searchParams = useSearchParams();
  const interviewId = searchParams.get('interview');
  const { authFetch } = useApiAuth();

  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [selectedId, setSelectedId] = useState('two-sum');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  // Unsaved work per problem+language, so switching never discards code.
  const drafts = useRef(new Map<string, string>());
  const languageRef = useRef(language);
  const draftFor = (p: Problem, lang: string) =>
    drafts.current.get(`${p.id}:${lang}`) ?? p.starterCode[lang] ?? '';

  useEffect(() => {
    authFetch<ProblemSummary[]>('/coding/problems')
      .then(setProblems)
      .catch((err: Error) => setLoadError(err.message));
  }, [authFetch]);

  useEffect(() => {
    let active = true;
    authFetch<Problem>(`/coding/problems/${selectedId}`)
      .then((p) => {
        if (!active) return;
        setProblem(p);
        setCode(draftFor(p, languageRef.current));
        setResults([]);
        setRunError(null);
        setHintsShown(0);
        setStartedAt(Date.now());
      })
      .catch((err: Error) => active && setLoadError(err.message));
    return () => {
      active = false;
    };
  }, [authFetch, selectedId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  const updateCode = (value: string) => {
    setCode(value);
    if (problem) drafts.current.set(`${problem.id}:${language}`, value);
  };

  const changeLanguage = (lang: string) => {
    languageRef.current = lang;
    setLanguage(lang);
    if (problem) setCode(draftFor(problem, lang));
  };

  const runCode = async () => {
    if (!problem) return;
    setRunning(true);
    setRunError(null);
    try {
      // Inside an interview the submission endpoint runs the tests and records
      // the attempt in one call; practice runs use the stateless endpoint.
      const res = interviewId
        ? await authFetch<{ testResults: TestResult[] }>(`/interviews/${interviewId}/coding`, {
            method: 'POST',
            body: JSON.stringify({
              problemId: problem.id,
              code,
              language,
              timeSpentSecs: Math.min(elapsed, 86_400),
              hintsUsed: hintsShown,
            }),
          }).then((r) => r.testResults)
        : await authFetch<{ results: TestResult[] }>('/coding/run', {
            method: 'POST',
            body: JSON.stringify({ problemId: problem.id, code, language }),
          }).then((r) => r.results);
      setResults(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to run your code.');
    } finally {
      setRunning(false);
    }
  };

  const resetCode = () => {
    if (!problem) return;
    if (!window.confirm('Discard your code and restore the starter template?')) return;
    drafts.current.delete(`${problem.id}:${language}`);
    setCode(problem.starterCode[language] ?? '');
  };

  const showHint = () => {
    if (!problem || hintsShown >= problem.hints.length) return;
    setHintsShown((h) => h + 1);
    if (interviewId) {
      authFetch(`/interviews/${interviewId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'HINT_REQUESTED',
          metadata: { problemId: problem.id, level: hintsShown + 1 },
        }),
      }).catch(() => {
        /* best-effort */
      });
    }
  };

  const passed = results.filter((r) => r.passed).length;

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {interviewId && (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/interview/${interviewId}`}>
                  <ArrowLeft className="h-4 w-4" /> Back to interview
                </Link>
              </Button>
            )}
            <h1 className="text-2xl font-bold">Coding Round</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {formatDuration(elapsed)}
            </span>
            <span>
              Hints: {hintsShown}/{problem?.hints.length ?? 0}
            </span>
          </div>
        </div>

        {interviewId && (
          <p className="mb-4 text-sm text-slate-400">
            Every run is recorded for this interview; your best run per problem counts toward the
            coding score in your report.
          </p>
        )}

        {loadError && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
          >
            {loadError}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full sm:w-72" aria-label="Problem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {problems.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} ({p.difficulty})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto">
              {problem && (
                <>
                  <div className="mb-2 flex gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        problem.difficulty === 'Easy'
                          ? 'bg-emerald-900 text-emerald-300'
                          : problem.difficulty === 'Medium'
                            ? 'bg-amber-900 text-amber-300'
                            : 'bg-red-900 text-red-300'
                      }`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <p className="mb-4 whitespace-pre-wrap text-sm text-slate-300">
                    {problem.description}
                  </p>
                  <h2 className="mb-2 font-medium">Examples</h2>
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="mb-3 rounded-lg bg-slate-900 p-3 font-mono text-xs">
                      <p>Input: {ex.input}</p>
                      <p>Output: {ex.output}</p>
                      {ex.explanation && (
                        <p className="mt-1 text-slate-400">{ex.explanation}</p>
                      )}
                    </div>
                  ))}
                  <h2 className="mb-2 font-medium">Constraints</h2>
                  <ul className="list-inside list-disc text-xs text-slate-400">
                    {problem.constraints.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>

                  {hintsShown > 0 && (
                    <div className="mt-4 space-y-2" aria-live="polite">
                      {problem.hints.slice(0, hintsShown).map((hint, i) => (
                        <div
                          key={hint}
                          className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100"
                        >
                          <span className="font-medium">Hint {i + 1}:</span> {hint}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded-lg border border-indigo-800 bg-indigo-950/30 p-3 text-sm">
                    <p className="font-medium text-indigo-300">Interviewer asks:</p>
                    <p className="mt-1 text-slate-300">
                      &ldquo;Walk me through your approach before you code. What&apos;s the time
                      complexity? What edge cases should we consider?&rdquo;
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={language} onValueChange={changeLanguage}>
                <SelectTrigger className="w-40" aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(problem?.languages ?? ['javascript', 'typescript']).map((l) => (
                    <SelectItem key={l} value={l}>
                      {LANGUAGE_LABELS[l] ?? l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={runCode} disabled={running || !problem} className="gap-1">
                <Play className="h-4 w-4" /> {running ? 'Running…' : 'Run tests'}
              </Button>
              <Button variant="secondary" onClick={resetCode} aria-label="Reset to starter code">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={showHint}
                className="gap-1"
                disabled={!problem || hintsShown >= problem.hints.length}
              >
                <Lightbulb className="h-4 w-4" />
                {problem && hintsShown >= problem.hints.length ? 'No more hints' : 'Hint'}
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <MonacoEditor
                height="400px"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(v) => updateCode(v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 14 }}
              />
            </div>

            {runError && (
              <div
                role="alert"
                className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
              >
                {runError}
              </div>
            )}

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Results: {passed}/{results.length} passed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" aria-live="polite">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-3 text-sm ${
                        r.passed
                          ? 'border border-emerald-800 bg-emerald-950/30'
                          : 'border border-red-800 bg-red-950/30'
                      }`}
                    >
                      <p className="font-medium">
                        Test {i + 1}: {r.passed ? 'Passed' : 'Failed'}
                        {!r.visible && ' (hidden)'}
                      </p>
                      {r.visible && !r.passed && !r.error && (
                        <p className="mt-1 font-mono text-xs text-slate-300">
                          Expected {JSON.stringify(r.expected)}, got {JSON.stringify(r.actual)}
                        </p>
                      )}
                      {r.error && <p className="mt-1 text-red-300">{r.error}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default function CodingPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-slate-400">Loading...</div>}>
      <CodingPageContent />
    </Suspense>
  );
}
