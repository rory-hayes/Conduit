import type { JobProcessor } from '../types.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { runExtraction } from '../../extraction/openaiExtractor.js';
import { evaluatePolicies } from '../../governance/policyEngine.js';
import { enqueueJob } from '../queue.js';
import { withClient } from '../../db.js';

interface ThreadMessage {
  threadId: string;
  workspaceId: string;
  text: string;
}

const getLatestThreadMessage = async (threadId: string): Promise<ThreadMessage> => {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT thread_id, workspace_id, text
       FROM messages
       WHERE thread_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [threadId]
    );

    if (!result.rows[0]) {
      throw new Error(`thread message not found for ${threadId}`);
    }

    return {
      threadId: result.rows[0].thread_id as string,
      workspaceId: result.rows[0].workspace_id as string,
      text: (result.rows[0].text as string) ?? ''
    };
  });
};

const insertExtractionArtifacts = async (input: {
  threadId: string;
  workspaceId: string;
  fields: Awaited<ReturnType<typeof runExtraction>>;
}): Promise<string> => {
  return withClient(async (client) => {
    const run = await client.query(
      `INSERT INTO extraction_runs (thread_id, workspace_id, schema_id, schema_version, model, status)
       VALUES ($1, $2, 'lead_intake', 'v1', 'deterministic-stub', 'completed')
       RETURNING id`,
      [input.threadId, input.workspaceId]
    );
    const extractionRunId = run.rows[0].id as string;

    for (const field of input.fields) {
      await client.query(
        `INSERT INTO field_values (
          extraction_run_id, thread_id, workspace_id, field_key, field_value_json, confidence, evidence_json
        ) VALUES ($1, $2, $3, $4, to_jsonb($5::text), $6, $7)`,
        [
          extractionRunId,
          input.threadId,
          input.workspaceId,
          field.field_key,
          field.field_value_json,
          field.confidence,
          field.evidence_json
        ]
      );
    }

    return extractionRunId;
  });
};

export const extractThread: JobProcessor = async ({ job }) => {
  const threadId = String(job.payload.thread_id ?? '');
  if (!threadId) {
    throw new Error('missing thread_id payload');
  }

  const thread = await getLatestThreadMessage(threadId);
  await writeAuditEvent({
    workspaceId: thread.workspaceId,
    threadId,
    jobId: job.id,
    type: 'extract_thread.started',
    data: { thread_id: threadId }
  });

  const fields = await runExtraction(thread.text);
  await insertExtractionArtifacts({ threadId, workspaceId: thread.workspaceId, fields });

  await enqueueJob(thread.workspaceId, 'associate_thread', { thread_id: threadId });

  const decision = evaluatePolicies(fields);
  if (decision.action === 'review') {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO review_items (workspace_id, thread_id, reason, status, payload_json)
         VALUES ($1, $2, $3, 'open', $4)`,
        [thread.workspaceId, threadId, decision.reason, { fields }]
      );
    });

    await writeAuditEvent({
      workspaceId: thread.workspaceId,
      threadId,
      jobId: job.id,
      type: 'policy.review_created',
      data: { reason: decision.reason }
    });
    return;
  }

  await enqueueJob(thread.workspaceId, 'sync_hubspot', { thread_id: threadId, schema_version: 'v1' });
  await enqueueJob(thread.workspaceId, 'sync_salesforce', { thread_id: threadId, schema_version: 'v1' });
  await writeAuditEvent({
    workspaceId: thread.workspaceId,
    threadId,
    jobId: job.id,
    type: 'policy.sync_enqueued',
    data: { targets: ['associate_thread', 'hubspot', 'salesforce'] }
  });
};
