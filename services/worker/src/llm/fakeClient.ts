import type { LLMClient, LLMResult, LLMRollupInput } from './types.js';

export class FakeLLMClient implements LLMClient {
  public calls: LLMRollupInput[] = [];

  constructor(private readonly fixture: LLMResult) {}

  async generateRollup(input: LLMRollupInput): Promise<LLMResult> {
    this.calls.push(input);
    return this.fixture;
  }
}
