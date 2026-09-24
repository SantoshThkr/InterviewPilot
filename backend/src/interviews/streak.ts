function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

/**
 * Consecutive-day streak ending today (or yesterday, if the user hasn't
 * practiced yet today). Derived from real completion dates rather than a naive
 * per-completion counter, so it reflects actual daily practice.
 */
export function computeStreak(
  completionDates: Date[],
  now: Date = new Date(),
): number {
  const days = new Set(completionDates.map(dayKey));
  if (days.size === 0) return 0;

  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
