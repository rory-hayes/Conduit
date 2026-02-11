import type { JobRecord, JobProcessor } from './types.js';
import type { JobType } from '@conduit/shared';
import { withClient } from '../db.js';
import { log } from '../log.js';

export const enqueueJob = async (
  workspaceId: string,
  type: JobType,
  payload: Record<string, unknown>
): Promise<string> => {
  return withClient(async (client) => {
    const result = await client.query(
      `INSERT INTO jobs (workspace_id, type, status, payload, attempts)
       VALUES ($1, $2, 'queued', $3, 0)
       RETURNING id`,
      [workspaceId, type, payload]
    );

    return result.rows[0].id as string;
  });
};

export const claimNextJob = async (): Promise<JobRecord | null> => {
  return withClient(async (client) => {
    const result = await client.query(
      `WITH next_job AS (
        SELECT id FROM jobs
        WHERE status = 'queued' AND run_after <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE jobs
      SET status = 'running',
          locked_at = now(),
          locked_by = $1,
          attempts = attempts + 1,
          updated_at = now()
      WHERE id IN (SELECT id FROM next_job)
      RETURNING *;`,
      ['worker']
    );

    return result.rows[0] ? mapJob(result.rows[0]) : null;
  });
};

export const completeJob = async (jobId: string) => {
  await withClient(async (client) => {
    await client.query(`UPDATE jobs SET status = 'succeeded', updated_at = now() WHERE id = $1`, [jobId]);
  });
};

export const failJob = async (jobId: string, error: string) => {
  await withClient(async (client) => {
    await client.query(
      `UPDATE jobs SET status = 'failed', updated_at = now(), last_error = $2 WHERE id = $1`,
      [jobId, error]
    );
  });
};

const mapJob = (row: Record<string, unknown>): JobRecord => ({
  id: row.id as string,
  workspaceId: row.workspace_id as string,
  type: row.type as JobType,
  status: row.status as JobRecord['status'],
  payload: (row.payload as Record<string, unknown>) ?? {},
  attempts: row.attempts as number,
  lockedAt: row.locked_at as string | null,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const processWith = async (job: JobRecord, processor: JobProcessor) => {
  const clientId = `job-${job.id}`;
  log.info('processing job', { jobId: job.id, type: job.type });
  await processor({ job, clientId });
};
