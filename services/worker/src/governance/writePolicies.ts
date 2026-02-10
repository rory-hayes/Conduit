import { evaluatePolicies } from './policyEngine.js';

export const enforceWritePolicies = async (payload: Record<string, unknown>) => {
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : 1;
  const decision = evaluatePolicies(confidence);

  if (!decision.allowCrmWrite) {
    return {
      ...payload,
      blocked: true,
      reason: decision.reason
    };
  }

  return payload;
};
