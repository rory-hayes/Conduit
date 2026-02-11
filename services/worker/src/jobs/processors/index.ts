import { extractThread } from './extractThread.js';
import { syncHubSpot } from './syncHubSpot.js';
import { associateThreadProcessor } from './associateThread.js';
import { syncSalesforce } from './syncSalesforce.js';
import { weeklyDigest } from './weeklyDigest.js';
import { weeklyRollup } from './weeklyRollup.js';
import { ocrTextract } from './ocrTextract.js';
import { reconcileConnections } from './reconcileConnections.js';
import { reconcileCrmWrites } from './reconcileCrmWrites.js';
import { purgeRetention } from './purgeRetention.js';
import type { JobProcessor } from '../types.js';

export const jobProcessors: Record<string, JobProcessor> = {
  extract_thread: extractThread,
  associate_thread: associateThreadProcessor,
  sync_hubspot: syncHubSpot,
  sync_salesforce: syncSalesforce,
  weekly_digest: weeklyDigest,
  weekly_rollup: weeklyRollup,
  ocr_textract: ocrTextract,
  reconcile_connections: reconcileConnections,
  reconcile_crm_writes: reconcileCrmWrites,
  purge_retention: purgeRetention
};
