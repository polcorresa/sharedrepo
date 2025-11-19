import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import fastifySensible from '@fastify/sensible';
import { env } from './config/env.js';
import { logger } from './logs/logger.js';
import zodProviderPlugin from './plugins/zod-provider.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import authPlugin from './plugins/auth.js';
import metricsPlugin from './plugins/metrics.js';
import jobsPlugin from './plugins/jobs.js';
import websocketPlugin from './plugins/websocket.js';
import loggingPlugin from './plugins/logging.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerRepoRoutes } from './routes/repos.js';
import { registerTreeRoutes } from './routes/tree.js';
import { registerAdminRoutes } from './routes/admin.js';

export const buildServer = () => {
  const app = Fastify({
    logger,
    trustProxy: true
  });

  // Core plugins
  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true
  });

  app.register(cookie, {
    secret: env.COOKIE_SECRET,
    hook: 'onRequest'
  });

  app.register(fastifySensible);

  // Custom plugins
  app.register(loggingPlugin); // Register early to ensure ip_hash is available
  app.register(metricsPlugin);
  app.register(zodProviderPlugin);
  app.register(errorHandlerPlugin);
  app.register(authPlugin);
  app.register(jobsPlugin);
  app.register(websocketPlugin);

  // Routes
  registerHealthRoutes(app);
  registerRepoRoutes(app);
  registerTreeRoutes(app);
  registerAdminRoutes(app);

  return app;
};
