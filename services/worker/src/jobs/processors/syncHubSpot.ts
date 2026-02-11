import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { withClient } from '../../db.js';
import { createHubSpotClient } from '../../connectors/hubspot/client.js';
import { createHubSpotTokenManager } from '../../connectors/hubspot/tokenManager.js';

const isDryRun = () => process.env.DRY_RUN !== 'false';

const upsertCrmWriteLog = async (workspaceId: string, threadId: string, idempotencyKey: string, payload: Record<string, unknown>, status: string) =>
  withClient((client) =>
    client.query(
      `INSERT INTO crm_write_log (workspace_id, thread_id, crm, action, idempotency_key, payload_json, payload_hash, status)
       VALUES ($1, $2, 'hubspot', 'upsert', $3, $4, $5, $6)
       ON CONFLICT (workspace_id, crm, idempotency_key) DO NOTHING`,
      [workspaceId, threadId, idempotencyKey, payload, hashPayload(payload), status]
    )
  );

export const syncHubSpot: JobProcessor = async ({ job }) => {
  const threadId = String(job.payload.thread_id ?? '');
  const schemaVersion = String(job.payload.schema_version ?? 'v1');
  const email = String(job.payload.primary_contact_email ?? 'unknown@example.com');

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

  await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_planned', data: { crm: 'hubspot', idempotency_key: idempotencyKey } });

  await upsertCrmWriteLog(job.workspaceId, threadId, idempotencyKey, payload, isDryRun() ? 'dry_run' : 'queued');

  if (isDryRun()) {
    await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_logged', data: { crm: 'hubspot', dry_run: true } });
    return;
  }

  const existing = await withClient((client) =>
    client.query(`SELECT id, status FROM crm_write_log WHERE workspace_id = $1 AND crm = 'hubspot' AND idempotency_key = $2 LIMIT 1`, [job.workspaceId, idempotencyKey])
  );

  if (existing.rows[0]?.status === 'succeeded') {
    return;
  }

  const tokenManager = createHubSpotTokenManager();
  const client = createHubSpotClient({ tokenManager, workspaceId: job.workspaceId });

  try {
    const contact = await client.upsertContactByEmail(email, { email });
    const contactId = String(contact.record?.id ?? '');
    const task = await client.createTask({ hs_task_subject: 'Conduit thread sync', hs_timestamp: new Date().toISOString() }, [{ toObjectId: contactId }]);
    const note = await client.createNote({ hs_note_body: `Weekly deal summary for thread ${threadId}` }, [{ toObjectId: contactId }]);

    await withClient((dbClient) =>
      dbClient.query(
        `UPDATE crm_write_log
         SET status = 'succeeded', external_ids_json = $3, response_json = $4, updated_at = now()
         WHERE workspace_id = $1 AND crm = 'hubspot' AND idempotency_key = $2`,
        [job.workspaceId, idempotencyKey, { contact_id: contactId, task_id: task?.id, note_id: note?.id }, { contact, task, note }]
      )
    );

    await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_succeeded', data: { crm: 'hubspot', idempotency_key: idempotencyKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/401|403/.test(message)) {
      await withClient((dbClient) =>
        dbClient.query(`UPDATE crm_connections SET status = 'error', last_error = $2, updated_at = now() WHERE workspace_id = $1 AND crm = 'hubspot'`, [job.workspaceId, message])
      );
    }
    throw error;
  }
};
