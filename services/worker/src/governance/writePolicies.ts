import { evaluatePolicies } from './policyEngine.js';
import type { ExtractedField } from '../extraction/openaiExtractor.js';

export const enforceWritePolicies = async (
  payload: Record<string, unknown> & { fields?: ExtractedField[] }
) => {
  const fields = payload.fields ?? [];
  const decision = evaluatePolicies(fields);

  if (decision.action === 'review') {
    return {
      ...payload,
      blocked: true,
      reason: decision.reason
    };
  }

  return payload;
};
