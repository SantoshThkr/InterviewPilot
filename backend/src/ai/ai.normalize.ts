export interface InterviewReportPayload {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  confidenceScore: number;
  problemSolvingScore: number;
  codingScore: number | null;
  systemDesignScore: number | null;
  behavioralScore: number | null;
  strengths: string[];
  weaknesses: string[];
  knowledgeGaps: string[];
  topicsToRevise: string[];
  mistakes: string[];
  learningRoadmap: Array<{
    topic: string;
    priority?: string;
    resources?: string[];
  }>;
  readinessPercent: number;
  summary: string;
}

export interface ResumeAnalysis {
  companies: unknown[];
  projects: unknown[];
  technologies: unknown[];
  experienceYears: number;
  achievements: unknown[];
  careerGaps: unknown[];
  suggestedQuestionTopics: unknown[];
}

const clampScore = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;

const optionalScore = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : null;

const stringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : [];

/** Normalize (possibly malformed) model JSON into a fully-shaped report. */
export function normalizeReport(raw: string): InterviewReportPayload {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      overallScore: 0,
      communicationScore: 0,
      technicalScore: 0,
      confidenceScore: 0,
      problemSolvingScore: 0,
      codingScore: null,
      systemDesignScore: null,
      behavioralScore: null,
      strengths: [],
      weaknesses: [],
      knowledgeGaps: [],
      topicsToRevise: [],
      mistakes: [],
      learningRoadmap: [],
      readinessPercent: 0,
      summary:
        'The performance report could not be generated. Please try again.',
    };
  }

  const roadmap = Array.isArray(parsed.learningRoadmap)
    ? (parsed.learningRoadmap as InterviewReportPayload['learningRoadmap'])
    : [];

  return {
    overallScore: clampScore(parsed.overallScore),
    communicationScore: clampScore(parsed.communicationScore),
    technicalScore: clampScore(parsed.technicalScore),
    confidenceScore: clampScore(parsed.confidenceScore),
    problemSolvingScore: clampScore(parsed.problemSolvingScore),
    codingScore: optionalScore(parsed.codingScore),
    systemDesignScore: optionalScore(parsed.systemDesignScore),
    behavioralScore: optionalScore(parsed.behavioralScore),
    strengths: stringArray(parsed.strengths),
    weaknesses: stringArray(parsed.weaknesses),
    knowledgeGaps: stringArray(parsed.knowledgeGaps),
    topicsToRevise: stringArray(parsed.topicsToRevise),
    mistakes: stringArray(parsed.mistakes),
    learningRoadmap: roadmap,
    readinessPercent: clampScore(parsed.readinessPercent),
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}

/** Normalize (possibly malformed) model JSON into a resume analysis. */
export function normalizeResume(raw: string): ResumeAnalysis {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  return {
    companies: Array.isArray(parsed.companies) ? parsed.companies : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    technologies: Array.isArray(parsed.technologies) ? parsed.technologies : [],
    experienceYears:
      typeof parsed.experienceYears === 'number' ? parsed.experienceYears : 0,
    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
    careerGaps: Array.isArray(parsed.careerGaps) ? parsed.careerGaps : [],
    suggestedQuestionTopics: Array.isArray(parsed.suggestedQuestionTopics)
      ? parsed.suggestedQuestionTopics
      : [],
  };
}
