import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Response } from 'express';
import {
  buildReportPrompt,
  buildSystemPrompt,
  InterviewConfig,
} from './interview.constants';

export interface InterviewReportPayload {
  overallScore?: number;
  communicationScore?: number;
  technicalScore?: number;
  confidenceScore?: number;
  problemSolvingScore?: number;
  codingScore?: number | null;
  systemDesignScore?: number | null;
  behavioralScore?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  knowledgeGaps?: string[];
  topicsToRevise?: string[];
  mistakes?: string[];
  learningRoadmap?: Array<{ topic: string; priority?: string; resources?: string[] }>;
  readinessPercent?: number;
  summary?: string;
}

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured. Set it in backend/.env');
    }

    this.openai = new OpenAI({ apiKey });
  }

  async generateOpening(
    config: InterviewConfig,
    resumeContent?: string,
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(config, resumeContent);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            'Begin the interview. Introduce yourself briefly as the interviewer and start with an appropriate opening question.',
        },
      ],
      temperature: 0.8,
      max_tokens: 400,
    });

    return (
      completion.choices[0]?.message?.content ??
      'Hello, thank you for joining today. Tell me about yourself and your recent work.'
    );
  }

  async streamResponse(
    config: InterviewConfig,
    messages: { role: 'user' | 'assistant'; content: string }[],
    resumeContent: string | undefined,
    res: Response,
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(config, resumeContent);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.75,
      max_tokens: 500,
      stream: true,
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    return fullContent || 'Can you elaborate on that?';
  }

  async generateReport(
    config: InterviewConfig,
    messages: { role: string; content: string }[],
  ): Promise<InterviewReportPayload> {
    const prompt = buildReportPrompt(messages, config);

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(raw) as InterviewReportPayload;
      return {
        overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 0,
        communicationScore:
          typeof parsed.communicationScore === 'number' ? parsed.communicationScore : 0,
        technicalScore: typeof parsed.technicalScore === 'number' ? parsed.technicalScore : 0,
        confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0,
        problemSolvingScore:
          typeof parsed.problemSolvingScore === 'number' ? parsed.problemSolvingScore : 0,
        codingScore:
          typeof parsed.codingScore === 'number' || parsed.codingScore === null
            ? parsed.codingScore
            : null,
        systemDesignScore:
          typeof parsed.systemDesignScore === 'number' || parsed.systemDesignScore === null
            ? parsed.systemDesignScore
            : null,
        behavioralScore:
          typeof parsed.behavioralScore === 'number' || parsed.behavioralScore === null
            ? parsed.behavioralScore
            : null,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        knowledgeGaps: Array.isArray(parsed.knowledgeGaps) ? parsed.knowledgeGaps : [],
        topicsToRevise: Array.isArray(parsed.topicsToRevise) ? parsed.topicsToRevise : [],
        mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
        learningRoadmap: Array.isArray(parsed.learningRoadmap) ? parsed.learningRoadmap : [],
        readinessPercent:
          typeof parsed.readinessPercent === 'number' ? parsed.readinessPercent : 0,
        summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      };
    } catch {
      return {
        overallScore: 0,
        communicationScore: 0,
        technicalScore: 0,
        confidenceScore: 0,
        problemSolvingScore: 0,
        strengths: [],
        weaknesses: [],
        knowledgeGaps: [],
        topicsToRevise: [],
        mistakes: [],
        learningRoadmap: [],
        readinessPercent: 0,
        summary: 'AI report generation failed to return valid JSON.',
      };
    }
  }

  async analyzeResume(content: string) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze this resume and extract structured data. Respond with JSON:
{
  "companies": ["..."],
  "projects": [{"name": "...", "description": "...", "technologies": ["..."]}],
  "technologies": ["..."],
  "experienceYears": number,
  "achievements": ["..."],
  "careerGaps": ["..."],
  "suggestedQuestionTopics": ["..."]
}`,
        },
        { role: 'user', content: content.slice(0, 10000) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
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
    } catch {
      return {
        companies: [],
        projects: [],
        technologies: [],
        experienceYears: 0,
        achievements: [],
        careerGaps: [],
        suggestedQuestionTopics: [],
      };
    }
  }

  async generateCodingHint(
    problem: string,
    code: string,
    attempt: number,
  ): Promise<string> {
    const hintLevel =
      attempt === 1
        ? 'Give a very subtle nudge — point toward the right direction without revealing the solution.'
        : attempt === 2
          ? 'Give a moderate hint about the approach or data structure to consider.'
          : 'Give a stronger hint about the algorithm but still let them implement it.';

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an interview proctor. ${hintLevel} Never write the full solution.`,
        },
        {
          role: 'user',
          content: `Problem: ${problem}\n\nCandidate's current code:\n${code}\n\nProvide a hint.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    return (
      completion.choices[0]?.message?.content ??
      'Think about what data structure would help you look up values quickly.'
    );
  }
}
