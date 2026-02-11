import { extractThread } from './extractThread.js';
import { syncHubSpot } from './syncHubSpot.js';
import { associateThreadProcessor } from './associateThread.js';
import { syncSalesforce } from './syncSalesforce.js';
import { weeklyDigest } from './weeklyDigest.js';
import { ocrTextract } from './ocrTextract.js';
import type { JobProcessor } from '../types.js';

export const jobProcessors: Record<string, JobProcessor> = {
  extract_thread: extractThread,
  associate_thread: associateThreadProcessor,
  sync_hubspot: syncHubSpot,
  sync_salesforce: syncSalesforce,
  weekly_digest: weeklyDigest,
  ocr_textract: ocrTextract
};
