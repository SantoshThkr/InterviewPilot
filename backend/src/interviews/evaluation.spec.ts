import {
  assembleReport,
  computeCodingScore,
  evaluatorDimensions,
  parseEvaluation,
  parseRating,
  readinessFor,
  weakAreaDeltas,
  weightedOverall,
  type QuestionFeedback,
  type ReportDimension,
} from './evaluation';
import {
  buildInterviewPlan,
  groupTranscript,
  type TranscriptMessage,
} from './interview-plan';

const plan = buildInterviewPlan({
  type: 'TECHNICAL',
  experience: '2-5 years',
  difficulty: 'Intermediate',
  personality: 'Neutral',
  topics: ['React', 'System Design'],
  weakAreas: [],
  hasResume: false,
});

const q = (planIndex: number): TranscriptMessage => ({
  role: 'INTERVIEWER',
  content: `Question ${planIndex + 1}?`,
  metadata: { kind: 'question', planIndex },
});
const a = (content: string): TranscriptMessage => ({
  role: 'CANDIDATE',
  content,
});

// Q1 React and Q2 System Design answered; Q3 asked but not answered.
const groups = groupTranscript(plan, [
  q(0),
  a('React re-renders when state changes...'),
  q(1),
  a('I would start with requirements...'),
  q(2),
]);

const ctx = {
  dimensions: evaluatorDimensions('TECHNICAL', groups),
  answeredPlanIndices: [0, 1],
};

const validOutput = {
  dimensions: {
    technical: { rating: 4, rationale: 'Accurate.', evidence: ['re-renders'] },
    problemSolving: { rating: 3, rationale: 'OK.', evidence: [] },
    communication: { rating: 5, rationale: 'Clear.', evidence: [] },
    confidence: { rating: 3, rationale: 'Steady.', evidence: [] },
    systemDesign: { rating: 2, rationale: 'Shallow.', evidence: [] },
  },
  questions: [
    { q: 1, rating: 4, strengths: ['correct'], gaps: [], betterAnswer: 'x' },
    { q: 2, rating: 2, strengths: [], gaps: ['no scaling'], betterAnswer: 'y' },
    {
      q: 3,
      rating: 5,
      strengths: ['hallucinated'],
      gaps: [],
      betterAnswer: '',
    },
  ],
  strengths: ['Clear explanations'],
  improvements: ['Discuss scaling'],
  knowledgeGaps: ['Sharding'],
  mistakes: [],
  weakTopics: ['system design', 'Quantum Physics'],
  roadmap: [
    {
      topic: 'System Design',
      priority: 'urgent',
      actions: ['Design a URL shortener'],
    },
  ],
  summary: 'Solid fundamentals.',
};

describe('evaluatorDimensions', () => {
  it('asks for system design only when a design question was answered', () => {
    expect(ctx.dimensions).toContain('systemDesign');
    const onlyFirst = groups.slice(0, 1);
    expect(evaluatorDimensions('TECHNICAL', onlyFirst)).not.toContain(
      'systemDesign',
    );
  });

  it('never asks the model for the coding score', () => {
    expect(ctx.dimensions).not.toContain('coding');
  });

  it('does not rate technical depth in an HR screen', () => {
    expect(evaluatorDimensions('HR', groups)).toEqual([
      'communication',
      'behavioral',
      'confidence',
    ]);
  });
});

describe('parseRating', () => {
  it.each([
    [4, 4],
    ['3', 3],
    [4.6, 5],
    [0, null],
    [6, null],
    [85, null],
    ['high', null],
    [null, null],
  ])('%p -> %p', (input, expected) => {
    expect(parseRating(input)).toBe(expected);
  });
});

describe('parseEvaluation', () => {
  it('returns null for malformed JSON so the caller can retry', () => {
    expect(parseEvaluation('not json{', ctx)).toBeNull();
    expect(parseEvaluation('[1,2]', ctx)).toBeNull();
  });

  it('returns null when no dimension has a valid rating', () => {
    const raw = JSON.stringify({
      dimensions: {
        technical: { rating: 95 },
        communication: { rating: 'great' },
      },
    });
    expect(parseEvaluation(raw, ctx)).toBeNull();
  });

  it('ignores ratings for questions the candidate never answered', () => {
    const result = parseEvaluation(JSON.stringify(validOutput), ctx)!;
    expect([...result.questions.keys()]).toEqual([0, 1]);
  });

  it('keeps weak topics only from the closed vocabulary, canonicalised', () => {
    const result = parseEvaluation(JSON.stringify(validOutput), ctx)!;
    expect(result.weakTopics).toEqual(['System Design']);
  });

  it('normalises roadmap priority', () => {
    const result = parseEvaluation(JSON.stringify(validOutput), ctx)!;
    expect(result.roadmap[0].priority).toBe('medium');
  });

  it('ignores dimensions that were not requested', () => {
    const raw = JSON.stringify({
      dimensions: { ...validOutput.dimensions, behavioral: { rating: 5 } },
    });
    expect(parseEvaluation(raw, ctx)!.dimensions.behavioral).toBeUndefined();
  });

  it('truncates oversized text and caps list lengths', () => {
    const raw = JSON.stringify({
      ...validOutput,
      summary: 'x'.repeat(5000),
      strengths: Array.from({ length: 20 }, (_, i) => `s${i}`),
    });
    const result = parseEvaluation(raw, ctx)!;
    expect(result.summary.length).toBeLessThanOrEqual(2000);
    expect(result.strengths).toHaveLength(5);
  });
});

describe('deterministic scoring', () => {
  const dim = (
    key: ReportDimension['key'],
    score: number | null,
    weight: number,
  ): ReportDimension => ({
    key,
    label: key,
    description: '',
    rating: null,
    score,
    weight,
    rationale: '',
    evidence: [],
    source: 'evaluator',
  });

  it('computes a weighted mean over available dimensions', () => {
    expect(
      weightedOverall([dim('technical', 80, 30), dim('communication', 40, 10)]),
    ).toBe(70);
  });

  it('skips unrated dimensions instead of treating them as zero', () => {
    expect(
      weightedOverall([
        dim('technical', 80, 30),
        dim('communication', null, 10),
      ]),
    ).toBe(80);
  });

  it('scales readiness by how much of the plan was answered', () => {
    expect(readinessFor(80, 3, 6)).toBe(40);
    expect(readinessFor(80, 6, 6)).toBe(80);
    expect(readinessFor(80, 9, 6)).toBe(80);
    expect(readinessFor(80, 1, 0)).toBe(0);
  });

  it('scores coding from the best attempt per problem', () => {
    expect(
      computeCodingScore([
        { problemId: 'a', testsPassed: 1, testsTotal: 4 },
        { problemId: 'a', testsPassed: 4, testsTotal: 4 },
        { problemId: 'b', testsPassed: 1, testsTotal: 2 },
        { problemId: 'c', testsPassed: 0, testsTotal: 0 },
      ]),
    ).toBe(75);
    expect(computeCodingScore([])).toBeNull();
  });
});

describe('assembleReport', () => {
  const evaluation = parseEvaluation(JSON.stringify(validOutput), ctx)!;

  it('derives every headline number from validated ratings', () => {
    const report = assembleReport({
      type: 'TECHNICAL',
      plan,
      groups,
      evaluation,
      codingScore: null,
    });
    // technical 80×35, problemSolving 60×25, communication 100×15,
    // confidence 60×10, systemDesign 40×15  →  7000 / 100
    expect(report.overallScore).toBe(70);
    expect(report.technicalScore).toBe(80);
    expect(report.systemDesignScore).toBe(40);
    expect(report.behavioralScore).toBeNull();
    expect(report.codingScore).toBeNull();
    // 2 of 6 planned questions answered.
    expect(report.readinessPercent).toBe(23);
  });

  it('includes coding from tests as its own weighted dimension', () => {
    const report = assembleReport({
      type: 'TECHNICAL',
      plan,
      groups,
      evaluation,
      codingScore: 100,
    });
    const coding = report.dimensions.find((d) => d.key === 'coding')!;
    expect(coding.source).toBe('tests');
    expect(report.codingScore).toBe(100);
    expect(report.overallScore).toBe(Math.round((7000 + 100 * 20) / 120));
  });

  it('produces per-question feedback including unanswered questions', () => {
    const report = assembleReport({
      type: 'TECHNICAL',
      plan,
      groups,
      evaluation,
      codingScore: null,
    });
    expect(
      report.questionFeedback.map((f) => [f.planIndex, f.answered, f.rating]),
    ).toEqual([
      [0, true, 4],
      [1, true, 2],
      [2, false, null],
    ]);
    expect(report.questionFeedback[0].question).toBe('Question 1?');
  });
});

describe('weakAreaDeltas', () => {
  const feedback = (focus: string, rating: number | null, answered = true) =>
    ({ focus, rating, answered }) as QuestionFeedback;

  it('adds a strike for weak answers and removes one for strong answers', () => {
    const deltas = weakAreaDeltas(
      [feedback('React', 2), feedback('Node.js', 5), feedback('CSS', 3)],
      [],
    );
    expect(Object.fromEntries(deltas)).toEqual({ React: 1, 'Node.js': -1 });
  });

  it('ignores non-vocabulary focuses and unanswered questions', () => {
    const deltas = weakAreaDeltas(
      [feedback('Background', 1), feedback('React', 1, false)],
      [],
    );
    expect(deltas.size).toBe(0);
  });

  it('adds flagged topics that no question covered', () => {
    const deltas = weakAreaDeltas(
      [feedback('React', 5)],
      ['React', 'Security'],
    );
    expect(Object.fromEntries(deltas)).toEqual({ React: -1, Security: 1 });
  });
});
