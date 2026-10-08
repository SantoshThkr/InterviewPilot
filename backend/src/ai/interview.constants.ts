export const ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'React Developer',
  'JavaScript Developer',
  'Node.js Developer',
] as const;

export const EXPERIENCE_LEVELS = [
  '0-2 years',
  '2-5 years',
  '5-8 years',
  'Senior',
  'Staff',
] as const;

export const INTERVIEW_TYPES = [
  'TECHNICAL',
  'HR',
  'BEHAVIORAL',
  'MANAGERIAL',
  'MIXED',
] as const;

/** Interview types whose plan is built from the selected technical topics. */
export const TOPIC_DRIVEN_TYPES: readonly string[] = ['TECHNICAL', 'MIXED'];

export const TECHNICAL_TOPICS = [
  'JavaScript',
  'React',
  'TypeScript',
  'HTML',
  'CSS',
  'Node.js',
  'System Design',
  'Next.js',
  'API',
  'Performance',
  'Security',
  'Browser',
  'Rendering',
  'State Management',
  'Async Programming',
  'Data Structures',
  'Algorithms',
] as const;

/**
 * Non-technical areas an interview can probe. Together with TECHNICAL_TOPICS
 * this is the closed vocabulary used for weak-area tracking, so the same gap
 * accumulates across interviews instead of being stored as free text.
 */
export const COMPETENCIES = [
  'Ownership',
  'Teamwork',
  'Conflict Resolution',
  'Handling Failure',
  'Prioritization',
  'Communication',
  'Decision Making',
  'Leadership',
  'Mentoring',
  'Stakeholder Management',
  'Self-awareness',
  'Motivation',
] as const;

export const WEAK_AREA_VOCABULARY: readonly string[] = [
  ...TECHNICAL_TOPICS,
  ...COMPETENCIES,
];

export const DIFFICULTY_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'FAANG',
  'Startup',
] as const;

export const PERSONALITIES = [
  'Friendly',
  'Neutral',
  'Strict',
  'Very Strict',
  'Google style',
  'Amazon style',
  'Startup style',
  'Fast-paced',
] as const;

export type Role = (typeof ROLES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export type TechnicalTopic = (typeof TECHNICAL_TOPICS)[number];
export type Competency = (typeof COMPETENCIES)[number];
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];
export type Personality = (typeof PERSONALITIES)[number];

export interface PersonalityConfig {
  tone: string;
  behavior: string[];
  followUpStyle: string;
  /** How many follow-ups the interviewer may ask before moving on. */
  maxFollowUps: number;
}

export const PERSONALITY_CONFIGS: Record<string, PersonalityConfig> = {
  Friendly: {
    tone: 'warm and encouraging but still professional',
    behavior: [
      'Give a brief neutral acknowledgment before probing deeper',
      'Use supportive language when the candidate struggles',
    ],
    followUpStyle: 'Ask clarifying follow-ups gently',
    maxFollowUps: 2,
  },
  Neutral: {
    tone: 'professional and balanced',
    behavior: [
      'Maintain steady pacing',
      'Neither overly warm nor cold',
      'Focus on facts and depth of answers',
    ],
    followUpStyle: 'Ask direct follow-up questions',
    maxFollowUps: 2,
  },
  Strict: {
    tone: 'formal and demanding',
    behavior: [
      'Push back on vague or incomplete answers',
      'Challenge assumptions',
      'Do not accept surface-level responses',
    ],
    followUpStyle: 'Push hard on weak points and inconsistencies',
    maxFollowUps: 3,
  },
  'Very Strict': {
    tone: 'intense and uncompromising',
    behavior: [
      'Challenge every claim that lacks depth',
      'Express skepticism when answers sound rehearsed',
      'Keep the pace brisk',
    ],
    followUpStyle:
      'Drill down until the candidate demonstrates mastery or admits a gap',
    maxFollowUps: 3,
  },
  'Google style': {
    tone: 'curious and analytical',
    behavior: [
      'Focus on first-principles thinking',
      'Ask about trade-offs and alternatives',
      'Probe scalability and edge cases',
    ],
    followUpStyle:
      'Ask how the approach changes at larger scale or under different constraints',
    maxFollowUps: 2,
  },
  'Amazon style': {
    tone: 'structured and leadership-focused',
    behavior: [
      'Expect STAR-structured answers for experience questions',
      'Ask about ownership and customer impact',
      'Ask about failures and what was learned',
    ],
    followUpStyle:
      'Ask for specific metrics, the candidate’s exact role, and what they would do differently',
    maxFollowUps: 2,
  },
  'Startup style': {
    tone: 'fast-moving and practical',
    behavior: [
      'Focus on shipping ability and pragmatism',
      'Prioritize practical trade-offs over textbook answers',
    ],
    followUpStyle:
      'Ask how they would ship this quickly with limited resources',
    maxFollowUps: 2,
  },
  'Fast-paced': {
    tone: 'energetic with minimal pauses',
    behavior: [
      'Move quickly between questions',
      'Politely cut short rambling answers',
    ],
    followUpStyle: 'Ask one sharp follow-up, then move on',
    maxFollowUps: 1,
  },
};

export function personalityConfig(personality: string): PersonalityConfig {
  return PERSONALITY_CONFIGS[personality] ?? PERSONALITY_CONFIGS.Neutral;
}
