import { buildIdempotencyKey } from '@conduit/shared';

export interface SalesforceWritePayload {
  workspaceId?: string;
  threadId?: string;
  summary?: string;
  tasks?: string[];
  fields?: Record<string, string | number | boolean>;
}

export const salesforceClient = () => ({
  writeOutcome: async (payload: SalesforceWritePayload) => {
    const idempotencyKey = buildIdempotencyKey([
      payload.workspaceId ?? 'unknown',
      'salesforce',
      payload.threadId ?? 'unknown',
      'summary'
    ]);

    return {
      idempotencyKey,
      status: 'stubbed'
    };
  }
});
