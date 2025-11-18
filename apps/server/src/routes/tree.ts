import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from '../plugins/zod-provider.js';
import { z } from 'zod';
import { repoSlugSchema, treeResponseSchema, treeFileSchema, treeFolderSchema } from '@sharedrepo/shared';
import { TreeService } from '../services/tree.service.js';
import { db } from '../db/client.js';

const treeService = new TreeService(db);

/**
 * Register tree-related routes
 * Handles tree operations: get tree, create/rename/move/delete nodes
 */
export const registerTreeRoutes = (app: FastifyInstance<any, any, any, any>) => {
  const server = app.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/repos/:slug/tree
   * Get complete tree structure for a repo
   */
  server.get(
    '/api/repos/:slug/tree',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        response: {
          200: treeResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const repoId = Number(request.repoToken!.repoId);
      const tree = await treeService.getTree(repoId);
      return reply.send(tree);
    }
  );

  /**
   * POST /api/repos/:slug/folders
   * Create a new folder
   */
  server.post(
    '/api/repos/:slug/folders',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        body: z.object({
          parentFolderId: z.string().nullable(),
          name: z.string().min(1).max(255),
        }),
        response: {
          201: treeFolderSchema,
        },
      },
    },
    async (request, reply) => {
      const repoId = Number(request.repoToken!.repoId);
      const { parentFolderId, name } = request.body;
      
      const folder = await treeService.createFolder(
        repoId,
        parentFolderId ? Number(parentFolderId) : null,
        name
      );
      
      return reply.status(201).send(folder);
    }
  );

  /**
   * POST /api/repos/:slug/files
   * Create a new file
   */
  server.post(
    '/api/repos/:slug/files',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
        }),
        body: z.object({
          folderId: z.string(),
          name: z.string().min(1).max(255),
        }),
        response: {
          201: treeFileSchema,
        },
      },
    },
    async (request, reply) => {
      const repoId = Number(request.repoToken!.repoId);
      const { folderId, name } = request.body;
      
      const file = await treeService.createFile(repoId, Number(folderId), name);
      
      return reply.status(201).send(file);
    }
  );

  /**
   * PATCH /api/repos/:slug/folders/:id
   * Rename or move a folder
   */
  server.patch(
    '/api/repos/:slug/folders/:id',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
          id: z.string(),
        }),
        body: z.object({
          operation: z.enum(['rename', 'move']),
          expectedVersion: z.number().int().nonnegative(),
          newName: z.string().min(1).max(255).optional(),
          newParentFolderId: z.string().nullable().optional(),
        }),
        response: {
          200: treeFolderSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { operation, expectedVersion, newName, newParentFolderId } = request.body;

      let folder;
      if (operation === 'rename') {
        if (!newName) {
          throw app.httpErrors.badRequest('newName is required for rename operation');
        }
        folder = await treeService.renameFolder(Number(id), newName, expectedVersion);
      } else {
        if (newParentFolderId === undefined) {
          throw app.httpErrors.badRequest('newParentFolderId is required for move operation');
        }
        folder = await treeService.moveFolder(
          Number(id),
          newParentFolderId ? Number(newParentFolderId) : null,
          expectedVersion
        );
      }

      return reply.send(folder);
    }
  );

  /**
   * PATCH /api/repos/:slug/files/:id
   * Rename or move a file
   */
  server.patch(
    '/api/repos/:slug/files/:id',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
          id: z.string(),
        }),
        body: z.object({
          operation: z.enum(['rename', 'move']),
          expectedVersion: z.number().int().nonnegative(),
          newName: z.string().min(1).max(255).optional(),
          newFolderId: z.string().optional(),
        }),
        response: {
          200: treeFileSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { operation, expectedVersion, newName, newFolderId } = request.body;

      let file;
      if (operation === 'rename') {
        if (!newName) {
          throw app.httpErrors.badRequest('newName is required for rename operation');
        }
        file = await treeService.renameFile(Number(id), newName, expectedVersion);
      } else {
        if (!newFolderId) {
          throw app.httpErrors.badRequest('newFolderId is required for move operation');
        }
        file = await treeService.moveFile(Number(id), Number(newFolderId), expectedVersion);
      }

      return reply.send(file);
    }
  );

  /**
   * DELETE /api/repos/:slug/folders/:id
   * Delete a folder
   */
  server.delete(
    '/api/repos/:slug/folders/:id',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
          id: z.string(),
        }),
        querystring: z.object({
          version: z.coerce.number().int().nonnegative(),
        }),
        response: {
          204: z.void(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { version } = request.query;
      
      await treeService.deleteFolder(Number(id), version);
      
      return reply.status(204).send();
    }
  );

  /**
   * DELETE /api/repos/:slug/files/:id
   * Delete a file
   */
  server.delete(
    '/api/repos/:slug/files/:id',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
          id: z.string(),
        }),
        querystring: z.object({
          version: z.coerce.number().int().nonnegative(),
        }),
        response: {
          204: z.void(),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { version } = request.query;
      
      await treeService.deleteFile(Number(id), version);
      
      return reply.status(204).send();
    }
  );

  /**
   * PUT /api/repos/:slug/files/:id/content
   * Update file content (save)
   */
  server.put(
    '/api/repos/:slug/files/:id/content',
    {
      preHandler: async (request, reply) => {
        await app.verifyRepoSlug(request, request.params.slug);
      },
      schema: {
        params: z.object({
          slug: repoSlugSchema,
          id: z.string(),
        }),
        body: z.object({
          text: z.string(),
        }),
        response: {
          200: treeFileSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { text } = request.body;
      
      const file = await treeService.updateFileContent(Number(id), text);
      
      return reply.send(file);
    }
  );
};
