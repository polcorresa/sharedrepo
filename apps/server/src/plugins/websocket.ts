import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { setupWSConnection } from 'y-websocket/bin/utils';
import { LeveldbPersistence } from 'y-leveldb';
import { treeEventService } from '../services/tree-events.service.js';
import { logger } from '../logs/logger.js';
import { createVerifier } from 'fast-jwt';
import { env } from '../config/env.js';
import type { RepoTokenPayload } from '@sharedrepo/shared';
import { metrics } from './metrics.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Yjs persistence
const persistenceDir = path.join(__dirname, '../../.yjs-storage');
const persistence = new LeveldbPersistence(persistenceDir);

const verifyToken = createVerifier({
  key: env.JWT_SECRET,
  cache: true,
});

const websocketPlugin: FastifyPluginAsync = async (app) => {
  await app.register(fastifyWebsocket);

  // Yjs WebSocket Endpoint
  app.get('/ws/yjs', { websocket: true }, (socket, req) => {
    // 1. Authenticate
    let token = req.cookies.repo_token;
      
      // If not in cookie, check query param (e.g. ?token=...)
      if (!token) {
        const query = req.query as any;
        token = query.token;
      }

    if (!token) {
      socket.close(1008, 'Unauthorized: No token provided');
      return;
    }

    let payload: RepoTokenPayload;
    try {
      payload = verifyToken(token) as RepoTokenPayload;
    } catch (err) {
      socket.close(1008, 'Unauthorized: Invalid token');
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
         socket.close(1008, 'Forbidden: Access denied to this repo');
         return;
      }
    }

    // 3. Hand off to y-websocket with persistence
    metrics.activeWebsocketConnections.inc();
    setupWSConnection(socket, req.raw, { persistence });
    
    socket.on('close', () => {
      metrics.activeWebsocketConnections.dec();
    });
  });

  // Tree Events WebSocket Endpoint
  app.get('/ws/repo/:slug/tree', { websocket: true }, (socket, req) => {
    const { slug } = req.params as { slug: string };

    // 1. Authenticate
    let token = req.cookies.repo_token;
    if (!token) {
      const query = req.query as any;
      token = query.token;
    }

    if (!token) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    let payload: RepoTokenPayload;
    try {
      payload = verifyToken(token) as RepoTokenPayload;
    } catch (err) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    if (payload.slug !== slug) {
      socket.close(1008, 'Forbidden');
      return;
    }

    const repoId = Number(payload.repoId);

    metrics.activeWebsocketConnections.inc();

    // 2. Subscribe to events
    const handler = (event: any) => {
      if (event.repoId === repoId) {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      }
    };

    treeEventService.on('tree-update', handler);

    // 3. Cleanup
    socket.on('close', () => {
      treeEventService.off('tree-update', handler);
      metrics.activeWebsocketConnections.dec();
    });
    
    // Send a ping every 30s to keep alive
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
    
    socket.on('close', () => clearInterval(pingInterval));
  });
};

export default fastifyPlugin(websocketPlugin);
