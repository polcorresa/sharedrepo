import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import { env } from './config/env.js';
import { logger } from './logs/logger.js';
import { registerHealthRoutes } from './routes/health.js';

const buildServer = () => {
  const app = Fastify({
    logger,
    trustProxy: true
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true
  });

  app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest'
  });

  app.register(fastifySensible);

  registerHealthRoutes(app);

  return app;
};

const start = async () => {
  const app = buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
