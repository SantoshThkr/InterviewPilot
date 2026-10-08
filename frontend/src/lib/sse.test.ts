import { describe, expect, it } from 'vitest';
import { createClientId, parseSseChunk } from './sse';

type Frame = { content?: string; error?: string };

describe('parseSseChunk', () => {
  it('parses complete data frames and the DONE sentinel', () => {
    const { events, rest } = parseSseChunk<Frame>(
      '',
      'data: {"content":"Hi"}\n\ndata: [DONE]\n\n',
    );
    expect(events).toEqual([
      { type: 'data', data: { content: 'Hi' } },
      { type: 'done' },
    ]);
    expect(rest).toBe('');
  });

  it('carries a frame split across network chunks', () => {
    const first = parseSseChunk<Frame>('', 'data: {"cont');
    expect(first.events).toEqual([]);
    const second = parseSseChunk<Frame>(first.rest, 'ent":"Hello"}\n\n');
    expect(second.events).toEqual([{ type: 'data', data: { content: 'Hello' } }]);
  });

  it('handles CRLF line endings from proxies', () => {
    const { events } = parseSseChunk<Frame>('', 'data: {"content":"a"}\r\n\r\n');
    expect(events).toEqual([{ type: 'data', data: { content: 'a' } }]);
  });

  it('skips malformed and non-data lines without failing the stream', () => {
    const { events } = parseSseChunk<Frame>(
      '',
      ': keep-alive\nevent: ping\ndata: {broken\ndata: {"error":"x"}\n',
    );
    expect(events).toEqual([{ type: 'data', data: { error: 'x' } }]);
  });
});

describe('createClientId', () => {
  it('produces ids accepted by the API and unique per call', () => {
    const ids = new Set(Array.from({ length: 50 }, createClientId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
