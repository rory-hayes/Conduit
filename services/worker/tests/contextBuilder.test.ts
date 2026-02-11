import { describe, expect, it } from 'vitest';
import { buildRollupContext } from '../src/rollups/contextBuilder.js';

describe('contextBuilder', () => {
  const input = {
    deal: { title: 'Acme Expansion', stage: 'proposal' },
    weekWindow: { start: '2026-01-01', end: '2026-01-07' },
    facts: [
      { key: 'budget', value: { amount: 50000 }, confidence: 0.95 },
      { key: 'random', value: true, confidence: 1 }
    ],
    readiness: { score: 0.8, missingKeys: ['authority'] },
    events: [{ timestamp: '2026-01-02T00:00:00.000Z', label: 'email_event', description: 'Requested pricing breakdown' }],
    risks: ['missing_authority'],
    suggestedNextActions: ['Collect authority evidence'],
    driftPaused: false,
    reviewItems: [{ reason: 'missing_authority' }],
    snippets: [{ text: 'Email me at rep@acme.com', signalTag: 'pricing_request' as const }]
  };

  it('returns minimal JSON with no snippets in structured_only mode', () => {
    const output = buildRollupContext(input, 'structured_only');
    expect(output).toHaveProperty('key_facts');
    expect(output).not.toHaveProperty('snippets');
  });

  it('includes redacted snippets in structured_plus_snippets mode', () => {
    const output = buildRollupContext(input, 'structured_plus_snippets') as { snippets: Array<{ text: string }> };
    expect(output.snippets).toHaveLength(1);
    expect(output.snippets[0]?.text).toContain('***@acme.com');
  });
});
