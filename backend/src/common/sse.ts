import type { Response } from 'express';

/**
 * Minimal Server-Sent Events writer for a POST response. Frames are JSON
 * objects; the stream always ends with a `[DONE]` sentinel. Writes after the
 * client has disconnected are ignored, so the server can finish (and persist)
 * a turn even if the connection dropped mid-stream.
 */
export class SseWriter {
  private opened = false;

  constructor(private readonly res: Response) {}

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.res.status(200);
    this.res.setHeader('Content-Type', 'text/event-stream');
    this.res.setHeader('Cache-Control', 'no-cache, no-transform');
    this.res.setHeader('Connection', 'keep-alive');
    // Disable proxy buffering (nginx) so tokens reach the browser promptly.
    this.res.setHeader('X-Accel-Buffering', 'no');
    this.res.flushHeaders?.();
  }

  send(data: unknown): void {
    this.open();
    if (this.res.writableEnded || this.res.destroyed) return;
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  done(): void {
    this.open();
    if (this.res.writableEnded) return;
    if (!this.res.destroyed) this.res.write('data: [DONE]\n\n');
    this.res.end();
  }

  fail(message: string, code?: string): void {
    this.send({ error: message, ...(code ? { code } : {}) });
    this.done();
  }
}
