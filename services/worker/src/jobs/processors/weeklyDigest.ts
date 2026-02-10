import type { JobProcessor } from '../types.js';
import { log } from '../../log.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const weeklyDigest: JobProcessor = async ({ job }) => {
  await writeAuditEvent('weekly_digest.started', { jobId: job.id });
  log.info('weekly digest stub', { jobId: job.id });
  await writeAuditEvent('weekly_digest.completed', { jobId: job.id });
};
