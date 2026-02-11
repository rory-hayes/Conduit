import { describe, expect, it, vi } from 'vitest';

const chain = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [] }),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => chain
  })
}));

const { formatConfidence, getTodayThreads, getOpenReviewItems, getThreadDetail } = await import(
  '../src/lib/queries'
);

describe('queries lib helpers', () => {
  it('formats confidence as percent', () => {
    expect(formatConfidence(0.905)).toBe('91%');
  });

  it('returns fallback empty arrays for list queries', async () => {
    const [threads, reviews] = await Promise.all([getTodayThreads(), getOpenReviewItems()]);
    expect(threads).toEqual([]);
    expect(reviews).toEqual([]);
  });

  it('returns detail object shape with empty fallbacks', async () => {
    chain.eq.mockReturnValue({ data: [] });
    const detail = await getThreadDetail('t1');
    expect(detail).toEqual({ messages: [], fields: [], reviewItems: [], crmLog: [] });
  });
});
