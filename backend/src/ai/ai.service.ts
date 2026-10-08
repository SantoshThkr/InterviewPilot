import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CHAT_PROVIDER,
  ChatProviderError,
  type ChatMessage,
  type ChatProvider,
} from './chat-provider';
import {
  RESUME_ANALYSIS_PROMPT,
  buildEvaluationPrompt,
  buildOpeningPrompt,
  buildTurnSystemPrompt,
  type EvaluationPromptInput,
} from './prompts';
import { ResumeAnalysis, normalizeResume } from './ai.normalize';
import type {
  InterviewConfig,
  InterviewPlan,
  TurnAction,
  TurnState,
} from '../interviews/interview-plan';
import {
  parseEvaluation,
  type EvaluationContext,
  type ValidatedEvaluation,
} from '../interviews/evaluation';

const EVALUATION_ATTEMPTS = 2;
const EVALUATION_TIMEOUT_MS = 90_000;
const RESUME_INPUT_CHARS = 10_000;

export interface TurnRequest {
  config: InterviewConfig;
  plan: InterviewPlan;
  state: TurnState;
  allowed: TurnAction[];
  history: ChatMessage[];
  resumeContent?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');

  constructor(@Inject(CHAT_PROVIDER) private readonly provider: ChatProvider) {}

  /**
   * First interviewer message. Falls back to the plan's deterministic
   * question if the model is unavailable, so a brief outage does not block
   * starting an interview.
   */
  async generateOpening(
    config: InterviewConfig,
    plan: InterviewPlan,
    resumeContent?: string,
  ): Promise<string> {
    const prompt = buildOpeningPrompt(config, plan, resumeContent);
    try {
      const text = await this.provider.complete({
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.7,
        maxTokens: 250,
      });
      if (text.trim()) return text.trim();
      this.logger.warn(
        'generateOpening returned empty content; using fallback',
      );
    } catch (error) {
      this.logFailure('generateOpening', error);
    }
    return `Hi, I'll be your interviewer today for this ${config.role} interview. ${plan.items[0].fallbackQuestion}`;
  }

  /** Streams the raw interviewer reply (including its leading control tag). */
  async *streamTurn(request: TurnRequest): AsyncIterable<string> {
    const system = buildTurnSystemPrompt(
      request.config,
      request.plan,
      request.state,
      request.allowed,
      request.resumeContent,
    );
    try {
      yield* this.provider.stream({
        messages: [{ role: 'system', content: system }, ...request.history],
        temperature: 0.7,
        maxTokens: 400,
      });
    } catch (error) {
      this.logFailure('streamTurn', error);
      throw this.toHttpError(error);
    }
  }

  /**
   * Grades a finished interview. Invalid output is retried once; if it is
   * still unusable the call fails so the interview stays open and the
   * candidate can retry, instead of persisting a fabricated report.
   */
  async evaluateInterview(
    input: EvaluationPromptInput,
    context: EvaluationContext,
  ): Promise<ValidatedEvaluation> {
    const prompt = buildEvaluationPrompt(input);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= EVALUATION_ATTEMPTS; attempt++) {
      try {
        const raw = await this.provider.complete({
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          temperature: 0.2,
          maxTokens: 3000,
          json: true,
          timeoutMs: EVALUATION_TIMEOUT_MS,
        });
        const evaluation = parseEvaluation(raw, context);
        if (evaluation) return evaluation;
        this.logger.warn(
          `evaluateInterview attempt ${attempt} returned unusable output`,
        );
      } catch (error) {
        lastError = error;
        this.logFailure(`evaluateInterview attempt ${attempt}`, error);
      }
    }

    throw lastError
      ? this.toHttpError(lastError)
      : new ServiceUnavailableException(
          'The report could not be generated right now. Your interview is saved — please try again.',
        );
  }

  async analyzeResume(content: string): Promise<ResumeAnalysis> {
    try {
      const raw = await this.provider.complete({
        messages: [
          { role: 'system', content: RESUME_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: `<resume>\n${content.slice(0, RESUME_INPUT_CHARS)}\n</resume>`,
          },
        ],
        temperature: 0.2,
        maxTokens: 1200,
        json: true,
      });
      return normalizeResume(raw);
    } catch (error) {
      // Resume analysis is best-effort — degrade to an empty analysis instead
      // of failing the whole upload.
      this.logFailure('analyzeResume', error);
      return normalizeResume('{}');
    }
  }

  private logFailure(where: string, error: unknown) {
    const status =
      error instanceof ChatProviderError ? error.status : undefined;
    this.logger.error(
      `${where} failed${status ? ` (status ${status})` : ''}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }

  private toHttpError(error: unknown): ServiceUnavailableException {
    if (error instanceof ServiceUnavailableException) return error;
    const status =
      error instanceof ChatProviderError ? error.status : undefined;
    return new ServiceUnavailableException(
      status === 429
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'The AI service is temporarily unavailable. Please try again.',
    );
  }
}
