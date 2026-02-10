import type { JobProcessor } from '../types.js';
import { log } from '../../log.js';
import { runExtraction } from '../../extraction/openaiExtractor.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const extractThread: JobProcessor = async ({ job }) => {
  await writeAuditEvent('extract_thread.started', job.payload);
  const result = await runExtraction(job.payload);
  log.info('extraction stub complete', { jobId: job.id, result });
  await writeAuditEvent('extract_thread.completed', { jobId: job.id });
};
