import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newDb } from 'pg-mem';
import pg from 'pg';

const db = newDb();
let idCounter = 0;
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid',
  implementation: () => `00000000-0000-0000-0000-${String(++idCounter).padStart(12, '0')}`
});

const { Pool } = db.adapters.createPg();
const pool = new Pool();

db.public.none(`
  CREATE TABLE jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid,
    type text NOT NULL,
    status text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts int NOT NULL DEFAULT 0,
    run_after timestamptz NOT NULL DEFAULT now(),
    locked_at timestamptz,
    locked_by text,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`);

vi.mock('../src/db.js', async () => ({
  withClient: async (fn: (client: pg.PoolClient) => Promise<unknown>) => {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
}));

const { claimNextJob, completeJob, failJob } = await import('../src/jobs/queue.js');

describe('job claiming', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM jobs');
    await pool.query(
      `INSERT INTO jobs (workspace_id, type, status, payload) VALUES
      ('00000000-0000-0000-0000-000000000001', 'extract_thread', 'queued', '{"thread_id":"t1"}'),
      ('00000000-0000-0000-0000-000000000001', 'sync_hubspot', 'queued', '{"thread_id":"t2"}')`
    );
  });

  it('claims jobs with SKIP LOCKED semantics', async () => {
    const first = await claimNextJob();
    const second = await claimNextJob();

    expect(first?.status).toBe('running');
    expect(second?.status).toBe('running');
    expect(first?.id).not.toEqual(second?.id);
  });

  it('marks completion and failure transitions', async () => {
    const job = await claimNextJob();
    await completeJob(job!.id);
    const completed = await pool.query('SELECT status FROM jobs WHERE id = $1', [job!.id]);
    expect(completed.rows[0].status).toBe('succeeded');

    const job2 = await claimNextJob();
    await failJob(job2!.id, 'boom');
    const failed = await pool.query('SELECT status, last_error FROM jobs WHERE id = $1', [job2!.id]);
    expect(failed.rows[0]).toMatchObject({ status: 'failed', last_error: 'boom' });
  });
});
