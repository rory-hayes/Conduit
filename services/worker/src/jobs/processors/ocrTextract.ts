import type { JobProcessor } from '../types.js';
import { textractClient } from '../../ocr/textractClient.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { log } from '../../log.js';

export const ocrTextract: JobProcessor = async ({ job }) => {
  await writeAuditEvent({ workspaceId: job.workspaceId, jobId: job.id, type: 'ocr_textract.started', data: {} });
  await textractClient().startExtraction(job.payload);
  log.info('textract stub', { jobId: job.id });
  await writeAuditEvent({ workspaceId: job.workspaceId, jobId: job.id, type: 'ocr_textract.completed', data: {} });
};
