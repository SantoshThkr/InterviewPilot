import { TurnStreamParser, sanitizeReply } from './turn-protocol';

function run(chunks: string[]) {
  const parser = new TurnStreamParser();
  const shown = chunks.map((c) => parser.push(c)).join('') + parser.flush();
  return { shown, action: parser.action };
}

describe('TurnStreamParser', () => {
  it('strips a leading tag and reports the action', () => {
    expect(run(['[[NEXT]] Let us move on.'])).toEqual({
      shown: 'Let us move on.',
      action: 'NEXT',
    });
  });

  it('handles a tag split across many chunks', () => {
    expect(run(['[', '[FOLL', 'OW_UP]', ']', ' ', 'Why', ' that?'])).toEqual({
      shown: 'Why that?',
      action: 'FOLLOW_UP',
    });
  });

  it('ignores whitespace before the tag', () => {
    expect(run(['\n ', '[[END]]', '\nThanks for your time.'])).toEqual({
      shown: 'Thanks for your time.',
      action: 'END',
    });
  });

  it('passes untagged replies through untouched', () => {
    expect(run(['Can you ', 'elaborate?'])).toEqual({
      shown: 'Can you elaborate?',
      action: null,
    });
  });

  it('does not swallow text that merely starts with a bracket', () => {
    expect(run(['[note] ok'])).toEqual({ shown: '[note] ok', action: null });
  });

  it('flushes a dangling partial tag instead of losing it', () => {
    expect(run(['[[NE'])).toEqual({ shown: '[[NE', action: null });
  });

  it('strips tags the model invented, without treating them as an action', () => {
    expect(run(['[[STEER', '_BACK]] ', 'Let us stay on topic.'])).toEqual({
      shown: 'Let us stay on topic.',
      action: null,
    });
  });

  it('does not hold back ordinary text that starts with brackets', () => {
    expect(run(['[[lowercase]] text'])).toEqual({
      shown: '[[lowercase]] text',
      action: null,
    });
  });

  it('never emits the tag itself', () => {
    const parser = new TurnStreamParser();
    const emitted = ['[[', 'NEXT', ']]', ' Hi'].map((c) => parser.push(c));
    expect(emitted.join('')).not.toContain('[[');
  });
});

describe('sanitizeReply', () => {
  it('removes invented tags as well', () => {
    expect(sanitizeReply('Okay [[STEER_BACK]] back to React.')).toBe(
      'Okay  back to React.',
    );
  });

  it('removes stray tags the model repeated mid-reply', () => {
    expect(sanitizeReply('Sure. [[NEXT]] Next question?  ')).toBe(
      'Sure.  Next question?',
    );
  });
});
