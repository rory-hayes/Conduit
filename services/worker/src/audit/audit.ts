import { withClient } from '../db.js';

interface AuditWriteInput {
  workspaceId: string;
  type: string;
  data: Record<string, unknown>;
  threadId?: string;
  jobId?: string;
}

export const writeAuditEvent = async ({ workspaceId, type, data, threadId, jobId }: AuditWriteInput) => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO audit_events (workspace_id, thread_id, job_id, type, data_json)
       VALUES ($1, $2, $3, $4, $5)`,
      [workspaceId, threadId ?? null, jobId ?? null, type, data]
    );
  });
};
