import { describe, expect, it } from 'vitest';
import { parseRollupOutput } from '../src/llm/rollupSchema.js';

describe('rollupSchema', () => {
  it('parses valid output', () => {
    const parsed = parseRollupOutput(
      JSON.stringify({
        summary_md: 'Summary',
        highlights: { events: ['a'], risks: ['b'], next_actions: ['c'] },
        confidence: 0.9,
        field_deltas: [{ key: 'timeline', value: { quarter: 'Q3' }, confidence: 0.95 }]
      })
    );

    expect(parsed.summary_md).toBe('Summary');
  });

  it('throws on invalid output', () => {
    expect(() => parseRollupOutput(JSON.stringify({ summary_md: 'x' }))).toThrow();
  });
});
