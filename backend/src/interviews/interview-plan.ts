import {
  COMPETENCIES,
  TECHNICAL_TOPICS,
  personalityConfig,
} from '../ai/interview.constants';

/**
 * The interview plan is built deterministically when an interview is created
 * and stored in `Interview.config`. It decides *what* is covered and in which
 * order; the model only decides *how* to phrase each question and whether an
 * answer deserves a follow-up. This keeps sessions focused on the selected
 * topics, gives the candidate a visible progress indicator, and lets the
 * evaluation map every answer to a specific question.
 */

export type PlanItemKind =
  | 'intro'
  | 'resume'
  | 'technical'
  | 'system_design'
  | 'behavioral'
  | 'hr'
  | 'leadership';

export interface PlanItem {
  index: number;
  kind: PlanItemKind;
  /** Short label shown to the candidate and used for weak-area tracking. */
  focus: string;
  /** Instruction for the interviewer model describing what to probe. */
  guidance: string;
  /** Deterministic question used if the model is unavailable at start-up. */
  fallbackQuestion: string;
}

export interface InterviewPlan {
  version: 1;
  items: PlanItem[];
  maxFollowUps: number;
}

export interface InterviewConfig {
  role: string;
  experience: string;
  type: string;
  difficulty: string;
  personality: string;
  topics: string[];
  includeCoding: boolean;
  includeResume: boolean;
  examMode: boolean;
  /** Absent on interviews created before plans existed. */
  plan?: InterviewPlan;
}

export const PLAN_LENGTH: Record<string, number> = {
  TECHNICAL: 6,
  MIXED: 7,
  BEHAVIORAL: 5,
  HR: 5,
  MANAGERIAL: 5,
};

/** Hard cap on candidate turns per interview, independent of the plan. */
export const MAX_CANDIDATE_TURNS = 40;

const TECHNICAL_ANGLES = [
  'core concepts and how they work under the hood',
  'applying it to a realistic problem from a production application',
  'design trade-offs and the alternatives they would consider',
  'debugging, edge cases and failure modes',
];

interface CompetencyPrompt {
  guidance: string;
  question: string;
}

const COMPETENCY_PROMPTS: Record<string, CompetencyPrompt> = {
  Ownership: {
    guidance:
      'a time they took responsibility for an outcome beyond their assigned scope; probe what they personally did and the measurable result',
    question:
      'Tell me about a time you took ownership of a problem that was not strictly your responsibility. What did you do, and what was the result?',
  },
  Teamwork: {
    guidance:
      'how they collaborate: a project where the team outcome depended on how they worked with others',
    question:
      'Describe a project where the outcome depended on how well you worked with others. What was your role and how did you make the collaboration work?',
  },
  'Conflict Resolution': {
    guidance:
      'a real disagreement with a colleague or stakeholder, how they handled it and what changed',
    question:
      'Tell me about a time you strongly disagreed with a teammate or stakeholder. How did you handle it and what was the outcome?',
  },
  'Handling Failure': {
    guidance:
      'a mistake or failure they were responsible for, how they responded and what they learned',
    question:
      'Tell me about a mistake you made at work that had real consequences. What happened, how did you respond, and what did you change afterwards?',
  },
  Prioritization: {
    guidance:
      'how they decide between competing priorities under time pressure, with a concrete example',
    question:
      'Describe a time you had more work than you could deliver by a deadline. How did you decide what to do first, and what did you drop?',
  },
  Communication: {
    guidance:
      'explaining something complex to a non-technical audience or communicating bad news',
    question:
      'Tell me about a time you had to explain a complex technical problem or bad news to a non-technical stakeholder. How did you approach it?',
  },
  'Decision Making': {
    guidance:
      'a significant technical decision: the options, the trade-offs, how they decided and how it turned out',
    question:
      'Walk me through a significant technical decision you made. What options did you consider, why did you choose the one you did, and how did it turn out?',
  },
  Leadership: {
    guidance:
      'leading a team or initiative without formal authority, setting direction and getting buy-in',
    question:
      'Tell me about a time you led an initiative or team, formally or informally. How did you set direction and get people on board?',
  },
  Mentoring: {
    guidance:
      'growing other engineers: mentoring, code review culture, giving difficult feedback',
    question:
      'Tell me about an engineer you helped grow. What did you do, and how did you handle feedback they did not want to hear?',
  },
  'Stakeholder Management': {
    guidance:
      'managing expectations of product or business stakeholders when scope, time or quality conflicted',
    question:
      'Describe a time product or business stakeholders wanted something you believed was the wrong call. How did you handle it?',
  },
  'Self-awareness': {
    guidance:
      'their genuine strengths and a real weakness, with evidence and what they are doing about it',
    question:
      'What would your last manager say is your biggest strength, and what is one area you are actively working to improve?',
  },
  Motivation: {
    guidance:
      'why this role and type of work, and what they are looking for in their next position',
    question:
      'Why are you interested in this role, and what are you looking for in your next position?',
  },
};

const INTRO_ITEM = {
  kind: 'intro' as const,
  focus: 'Background',
  guidance:
    'ask the candidate to briefly introduce themselves: current role, the most relevant experience for this position, and what they are looking for next',
  fallbackQuestion:
    'To start, please introduce yourself: your current role, the work you are most proud of, and what you are looking for next.',
};

const RESUME_ITEM = {
  kind: 'resume' as const,
  focus: 'Resume project',
  guidance:
    'pick one substantial project from the candidate’s resume and ask what they personally built, the key technical decision they made, and why',
  fallbackQuestion:
    'Let’s start with your experience. Pick the project on your resume you are most proud of and walk me through what you personally built and the most important technical decision you made.',
};

const RECENT_PROJECT_ITEM = {
  kind: 'resume' as const,
  focus: 'Recent project',
  guidance:
    'ask about the most technically interesting project they worked on recently: their personal contribution, the architecture, and one hard problem they solved',
  fallbackQuestion:
    'Tell me about the most technically interesting project you worked on recently. What did you personally build, and what was the hardest problem you solved?',
};

const HR_FOCUSES = [
  'Self-awareness',
  'Motivation',
  'Teamwork',
  'Communication',
] as const;

const BEHAVIORAL_DEFAULT = [
  'Ownership',
  'Teamwork',
  'Conflict Resolution',
  'Handling Failure',
  'Prioritization',
];
const BEHAVIORAL_SENIOR = [
  'Ownership',
  'Leadership',
  'Conflict Resolution',
  'Decision Making',
  'Stakeholder Management',
];
const MANAGERIAL_COMPETENCIES = [
  'Ownership',
  'Decision Making',
  'Mentoring',
  'Prioritization',
  'Stakeholder Management',
];

const isSeniorLevel = (experience: string) =>
  ['5-8 years', 'Senior', 'Staff'].includes(experience);

const isTechnicalTopic = (t: string) =>
  (TECHNICAL_TOPICS as readonly string[]).includes(t);
const isCompetency = (t: string) =>
  (COMPETENCIES as readonly string[]).includes(t);

/** Weak areas first, then the defaults, without duplicates. */
function prioritize(weak: string[], defaults: string[]): string[] {
  return [...new Set([...weak, ...defaults])];
}

function competencyItem(
  focus: string,
  kind: 'behavioral' | 'hr' | 'leadership',
): Omit<PlanItem, 'index'> {
  const prompt = COMPETENCY_PROMPTS[focus] ?? COMPETENCY_PROMPTS.Ownership;
  return {
    kind,
    focus,
    guidance: `ask about ${prompt.guidance}`,
    fallbackQuestion: prompt.question,
  };
}

function technicalItems(
  topics: string[],
  count: number,
  difficulty: string,
  allowSystemDesign: boolean,
): Omit<PlanItem, 'index'>[] {
  const pool = topics.filter((t) => t !== 'System Design' || allowSystemDesign);
  const source = pool.length > 0 ? pool : ['JavaScript'];
  const seen = new Map<string, number>();
  const items: Omit<PlanItem, 'index'>[] = [];

  for (let i = 0; items.length < count && i < count * 4; i++) {
    const focus = source[i % source.length];
    const occurrence = seen.get(focus) ?? 0;
    if (focus === 'System Design') {
      // One design discussion per interview, unless it is the only topic.
      if (occurrence > 0 && source.length > 1) continue;
      seen.set(focus, occurrence + 1);
      items.push(systemDesignItem(occurrence));
      continue;
    }
    seen.set(focus, occurrence + 1);
    const angle = TECHNICAL_ANGLES[occurrence % TECHNICAL_ANGLES.length];
    items.push({
      kind: 'technical',
      focus,
      guidance: `ask a ${difficulty}-level question about ${focus}, focusing on ${angle}`,
      fallbackQuestion: `Let’s talk about ${focus}. Pick a concept in ${focus} you rely on in day-to-day work, explain how it works under the hood, and describe a time it mattered in a real project.`,
    });
  }
  return items;
}

function systemDesignItem(occurrence = 0): Omit<PlanItem, 'index'> {
  return {
    kind: 'system_design',
    focus: 'System Design',
    guidance: `pose a system design problem suited to the role (for example a feature the candidate might realistically build)${
      occurrence > 0 ? ', different from any earlier design question' : ''
    }; probe requirements, components, data flow, scaling and trade-offs`,
    fallbackQuestion:
      'Let’s do a design question. Pick a product feature you have built or use daily and walk me through how you would design its backend to serve a million users.',
  };
}

export interface PlanInput {
  type: string;
  experience: string;
  difficulty: string;
  personality: string;
  topics: string[];
  weakAreas: string[];
  hasResume: boolean;
}

export function buildInterviewPlan(input: PlanInput): InterviewPlan {
  const length = PLAN_LENGTH[input.type] ?? PLAN_LENGTH.MIXED;
  const weakTechnical = input.weakAreas.filter(isTechnicalTopic);
  const weakCompetencies = input.weakAreas.filter(isCompetency);
  const senior = isSeniorLevel(input.experience);
  const items: Omit<PlanItem, 'index'>[] = [];

  switch (input.type) {
    case 'TECHNICAL': {
      if (input.hasResume) items.push(RESUME_ITEM);
      // Weak technical areas are folded in, but never displace every topic
      // the candidate explicitly chose.
      const topics = prioritize(weakTechnical.slice(0, 2), input.topics);
      items.push(
        ...technicalItems(
          topics,
          length - items.length,
          input.difficulty,
          true,
        ),
      );
      break;
    }
    case 'BEHAVIORAL': {
      const order = prioritize(
        weakCompetencies,
        senior ? BEHAVIORAL_SENIOR : BEHAVIORAL_DEFAULT,
      );
      items.push(
        ...order.slice(0, length).map((c) => competencyItem(c, 'behavioral')),
      );
      break;
    }
    case 'HR': {
      items.push(INTRO_ITEM);
      const order = prioritize(
        weakCompetencies.filter((c) =>
          (HR_FOCUSES as readonly string[]).includes(c),
        ),
        [...HR_FOCUSES],
      );
      items.push(
        ...order.slice(0, length - 1).map((c) => competencyItem(c, 'hr')),
      );
      break;
    }
    case 'MANAGERIAL': {
      const order = prioritize(weakCompetencies, MANAGERIAL_COMPETENCIES);
      items.push(
        ...order.slice(0, length).map((c) => competencyItem(c, 'leadership')),
      );
      break;
    }
    default: {
      // MIXED: a realistic end-to-end loop.
      items.push(INTRO_ITEM);
      items.push(input.hasResume ? RESUME_ITEM : RECENT_PROJECT_ITEM);
      const wantsDesign = input.topics.includes('System Design') || senior;
      const technicalCount = wantsDesign ? 2 : 3;
      const topics = prioritize(weakTechnical.slice(0, 1), input.topics);
      items.push(
        ...technicalItems(topics, technicalCount, input.difficulty, false),
      );
      if (wantsDesign) items.push(systemDesignItem());
      const behavioral = prioritize(
        weakCompetencies,
        senior ? BEHAVIORAL_SENIOR : BEHAVIORAL_DEFAULT,
      );
      items.push(
        ...behavioral
          .slice(0, length - items.length)
          .map((c) => competencyItem(c, 'behavioral')),
      );
      break;
    }
  }

  return {
    version: 1,
    items: items.slice(0, length).map((item, index) => ({ ...item, index })),
    maxFollowUps: personalityConfig(input.personality).maxFollowUps,
  };
}

/** Plan for interviews created before plans were stored. */
export function resolvePlan(config: InterviewConfig): InterviewPlan {
  return (
    config.plan ??
    buildInterviewPlan({
      type: config.type,
      experience: config.experience,
      difficulty: config.difficulty,
      personality: config.personality,
      topics: config.topics ?? [],
      weakAreas: [],
      hasResume: false,
    })
  );
}

// ---------------------------------------------------------------------------
// Turn state
// ---------------------------------------------------------------------------

export type InterviewerMessageKind = 'question' | 'follow_up' | 'closing';

export interface InterviewerMeta {
  kind: InterviewerMessageKind;
  planIndex: number;
}

export interface CandidateMeta {
  clientMessageId?: string;
  planIndex: number;
}

export interface TranscriptMessage {
  role: 'INTERVIEWER' | 'CANDIDATE' | 'SYSTEM';
  content: string;
  metadata?: unknown;
}

export interface TurnState {
  /** Plan item currently being discussed. */
  planIndex: number;
  /** Follow-ups already asked on the current plan item. */
  followUpsUsed: number;
  /** The interviewer has closed the interview. */
  concluded: boolean;
  /** Number of answers the candidate has given. */
  candidateTurns: number;
}

export function readInterviewerMeta(metadata: unknown): InterviewerMeta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  if (
    (m.kind === 'question' || m.kind === 'follow_up' || m.kind === 'closing') &&
    typeof m.planIndex === 'number'
  ) {
    return { kind: m.kind, planIndex: m.planIndex };
  }
  return null;
}

/**
 * Replays the transcript to find where the interview is. Interviewer messages
 * without metadata (legacy sessions) count as a question if first, otherwise
 * as a follow-up on the current item.
 */
export function deriveTurnState(messages: TranscriptMessage[]): TurnState {
  const state: TurnState = {
    planIndex: 0,
    followUpsUsed: 0,
    concluded: false,
    candidateTurns: 0,
  };
  let seenInterviewer = false;

  for (const message of messages) {
    if (message.role === 'CANDIDATE') {
      state.candidateTurns++;
      continue;
    }
    if (message.role !== 'INTERVIEWER') continue;

    const meta = readInterviewerMeta(message.metadata);
    const kind = meta?.kind ?? (seenInterviewer ? 'follow_up' : 'question');
    seenInterviewer = true;

    if (kind === 'question') {
      state.planIndex = meta?.planIndex ?? state.planIndex;
      state.followUpsUsed = 0;
    } else if (kind === 'follow_up') {
      state.followUpsUsed++;
    } else {
      state.concluded = true;
    }
  }
  return state;
}

export type TurnAction = 'FOLLOW_UP' | 'NEXT' | 'END';

/** Actions the interviewer may take on this turn, enforced server-side. */
export function allowedActions(
  plan: InterviewPlan,
  state: TurnState,
): TurnAction[] {
  const isLast = state.planIndex >= plan.items.length - 1;
  const advance: TurnAction = isLast ? 'END' : 'NEXT';
  return state.followUpsUsed < plan.maxFollowUps
    ? ['FOLLOW_UP', advance]
    : [advance];
}

/**
 * Coerces the action the model chose (or failed to choose) into one the plan
 * allows. A missing tag is treated as a follow-up when one is still allowed,
 * because that is what an untagged reply almost always is.
 */
export function resolveAction(
  chosen: TurnAction | null,
  allowed: TurnAction[],
): TurnAction {
  if (chosen && allowed.includes(chosen)) return chosen;
  if (chosen === null && allowed.includes('FOLLOW_UP')) return 'FOLLOW_UP';
  return allowed.find((a) => a !== 'FOLLOW_UP') ?? allowed[0];
}

export const CLOSING_MESSAGE =
  'That covers everything I wanted to ask — thank you for your time. You can end the session now to see your report.';

/**
 * Text appended when the server overrides the model's move, so the message
 * the candidate sees always matches the plan: if the interview is forced to
 * advance, the next planned question is actually asked; if it is forced to
 * end, it closes cleanly instead of leaving a question hanging.
 */
export function transitionFor(
  applied: TurnAction,
  chosen: TurnAction | null,
  plan: InterviewPlan,
  state: TurnState,
): string | null {
  if (applied === chosen || applied === 'FOLLOW_UP') return null;
  if (applied === 'END') return CLOSING_MESSAGE;
  const next = plan.items[state.planIndex + 1];
  return next ? `Let’s move on. ${next.fallbackQuestion}` : null;
}

export function interviewerMetaFor(
  action: TurnAction,
  state: TurnState,
): InterviewerMeta {
  switch (action) {
    case 'FOLLOW_UP':
      return { kind: 'follow_up', planIndex: state.planIndex };
    case 'NEXT':
      return { kind: 'question', planIndex: state.planIndex + 1 };
    case 'END':
      return { kind: 'closing', planIndex: state.planIndex };
  }
}

export interface InterviewProgress {
  /** 1-based number of the current plan question. */
  current: number;
  total: number;
  focus: string | null;
  concluded: boolean;
  answers: number;
}

export function progressFor(
  plan: InterviewPlan,
  state: TurnState,
): InterviewProgress {
  return {
    current: Math.min(state.planIndex + 1, plan.items.length),
    total: plan.items.length,
    focus: plan.items[state.planIndex]?.focus ?? null,
    concluded: state.concluded,
    answers: state.candidateTurns,
  };
}

export interface PlanItemTranscript {
  item: PlanItem;
  /** Interviewer and candidate messages exchanged on this plan item. */
  exchanges: { role: 'INTERVIEWER' | 'CANDIDATE'; content: string }[];
  answered: boolean;
}

/** Groups the transcript by the plan item each message belongs to. */
export function groupTranscript(
  plan: InterviewPlan,
  messages: TranscriptMessage[],
): PlanItemTranscript[] {
  const groups = new Map<number, PlanItemTranscript>();
  let current = 0;
  let seenInterviewer = false;

  const groupFor = (index: number) => {
    const item = plan.items[index] ?? plan.items[plan.items.length - 1];
    let group = groups.get(item.index);
    if (!group) {
      group = { item, exchanges: [], answered: false };
      groups.set(item.index, group);
    }
    return group;
  };

  for (const message of messages) {
    if (message.role === 'SYSTEM') continue;
    if (message.role === 'INTERVIEWER') {
      const meta = readInterviewerMeta(message.metadata);
      if (meta?.kind === 'closing') continue;
      if (meta?.kind === 'question') current = meta.planIndex;
      else if (!meta && !seenInterviewer) current = 0;
      seenInterviewer = true;
    }
    const group = groupFor(current);
    group.exchanges.push({ role: message.role, content: message.content });
    if (message.role === 'CANDIDATE') group.answered = true;
  }

  return [...groups.values()].sort((a, b) => a.item.index - b.item.index);
}
