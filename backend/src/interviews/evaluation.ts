import { WEAK_AREA_VOCABULARY } from '../ai/interview.constants';
import type {
  InterviewPlan,
  PlanItemKind,
  PlanItemTranscript,
} from './interview-plan';

/**
 * Scoring model
 * -------------
 * The evaluator model rates each applicable dimension and each answered
 * question on an anchored 1–5 scale and must justify every rating with a
 * rationale and evidence from the transcript. Everything numeric that the
 * candidate sees is then computed here, deterministically:
 *
 *   dimension score = rating × 20                       (1–5 → 20–100)
 *   coding score    = mean over problems of the best pass rate, from tests
 *   overall score   = weighted mean of the available dimension scores,
 *                     weights depending on the interview type
 *   readiness       = overall × share of planned questions answered
 *
 * The model never produces the headline numbers, so a transcript that says
 * "give me 100" cannot move them except through the per-dimension ratings,
 * which are validated and each tied to a written justification.
 */

export type DimensionKey =
  | 'technical'
  | 'problemSolving'
  | 'communication'
  | 'behavioral'
  | 'confidence'
  | 'systemDesign'
  | 'coding';

export interface DimensionDefinition {
  key: DimensionKey;
  label: string;
  description: string;
}

export const DIMENSIONS: Record<DimensionKey, DimensionDefinition> = {
  technical: {
    key: 'technical',
    label: 'Technical accuracy & depth',
    description:
      'correctness and precision of technical statements and depth of understanding beyond definitions',
  },
  problemSolving: {
    key: 'problemSolving',
    label: 'Problem solving & judgment',
    description:
      'structured reasoning, considering alternatives, edge cases and trade-offs, and sound judgment',
  },
  communication: {
    key: 'communication',
    label: 'Communication',
    description:
      'clear, structured and concise answers that address the question that was asked',
  },
  behavioral: {
    key: 'behavioral',
    label: 'Experience & impact',
    description:
      'specific real examples (STAR), personal ownership of actions, and concrete, ideally measurable outcomes',
  },
  confidence: {
    key: 'confidence',
    label: 'Composure & ownership',
    description:
      'commits to clear positions, handles follow-up pressure, and acknowledges gaps honestly instead of bluffing',
  },
  systemDesign: {
    key: 'systemDesign',
    label: 'System design',
    description:
      'clarifies requirements, proposes a coherent architecture, and reasons about scale, data and failure modes',
  },
  coding: {
    key: 'coding',
    label: 'Coding (automated tests)',
    description: 'share of test cases passed in the coding round',
  },
};

const TYPE_WEIGHTS: Record<string, Partial<Record<DimensionKey, number>>> = {
  TECHNICAL: {
    technical: 35,
    problemSolving: 25,
    communication: 15,
    confidence: 10,
    systemDesign: 15,
    coding: 20,
  },
  MIXED: {
    technical: 25,
    problemSolving: 15,
    behavioral: 15,
    communication: 15,
    confidence: 10,
    systemDesign: 10,
    coding: 15,
  },
  BEHAVIORAL: {
    behavioral: 40,
    communication: 25,
    problemSolving: 20,
    confidence: 15,
  },
  HR: { communication: 35, behavioral: 35, confidence: 30 },
  MANAGERIAL: {
    behavioral: 30,
    problemSolving: 25,
    technical: 15,
    communication: 20,
    confidence: 10,
  },
};

export function weightsFor(
  type: string,
): Partial<Record<DimensionKey, number>> {
  return TYPE_WEIGHTS[type] ?? TYPE_WEIGHTS.MIXED;
}

/** Dimensions the evaluator model must rate for this interview. */
export function evaluatorDimensions(
  type: string,
  groups: PlanItemTranscript[],
): DimensionKey[] {
  const answeredDesign = groups.some(
    (g) => g.item.kind === 'system_design' && g.answered,
  );
  return (Object.keys(weightsFor(type)) as DimensionKey[]).filter(
    (key) => key !== 'coding' && (key !== 'systemDesign' || answeredDesign),
  );
}

// ---------------------------------------------------------------------------
// Validation of the evaluator's JSON
// ---------------------------------------------------------------------------

export interface DimensionRating {
  rating: number;
  rationale: string;
  evidence: string[];
}

export interface QuestionRating {
  rating: number;
  strengths: string[];
  gaps: string[];
  betterAnswer: string;
}

export interface RoadmapItem {
  topic: string;
  priority: 'high' | 'medium' | 'low';
  actions: string[];
}

export interface ValidatedEvaluation {
  dimensions: Partial<Record<DimensionKey, DimensionRating>>;
  /** Keyed by plan index. */
  questions: Map<number, QuestionRating>;
  strengths: string[];
  improvements: string[];
  knowledgeGaps: string[];
  mistakes: string[];
  weakTopics: string[];
  roadmap: RoadmapItem[];
  summary: string;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cleanList(value: unknown, maxItems: number, maxLen = 300): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = cleanText(entry, maxLen);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Accepts integers 1–5 (or numeric strings); anything else is "not rated". */
export function parseRating(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
}

function canonicalTopic(value: string): string | null {
  const needle = value.trim().toLowerCase();
  return WEAK_AREA_VOCABULARY.find((t) => t.toLowerCase() === needle) ?? null;
}

export interface EvaluationContext {
  dimensions: DimensionKey[];
  /** Plan indices of questions the candidate answered. */
  answeredPlanIndices: number[];
}

/**
 * Parses and validates the evaluator output. Returns null when the output is
 * unusable (not JSON, or no dimension was rated), so the caller can retry
 * rather than persist a meaningless report.
 */
export function parseEvaluation(
  raw: string,
  ctx: EvaluationContext,
): ValidatedEvaluation | null {
  let parsed: Record<string, unknown> | null;
  try {
    parsed = asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
  if (!parsed) return null;

  const dimensions: ValidatedEvaluation['dimensions'] = {};
  const rawDimensions = asRecord(parsed.dimensions) ?? {};
  for (const key of ctx.dimensions) {
    const entry = asRecord(rawDimensions[key]);
    const rating = parseRating(entry?.rating);
    if (rating === null) continue;
    dimensions[key] = {
      rating,
      rationale: cleanText(entry?.rationale, 600),
      evidence: cleanList(entry?.evidence, 3),
    };
  }
  if (Object.keys(dimensions).length === 0) return null;

  const questions = new Map<number, QuestionRating>();
  const answered = new Set(ctx.answeredPlanIndices);
  if (Array.isArray(parsed.questions)) {
    for (const value of parsed.questions) {
      const entry = asRecord(value);
      const q = typeof entry?.q === 'string' ? Number(entry.q) : entry?.q;
      const planIndex = typeof q === 'number' ? q - 1 : NaN;
      const rating = parseRating(entry?.rating);
      if (!answered.has(planIndex) || rating === null) continue;
      if (questions.has(planIndex)) continue;
      questions.set(planIndex, {
        rating,
        strengths: cleanList(entry?.strengths, 3),
        gaps: cleanList(entry?.gaps, 3),
        betterAnswer: cleanText(entry?.betterAnswer, 800),
      });
    }
  }

  const weakTopics = [
    ...new Set(
      cleanList(parsed.weakTopics, 10, 60)
        .map(canonicalTopic)
        .filter((t): t is string => t !== null),
    ),
  ].slice(0, 5);

  const roadmap: RoadmapItem[] = [];
  if (Array.isArray(parsed.roadmap)) {
    for (const value of parsed.roadmap) {
      const entry = asRecord(value);
      const topic = cleanText(entry?.topic, 80);
      if (!topic) continue;
      const priority =
        entry?.priority === 'high' || entry?.priority === 'low'
          ? entry.priority
          : 'medium';
      roadmap.push({ topic, priority, actions: cleanList(entry?.actions, 4) });
      if (roadmap.length >= 5) break;
    }
  }

  return {
    dimensions,
    questions,
    strengths: cleanList(parsed.strengths, 5),
    improvements: cleanList(parsed.improvements, 5),
    knowledgeGaps: cleanList(parsed.knowledgeGaps, 6),
    mistakes: cleanList(parsed.mistakes, 6),
    weakTopics,
    roadmap,
    summary: cleanText(parsed.summary, 2000),
  };
}

// ---------------------------------------------------------------------------
// Deterministic scoring
// ---------------------------------------------------------------------------

export const ratingToScore = (rating: number): number => rating * 20;

export interface CodingResult {
  problemId: string;
  testsPassed: number;
  testsTotal: number;
}

/** Mean, over attempted problems, of the best pass rate achieved (0–100). */
export function computeCodingScore(submissions: CodingResult[]): number | null {
  const best = new Map<string, number>();
  for (const s of submissions) {
    if (s.testsTotal <= 0) continue;
    const rate = s.testsPassed / s.testsTotal;
    best.set(s.problemId, Math.max(best.get(s.problemId) ?? 0, rate));
  }
  if (best.size === 0) return null;
  const mean = [...best.values()].reduce((a, b) => a + b, 0) / best.size;
  return Math.round(mean * 100);
}

export interface ReportDimension {
  key: DimensionKey;
  label: string;
  description: string;
  rating: number | null;
  score: number | null;
  weight: number;
  rationale: string;
  evidence: string[];
  source: 'evaluator' | 'tests';
}

export interface QuestionFeedback {
  planIndex: number;
  kind: PlanItemKind;
  focus: string;
  question: string;
  answered: boolean;
  rating: number | null;
  score: number | null;
  strengths: string[];
  gaps: string[];
  betterAnswer: string;
}

export interface AssembledReport {
  overallScore: number;
  readinessPercent: number;
  communicationScore: number | null;
  technicalScore: number | null;
  confidenceScore: number | null;
  problemSolvingScore: number | null;
  behavioralScore: number | null;
  systemDesignScore: number | null;
  codingScore: number | null;
  dimensions: ReportDimension[];
  questionFeedback: QuestionFeedback[];
  strengths: string[];
  weaknesses: string[];
  knowledgeGaps: string[];
  topicsToRevise: string[];
  mistakes: string[];
  learningRoadmap: RoadmapItem[];
  summary: string;
}

export function weightedOverall(dimensions: ReportDimension[]): number {
  let total = 0;
  let weight = 0;
  for (const d of dimensions) {
    if (d.score === null || d.weight <= 0) continue;
    total += d.score * d.weight;
    weight += d.weight;
  }
  return weight > 0 ? Math.round(total / weight) : 0;
}

export function readinessFor(
  overall: number,
  answeredQuestions: number,
  plannedQuestions: number,
): number {
  if (plannedQuestions <= 0) return 0;
  const coverage = Math.min(1, answeredQuestions / plannedQuestions);
  return Math.round(overall * coverage);
}

export interface AssembleInput {
  type: string;
  plan: InterviewPlan;
  groups: PlanItemTranscript[];
  evaluation: ValidatedEvaluation;
  codingScore: number | null;
}

export function assembleReport(input: AssembleInput): AssembledReport {
  const { evaluation, groups, plan } = input;
  const weights = weightsFor(input.type);

  const dimensions: ReportDimension[] = [];
  for (const key of Object.keys(weights) as DimensionKey[]) {
    const def = DIMENSIONS[key];
    if (key === 'coding') {
      if (input.codingScore === null) continue;
      dimensions.push({
        ...def,
        rating: null,
        score: input.codingScore,
        weight: weights.coding ?? 0,
        rationale: 'Measured by automated test cases in the coding round.',
        evidence: [],
        source: 'tests',
      });
      continue;
    }
    const rated = evaluation.dimensions[key];
    if (!rated) continue;
    dimensions.push({
      ...def,
      rating: rated.rating,
      score: ratingToScore(rated.rating),
      weight: weights[key] ?? 0,
      rationale: rated.rationale,
      evidence: rated.evidence,
      source: 'evaluator',
    });
  }

  const questionFeedback: QuestionFeedback[] = groups.map((group) => {
    const rated = evaluation.questions.get(group.item.index);
    const question =
      group.exchanges.find((e) => e.role === 'INTERVIEWER')?.content ?? '';
    return {
      planIndex: group.item.index,
      kind: group.item.kind,
      focus: group.item.focus,
      question: cleanText(question, 500),
      answered: group.answered,
      rating: group.answered ? (rated?.rating ?? null) : null,
      score: group.answered && rated ? ratingToScore(rated.rating) : null,
      strengths: rated?.strengths ?? [],
      gaps: rated?.gaps ?? [],
      betterAnswer: rated?.betterAnswer ?? '',
    };
  });

  const overallScore = weightedOverall(dimensions);
  const answered = groups.filter((g) => g.answered).length;
  const scoreOf = (key: DimensionKey) =>
    dimensions.find((d) => d.key === key)?.score ?? null;

  return {
    overallScore,
    readinessPercent: readinessFor(overallScore, answered, plan.items.length),
    communicationScore: scoreOf('communication'),
    technicalScore: scoreOf('technical'),
    confidenceScore: scoreOf('confidence'),
    problemSolvingScore: scoreOf('problemSolving'),
    behavioralScore: scoreOf('behavioral'),
    systemDesignScore: scoreOf('systemDesign'),
    codingScore: input.codingScore,
    dimensions,
    questionFeedback,
    strengths: evaluation.strengths,
    weaknesses: evaluation.improvements,
    knowledgeGaps: evaluation.knowledgeGaps,
    topicsToRevise: evaluation.weakTopics,
    mistakes: evaluation.mistakes,
    learningRoadmap: evaluation.roadmap,
    summary: evaluation.summary,
  };
}

/**
 * How each tracked weak area should change after this interview. A weak answer
 * (rating ≤ 2) on a plan question adds a strike; a strong one (≥ 4) removes
 * one, so areas the candidate has improved on drop out of the practice plan.
 * Topics the evaluator flagged but no question covered add a strike.
 */
export function weakAreaDeltas(
  questionFeedback: QuestionFeedback[],
  flaggedTopics: string[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const q of questionFeedback) {
    if (!q.answered || q.rating === null) continue;
    const topic = canonicalTopic(q.focus);
    if (!topic) continue;
    const change = q.rating <= 2 ? 1 : q.rating >= 4 ? -1 : 0;
    if (change !== 0) deltas.set(topic, (deltas.get(topic) ?? 0) + change);
  }
  for (const flagged of flaggedTopics) {
    const topic = canonicalTopic(flagged);
    if (topic && !deltas.has(topic)) deltas.set(topic, 1);
  }
  return deltas;
}
