import Type, { type Static } from 'typebox';
import { Value } from 'typebox/value';

const envSchema = Type.Object({
  DATABASE_URL: Type.String({ default: 'file:./data.db' }),
  BETTER_AUTH_SECRET: Type.String({ minLength: 1 }),
  BETTER_AUTH_URL: Type.String({ default: 'http://localhost:3000' }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  RATE_LIMIT_MAX: Type.Number({ default: 100 }),
  RATE_LIMIT_WINDOW: Type.Number({ default: 60000 }),
});

export type Env = Static<typeof envSchema>;

let env: Env;

export function loadEnv(): Env {
  if (env) return env;

  const parsed = {
    DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data.db',
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
    HOST: process.env.HOST ?? '0.0.0.0',
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 100,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW ? Number(process.env.RATE_LIMIT_WINDOW) : 60000,
  };

  if (!Value.Check(envSchema, parsed)) {
    const errors: string[] = [];
    for (const err of Value.Errors(envSchema, parsed)) {
      errors.push(`${err.instancePath}: ${err.message}`);
    }
    throw new Error(`Invalid environment variables:\n  ${errors.join('\n  ')}`);
  }

  env = parsed as Env;
  return env;
}

export function getEnv(): Env {
  if (!env) return loadEnv();
  return env;
}
