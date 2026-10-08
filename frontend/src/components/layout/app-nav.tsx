'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard, Mic, FileText, Code2, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/interview/setup', label: 'New Interview', icon: Mic },
  { href: '/resume', label: 'Resume', icon: FileText },
  { href: '/coding', label: 'Coding', icon: Code2 },
  { href: '/history', label: 'History', icon: History },
];

export function AppNav() {
  const pathname = usePathname();

  const links = (compact: boolean) =>
    navItems.map(({ href, label, icon: Icon }) => {
      const active = pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
            active
              ? 'bg-slate-800 text-indigo-400'
              : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
            compact && 'px-2.5 py-1.5 text-xs',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold">
            IP
          </div>
          <span className="font-semibold text-slate-100">InterviewPilot</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links(false)}
        </nav>

        <UserButton />
      </div>
      {/* Small screens: a scrollable row instead of hiding navigation entirely. */}
      <nav
        aria-label="Main"
        className="flex gap-1 overflow-x-auto border-t border-slate-800 px-4 py-2 md:hidden"
      >
        {links(true)}
      </nav>
    </header>
  );
}
