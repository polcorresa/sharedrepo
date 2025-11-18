import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from '../plugins/zod-provider.js';
import { z } from 'zod';
import { runExpiryJob } from '../jobs/expiry.job.js';
import { env } from '../config/env.js';

/**
 * Register admin routes
 * These routes should be protected or only available in dev/test environments
 */
export const registerAdminRoutes = (app: FastifyInstance<any, any, any, any>) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /api/admin/expire-repos
   * Trigger the repo expiration job manually
   */
  server.post(
    '/api/admin/expire-repos',
    {
      schema: {
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
      preHandler: async (request, reply) => {
        // Simple protection: only allow in non-production or if a secret header is present
        // For this project, we'll restrict to non-production
        if (env.NODE_ENV === 'production') {
          throw app.httpErrors.forbidden('Admin routes are not available in production');
        }
      },
    },
    async (request, reply) => {
      await runExpiryJob();
      return reply.send({ message: 'Expiry job triggered' });
    }
  );
};
