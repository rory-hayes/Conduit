import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { withClient } from '../../db.js';

const isDryRun = process.env.DRY_RUN !== 'false';

export const syncHubSpot: JobProcessor = async ({ job }) => {
  const threadId = String(job.payload.thread_id ?? '');
  const schemaVersion = String(job.payload.schema_version ?? 'v1');

  const payload = {
    thread_id: threadId,
    schema_version: schemaVersion,
    action: 'upsert_task_and_note'
  };

  const idempotencyKey = buildCrmIdempotencyKey({
    workspace_id: job.workspaceId,
    crm_system: 'hubspot',
    object_type: 'thread',
    object_id: threadId,
    action: 'sync',
    source_event_id: schemaVersion
  });

  await writeAuditEvent({
    workspaceId: job.workspaceId,
    threadId,
    jobId: job.id,
    type: 'crm_write_planned',
    data: { crm: 'hubspot', idempotency_key: idempotencyKey }
  });

  await withClient(async (client) => {
    await client.query(
      `INSERT INTO crm_write_log (workspace_id, thread_id, crm, action, idempotency_key, payload_json, payload_hash, status)
       VALUES ($1, $2, 'hubspot', 'upsert', $3, $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [job.workspaceId, threadId, idempotencyKey, payload, hashPayload(payload), isDryRun ? 'dry_run' : 'queued']
    );
  });

  await writeAuditEvent({
    workspaceId: job.workspaceId,
    threadId,
    jobId: job.id,
    type: 'crm_write_logged',
    data: { crm: 'hubspot', dry_run: isDryRun }
  });
};
