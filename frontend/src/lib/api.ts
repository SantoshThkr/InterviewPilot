const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
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

/**
 * Streams an SSE response. Calls `onChunk` for each text delta. Rejects with an
 * ApiError if the request fails or the server sends an `{ error }` frame, so the
 * caller can show a retry affordance.
 */
export async function streamMessage(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  auth: { token?: string },
): Promise<void> {
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
    throw new ApiError('Could not reach the server. Check your connection.', 0);
  }

  if (!res.ok || !res.body) {
    const errBody = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(errBody?.message ?? 'The interviewer could not respond.', res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as { content?: string; error?: string };
        if (parsed.error) throw new ApiError(parsed.error, 503);
        if (parsed.content) onChunk(parsed.content);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        /* skip malformed chunks */
      }
    }
  }
}
