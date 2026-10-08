import type { TurnAction } from './interview-plan';

/**
 * The interviewer model starts each reply with a control tag such as
 * `[[FOLLOW_UP]]`, `[[NEXT]]` or `[[END]]` so the server knows how the plan
 * advances. The tag must never reach the candidate, but the reply is streamed,
 * so the tag can arrive split across chunks. This parser holds back only the
 * leading characters that could still be part of a tag and passes everything
 * else through unchanged.
 *
 * Weaker models sometimes invent their own tag (e.g. `[[STEER_BACK]]`). Any
 * leading `[[UPPER_SNAKE]]` token is therefore stripped; unknown ones count
 * as "no tag".
 */

const TAGS: Record<string, TurnAction> = {
  '[[FOLLOW_UP]]': 'FOLLOW_UP',
  '[[NEXT]]': 'NEXT',
  '[[END]]': 'END',
};
const TAG_STRINGS = Object.keys(TAGS);
const MAX_TAG_LENGTH = 32;
/** A complete tag-shaped token at the start of the reply. */
const LEADING_TAG_RE = /^\[\[[A-Z][A-Z_]*\]\]/;
/** Something that may still grow into a tag-shaped token. */
const PARTIAL_TAG_RE = /^\[(?:\[(?:[A-Z][A-Z_]*(?:\])?)?)?$/;
const STRAY_TAG_RE = /\[\[[A-Z][A-Z_]*\]\]/g;

export class TurnStreamParser {
  private pending = '';
  private decided = false;
  private trimNext = false;
  private chosen: TurnAction | null = null;

  /** The action named by the leading tag, or null if the model sent none. */
  get action(): TurnAction | null {
    return this.chosen;
  }

  /** Feed a raw chunk; returns the text that is safe to show the candidate. */
  push(chunk: string): string {
    if (this.decided) return this.emit(chunk);

    this.pending += chunk;
    const lead = this.pending.trimStart();
    if (!lead) return '';

    const tag = LEADING_TAG_RE.exec(lead)?.[0];
    if (tag) {
      this.decided = true;
      this.chosen = TAGS[tag] ?? null;
      this.trimNext = true;
      const rest = lead.slice(tag.length);
      this.pending = '';
      return this.emit(rest);
    }

    // Still a possible prefix of a tag (e.g. "[[NE"): keep waiting.
    if (lead.length <= MAX_TAG_LENGTH && PARTIAL_TAG_RE.test(lead)) return '';

    this.decided = true;
    const text = this.pending;
    this.pending = '';
    return this.emit(text);
  }

  /** Call once the stream ends; returns any text still held back. */
  flush(): string {
    if (this.decided) return '';
    this.decided = true;
    const text = this.pending;
    this.pending = '';
    return this.emit(text);
  }

  private emit(text: string): string {
    if (!this.trimNext) return text;
    const trimmed = text.trimStart();
    if (trimmed) this.trimNext = false;
    return trimmed;
  }
}

/** Final clean-up before a reply is persisted. */
export function sanitizeReply(text: string): string {
  return text.replace(STRAY_TAG_RE, '').trim();
}

/** Prefix used when replaying earlier interviewer turns to the model. */
export function tagFor(action: TurnAction): string {
  return TAG_STRINGS.find((t) => TAGS[t] === action) ?? '';
}
