import { type Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const envSchema = Type.Object({
  DATABASE_URL: Type.String({ default: 'file:./data.db' }),
  BETTER_AUTH_SECRET: Type.String({ minLength: 1 }),
  BETTER_AUTH_URL: Type.String({ default: 'http://localhost:3000' }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
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
  };

  if (!Value.Check(envSchema, parsed)) {
    console.error('Invalid environment variables:');
    for (const err of Value.Errors(envSchema, parsed)) {
      console.error(`  ${err.path}: ${err.message} (received ${JSON.stringify(err.value)})`);
    }
    process.exit(1);
  }

  env = parsed as Env;
  return env;
}

export function getEnv(): Env {
  if (!env) throw new Error('Env not loaded. Call loadEnv() first.');
  return env;
}
