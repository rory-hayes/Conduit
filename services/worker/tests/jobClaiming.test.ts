import { describe, expect, it, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import pg from 'pg';

const db = newDb();
db.public.registerFunction({
  name: 'gen_random_uuid',
  returns: 'uuid',
  implementation: () => '00000000-0000-0000-0000-000000000001'
});

const { Pool } = db.adapters.createPg();
const pool = new Pool();

db.public.none(`
  CREATE TABLE jobs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL,
    status text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts int NOT NULL DEFAULT 0,
    max_attempts int NOT NULL DEFAULT 5,
    locked_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`);

vi.mock('../src/db.js', async () => {
  return {
    withClient: async (fn: (client: pg.PoolClient) => Promise<unknown>) => {
      const client = await pool.connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    }
  };
});

const { claimNextJob } = await import('../src/jobs/queue.js');

describe('job claiming', () => {
  beforeEach(async () => {
    await pool.query('DELETE FROM jobs');
    await pool.query(
      `INSERT INTO jobs (type, status, payload) VALUES
      ('extract_thread', 'queued', '{"threadId":"t1"}'),
      ('sync_hubspot', 'queued', '{"threadId":"t2"}')`
    );
  });

  it('claims jobs with SKIP LOCKED semantics', async () => {
    const first = await claimNextJob();
    const second = await claimNextJob();

    expect(first?.status).toBe('processing');
    expect(second?.status).toBe('processing');
    expect(first?.id).not.toEqual(second?.id);
  });
});
