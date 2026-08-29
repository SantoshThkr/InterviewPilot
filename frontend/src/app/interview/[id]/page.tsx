'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Send, Square, Code2, AlertTriangle } from 'lucide-react';
import { useAuth, useUser } from '@clerk/nextjs';
import { AppNav } from '@/components/layout/app-nav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useApiAuth } from '@/hooks/use-api-auth';
import { streamMessage } from '@/lib/api';
import { formatDuration } from '@/lib/utils';

interface Message {
  id: string;
  role: 'INTERVIEWER' | 'CANDIDATE' | 'SYSTEM';
  content: string;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  personality: string;
  difficulty: string;
  status: string;
  messages: Message[];
  config?: { examMode?: boolean };
}

export default function LiveInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authFetch } = useApiAuth();
  const { getToken } = useAuth();
  const { user } = useUser();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    authFetch<Interview>(`/interviews/${id}`).then(setInterview).catch(console.error);
  }, [authFetch, id]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interview?.messages, streamBuffer]);

  const recordEvent = useCallback(
    (type: string, metadata?: Record<string, unknown>) => {
      authFetch(`/interviews/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({ type, metadata }),
      }).catch(console.error);
    },
    [authFetch, id],
  );

  useEffect(() => {
    const onBlur = () => {
      setWarnings((w) => [...w, 'Browser lost focus — flagged in exam report']);
      recordEvent('FOCUS_LOST');
    };
    const onPaste = () => {
      setWarnings((w) => [...w, 'Copy/paste detected']);
      recordEvent('COPY_PASTE');
    };

    window.addEventListener('blur', onBlur);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('paste', onPaste);
    };
  }, [recordEvent]);

  const speak = (text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const content = input.trim();
    setInput('');
    setStreaming(true);
    setStreamBuffer('');

    setInterview((prev) =>
      prev
        ? {
            ...prev,
            messages: [
              ...prev.messages,
              {
                id: `temp-${Date.now()}`,
                role: 'CANDIDATE',
                content,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : prev,
    );

    try {
      const token = await getToken();
      let accumulated = '';

      await streamMessage(
        `/interviews/${id}/message`,
        { content },
        (chunk) => {
          accumulated += chunk;
          setStreamBuffer(accumulated);
        },
        {
          token: token ?? undefined,
          userId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
        },
      );

      speak(accumulated);
      const updated = await authFetch<Interview>(`/interviews/${id}`);
      setInterview(updated);
      setStreamBuffer('');
    } catch (err) {
      console.error(err);
    } finally {
      setStreaming(false);
    }
  };

  const endInterview = async () => {
    if (!confirm('End interview and generate report?')) return;
    try {
      await authFetch(`/interviews/${id}/complete`, { method: 'POST' });
      router.push(`/interview/${id}/report`);
    } catch (err) {
      console.error(err);
    }
  };

  if (!interview) {
    return (
      <>
        <AppNav />
        <div className="flex flex-1 items-center justify-center p-20 text-slate-400">
          Loading interview...
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto flex max-w-5xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{interview.role} Interview</h1>
            <p className="text-sm text-slate-400">
              {interview.personality} · {interview.difficulty} · {formatDuration(elapsed)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={voiceEnabled ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
            >
              {voiceEnabled ? 'Voice On' : 'Voice Off'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/coding?interview=${id}`)}>
              <Code2 className="mr-1 h-4 w-4" /> Coding
            </Button>
            <Button variant="destructive" size="sm" onClick={endInterview}>
              <Square className="mr-1 h-4 w-4" /> End
            </Button>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3">
            {warnings.map((w, i) => (
              <p key={i} className="flex items-center gap-2 text-sm text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {w}
              </p>
            ))}
          </div>
        )}

        <Card className="mb-4 flex-1">
          <CardContent className="flex h-[55vh] flex-col overflow-y-auto p-4">
            {interview.messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.role === 'CANDIDATE' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                    msg.role === 'CANDIDATE'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-100'
                  }`}
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
                <div className="max-w-[80%] rounded-xl bg-slate-800 px-4 py-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-indigo-300">Interviewer</p>
                  {streamBuffer}
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-indigo-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant={isListening ? 'destructive' : 'secondary'}
            size="icon"
            onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
            disabled={streaming}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer... (think aloud, be specific)"
            className="min-h-[60px] flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={streaming}
          />
          <Button onClick={sendMessage} disabled={streaming || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </main>
    </>
  );
}
