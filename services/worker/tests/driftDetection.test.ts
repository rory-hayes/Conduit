import { describe, expect, it } from 'vitest';
import { computeExtractionQuality, computeSourceKey, shouldTriggerDrift } from '../src/governance/driftDetection.js';

describe('drift detection helpers', () => {
  it('computeSourceKey is stable across reply prefixes and whitespace', () => {
    const a = computeSourceKey({
      fromEmail: 'Rep@Example.com',
      subject: 'Re:   Pricing update',
      text: 'Hello there\nBody'
    });
    const b = computeSourceKey({
      fromEmail: 'rep@example.com',
      subject: 'Fwd: pricing update',
      text: 'Hello there\nBody changed'
    });

    expect(a).toContain('domain:example.com');
    expect(a.split('|sub:')[1].split('|h:')[0]).toBe('pricing update');
    expect(a).toBe(b);
  });

  it('computeExtractionQuality scores weighted required fields', () => {
    const quality = computeExtractionQuality([
      { field_key: 'email', field_value_json: 'a@b.com', confidence: 0.9, evidence_json: { match: '', line: 1 } },
      { field_key: 'name', field_value_json: 'Jane', confidence: 0.9, evidence_json: { match: '', line: 1 } },
      { field_key: 'company', field_value_json: 'Acme', confidence: 0.8, evidence_json: { match: '', line: 1 } }
    ]);

    expect(quality).toBe(1);
  });

  it('shouldTriggerDrift only triggers on material drop', () => {
    expect(shouldTriggerDrift(0.55, 0.9)).toBe(true);
    expect(shouldTriggerDrift(0.75, 0.9)).toBe(false);
    expect(shouldTriggerDrift(0.5, 0.7)).toBe(false);
  });
});
