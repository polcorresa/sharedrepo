import fastifyPlugin from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { runExpiryJob } from '../jobs/expiry.job.js';
import { RepoRepository } from '@sharedrepo/db';
import { db } from '../db/client.js';
import { metrics } from './metrics.js';

const JOB_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const METRICS_INTERVAL_MS = 60 * 1000; // 1 minute

const repoRepo = new RepoRepository(db);

/**
 * Jobs plugin
 * Schedules background tasks
 */
const jobsPlugin: FastifyPluginAsync = async (app) => {
  // Run immediately on startup (optional, but good for testing/cleanup)
  // await runExpiryJob(); 
  // Commented out to avoid slowing down startup, but can be enabled.

  // Schedule periodic expiry run
  const expiryIntervalId = setInterval(() => {
    runExpiryJob();
  }, JOB_INTERVAL_MS);

  // Schedule periodic metrics update
  const metricsIntervalId = setInterval(async () => {
    try {
      const count = await repoRepo.countActive();
      metrics.activeReposCount.set(Number(count));
    } catch (err) {
      app.log.error(err, 'Failed to update active repos metric');
    }
  }, METRICS_INTERVAL_MS);

  // Initial metric update
  repoRepo.countActive().then(count => metrics.activeReposCount.set(Number(count))).catch(err => app.log.error(err));

  // Clean up on close
  app.addHook('onClose', (instance, done) => {
    clearInterval(expiryIntervalId);
    clearInterval(metricsIntervalId);
    done();
  });
};

export default fastifyPlugin(jobsPlugin);
