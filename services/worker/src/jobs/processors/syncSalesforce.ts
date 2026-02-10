import type { JobProcessor } from '../types.js';
import { log } from '../../log.js';
import { salesforceClient } from '../../connectors/salesforce/client.js';
import { enforceWritePolicies } from '../../governance/writePolicies.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const syncSalesforce: JobProcessor = async ({ job }) => {
  await writeAuditEvent('sync_salesforce.started', { jobId: job.id });
  const payload = await enforceWritePolicies(job.payload);
  await salesforceClient().writeOutcome(payload);
  log.info('salesforce sync stub', { jobId: job.id });
  await writeAuditEvent('sync_salesforce.completed', { jobId: job.id });
};
