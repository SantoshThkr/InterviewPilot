import OpenAI from 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  /** Ask the model for a single JSON object. */
  json?: boolean;
  /** Overall request timeout for non-streaming calls. */
  timeoutMs?: number;
}

/**
 * The only seam between the app and a language model. The production
 * implementation talks to any OpenAI-compatible API (OpenAI, or a local model
 * server such as Ollama via OPENAI_BASE_URL); tests substitute a fake.
 */
export interface ChatProvider {
  readonly model: string;
  complete(request: ChatRequest): Promise<string>;
  /** Yields text deltas. Throws if the stream fails or stalls. */
  stream(request: ChatRequest): AsyncIterable<string>;
}

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');

/** Thrown for provider failures; carries the HTTP status when there is one. */
export class ChatProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ChatProviderError';
  }
}

export interface OpenAiProviderOptions {
  apiKey: string;
  baseURL?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  /** A stream that produces no tokens for this long is aborted. */
  streamIdleTimeoutMs: number;
}

export class OpenAiCompatibleProvider implements ChatProvider {
  private readonly client: OpenAI;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: options.timeoutMs,
      maxRetries: options.maxRetries,
    });
  }

  get model(): string {
    return this.options.model;
  }

  async complete(request: ChatRequest): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.options.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          ...(request.json
            ? { response_format: { type: 'json_object' as const } }
            : {}),
        },
        request.timeoutMs ? { timeout: request.timeoutMs } : undefined,
      );
      return completion.choices[0]?.message?.content ?? '';
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async *stream(request: ChatRequest): AsyncIterable<string> {
    const controller = new AbortController();
    let idleTimer: NodeJS.Timeout | undefined;
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => controller.abort(),
        this.options.streamIdleTimeoutMs,
      );
    };

    try {
      armIdleTimer();
      const stream = await this.client.chat.completions.create(
        {
          model: this.options.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
        },
        { signal: controller.signal },
      );
      for await (const chunk of stream) {
        armIdleTimer();
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ChatProviderError('The model stream stalled and was aborted');
      }
      throw toProviderError(error);
    } finally {
      clearTimeout(idleTimer);
      // Stop the upstream request if the consumer bailed out early.
      controller.abort();
    }
  }
}

function toProviderError(error: unknown): ChatProviderError {
  if (error instanceof ChatProviderError) return error;
  const status =
    error instanceof OpenAI.APIError
      ? (error.status as number | undefined)
      : undefined;
  const message = error instanceof Error ? error.message : 'unknown error';
  return new ChatProviderError(message, status);
}
