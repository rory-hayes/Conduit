import { describe, expect, it } from 'vitest';
import { computeBantReadiness, suggestQuestions } from '../src/governance/dealReadiness.js';

describe('deal readiness governance', () => {
  it('computes readiness score from present BANT keys', () => {
    const result = computeBantReadiness([
      { key: 'budget', confidence: 0.6, value_json: { signal: true } },
      { key: 'timeline', confidence: 0.7, value_json: 'Q2' }
    ]);

    expect(result.readinessScore).toBe(50);
    expect(result.missingKeys).toEqual(['authority', 'need']);
  });

  it('returns ordered questions for missing keys', () => {
    const questions = suggestQuestions(['need', 'budget']);
    expect(questions).toEqual([
      'Do you have a budget range allocated for this?',
      'What problem are you trying to solve and what happens if you don’t solve it?'
    ]);
  });
});
