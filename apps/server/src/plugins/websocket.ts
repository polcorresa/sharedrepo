import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { treeEventService } from '../services/tree-events.service.js';
import { logger } from '../logs/logger.js';
import { createVerifier } from 'fast-jwt';
import { env } from '../config/env.js';
import type { RepoTokenPayload } from '@sharedrepo/shared';

const verifyToken = createVerifier({
  key: env.JWT_SECRET,
  cache: true,
});

const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.register(fastifyWebsocket);

  app.register(async function (app) {
    // Yjs WebSocket Endpoint
    app.get('/ws/yjs', { websocket: true }, (connection, req) => {
      // 1. Authenticate
      // Token can be in query param or cookie. y-websocket client usually supports query params?
      // Or we can parse cookie from req.headers.cookie
      // Let's try to get token from cookie first, then query param.
      let token = req.cookies.repo_token;
      
      // If not in cookie, check query param (e.g. ?token=...)
      if (!token) {
        const query = req.query as any;
        token = query.token;
      }

      if (!token) {
        connection.socket.close(1008, 'Unauthorized: No token provided');
        return;
      }

      let payload: RepoTokenPayload;
      try {
        payload = verifyToken(token) as RepoTokenPayload;
      } catch (err) {
        connection.socket.close(1008, 'Unauthorized: Invalid token');
        return;
      }

      // 2. Validate Room Access
      // y-websocket uses req.url to determine room name.
      // Usually it's just the path, but setupWSConnection handles it.
      // We need to ensure the user is connecting to a room they have access to.
      // Room name format: repo:<repoId>:file:<fileId>
      // We can inspect req.url to see if it matches the repoId in the token.
      
      // setupWSConnection expects req.url to contain the room name.
      // If we mount at /ws/yjs, the client connects to /ws/yjs/roomName
      // Let's parse the URL.
      const urlParts = req.url?.split('/');
      const roomName = urlParts?.[urlParts?.length - 1]; // Last part is usually room name if client appends it

      // Actually, y-websocket client sends room name in the path.
      // If we use WebsocketProvider('ws://host/ws/yjs', 'roomname'), it connects to ws://host/ws/yjs/roomname
      // So req.url will be /ws/yjs/roomname
      
      if (roomName && roomName.startsWith('repo:')) {
        const parts = roomName.split(':');
        const roomRepoId = parts[1];
        if (roomRepoId !== payload.repoId) {
           connection.socket.close(1008, 'Forbidden: Access denied to this repo');
           return;
        }
      }

      // 3. Hand off to y-websocket
      setupWSConnection(connection.socket, req.raw);
    });

    // Tree Events WebSocket Endpoint
    app.get('/ws/repo/:slug/tree', { websocket: true }, (connection, req) => {
      const { slug } = req.params as { slug: string };

      // 1. Authenticate
      let token = req.cookies.repo_token;
      if (!token) {
        const query = req.query as any;
        token = query.token;
      }

      if (!token) {
        connection.socket.close(1008, 'Unauthorized');
        return;
      }

      let payload: RepoTokenPayload;
      try {
        payload = verifyToken(token) as RepoTokenPayload;
      } catch (err) {
        connection.socket.close(1008, 'Unauthorized');
        return;
      }

      if (payload.slug !== slug) {
        connection.socket.close(1008, 'Forbidden');
        return;
      }

      const repoId = Number(payload.repoId);

      // 2. Subscribe to events
      const handler = (event: any) => {
        if (event.repoId === repoId) {
          if (connection.socket.readyState === connection.socket.OPEN) {
            connection.socket.send(JSON.stringify(event));
          }
        }
      };

      treeEventService.on('tree-update', handler);

      // 3. Cleanup
      connection.socket.on('close', () => {
        treeEventService.off('tree-update', handler);
      });
      
      // Send a ping every 30s to keep alive
      const pingInterval = setInterval(() => {
        if (connection.socket.readyState === connection.socket.OPEN) {
          connection.socket.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
      
      connection.socket.on('close', () => clearInterval(pingInterval));
    });
  });
};

export default fastifyPlugin(websocketPlugin);
