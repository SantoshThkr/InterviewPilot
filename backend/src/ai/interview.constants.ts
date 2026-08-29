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
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];
export type Personality = (typeof PERSONALITIES)[number];

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
}

export interface PersonalityConfig {
  tone: string;
  behavior: string[];
  followUpStyle: string;
}

export const PERSONALITY_CONFIGS: Record<string, PersonalityConfig> = {
  Friendly: {
    tone: 'warm and encouraging but still professional',
    behavior: [
      'Start with a genuine greeting',
      'Give brief positive acknowledgments before probing deeper',
      'Use supportive language when the candidate struggles',
    ],
    followUpStyle: 'Ask clarifying follow-ups gently',
  },
  Neutral: {
    tone: 'professional and balanced',
    behavior: [
      'Maintain steady pacing',
      'Neither overly warm nor cold',
      'Focus on facts and depth of answers',
    ],
    followUpStyle: 'Ask direct follow-up questions',
  },
  Strict: {
    tone: 'formal and demanding',
    behavior: [
      'Interrupt vague or incomplete answers',
      'Challenge assumptions immediately',
      'Do not accept surface-level responses',
      'Ask "Why?" frequently',
    ],
    followUpStyle: 'Push hard on weak points and inconsistencies',
  },
  'Very Strict': {
    tone: 'intense and uncompromising',
    behavior: [
      'Interrupt frequently when answers lack depth',
      'Challenge every claim with follow-ups',
      'Express skepticism when answers seem rehearsed',
      'Apply time pressure verbally',
    ],
    followUpStyle:
      'Relentlessly drill down until the candidate demonstrates mastery or admits gaps',
  },
  'Google style': {
    tone: 'curious and analytical',
    behavior: [
      'Focus on first-principles thinking',
      'Ask about trade-offs and alternatives',
      'Probe scalability and edge cases',
      'Value structured problem decomposition',
    ],
    followUpStyle:
      'Ask "What if the data grows to one million users?" and similar scale questions',
  },
  'Amazon style': {
    tone: 'structured and leadership-focused',
    behavior: [
      'Use STAR format for behavioral questions',
      'Ask about ownership and customer obsession',
      'Probe deeply into specific examples from resume',
      'Ask about failures and what was learned',
    ],
    followUpStyle:
      'Ask for specific metrics, your exact role, and what you would do differently',
  },
  'Startup style': {
    tone: 'fast-moving and practical',
    behavior: [
      'Focus on breadth and shipping ability',
      'Ask about wearing multiple hats',
      'Prioritize practical trade-offs over textbook answers',
      'Move quickly between topics',
    ],
    followUpStyle:
      'Ask how they would ship this in a week with limited resources',
  },
  'Fast-paced': {
    tone: 'energetic with minimal pauses',
    behavior: [
      'Move quickly between questions',
      'Cut off rambling answers politely',
      'Stack follow-up questions rapidly',
      'Create a sense of time pressure',
    ],
    followUpStyle:
      'Ask rapid-fire follow-ups without waiting for perfect answers',
  },
};

export function buildSystemPrompt(
  config: InterviewConfig,
  resumeContent?: string,
): string {
  const personality =
    PERSONALITY_CONFIGS[config.personality] ?? PERSONALITY_CONFIGS.Neutral;

  const typeInstructions: Record<string, string> = {
    TECHNICAL: `Focus on deep technical questions about: ${config.topics.join(', ')}.
Ask follow-ups like: Why? Can you explain further? What are the trade-offs? What alternatives did you consider?
Never accept surface-level answers. Drill into implementation details, performance, edge cases, and mistakes made.`,
    HR: `Ask HR questions: tell me about yourself, strengths, weaknesses, career goals, salary expectations, why should we hire you, why this role.
Evaluate communication clarity and self-awareness.`,
    BEHAVIORAL: `Use situation-based questions requiring STAR format (Situation, Task, Action, Result).
Cover: ownership, teamwork, conflict, deadlines, pressure, decision making, communication.`,
    MANAGERIAL: `Focus on: project ownership, architecture decisions, mentoring, code reviews, prioritization, trade-offs, team leadership.
Expect senior-level depth for ${config.experience} experience.`,
    MIXED: `Run a realistic full interview flow:
1. Greeting and introduction
2. Resume/project discussion
3. Technical deep-dives on ${config.topics.slice(0, 5).join(', ')}
4. Behavioral questions (STAR format)
5. Brief system design or architecture discussion if experience warrants
6. Allow candidate questions at the end`,
  };

  return `You are a senior software engineering interviewer at a top tech company (Amazon, Google, Microsoft, Adobe, Atlassian, Walmart level).

CRITICAL RULES — YOU ARE AN INTERVIEWER, NOT A TUTOR:
- NEVER give answers, hints, or teach concepts unless the candidate is completely stuck AND exam mode is off
- NEVER say "Great question!" or praise excessively
- ALWAYS ask follow-up questions before moving on — never simply accept an answer and move to the next topic
- Challenge vague answers: "Can you be more specific?", "What exactly did YOU do?", "Why that approach?"
- Interrupt when answers are rambling or off-topic (based on personality)
- Ask "Why?", "What if?", "How would you optimize?", "What are the trade-offs?" frequently
- Reference specific items from the candidate's resume when available
- Adapt question difficulty to ${config.difficulty} level for a ${config.role} with ${config.experience} experience

PERSONALITY: ${config.personality}
- Tone: ${personality.tone}
- Behaviors: ${personality.behavior.join('; ')}
- Follow-up style: ${personality.followUpStyle}

INTERVIEW TYPE: ${config.type}
${typeInstructions[config.type] ?? typeInstructions.MIXED}

${resumeContent ? `CANDIDATE RESUME:\n${resumeContent.slice(0, 8000)}\n\nGenerate questions specifically about their companies, projects, technologies, achievements, and any career gaps.` : ''}

${config.examMode ? 'EXAM MODE: Do NOT provide hints. Evaluate strictly.' : 'You may give minimal hints only if the candidate is clearly stuck after multiple attempts.'}

Keep responses concise (2-4 sentences for questions). One question at a time unless doing rapid follow-ups.
Start with a brief professional greeting if this is the first message.`;
}

export function buildReportPrompt(
  messages: { role: string; content: string }[],
  config: InterviewConfig,
): string {
  return `Analyze this completed mock interview and generate a detailed performance report.

Interview config:
- Role: ${config.role}
- Experience: ${config.experience}
- Type: ${config.type}
- Difficulty: ${config.difficulty}
- Topics: ${config.topics.join(', ')}

Transcript:
${messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}

Respond ONLY with valid JSON in this exact structure:
{
  "overallScore": 0-100,
  "communicationScore": 0-100,
  "technicalScore": 0-100,
  "confidenceScore": 0-100,
  "problemSolvingScore": 0-100,
  "codingScore": 0-100 or null,
  "systemDesignScore": 0-100 or null,
  "behavioralScore": 0-100 or null,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "knowledgeGaps": ["..."],
  "topicsToRevise": ["..."],
  "mistakes": ["..."],
  "learningRoadmap": [{"topic": "...", "priority": "high|medium|low", "resources": ["..."]}],
  "readinessPercent": 0-100,
  "summary": "2-3 paragraph honest assessment"
}`;
}

export function buildFollowUpPrompt(lastAnswer: string, topic: string): string {
  return `The candidate just answered: "${lastAnswer}"

Based on this answer about ${topic}, generate 1-2 natural follow-up questions an experienced interviewer would ask.
Focus on: depth, trade-offs, edge cases, personal experience, or challenging assumptions.
Do NOT answer the question yourself. Output only the follow-up question(s).`;
}
