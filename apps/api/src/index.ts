import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';

const app = await buildApp();
const env = getEnv();

const gracefulShutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down...`);
  await app.close();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
