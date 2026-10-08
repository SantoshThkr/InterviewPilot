import {
  CLOSING_MESSAGE,
  PLAN_LENGTH,
  allowedActions,
  buildInterviewPlan,
  deriveTurnState,
  groupTranscript,
  interviewerMetaFor,
  progressFor,
  resolveAction,
  transitionFor,
  type PlanInput,
  type TranscriptMessage,
} from './interview-plan';

const base: PlanInput = {
  type: 'TECHNICAL',
  experience: '2-5 years',
  difficulty: 'Intermediate',
  personality: 'Neutral',
  topics: ['React', 'Node.js'],
  weakAreas: [],
  hasResume: false,
};

const interviewer = (
  kind: 'question' | 'follow_up' | 'closing',
  planIndex: number,
): TranscriptMessage => ({
  role: 'INTERVIEWER',
  content: `${kind} ${planIndex}`,
  metadata: { kind, planIndex },
});
const candidate = (content = 'answer'): TranscriptMessage => ({
  role: 'CANDIDATE',
  content,
});

describe('buildInterviewPlan', () => {
  it('builds a plan of the configured length with sequential indices', () => {
    for (const type of Object.keys(PLAN_LENGTH)) {
      const plan = buildInterviewPlan({ ...base, type });
      expect(plan.items).toHaveLength(PLAN_LENGTH[type]);
      expect(plan.items.map((i) => i.index)).toEqual(
        plan.items.map((_, i) => i),
      );
      for (const item of plan.items) {
        expect(item.guidance).toBeTruthy();
        expect(item.fallbackQuestion).toBeTruthy();
      }
    }
  });

  it('covers only the selected topics in a technical interview', () => {
    const plan = buildInterviewPlan(base);
    expect(new Set(plan.items.map((i) => i.focus))).toEqual(
      new Set(['React', 'Node.js']),
    );
    // Repeated topics get different angles, not identical questions.
    const react = plan.items.filter((i) => i.focus === 'React');
    expect(new Set(react.map((i) => i.guidance)).size).toBe(react.length);
  });

  it('starts with a resume deep-dive when a resume is available', () => {
    const plan = buildInterviewPlan({ ...base, hasResume: true });
    expect(plan.items[0].kind).toBe('resume');
  });

  it('prioritises tracked weak areas without dropping chosen topics', () => {
    const plan = buildInterviewPlan({ ...base, weakAreas: ['Security'] });
    const focuses = plan.items.map((i) => i.focus);
    expect(focuses[0]).toBe('Security');
    expect(focuses).toEqual(expect.arrayContaining(['React', 'Node.js']));
  });

  it('includes at most one system design item when other topics exist', () => {
    const plan = buildInterviewPlan({
      ...base,
      topics: ['System Design', 'React'],
    });
    expect(plan.items.filter((i) => i.kind === 'system_design')).toHaveLength(
      1,
    );
  });

  it('still fills the plan when System Design is the only topic', () => {
    const plan = buildInterviewPlan({ ...base, topics: ['System Design'] });
    expect(plan.items).toHaveLength(PLAN_LENGTH.TECHNICAL);
    expect(plan.items.every((i) => i.kind === 'system_design')).toBe(true);
  });

  it('never injects technical topics into behavioral or HR interviews', () => {
    for (const type of ['BEHAVIORAL', 'HR', 'MANAGERIAL']) {
      const plan = buildInterviewPlan({
        ...base,
        type,
        weakAreas: ['React', 'Ownership'],
      });
      expect(plan.items.some((i) => i.kind === 'technical')).toBe(false);
      expect(plan.items.some((i) => i.focus === 'React')).toBe(false);
    }
  });

  it('runs a full loop for MIXED interviews', () => {
    const plan = buildInterviewPlan({
      ...base,
      type: 'MIXED',
      experience: 'Senior',
      hasResume: true,
    });
    const kinds = plan.items.map((i) => i.kind);
    expect(kinds[0]).toBe('intro');
    expect(kinds[1]).toBe('resume');
    expect(kinds).toContain('technical');
    expect(kinds).toContain('system_design');
    expect(kinds).toContain('behavioral');
  });

  it('derives the follow-up budget from the interviewer personality', () => {
    expect(
      buildInterviewPlan({ ...base, personality: 'Fast-paced' }).maxFollowUps,
    ).toBe(1);
    expect(
      buildInterviewPlan({ ...base, personality: 'Strict' }).maxFollowUps,
    ).toBe(3);
    expect(
      buildInterviewPlan({ ...base, personality: 'Unknown' }).maxFollowUps,
    ).toBe(2);
  });

  it('is deterministic', () => {
    expect(buildInterviewPlan(base)).toEqual(buildInterviewPlan(base));
  });
});

describe('turn state', () => {
  const plan = buildInterviewPlan(base); // 6 items, 2 follow-ups

  it('tracks the current question and follow-ups', () => {
    const state = deriveTurnState([
      interviewer('question', 0),
      candidate(),
      interviewer('follow_up', 0),
      candidate(),
      interviewer('question', 1),
      candidate(),
      interviewer('follow_up', 1),
    ]);
    expect(state).toEqual({
      planIndex: 1,
      followUpsUsed: 1,
      concluded: false,
      candidateTurns: 3,
    });
  });

  it('treats legacy messages without metadata as a question then follow-ups', () => {
    const state = deriveTurnState([
      { role: 'INTERVIEWER', content: 'hi' },
      candidate(),
      { role: 'INTERVIEWER', content: 'why?' },
    ]);
    expect(state.planIndex).toBe(0);
    expect(state.followUpsUsed).toBe(1);
  });

  it('allows a follow-up or advancing while follow-ups remain', () => {
    expect(
      allowedActions(plan, deriveTurnState([interviewer('question', 0)])),
    ).toEqual(['FOLLOW_UP', 'NEXT']);
  });

  it('forces advancing once the follow-up budget is spent', () => {
    const state = deriveTurnState([
      interviewer('question', 2),
      candidate(),
      interviewer('follow_up', 2),
      candidate(),
      interviewer('follow_up', 2),
    ]);
    expect(allowedActions(plan, state)).toEqual(['NEXT']);
  });

  it('offers END instead of NEXT on the last question', () => {
    const state = deriveTurnState([interviewer('question', 5)]);
    expect(allowedActions(plan, state)).toEqual(['FOLLOW_UP', 'END']);
  });

  it('marks the interview concluded after a closing message', () => {
    const state = deriveTurnState([
      interviewer('question', 5),
      candidate(),
      interviewer('closing', 5),
    ]);
    expect(state.concluded).toBe(true);
    expect(progressFor(plan, state)).toMatchObject({
      current: 6,
      total: 6,
      concluded: true,
      answers: 1,
    });
  });
});

describe('resolveAction', () => {
  it('keeps an allowed choice', () => {
    expect(resolveAction('NEXT', ['FOLLOW_UP', 'NEXT'])).toBe('NEXT');
  });

  it('defaults a missing tag to a follow-up when one is allowed', () => {
    expect(resolveAction(null, ['FOLLOW_UP', 'NEXT'])).toBe('FOLLOW_UP');
  });

  it('coerces a disallowed follow-up into advancing', () => {
    expect(resolveAction('FOLLOW_UP', ['NEXT'])).toBe('NEXT');
    expect(resolveAction(null, ['END'])).toBe('END');
  });

  it('does not let the model end the interview early', () => {
    expect(resolveAction('END', ['FOLLOW_UP', 'NEXT'])).toBe('NEXT');
  });

  it('maps actions to message metadata', () => {
    const state = deriveTurnState([interviewer('question', 2)]);
    expect(interviewerMetaFor('FOLLOW_UP', state)).toEqual({
      kind: 'follow_up',
      planIndex: 2,
    });
    expect(interviewerMetaFor('NEXT', state)).toEqual({
      kind: 'question',
      planIndex: 3,
    });
    expect(interviewerMetaFor('END', state)).toEqual({
      kind: 'closing',
      planIndex: 2,
    });
  });
});

describe('transitionFor', () => {
  const plan = buildInterviewPlan(base);
  const state = deriveTurnState([interviewer('question', 1)]);

  it('adds nothing when the model chose the applied move itself', () => {
    expect(transitionFor('NEXT', 'NEXT', plan, state)).toBeNull();
    expect(transitionFor('FOLLOW_UP', null, plan, state)).toBeNull();
  });

  it('asks the next planned question when the server forces advancing', () => {
    expect(transitionFor('NEXT', 'FOLLOW_UP', plan, state)).toBe(
      `Let’s move on. ${plan.items[2].fallbackQuestion}`,
    );
    expect(transitionFor('NEXT', null, plan, state)).toContain(
      plan.items[2].fallbackQuestion,
    );
  });

  it('closes cleanly when the server forces the end', () => {
    expect(transitionFor('END', 'FOLLOW_UP', plan, state)).toBe(
      CLOSING_MESSAGE,
    );
  });
});

describe('groupTranscript', () => {
  const plan = buildInterviewPlan(base);

  it('assigns every answer to the plan question it responds to', () => {
    const groups = groupTranscript(plan, [
      interviewer('question', 0),
      candidate('a0'),
      interviewer('follow_up', 0),
      candidate('a0b'),
      interviewer('question', 1),
      candidate('a1'),
      interviewer('question', 2),
    ]);
    expect(groups.map((g) => [g.item.index, g.answered])).toEqual([
      [0, true],
      [1, true],
      [2, false],
    ]);
    expect(
      groups[0].exchanges
        .filter((e) => e.role === 'CANDIDATE')
        .map((e) => e.content),
    ).toEqual(['a0', 'a0b']);
  });

  it('excludes the closing message from graded content', () => {
    const groups = groupTranscript(plan, [
      interviewer('question', 0),
      candidate(),
      interviewer('closing', 0),
    ]);
    expect(groups[0].exchanges).toHaveLength(2);
  });
});
