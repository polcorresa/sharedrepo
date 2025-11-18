import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from '../plugins/zod-provider.js';
import { z } from 'zod';
import {
  repoSlugSchema,
  repoPasswordSchema,
  repoStatusSchema,
  repoMetadataSchema,
} from '@sharedrepo/shared';
import { RepoService } from '../services/repo.service.js';
import { db } from '../db/client.js';

const repoService = new RepoService(db);

/**
 * Register repo-related routes
 * Handles repo status, create, login, logout
 */
export const registerRepoRoutes = (app: FastifyInstance<any, any, any, any>) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/repos/:slug/status
   * Check if a repo slug is available or exists
   */
  server.get(
    '/api/repos/:slug/status',
    {
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        response: {
          200: repoStatusSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const status = await repoService.getStatus(slug);
      return reply.send(status);
    }
  );

  /**
   * POST /api/repos
   * Create a new repo with password
   */
  server.post(
    '/api/repos',
    {
      schema: {
        body: z.object({
          slug: repoSlugSchema,
          password: repoPasswordSchema,
        }),
        response: {
          201: repoMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug, password } = request.body;
      const { metadata, token } = await repoService.create(slug, password);

      // Set access token as httpOnly cookie
      reply.setCookie('repo_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.status(201).send(metadata);
    }
  );

  /**
   * POST /api/repos/:slug/login
   * Login to existing repo with password
   */
  server.post(
    '/api/repos/:slug/login',
    {
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        body: z.object({
          password: repoPasswordSchema,
        }),
        response: {
          200: repoMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const { password } = request.body;
      const { metadata, token } = await repoService.login(slug, password);

      // Set access token as httpOnly cookie
      reply.setCookie('repo_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return reply.send(metadata);
    }
  );

  /**
   * POST /api/repos/:slug/logout
   * Logout by clearing the access token cookie
   */
  server.post(
    '/api/repos/:slug/logout',
    {
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        response: {
          200: z.object({
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      // Clear the access token cookie
      reply.clearCookie('repo_token', {
        path: '/',
      });

      return reply.send({ message: 'Logged out successfully' });
    }
  );

  /**
   * GET /api/repos/:slug
   * Get repo metadata (requires authentication)
   */
  server.get(
    '/api/repos/:slug',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        response: {
          200: repoMetadataSchema,
        },
      },
    },
    async (request, reply) => {
      // Token is verified by preHandler
      const repoId = request.repoToken!.repoId;
      const metadata = await repoService.getById(repoId);
      return reply.send(metadata);
    }
  );

  /**
   * GET /api/repos/:slug/archive
   * Download repo as zip
   */
  server.get(
    '/api/repos/:slug/archive',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
      },
    },
    async (request, reply) => {
      const { slug } = request.params;
      const repoId = request.repoToken!.repoId;

      const archiveStream = await repoService.getArchive(repoId);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="codeshare-${slug}.zip"`);

      return reply.send(archiveStream);
    }
  );
};
