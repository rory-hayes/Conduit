import type { JobProcessor } from '../types.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { runExtraction } from '../../extraction/openaiExtractor.js';
import { evaluatePolicies } from '../../governance/policyEngine.js';
import { enqueueJob } from '../queue.js';
import { withClient } from '../../db.js';
import {
  computeExtractionQuality,
  computeSourceKey,
  shouldTriggerDrift,
  type SourceMessage
} from '../../governance/driftDetection.js';

interface ThreadMessage extends SourceMessage {
  threadId: string;
  workspaceId: string;
}

interface WorkspacePolicy {
  pause_on_drift?: boolean;
  drift_thresholds?: { historical_min?: number; current_max?: number };
  pause_scope?: 'source_key' | 'schema' | 'workspace';
}

const getLatestThreadMessage = async (threadId: string): Promise<ThreadMessage> => {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT thread_id, workspace_id, text, from_email, subject
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
      text: (result.rows[0].text as string) ?? '',
      fromEmail: (result.rows[0].from_email as string) ?? '',
      subject: (result.rows[0].subject as string) ?? ''
    };
  });
};

const getPolicy = async (workspaceId: string): Promise<Required<WorkspacePolicy>> => {
  const defaults: Required<WorkspacePolicy> = {
    pause_on_drift: true,
    drift_thresholds: { historical_min: 0.85, current_max: 0.6 },
    pause_scope: 'source_key'
  };

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT policy
       FROM policies
       WHERE workspace_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId]
    );

    const policy = (result.rows[0]?.policy as WorkspacePolicy | undefined) ?? {};
    return {
      pause_on_drift: policy.pause_on_drift ?? defaults.pause_on_drift,
      drift_thresholds: {
        historical_min: policy.drift_thresholds?.historical_min ?? defaults.drift_thresholds.historical_min,
        current_max: policy.drift_thresholds?.current_max ?? defaults.drift_thresholds.current_max
      },
      pause_scope: policy.pause_scope ?? defaults.pause_scope
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

const handleDrift = async (params: {
  threadId: string;
  workspaceId: string;
  sourceKey: string;
  currentQuality: number;
  historicalQuality: number;
  policy: Required<WorkspacePolicy>;
  jobId: string;
}) => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO drift_alerts (workspace_id, thread_id, source_key, severity, reason, details_json, status)
       VALUES ($1, $2, $3, $4, 'extraction_quality_drop', $5, 'open')`,
      [
        params.workspaceId,
        params.threadId,
        params.sourceKey,
        params.currentQuality < 0.45 ? 'critical' : 'warning',
        { current_quality: params.currentQuality, historical_quality: params.historicalQuality }
      ]
    );

    if (params.policy.pause_on_drift) {
      await client.query(
        `INSERT INTO write_pause (workspace_id, scope, scope_key, paused, paused_reason, paused_at, updated_at)
         VALUES ($1, $2, $3, true, 'drift_detected', now(), now())
         ON CONFLICT (workspace_id, scope, scope_key)
         DO UPDATE SET paused = true, paused_reason = 'drift_detected', paused_at = now(), updated_at = now()`,
        [params.workspaceId, params.policy.pause_scope, params.sourceKey]
      );
    }

    await client.query(
      `INSERT INTO review_items (workspace_id, thread_id, reason, status, payload_json)
       VALUES ($1, $2, 'drift_pause_review', 'open', $3)`,
      [params.workspaceId, params.threadId, { source_key: params.sourceKey, quality: params.currentQuality }]
    );
  });

  await writeAuditEvent({
    workspaceId: params.workspaceId,
    threadId: params.threadId,
    jobId: params.jobId,
    type: 'drift_detected',
    data: { source_key: params.sourceKey, current_quality: params.currentQuality, historical_quality: params.historicalQuality }
  });

  if (params.policy.pause_on_drift) {
    await writeAuditEvent({
      workspaceId: params.workspaceId,
      threadId: params.threadId,
      jobId: params.jobId,
      type: 'crm_writes_paused',
      data: { scope: params.policy.pause_scope, scope_key: params.sourceKey }
    });
  }
};

export const extractThread: JobProcessor = async ({ job }) => {
  const threadId = String(job.payload.thread_id ?? '');
  if (!threadId) {
    throw new Error('missing thread_id payload');
  }

  const thread = await getLatestThreadMessage(threadId);
  const policy = await getPolicy(thread.workspaceId);

  await writeAuditEvent({
    workspaceId: thread.workspaceId,
    threadId,
    jobId: job.id,
    type: 'extract_thread.started',
    data: { thread_id: threadId }
  });

  const fields = await runExtraction(thread.text ?? '');
  await insertExtractionArtifacts({ threadId, workspaceId: thread.workspaceId, fields });

  const sourceKey = computeSourceKey(thread);
  const currentQuality = computeExtractionQuality(fields);

  const history = await withClient(async (client) => {
    const result = await client.query(
      `SELECT last_good_quality
       FROM extraction_quality_history
       WHERE workspace_id = $1
         AND source_key = $2
         AND schema_id IS NULL
       LIMIT 1`,
      [thread.workspaceId, sourceKey]
    );
    return result.rows[0]?.last_good_quality as number | undefined;
  });

  const thresholdHistorical = policy.drift_thresholds.historical_min;
  const thresholdCurrent = policy.drift_thresholds.current_max;
  const driftTriggered = history !== undefined && history >= thresholdHistorical && currentQuality <= thresholdCurrent;

  if (driftTriggered || (history !== undefined && shouldTriggerDrift(currentQuality, history))) {
    await handleDrift({
      threadId,
      workspaceId: thread.workspaceId,
      sourceKey,
      currentQuality,
      historicalQuality: history,
      policy,
      jobId: job.id
    });
    return;
  }

  if (currentQuality >= thresholdHistorical) {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO extraction_quality_history (workspace_id, source_key, schema_id, last_good_quality, last_good_at, updated_at)
         VALUES ($1, $2, NULL, $3, now(), now())
         ON CONFLICT (workspace_id, source_key, schema_id)
         DO UPDATE SET last_good_quality = EXCLUDED.last_good_quality, last_good_at = now(), updated_at = now()`,
        [thread.workspaceId, sourceKey, currentQuality]
      );
    });
  }

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
