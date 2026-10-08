import { parseSseChunk } from './sse';
import type { TurnResult } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { ...fetchOptions, headers });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? res.statusText ?? 'Request failed', res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface TurnFrame {
  content?: string;
  error?: string;
  code?: string;
  turn?: TurnResult;
}

/**
 * Sends one answer and streams the interviewer's reply. `onChunk` receives
 * text deltas; the promise resolves with the saved turn. It rejects with an
 * ApiError on an HTTP error, an `{error}` frame, or a connection that closes
 * before the turn is confirmed — in which case the server may or may not have
 * saved it, so callers should re-sync before retrying.
 */
export async function streamMessage(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  auth: { token?: string },
): Promise<TurnResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.', 0, 'NETWORK');
  }

  if (!res.ok || !res.body) {
    const errBody = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errBody?.message ?? 'The interviewer could not respond.', res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let turn: TurnResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = parseSseChunk<TurnFrame>(buffer, decoder.decode(value, { stream: true }));
      buffer = parsed.rest;

      for (const event of parsed.events) {
        if (event.type === 'done') {
          if (turn) return turn;
          continue;
        }
        const frame = event.data;
        if (frame.error) throw new ApiError(frame.error, 503, frame.code);
        if (frame.content) onChunk(frame.content);
        if (frame.turn) turn = frame.turn;
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('The connection dropped while the interviewer was replying.', 0, 'NETWORK');
  } finally {
    reader.releaseLock();
  }

  if (turn) return turn;
  throw new ApiError('The connection dropped while the interviewer was replying.', 0, 'NETWORK');
}
