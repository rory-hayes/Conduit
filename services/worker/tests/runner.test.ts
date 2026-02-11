import { describe, expect, it, vi } from 'vitest';

const complete = vi.fn();
const fail = vi.fn();
const process = vi.fn();

vi.mock('../src/jobs/queue.js', () => ({
  claimNextJob: vi.fn(),
  completeJob: complete,
  failJob: fail,
  processWith: process
}));

vi.mock('../src/jobs/processors/index.js', () => ({
  jobProcessors: {
    extract_thread: async () => undefined
  }
}));

const queue = await import('../src/jobs/queue.js');
const { runOnce } = await import('../src/jobs/runner.js');

describe('runner', () => {
  it('returns false when no job', async () => {
    vi.mocked(queue.claimNextJob).mockResolvedValueOnce(null as any);
    expect(await runOnce()).toBe(false);
  });

  it('fails missing processor', async () => {
    vi.mocked(queue.claimNextJob).mockResolvedValueOnce({ id: '1', type: 'unknown' } as any);
    expect(await runOnce()).toBe(true);
    expect(fail).toHaveBeenCalled();
  });

  it('completes successful job', async () => {
    vi.mocked(queue.claimNextJob).mockResolvedValueOnce({ id: '2', type: 'extract_thread' } as any);
    expect(await runOnce()).toBe(true);
    expect(complete).toHaveBeenCalledWith('2');
  });

  it('marks failure on processor error', async () => {
    process.mockRejectedValueOnce(new Error('broken'));
    vi.mocked(queue.claimNextJob).mockResolvedValueOnce({ id: '3', type: 'extract_thread' } as any);
    await runOnce();
    expect(fail).toHaveBeenCalledWith('3', 'broken');
  });
});
