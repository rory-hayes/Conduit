import { computeRetrySchedule, isPermanentFailure } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const reconcileCrmWrites: JobProcessor = async () => {
  const { rows } = await withClient((client) =>
    client.query(
      `SELECT id, workspace_id, thread_id, crm, retry_count
       FROM crm_write_log
       WHERE status IN ('failed', 'planned')
         AND permanent_failure = false
         AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY created_at
       LIMIT 200`
    )
  );

  for (const row of rows) {
    const retryCount = Number(row.retry_count ?? 0);
    const workspaceId = String(row.workspace_id);
    const threadId = row.thread_id ? String(row.thread_id) : null;
    const crm = String(row.crm);

    if (isPermanentFailure(retryCount + 1, 8)) {
      await withClient((client) =>
        client.query(`UPDATE crm_write_log SET permanent_failure = true, updated_at = now() WHERE id = $1`, [row.id])
      );
      await writeAuditEvent({ workspaceId, threadId, type: 'crm_write_marked_permanent_failure', data: { crm_write_log_id: row.id, crm, retry_count: retryCount + 1 } });
      continue;
    }

    const scheduled = computeRetrySchedule(retryCount);
    const jobType = crm === 'hubspot' ? 'sync_hubspot' : 'sync_salesforce';

    await withClient((client) =>
      client.query(
        `INSERT INTO jobs (workspace_id, type, status, payload, run_after, attempts)
         VALUES ($1, $2, 'queued', $3, now(), 0)`,
        [workspaceId, jobType, { crm_write_log_id: row.id, thread_id: row.thread_id }]
      )
    );

    await withClient((client) =>
      client.query(`UPDATE crm_write_log SET retry_count = $2, next_retry_at = $3, updated_at = now() WHERE id = $1`, [row.id, scheduled.retryCount, scheduled.nextRetryAt])
    );

    await writeAuditEvent({
      workspaceId,
      threadId,
      type: 'crm_write_retry_scheduled',
      data: { crm_write_log_id: row.id, crm, retry_count: scheduled.retryCount, next_retry_at: scheduled.nextRetryAt }
    });
  }
};
