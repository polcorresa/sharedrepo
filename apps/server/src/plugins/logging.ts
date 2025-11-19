import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { hashIp } from '@sharedrepo/db';

/**
 * Logging plugin
 * Adds standardized fields to the request logger
 */
const loggingPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request) => {
    const ipHash = hashIp(request.ip);
    (request.log as any).setBindings({ ip_hash: ipHash });
  });
};

export default fastifyPlugin(loggingPlugin);
