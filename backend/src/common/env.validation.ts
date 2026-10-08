/**
 * Fail fast at boot if required configuration is missing, instead of throwing
 * obscure errors deep inside a request.
 */
const REQUIRED_ENV = ['DATABASE_URL', 'CLERK_SECRET_KEY'] as const;

const isSet = (env: NodeJS.ProcessEnv, key: string) => !!env[key]?.trim();

export function validateEnv(env: NodeJS.ProcessEnv): void {
  const problems: string[] = REQUIRED_ENV.filter((key) => !isSet(env, key));

  // A key is only needed for the hosted OpenAI API; a local OpenAI-compatible
  // server (OPENAI_BASE_URL, e.g. Ollama) works without one.
  if (!isSet(env, 'OPENAI_API_KEY') && !isSet(env, 'OPENAI_BASE_URL')) {
    problems.push('OPENAI_API_KEY (or OPENAI_BASE_URL for a local model)');
  }

  // Without it CORS would reflect any origin.
  if (env.NODE_ENV === 'production' && !isSet(env, 'FRONTEND_URL')) {
    problems.push('FRONTEND_URL (required in production)');
  }

  if (problems.length > 0) {
    throw new Error(
      `Missing required environment variables: ${problems.join(', ')}. ` +
        `Copy backend/.env.example to backend/.env and fill them in.`,
    );
  }
}
