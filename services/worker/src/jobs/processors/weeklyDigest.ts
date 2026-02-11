import type { JobProcessor } from '../types.js';
import { log } from '../../log.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const weeklyDigest: JobProcessor = async ({ job }) => {
  await writeAuditEvent({ workspaceId: job.workspaceId, jobId: job.id, type: 'weekly_digest.started', data: {} });
  log.info('weekly digest stub', { jobId: job.id });
  await writeAuditEvent({ workspaceId: job.workspaceId, jobId: job.id, type: 'weekly_digest.completed', data: {} });
};
