import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { createVerifier, type VerifierOptions } from 'fast-jwt';
import { env } from '../config/env.js';
import type { RepoTokenPayload } from '@sharedrepo/shared';

// Extend Fastify request to include decoded token
declare module 'fastify' {
  interface FastifyRequest {
    repoToken?: RepoTokenPayload;
  }
}

/**
 * JWT verifier instance
 * Configured to verify tokens signed with our secret
 */
const verifyToken = createVerifier({
  key: env.JWT_SECRET,
  cache: true, // Cache decoded tokens for performance
  cacheTTL: 60000, // Cache for 1 minute
} as VerifierOptions);

/**
 * Authentication plugin
 * Provides decorators and hooks for repo access token validation
 */
const authPlugin: FastifyPluginAsync = async (app) => {
  /**
   * Decorator: Verify repo access token from cookie
   * Throws 401 if token is missing or invalid
   */
  app.decorate('verifyRepoAccess', async function (request: FastifyRequest) {
    // Get token from cookie
    const token = request.cookies.repo_token;

    if (!token) {
      throw app.httpErrors.unauthorized('Access token required');
    }

    try {
      // Verify and decode token
      const payload = verifyToken(token) as RepoTokenPayload;

      // Attach payload to request for route handlers
      request.repoToken = payload;
    } catch (error) {
      throw app.httpErrors.unauthorized('Invalid or expired access token');
    }
  });

  /**
   * Decorator: Verify repo access token matches a specific slug
   * Throws 403 if token is for a different repo
   */
  app.decorate(
    'verifyRepoSlug',
    async function (request: FastifyRequest, slug: string) {
      // First verify the token exists and is valid
      await app.verifyRepoAccess(request);

      // Check if token is for the requested repo
      if (request.repoToken?.slug !== slug) {
        throw app.httpErrors.forbidden('Access token is for a different repository');
      }
    }
  );
};

export default fastifyPlugin(authPlugin);

// Extend Fastify instance with our decorators
declare module 'fastify' {
  interface FastifyInstance {
    verifyRepoAccess(request: FastifyRequest): Promise<void>;
    verifyRepoSlug(request: FastifyRequest, slug: string): Promise<void>;
  }
}
