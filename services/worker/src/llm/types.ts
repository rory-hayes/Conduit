export type LLMContextLevel = 'structured_only' | 'structured_plus_snippets';

export interface LLMRollupInput {
  model: string;
  contextLevel: LLMContextLevel;
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    workspaceId: string;
    dealId?: string;
    threadId?: string;
    weekStart: string;
    weekEnd: string;
  };
}

export interface LLMResult {
  outputText: string;
  outputJson?: Record<string, unknown>;
  tokensPrompt?: number;
  tokensCompletion?: number;
  latencyMs: number;
}

export interface LLMClient {
  generateRollup(input: LLMRollupInput): Promise<LLMResult>;
}

export class LLMDryRunError extends Error {
  constructor(message = 'LLM generation skipped in DRY_RUN mode') {
    super(message);
    this.name = 'LLMDryRunError';
  }
}
