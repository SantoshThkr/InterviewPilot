/**
 * Fail fast at boot if required configuration is missing, instead of throwing
 * obscure errors deep inside a request.
 */
const REQUIRED_ENV = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'CLERK_SECRET_KEY',
] as const;

export function validateEnv(env: NodeJS.ProcessEnv): void {
  const missing = REQUIRED_ENV.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy backend/.env.example to backend/.env and fill them in.`,
    );
  }
}
