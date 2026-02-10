import { buildIdempotencyKey } from '@conduit/shared';

export interface HubSpotWritePayload {
  workspaceId?: string;
  threadId?: string;
  summary?: string;
  tasks?: string[];
  fields?: Record<string, string | number | boolean>;
}

export const hubspotClient = () => ({
  writeOutcome: async (payload: HubSpotWritePayload) => {
    const idempotencyKey = buildIdempotencyKey([
      payload.workspaceId ?? 'unknown',
      'hubspot',
      payload.threadId ?? 'unknown',
      'summary'
    ]);

    return {
      idempotencyKey,
      status: 'stubbed'
    };
  }
});
