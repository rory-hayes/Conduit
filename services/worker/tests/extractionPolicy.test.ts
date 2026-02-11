import { describe, expect, it } from 'vitest';
import { deterministicExtract } from '../src/extraction/openaiExtractor';
import { evaluatePolicies } from '../src/governance/policyEngine';

describe('deterministic extraction + policy', () => {
  it('extracts known fields with confidence/evidence', () => {
    const fields = deterministicExtract(`Name: Jamie Quinn\nEmail: jamie@acme.com\nCompany: Acme`);
    expect(fields).toHaveLength(3);
    expect(fields.find((f) => f.field_key === 'email')?.confidence).toBe(0.99);
    expect(fields[0].evidence_json.line).toBe(1);
  });

  it('routes to review if email missing', () => {
    const decision = evaluatePolicies(deterministicExtract('Name: Jamie'));
    expect(decision).toEqual({ action: 'review', reason: 'missing_or_low_confidence_email' });
  });

  it('routes to sync when required fields are high confidence', () => {
    const fields = deterministicExtract('Name: Jamie\nEmail: jamie@acme.com');
    expect(evaluatePolicies(fields)).toEqual({ action: 'sync' });
  });
});
