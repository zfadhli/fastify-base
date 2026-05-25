import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';

const app = await buildApp();
const env = getEnv();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  console.log(`Server running at http://${env.HOST}:${env.PORT}`);
  console.log(`API docs at http://${env.HOST}:${env.PORT}/docs`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
