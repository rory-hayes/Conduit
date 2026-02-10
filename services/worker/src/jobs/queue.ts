import type { JobRecord, JobProcessor } from './types.js';
import type { JobType } from '@conduit/shared';
import { withClient } from '../db.js';
import { log } from '../log.js';

export const enqueueJob = async (type: JobType, payload: Record<string, unknown>) => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO jobs (type, status, payload, attempts, max_attempts)
       VALUES ($1, 'queued', $2, 0, 5)`
      ,
      [type, payload]
    );
  });
};

export const claimNextJob = async (): Promise<JobRecord | null> => {
  return withClient(async (client) => {
    const result = await client.query(
      `WITH next_job AS (
        SELECT id FROM jobs
        WHERE status = 'queued'
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE jobs
      SET status = 'processing',
          locked_at = now(),
          attempts = attempts + 1,
          updated_at = now()
      WHERE id IN (SELECT id FROM next_job)
      RETURNING *;`
    );

    if (result.rows.length === 0) {
      return null;
    }

    return mapJob(result.rows[0]);
  });
};

export const completeJob = async (jobId: string) => {
  await withClient(async (client) => {
    await client.query(
      `UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = $1`,
      [jobId]
    );
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

const mapJob = (row: Record<string, unknown>): JobRecord => {
  return {
    id: row.id as string,
    type: row.type as JobType,
    status: row.status as JobRecord['status'],
    payload: (row.payload as Record<string, unknown>) ?? {},
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lockedAt: row.locked_at as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
};

export const processWith = async (job: JobRecord, processor: JobProcessor) => {
  const clientId = `job-${job.id}`;
  log.info('processing job', { jobId: job.id, type: job.type });
  await processor({ job, clientId });
};
