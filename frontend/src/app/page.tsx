'use client';

import Link from 'next/link';
import { SignInButton, SignUpButton, useUser } from '@clerk/nextjs';
import { ArrowRight, Brain, Code2, Mic, Shield, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const { isSignedIn } = useUser();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold">
            IF
          </div>
          <span className="text-lg font-semibold">InterviewPilot</span>
        </div>
        <div className="flex gap-3">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <Button variant="ghost">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Get Started</Button>
              </SignUpButton>
            </>
          ) : (
            <Link href="/dashboard">
              <Button>Go to dashboard</Button>
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-indigo-400">
            AI-Powered Interview Simulator
          </p>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight md:text-6xl">
            Feel the pressure of a{' '}
            <span className="gradient-text">real FAANG interview</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Not a tutor. Not a chatbot. An AI interviewer that challenges you with deep
            follow-ups, resume-based questions, coding rounds, and honest feedback — just
            like Amazon, Google, and Microsoft.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {!isSignedIn ? (
              <SignUpButton mode="modal">
                <Button size="lg" className="gap-2">
                  Start Practicing <ArrowRight className="h-4 w-4" />
                </Button>
              </SignUpButton>
            ) : (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Link href="#features">
              <Button size="lg" variant="secondary">
                See Features
              </Button>
            </Link>
          </div>
        </section>

        <section id="features" className="border-t border-slate-800 bg-slate-900/30 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Brain,
                title: 'Resume-Based Interviews',
                desc: 'Upload your resume. The AI drills into your projects, tech stack, and career gaps.',
              },
              {
                icon: Mic,
                title: 'Live Voice Mode',
                desc: 'Speech-to-text and text-to-speech for a Zoom-like interview experience.',
              },
              {
                icon: Code2,
                title: 'Coding Rounds',
                desc: 'Monaco editor with test cases, timers, and think-aloud follow-ups.',
              },
              {
                icon: Target,
                title: 'Adaptive AI',
                desc: 'Remembers weak areas and focuses future interviews on your gaps.',
              },
              {
                icon: Shield,
                title: 'Anti-Cheating',
                desc: 'Focus detection, copy-paste warnings, and exam mode for realistic practice.',
              },
              {
                icon: ArrowRight,
                title: 'Actionable Reports',
                desc: 'Scores, knowledge gaps, and a personalized learning roadmap after every session.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-xl p-6">
                <Icon className="mb-4 h-8 w-8 text-indigo-400" />
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
