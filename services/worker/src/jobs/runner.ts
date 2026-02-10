import { claimNextJob, completeJob, failJob, processWith } from './queue.js';
import { jobProcessors } from './processors/index.js';
import { log } from '../log.js';

export const runOnce = async () => {
  const job = await claimNextJob();
  if (!job) {
    return false;
  }
  const processor = jobProcessors[job.type];
  if (!processor) {
    log.error('missing processor', { jobType: job.type });
    await failJob(job.id, `missing processor for ${job.type}`);
    return true;
  }

  try {
    await processWith(job, processor);
    await completeJob(job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    log.error('job failed', { jobId: job.id, error: message });
    await failJob(job.id, message);
  }
  return true;
};

export const startRunner = async () => {
  log.info('worker started');
  // Simple polling loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const didWork = await runOnce();
    if (!didWork) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};
