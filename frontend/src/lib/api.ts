const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string; userId?: string; email?: string } = {},
): Promise<T> {
  const { token, userId, email, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['x-clerk-user-id'] = userId;
  if (email) headers['x-clerk-user-email'] = email;

  if (!(fetchOptions.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }

  return res.json();
}

export async function streamMessage(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  auth: { token?: string; userId?: string; email?: string },
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  if (auth.userId) headers['x-clerk-user-id'] = auth.userId;
  if (auth.email) headers['x-clerk-user-email'] = auth.email;

  const res = await fetch(`${API_URL}/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) throw new Error('Stream failed');

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
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) onChunk(parsed.content);
        } catch {
          /* skip malformed chunks */
        }
      }
    }
  }
}
