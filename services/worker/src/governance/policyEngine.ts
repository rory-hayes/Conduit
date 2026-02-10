import { REVIEW_CONFIDENCE_THRESHOLD, DRIFT_PAUSE_THRESHOLD } from '@conduit/shared';

export interface PolicyDecision {
  allowCrmWrite: boolean;
  requiresReview: boolean;
  reason?: string;
}

export const evaluatePolicies = (confidenceScore: number): PolicyDecision => {
  if (confidenceScore < DRIFT_PAUSE_THRESHOLD) {
    return {
      allowCrmWrite: false,
      requiresReview: true,
      reason: 'drift_pause'
    };
  }

  if (confidenceScore < REVIEW_CONFIDENCE_THRESHOLD) {
    return {
      allowCrmWrite: false,
      requiresReview: true,
      reason: 'low_confidence'
    };
  }

  return {
    allowCrmWrite: true,
    requiresReview: false
  };
};
