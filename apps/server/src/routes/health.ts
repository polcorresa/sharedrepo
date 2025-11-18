import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from '../plugins/zod-provider.js';
import { db } from '../db/client.js';
import { env } from '../config/env.js';

/**
 * Server start time for uptime calculation
 */
const startTime = Date.now();

/**
 * Health check response schema
 */
const healthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
  checks: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      responseTime: z.number().optional(),
      error: z.string().optional(),
    }),
  }),
});

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    // Simple query to check database connection
    await db.selectFrom('repos').select('id').limit(1).execute();
    
    return {
      status: 'up',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register health check routes
 */
export const registerHealthRoutes = (app: FastifyInstance<any, any, any, any>) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /health - Comprehensive health check
   * Returns detailed system health information including database status
   */
  server.get(
    '/health',
    {
      schema: {
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const checks = {
        database: await checkDatabase(),
      };

      // Determine overall health status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let httpStatus: number;

      if (checks.database.status === 'up') {
        status = 'healthy';
        httpStatus = 200;
      } else {
        status = 'unhealthy';
        httpStatus = 503;
      }

      const response = {
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000), // uptime in seconds
        version: process.env.npm_package_version || '0.1.0',
        environment: env.NODE_ENV,
        checks,
      };

      // Log health check failures
      if (status !== 'healthy') {
        request.log.warn(
          {
            healthStatus: status,
            checks,
          },
          'Health check failed'
        );
      }

      return reply.status(httpStatus).send(response);
    }
  );

  /**
   * GET /health/ready - Readiness probe (for Kubernetes)
   * Returns 200 if service is ready to accept traffic
   */
  server.get('/health/ready', async (request, reply) => {
    const dbCheck = await checkDatabase();

    if (dbCheck.status === 'up') {
      return reply.status(200).send({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    }

    return reply.status(503).send({
      ready: false,
      timestamp: new Date().toISOString(),
      reason: 'Database unavailable',
    });
  });

  /**
   * GET /health/live - Liveness probe (for Kubernetes)
   * Returns 200 if service is alive (doesn't check dependencies)
   */
  server.get('/health/live', async (request, reply) => {
    return reply.status(200).send({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
    });
  });
};
