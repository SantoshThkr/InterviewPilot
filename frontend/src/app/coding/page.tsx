'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Play, RotateCcw, Lightbulb, Clock } from 'lucide-react';
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

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: Record<string, string>;
  testCases: { input?: unknown; expected?: unknown; visible: boolean }[];
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

  const [problems, setProblems] = useState<{ id: string; title: string; difficulty: string }[]>([]);
  const [selectedId, setSelectedId] = useState('two-sum');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  useEffect(() => {
    authFetch<{ id: string; title: string; difficulty: string }[]>('/coding/problems')
      .then(setProblems)
      .catch(console.error);
  }, [authFetch]);

  useEffect(() => {
    authFetch<Problem>(`/coding/problems/${selectedId}`)
      .then((p) => {
        setProblem(p);
        setCode(p.starterCode[language] ?? p.starterCode.javascript ?? '');
        setResults([]);
      })
      .catch(console.error);
  }, [authFetch, selectedId, language]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const runCode = async () => {
    setRunning(true);
    try {
      const res = await authFetch<{ results: TestResult[] }>('/coding/run', {
        method: 'POST',
        body: JSON.stringify({ problemId: selectedId, code, language }),
      });
      setResults(res.results);

      if (interviewId) {
        await authFetch(`/interviews/${interviewId}/coding`, {
          method: 'POST',
          body: JSON.stringify({
            problemId: selectedId,
            code,
            language,
            timeSpentSecs: elapsed,
            hintsUsed,
          }),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const requestHint = () => {
    setHintsUsed((h) => h + 1);
    alert(
      hintsUsed === 0
        ? 'Think about what data structure gives O(1) lookups.'
        : hintsUsed === 1
          ? 'Consider using a hash map to store complements.'
          : 'Iterate through the array once, checking if (target - current) exists in your map.',
    );
  };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-7xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Coding Round</h1>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {formatDuration(elapsed)}
            </span>
            <span>Hints: {hintsUsed}</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="w-64">
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
              </div>
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
                  <h4 className="mb-2 font-medium">Examples</h4>
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="mb-3 rounded-lg bg-slate-900 p-3 font-mono text-xs">
                      <p>Input: {ex.input}</p>
                      <p>Output: {ex.output}</p>
                      {ex.explanation && (
                        <p className="mt-1 text-slate-400">{ex.explanation}</p>
                      )}
                    </div>
                  ))}
                  <h4 className="mb-2 font-medium">Constraints</h4>
                  <ul className="list-inside list-disc text-xs text-slate-400">
                    {problem.constraints.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>

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
            <div className="flex items-center gap-2">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['javascript', 'typescript', 'python', 'java', 'cpp'].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={runCode} disabled={running} className="gap-1">
                <Play className="h-4 w-4" /> Run
              </Button>
              <Button variant="secondary" onClick={() => setCode(problem?.starterCode[language] ?? '')}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={requestHint} className="gap-1">
                <Lightbulb className="h-4 w-4" /> Hint
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800">
              <MonacoEditor
                height="400px"
                language={language === 'cpp' ? 'cpp' : language}
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{ minimap: { enabled: false }, fontSize: 14 }}
              />
            </div>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Results: {results.filter((r) => r.passed).length}/{results.length} passed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                      {r.error && <p className="text-red-300">{r.error}</p>}
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
