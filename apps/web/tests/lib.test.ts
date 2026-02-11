import { describe, expect, it, vi } from 'vitest';

const chain = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [] }),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null })
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => chain
  })
}));

const { formatConfidence, getTodayThreads, getOpenReviewItems, getThreadDetail, suggestDealQuestions } = await import(
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

  it('maps missing keys to ordered questions', () => {
    expect(suggestDealQuestions(['timeline', 'budget'])).toEqual([
      'Do you have a budget range allocated for this?',
      'When do you need this live?'
    ]);
  });

  it('returns detail object shape with empty fallbacks', async () => {
    chain.eq.mockReturnValue({ data: [] });
    const detail = await getThreadDetail('t1');
    expect(detail).toEqual({
      messages: [],
      fields: [],
      reviewItems: [],
      crmLog: [],
      threadLink: null,
      deal: null,
      dealReadiness: null,
      dealFacts: [],
      needsLinkingCandidates: []
    });
  });
});
