import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Response } from 'express';
import {
  buildReportPrompt,
  buildSystemPrompt,
  InterviewConfig,
} from './interview.constants';
import {
  InterviewReportPayload,
  ResumeAnalysis,
  normalizeReport,
  normalizeResume,
} from './ai.normalize';

export type { InterviewReportPayload } from './ai.normalize';

const MODEL = 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = 30_000;

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Set it in backend/.env',
      );
    }
    this.openai = new OpenAI({
      apiKey,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 2,
    });
  }

  async generateOpening(
    config: InterviewConfig,
    resumeContent?: string,
  ): Promise<string> {
    const systemPrompt = buildSystemPrompt(config, resumeContent);
    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
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
        'Hello, thanks for joining today. To start, tell me about yourself and your recent work.'
      );
    } catch (error) {
      throw this.toHttpError(error, 'generateOpening');
    }
  }

  /**
   * Streams the interviewer reply as SSE. Returns the full text on success, or
   * `null` if generation failed (an `error` frame is sent to the client and the
   * stream is closed). The caller must not persist a reply when this returns
   * `null`.
   */
  async streamResponse(
    config: InterviewConfig,
    messages: { role: 'user' | 'assistant'; content: string }[],
    resumeContent: string | undefined,
    res: Response,
  ): Promise<string | null> {
    const systemPrompt = buildSystemPrompt(config, resumeContent);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let fullContent = '';
    try {
      const stream = await this.openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.75,
        max_tokens: 500,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullContent += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return fullContent || 'Could you elaborate on that?';
    } catch (error) {
      this.logger.error(
        `streamResponse failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      // If we already streamed some text, keep it; otherwise signal a clean failure.
      if (fullContent) {
        res.write('data: [DONE]\n\n');
        res.end();
        return fullContent;
      }
      res.write(
        `data: ${JSON.stringify({
          error:
            'The interviewer is temporarily unavailable. Please try again.',
        })}\n\n`,
      );
      res.end();
      return null;
    }
  }

  async generateReport(
    config: InterviewConfig,
    messages: { role: string; content: string }[],
  ): Promise<InterviewReportPayload> {
    const prompt = buildReportPrompt(messages, config);
    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      return normalizeReport(completion.choices[0]?.message?.content ?? '{}');
    } catch (error) {
      throw this.toHttpError(error, 'generateReport');
    }
  }

  async analyzeResume(content: string): Promise<ResumeAnalysis> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
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
      return normalizeResume(completion.choices[0]?.message?.content ?? '{}');
    } catch (error) {
      // Resume analysis is best-effort — degrade to an empty analysis instead of
      // failing the whole upload.
      this.logger.warn(
        `analyzeResume failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return normalizeResume('{}');
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

    try {
      const completion = await this.openai.chat.completions.create({
        model: MODEL,
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
        'Think about which data structure gives you fast lookups here.'
      );
    } catch (error) {
      throw this.toHttpError(error, 'generateCodingHint');
    }
  }

  private toHttpError(
    error: unknown,
    where: string,
  ): ServiceUnavailableException {
    const status: number | undefined =
      error instanceof OpenAI.APIError
        ? (error.status as number | undefined)
        : undefined;
    this.logger.error(
      `${where} failed${status ? ` (status ${status})` : ''}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
    const message =
      status === 429
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'The AI service is temporarily unavailable. Please try again.';
    return new ServiceUnavailableException(message);
  }
}
