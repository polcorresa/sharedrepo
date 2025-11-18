import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { runExpiryJob } from '../jobs/expiry.job.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Jobs plugin
 * Schedules background tasks
 */
const jobsPlugin: FastifyPluginAsync = async (app) => {
  // Run immediately on startup (optional, but good for testing/cleanup)
  // await runExpiryJob(); 
  // Commented out to avoid slowing down startup, but can be enabled.

  // Schedule periodic run
  const intervalId = setInterval(() => {
    runExpiryJob();
  }, JOB_INTERVAL_MS);

  // Clean up on close
  app.addHook('onClose', (instance, done) => {
    clearInterval(intervalId);
    done();
  });
};

export default fastifyPlugin(jobsPlugin);
