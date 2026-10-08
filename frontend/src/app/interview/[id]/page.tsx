'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApiAuth } from '@/hooks/use-api-auth';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/use-voice';
import { ApiError, streamMessage } from '@/lib/api';
import { createClientId } from '@/lib/sse';
import type {
  CompletionResult,
  Interview,
  InterviewMessage,
  TurnResult,
} from '@/lib/types';
import { formatDuration } from '@/lib/utils';

interface PendingAnswer {
  content: string;
  /** Reused on retry so the server can recognise an already-saved answer. */
  clientMessageId: string;
}

function useElapsedSeconds(startedAt: string | null | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export default function LiveInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authFetch, requireToken } = useApiAuth();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [failedAnswer, setFailedAnswer] = useState<PendingAnswer | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [integrity, setIntegrity] = useState({ focusLost: 0, pastes: 0 });

  const inFlight = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const recognition = useSpeechRecognition(setInput);
  const synthesis = useSpeechSynthesis(voiceEnabled);

  const adoptInterview = useCallback(
    (data: Interview) => {
      if (data.status === 'COMPLETED') {
        router.replace(`/interview/${id}/report`);
        return;
      }
      setInterview(data);
      setIntegrity({
        focusLost: data.events.filter((e) => e.type === 'FOCUS_LOST').length,
        pastes: data.events.filter((e) => e.type === 'COPY_PASTE').length,
      });
    },
    [id, router],
  );

  useEffect(() => {
    let active = true;
    authFetch<Interview>(`/interviews/${id}`)
      .then((data) => active && adoptInterview(data))
      .catch((err: unknown) => active && setLoadError(errorMessage(err, 'Could not load the interview.')));
    return () => {
      active = false;
    };
  }, [authFetch, adoptInterview, id]);

  const isOpen = interview?.status === 'IN_PROGRESS';
  const concluded = !!interview?.progress?.concluded;
  const examMode = !!interview?.config?.examMode && isOpen;
  const elapsed = useElapsedSeconds(interview?.startedAt, isOpen && !concluded);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [interview?.messages.length, streamBuffer]);

  const recordEvent = useCallback(
    (type: 'FOCUS_LOST' | 'COPY_PASTE') => {
      authFetch(`/interviews/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      }).catch(() => {
        /* Integrity events are best-effort. */
      });
    },
    [authFetch, id],
  );

  // Exam-mode integrity signals. Only recorded when the candidate opted in.
  useEffect(() => {
    if (!examMode) return;
    let lastBlur = 0;
    const onBlur = () => {
      const now = Date.now();
      if (now - lastBlur < 3000) return; // one event per focus loss, not per flicker
      lastBlur = now;
      setIntegrity((c) => ({ ...c, focusLost: c.focusLost + 1 }));
      recordEvent('FOCUS_LOST');
    };
    const onPaste = () => {
      setIntegrity((c) => ({ ...c, pastes: c.pastes + 1 }));
      recordEvent('COPY_PASTE');
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('paste', onPaste);
    };
  }, [examMode, recordEvent]);

  const applyTurn = (turn: TurnResult, optimisticId: string) => {
    setInterview((prev) =>
      prev
        ? {
            ...prev,
            progress: turn.progress,
            messages: [
              ...prev.messages.filter((m) => m.id !== optimisticId),
              turn.candidate,
              turn.interviewer,
            ],
          }
        : prev,
    );
  };

  /** After a failure, check whether the server saved the turn anyway. */
  const resync = async (clientMessageId: string): Promise<boolean> => {
    try {
      const fresh = await authFetch<Interview>(`/interviews/${id}`);
      const saved = fresh.messages.some(
        (m) => m.role === 'CANDIDATE' && m.metadata?.clientMessageId === clientMessageId,
      );
      if (saved || fresh.status !== 'IN_PROGRESS') {
        adoptInterview(fresh);
        return true;
      }
    } catch {
      /* Still offline; fall through to the retry UI. */
    }
    return false;
  };

  const submit = async (answer: PendingAnswer) => {
    if (inFlight.current || !interview) return;
    inFlight.current = true;
    recognition.stop();
    synthesis.cancel();
    setStreaming(true);
    setStreamBuffer('');
    setSendError(null);
    setFailedAnswer(null);
    setInput('');

    const optimistic: InterviewMessage = {
      id: `pending-${answer.clientMessageId}`,
      role: 'CANDIDATE',
      content: answer.content,
      createdAt: new Date().toISOString(),
      metadata: { clientMessageId: answer.clientMessageId },
    };
    setInterview((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev,
    );

    try {
      const token = await requireToken();
      let accumulated = '';
      const turn = await streamMessage(
        `/interviews/${id}/message`,
        { content: answer.content, clientMessageId: answer.clientMessageId },
        (chunk) => {
          accumulated += chunk;
          setStreamBuffer(accumulated);
        },
        { token },
      );
      applyTurn(turn, optimistic.id);
      synthesis.speak(turn.interviewer.content);
    } catch (err) {
      setStreamBuffer('');
      const recovered = await resync(answer.clientMessageId);
      if (!recovered) {
        setInterview((prev) =>
          prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimistic.id) } : prev,
        );
        setFailedAnswer(answer);
        setInput(answer.content);
        setSendError(
          err instanceof ApiError && err.status === 409
            ? err.message
            : `${errorMessage(err, 'Your answer could not be sent.')} Your answer is kept below — retry when ready.`,
        );
      }
    } finally {
      setStreamBuffer('');
      setStreaming(false);
      inFlight.current = false;
    }
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || streaming) return;
    const clientMessageId =
      failedAnswer && failedAnswer.content === content
        ? failedAnswer.clientMessageId
        : createClientId();
    void submit({ content, clientMessageId });
  };

  const endInterview = async () => {
    if (!interview) return;
    const answered = interview.messages.some((m) => m.role === 'CANDIDATE');
    const confirmation = concluded
      ? null
      : answered
        ? 'End the interview now and generate your report? Unanswered questions lower your readiness score.'
        : 'You have not answered any questions yet. End the interview without a report?';
    if (confirmation && !window.confirm(confirmation)) return;

    setEnding(true);
    setSendError(null);
    recognition.stop();
    synthesis.cancel();
    try {
      const result = await authFetch<CompletionResult>(`/interviews/${id}/complete`, {
        method: 'POST',
      });
      if (result.status === 'COMPLETED') {
        router.push(`/interview/${id}/report`);
        return;
      }
      setInterview((prev) => (prev ? { ...prev, status: result.status } : prev));
      setEnding(false);
    } catch (err) {
      setEnding(false);
      setSendError(
        `${errorMessage(err, 'The report could not be generated.')} Your interview is saved, so you can try again.`,
      );
    }
  };

  if (loadError) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-slate-300">{loadError}</p>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </>
    );
  }

  if (!interview) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 items-center justify-center p-8 text-slate-400" role="status">
          Loading interview…
        </div>
      </>
    );
  }

  if (interview.status === 'ABANDONED') {
    return (
      <>
        <AppNav />
        <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold">This interview has ended</h1>
          <p className="text-slate-400">
            It was ended before any questions were answered, so there is nothing to evaluate.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link href="/interview/setup">Start a new interview</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  const progress = interview.progress;
  const progressPercent = progress
    ? concluded
      ? 100
      : Math.round(((progress.current - 1) / progress.total) * 100)
    : 0;
  const busy = streaming || ending;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{interview.role} Interview</h1>
            <p className="text-sm text-slate-400">
              {interview.personality} · {interview.difficulty} ·{' '}
              <span aria-label="Elapsed time">{formatDuration(elapsed)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {synthesis.supported && (
              <Button
                variant={voiceEnabled ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setVoiceEnabled((v) => !v)}
                aria-pressed={voiceEnabled}
              >
                {voiceEnabled ? (
                  <Volume2 className="mr-1 h-4 w-4" />
                ) : (
                  <VolumeX className="mr-1 h-4 w-4" />
                )}
                Read aloud
              </Button>
            )}
            {interview.config?.includeCoding && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/coding?interview=${id}`}>
                  <Code2 className="mr-1 h-4 w-4" /> Coding round
                </Link>
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={endInterview} disabled={busy}>
              <Square className="mr-1 h-4 w-4" /> {ending ? 'Generating report…' : 'End interview'}
            </Button>
          </div>
        </div>

        {progress && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-slate-400">
              <span>
                {concluded
                  ? 'All questions covered'
                  : `Question ${progress.current} of ${progress.total}${progress.focus ? ` · ${progress.focus}` : ''}`}
              </span>
              <span>
                {progress.answers} answer{progress.answers === 1 ? '' : 's'}
              </span>
            </div>
            <Progress value={progressPercent} aria-label="Interview progress" />
          </div>
        )}

        {examMode && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Exam mode: no hints. Leaving this window and pasting are recorded and shown in your
              report
              {integrity.focusLost + integrity.pastes > 0 &&
                ` (so far: ${integrity.focusLost} focus change${integrity.focusLost === 1 ? '' : 's'}, ${integrity.pastes} paste${integrity.pastes === 1 ? '' : 's'})`}
              .
            </p>
          </div>
        )}

        {sendError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {sendError}
            </span>
            {failedAnswer && (
              <Button size="sm" variant="secondary" onClick={() => void submit(failedAnswer)} disabled={busy}>
                Retry
              </Button>
            )}
          </div>
        )}

        <Card className="mb-4 flex-1">
          <CardContent
            className="flex h-[55vh] flex-col overflow-y-auto p-4"
            role="log"
            aria-live="polite"
            aria-label="Interview transcript"
          >
            {interview.messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.role === 'CANDIDATE' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'CANDIDATE'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-100'
                  } ${msg.id.startsWith('pending-') ? 'opacity-70' : ''}`}
                >
                  {msg.role === 'INTERVIEWER' && (
                    <p className="mb-1 text-xs font-medium text-indigo-300">Interviewer</p>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {streamBuffer && (
              <div className="mb-4 flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-slate-800 px-4 py-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-indigo-300">Interviewer</p>
                  {streamBuffer}
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-indigo-400" />
                </div>
              </div>
            )}

            {streaming && !streamBuffer && (
              <div className="mb-4 flex justify-start" role="status">
                <div className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-400">
                  <span className="text-xs font-medium text-indigo-300">Interviewer is thinking</span>
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" />
                  </span>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </CardContent>
        </Card>

        {concluded ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-800 bg-emerald-950/30 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="flex items-center gap-2 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              The interviewer has covered every question. Generate your report to see detailed
              feedback.
            </p>
            <Button onClick={endInterview} disabled={busy}>
              {ending ? 'Generating report…' : 'Generate report'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              {recognition.supported && (
                <Button
                  variant={recognition.listening ? 'destructive' : 'secondary'}
                  size="icon"
                  onClick={() =>
                    recognition.listening ? recognition.stop() : recognition.start(input)
                  }
                  disabled={busy}
                  aria-label={recognition.listening ? 'Stop voice input' : 'Answer by voice'}
                  aria-pressed={recognition.listening}
                >
                  {recognition.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <label htmlFor="answer" className="sr-only">
                Your answer
              </label>
              <Textarea
                id="answer"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  recognition.listening
                    ? 'Listening… speak your answer'
                    : 'Type your answer… (think aloud, be specific). Enter to send, Shift+Enter for a new line.'
                }
                className="min-h-[60px] flex-1 resize-none"
                maxLength={10000}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={busy}
              />
              <Button onClick={handleSend} disabled={busy || !input.trim()} size="icon" aria-label="Send answer">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {recognition.error && (
              <p className="mt-2 text-xs text-amber-300" role="alert">
                {recognition.error}
              </p>
            )}
          </>
        )}
      </main>
    </>
  );
}
