import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, streamMessage } from './api';

function sseResponse(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

const turn = {
  candidate: { id: 'c1', role: 'CANDIDATE', content: 'a', createdAt: '' },
  interviewer: { id: 'i1', role: 'INTERVIEWER', content: 'Why?', createdAt: '' },
  progress: { current: 1, total: 6, focus: 'React', concluded: false, answers: 1 },
};

afterEach(() => vi.unstubAllGlobals());

describe('streamMessage', () => {
  it('streams deltas and resolves with the saved turn', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          'data: {"content":"Wh"}\n\n',
          'data: {"content":"y?"}\n\ndata: {"turn":',
          `${JSON.stringify(turn)}}\n\ndata: [DONE]\n\n`,
        ]),
      ),
    );
    const chunks: string[] = [];
    const result = await streamMessage('/x', {}, (c) => chunks.push(c), { token: 't' });
    expect(chunks.join('')).toBe('Why?');
    expect(result.interviewer.id).toBe('i1');
  });

  it('rejects with the server message on an error frame', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse(['data: {"error":"AI down","code":"AI_UNAVAILABLE"}\n\ndata: [DONE]\n\n']),
      ),
    );
    await expect(streamMessage('/x', {}, () => {}, {})).rejects.toMatchObject({
      message: 'AI down',
      code: 'AI_UNAVAILABLE',
    });
  });

  it('treats a stream that ends before the turn is confirmed as a dropped connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(['data: {"content":"Half"}\n\n'])));
    const error = await streamMessage('/x', {}, () => {}, {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK');
  });

  it('surfaces HTTP errors such as a concurrent-answer conflict', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'Still processing' }), { status: 409 }),
      ),
    );
    await expect(streamMessage('/x', {}, () => {}, {})).rejects.toMatchObject({
      status: 409,
      message: 'Still processing',
    });
  });

  it('reports an unreachable server distinctly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed'))));
    await expect(streamMessage('/x', {}, () => {}, {})).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK',
    });
  });
});
