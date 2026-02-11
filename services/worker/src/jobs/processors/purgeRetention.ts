import { defaultRetentionPolicy, normalizeRetentionPolicy } from '@conduit/shared';
import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';

export const purgeRetention: JobProcessor = async () => {
  const { rows: workspaces } = await withClient((client) => client.query(`SELECT id FROM workspaces`));

  for (const ws of workspaces) {
    const workspaceId = String(ws.id);
    const { rows: policies } = await withClient((client) => client.query(`SELECT * FROM retention_policies WHERE workspace_id = $1 LIMIT 1`, [workspaceId]));
    const policy = normalizeRetentionPolicy(policies[0] ?? defaultRetentionPolicy());

    if (!policy.purge_enabled) continue;

    const messageRedaction = await withClient((client) =>
      client.query(
        `UPDATE messages
         SET text = NULL,
             html = NULL,
             is_redacted = true,
             redacted_at = now()
         WHERE workspace_id = $1
           AND is_redacted = false
           AND received_at < now() - ($2::text || ' days')::interval`,
        [workspaceId, policy.raw_email_retention_days]
      )
    );

    const attachmentCleanup = await withClient((client) =>
      client.query(
        `UPDATE attachments a
         SET storage_path = NULL
         FROM messages m
         WHERE a.message_id = m.id
           AND m.workspace_id = $1
           AND a.created_at < now() - ($2::text || ' days')::interval
           AND a.storage_path IS NOT NULL`,
        [workspaceId, policy.attachment_retention_days]
      )
    );

    await writeAuditEvent({
      workspaceId,
      type: 'retention_purge_completed',
      data: {
        redacted_messages: messageRedaction.rowCount ?? 0,
        purged_attachments: attachmentCleanup.rowCount ?? 0,
        policy
      }
    });
  }
};
