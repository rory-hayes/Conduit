import type { ExtractedField } from '../extraction/openaiExtractor.js';

export interface PolicyDecision {
  action: 'review' | 'sync';
  reason?: 'missing_or_low_confidence_email' | 'missing_or_low_confidence_name';
}

const byKey = (fields: ExtractedField[], key: ExtractedField['field_key']) => {
  return fields.find((field) => field.field_key === key);
};

export const evaluatePolicies = (fields: ExtractedField[]): PolicyDecision => {
  const email = byKey(fields, 'email');
  const name = byKey(fields, 'name');

  if (!email || email.confidence < 0.85) {
    return { action: 'review', reason: 'missing_or_low_confidence_email' };
  }

  if (!name || name.confidence < 0.85) {
    return { action: 'review', reason: 'missing_or_low_confidence_name' };
  }

  return { action: 'sync' };
};
