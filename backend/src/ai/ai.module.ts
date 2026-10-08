import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { CHAT_PROVIDER, OpenAiCompatibleProvider } from './chat-provider';

export const DEFAULT_AI_MODEL = 'gpt-4o-mini';

@Module({
  providers: [
    {
      provide: CHAT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const baseURL =
          config.get<string>('OPENAI_BASE_URL')?.trim() || undefined;
        // Local OpenAI-compatible servers (e.g. Ollama) ignore the key, but
        // the SDK requires a non-empty value.
        const apiKey =
          config.get<string>('OPENAI_API_KEY')?.trim() || 'not-required';
        return new OpenAiCompatibleProvider({
          apiKey,
          baseURL,
          model: config.get<string>('AI_MODEL')?.trim() || DEFAULT_AI_MODEL,
          timeoutMs: 30_000,
          maxRetries: 2,
          streamIdleTimeoutMs: 20_000,
        });
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
