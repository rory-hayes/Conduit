import { LLMDryRunError, type LLMClient, type LLMResult, type LLMRollupInput } from './types.js';

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (status: number): boolean => status === 429 || status >= 500;

const isDryRun = (): boolean => process.env.DRY_RUN !== 'false';

export class OpenAILLMClient implements LLMClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    this.baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  }

  async generateRollup(input: LLMRollupInput): Promise<LLMResult> {
    if (isDryRun()) {
      throw new LLMDryRunError();
    }

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is missing');
    }

    const payload = {
      model: input.model,
      temperature: 0.1,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ]
    };

    const started = Date.now();
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (attempt < maxAttempts && shouldRetry(response.status)) {
          await sleep(150 * 2 ** (attempt - 1));
          continue;
        }
        throw new Error(`OpenAI request failed (${response.status})`);
      }

      const body = (await response.json()) as OpenAIResponse;
      const content = body.choices?.[0]?.message?.content?.trim() ?? '';

      return {
        outputText: content,
        latencyMs: Date.now() - started,
        tokensPrompt: body.usage?.prompt_tokens,
        tokensCompletion: body.usage?.completion_tokens
      };
    }

    throw new Error('OpenAI request failed after retries');
  }
}
