import { buildCrmIdempotencyKey, hashPayload } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { withClient } from '../../db.js';
import { createSalesforceClient } from '../../connectors/salesforce/client.js';
import { createSalesforceTokenManager } from '../../connectors/salesforce/tokenManager.js';

const isDryRun = () => process.env.DRY_RUN !== 'false';


const resolveSalesforceOpportunityAssociation = async (workspaceId: string, threadId: string): Promise<string | null> => {
  const { rows } = await withClient((client) =>
    client.query(
      `SELECT d.crm_deal_id
       FROM thread_links tl
       JOIN deals d ON d.id = tl.deal_id
       WHERE tl.workspace_id = $1 AND tl.thread_id = $2 AND d.crm = 'salesforce'
       LIMIT 1`,
      [workspaceId, threadId]
    )
  );
  return rows[0]?.crm_deal_id ? String(rows[0].crm_deal_id) : null;
};

export const syncSalesforce: JobProcessor = async ({ job }) => {
  const threadId = String(job.payload.thread_id ?? '');
  const schemaVersion = String(job.payload.schema_version ?? 'v1');
  const email = String(job.payload.primary_contact_email ?? 'unknown@example.com');
  const summary = String(job.payload.summary ?? `Weekly deal summary for thread ${threadId}`);

  const payload = {
    thread_id: threadId,
    schema_version: schemaVersion,
    action: 'upsert_task'
  };

  const idempotencyKey = buildCrmIdempotencyKey({
    workspace_id: job.workspaceId,
    crm_system: 'salesforce',
    object_type: 'thread',
    object_id: threadId,
    action: 'sync',
    source_event_id: schemaVersion
  });

  await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_planned', data: { crm: 'salesforce', idempotency_key: idempotencyKey } });

  await withClient((client) =>
    client.query(
      `INSERT INTO crm_write_log (workspace_id, thread_id, crm, action, idempotency_key, payload_json, payload_hash, status)
       VALUES ($1, $2, 'salesforce', 'upsert', $3, $4, $5, $6)
       ON CONFLICT (workspace_id, crm, idempotency_key) DO NOTHING`,
      [job.workspaceId, threadId, idempotencyKey, payload, hashPayload(payload), isDryRun() ? 'dry_run' : 'queued']
    )
  );

  if (isDryRun()) {
    await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_logged', data: { crm: 'salesforce', dry_run: true } });
    return;
  }

  const existing = await withClient((client) =>
    client.query(`SELECT id, status FROM crm_write_log WHERE workspace_id = $1 AND crm = 'salesforce' AND idempotency_key = $2 LIMIT 1`, [job.workspaceId, idempotencyKey])
  );
  if (existing.rows[0]?.status === 'succeeded') {
    return;
  }

  const tokenManager = createSalesforceTokenManager();
  const client = createSalesforceClient({ tokenManager, workspaceId: job.workspaceId });

  try {
    const leadResult = await client.upsertLeadMinimal(email, null, null, {});
    const opportunityId = await resolveSalesforceOpportunityAssociation(job.workspaceId, threadId);
    const taskPayload: Record<string, unknown> = {
      Subject: 'Weekly deal summary',
      Description: summary,
      ActivityDate: new Date().toISOString().slice(0, 10)
    };
    if (leadResult.id) taskPayload.WhoId = leadResult.id;
    if (opportunityId) taskPayload.WhatId = opportunityId;
    const task = await client.createTask(taskPayload);

    await withClient((dbClient) =>
      dbClient.query(
        `UPDATE crm_write_log
         SET status = 'succeeded', external_ids_json = $3, response_json = $4, updated_at = now()
         WHERE workspace_id = $1 AND crm = 'salesforce' AND idempotency_key = $2`,
        [job.workspaceId, idempotencyKey, { lead_id: leadResult.id, task_id: task?.id }, { lead: leadResult, task }]
      )
    );

    await writeAuditEvent({ workspaceId: job.workspaceId, threadId, jobId: job.id, type: 'crm_write_succeeded', data: { crm: 'salesforce', idempotency_key: idempotencyKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/401|403/.test(message)) {
      await withClient((dbClient) =>
        dbClient.query(`UPDATE crm_connections SET status = 'error', last_error = $2, updated_at = now() WHERE workspace_id = $1 AND crm = 'salesforce'`, [
          job.workspaceId,
          message
        ])
      );
    }
    throw error;
  }
};
