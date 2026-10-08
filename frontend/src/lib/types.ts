/** Shapes returned by the InterviewPilot API. */

export type MessageRole = 'INTERVIEWER' | 'CANDIDATE' | 'SYSTEM';

export interface InterviewMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  metadata?: {
    kind?: 'question' | 'follow_up' | 'closing';
    planIndex?: number;
    clientMessageId?: string;
  } | null;
}

export interface InterviewProgress {
  current: number;
  total: number;
  focus: string | null;
  concluded: boolean;
  answers: number;
}

export interface PlanItemSummary {
  index: number;
  kind: string;
  focus: string;
}

export type InterviewStatus =
  | 'SETUP'
  | 'IN_PROGRESS'
  | 'CODING'
  | 'COMPLETED'
  | 'ABANDONED';

export interface ReportDimension {
  key: string;
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
  kind: string;
  focus: string;
  question: string;
  answered: boolean;
  rating: number | null;
  score: number | null;
  strengths: string[];
  gaps: string[];
  betterAnswer: string;
}

export interface RoadmapItem {
  topic: string;
  priority: string;
  /** `resources` on reports created before structured evaluation. */
  actions?: string[];
  resources?: string[];
}

export interface InterviewReport {
  id: string;
  overallScore: number;
  readinessPercent: number;
  communicationScore: number | null;
  technicalScore: number | null;
  confidenceScore: number | null;
  problemSolvingScore: number | null;
  codingScore: number | null;
  systemDesignScore: number | null;
  behavioralScore: number | null;
  strengths: string[];
  weaknesses: string[];
  knowledgeGaps: string[];
  topicsToRevise: string[];
  mistakes: string[];
  learningRoadmap: RoadmapItem[] | null;
  dimensions: ReportDimension[] | null;
  questionFeedback: QuestionFeedback[] | null;
  summary: string;
}

export interface CodingSubmission {
  id: string;
  problemId: string;
  problemTitle: string;
  language: string;
  difficulty: string;
  testsPassed: number;
  testsTotal: number;
  hintsUsed: number;
  createdAt: string;
}

export interface InterviewEvent {
  id: string;
  type: 'FOCUS_LOST' | 'COPY_PASTE' | 'FULLSCREEN_EXIT' | 'HINT_REQUESTED';
  createdAt: string;
}

export interface Interview {
  id: string;
  role: string;
  type: string;
  difficulty: string;
  personality: string;
  status: InterviewStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationSecs: number | null;
  config: { examMode?: boolean; includeCoding?: boolean; topics?: string[] } | null;
  messages: InterviewMessage[];
  plan: PlanItemSummary[];
  progress: InterviewProgress | null;
  report: InterviewReport | null;
  codingSubs: CodingSubmission[];
  events: InterviewEvent[];
}

export interface TurnResult {
  candidate: InterviewMessage;
  interviewer: InterviewMessage;
  progress: InterviewProgress;
}

export interface CompletionResult {
  status: InterviewStatus;
  report: InterviewReport | null;
}
