import type { JobProcessor } from '../types.js';
import { textractClient } from '../../ocr/textractClient.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { log } from '../../log.js';

export const ocrTextract: JobProcessor = async ({ job }) => {
  await writeAuditEvent('ocr_textract.started', { jobId: job.id });
  await textractClient().startExtraction(job.payload);
  log.info('textract stub', { jobId: job.id });
  await writeAuditEvent('ocr_textract.completed', { jobId: job.id });
};
