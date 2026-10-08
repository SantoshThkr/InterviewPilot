import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://localhost/db',
  CLERK_SECRET_KEY: 'sk_test_x',
  OPENAI_API_KEY: 'sk-x',
};
const withoutOpenAiKey = () => ({
  DATABASE_URL: base.DATABASE_URL,
  CLERK_SECRET_KEY: base.CLERK_SECRET_KEY,
});

describe('validateEnv', () => {
  it('accepts a complete development configuration', () => {
    expect(() => validateEnv({ ...base })).not.toThrow();
  });

  it('accepts a local model server without an OpenAI key', () => {
    expect(() =>
      validateEnv({
        ...withoutOpenAiKey(),
        OPENAI_BASE_URL: 'http://localhost:11434/v1',
      }),
    ).not.toThrow();
  });

  it('requires an AI provider', () => {
    expect(() => validateEnv(withoutOpenAiKey())).toThrow(/OPENAI_API_KEY/);
  });

  it('requires FRONTEND_URL in production so CORS is not open', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /FRONTEND_URL/,
    );
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
      }),
    ).not.toThrow();
  });

  it('lists every missing variable at once', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL, CLERK_SECRET_KEY/);
  });
});
