/**
 * Incremental parser for the `data: ...` lines of a Server-Sent Events
 * stream. Network chunks can end mid-line, so the unfinished tail is carried
 * over to the next call.
 */
export type SseEvent<T> = { type: 'data'; data: T } | { type: 'done' };

export function parseSseChunk<T>(
  buffer: string,
  chunk: string,
): { events: SseEvent<T>[]; rest: string } {
  const lines = (buffer + chunk).split('\n');
  const rest = lines.pop() ?? '';
  const events: SseEvent<T>[] = [];

  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6);
    if (payload === '[DONE]') {
      events.push({ type: 'done' });
      continue;
    }
    try {
      events.push({ type: 'data', data: JSON.parse(payload) as T });
    } catch {
      // Ignore malformed frames rather than failing the whole stream.
    }
  }
  return { events, rest };
}

/** Collision-resistant id for idempotent retries, with a fallback for old browsers. */
export function createClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
