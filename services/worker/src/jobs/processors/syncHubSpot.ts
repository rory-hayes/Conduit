import type { JobProcessor } from '../types.js';
import { log } from '../../log.js';
import { hubspotClient } from '../../connectors/hubspot/client.js';
import { enforceWritePolicies } from '../../governance/writePolicies.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const syncHubSpot: JobProcessor = async ({ job }) => {
  await writeAuditEvent('sync_hubspot.started', { jobId: job.id });
  const payload = await enforceWritePolicies(job.payload);
  await hubspotClient().writeOutcome(payload);
  log.info('hubspot sync stub', { jobId: job.id });
  await writeAuditEvent('sync_hubspot.completed', { jobId: job.id });
};
