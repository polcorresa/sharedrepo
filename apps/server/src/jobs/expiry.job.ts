import { RepoRepository } from '@sharedrepo/db';
import { db } from '../db/client.js';
import { logger } from '../logs/logger.js';
import { metrics } from '../plugins/metrics.js';

const repoRepo = new RepoRepository(db);

/**
 * Job to delete expired repositories
 * Runs periodically to clean up repos that haven't been accessed in 7 days
 */
export const runExpiryJob = async () => {
  logger.info('Starting repo expiration job...');
  try {
    const count = await repoRepo.deleteExpired();
    if (count > 0) {
      logger.info(`Expiry job completed. Deleted ${count} expired repos.`);
      metrics.repoOperationsTotal.inc({ operation: 'expire' }, count);
    } else {
      logger.info('Expiry job completed. No expired repos found.');
    }
  } catch (error) {
    logger.error(error, 'Error running repo expiration job');
  }
};
