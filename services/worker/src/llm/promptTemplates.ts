import type { LLMContextLevel } from './types.js';

export const buildRollupSystemPrompt = (): string =>
  [
    'You are Conduit, a conservative B2B revenue operations assistant.',
    'Use ONLY facts in provided context_json. Do not invent data.',
    'Return JSON only, no markdown wrappers and no extra keys.',
    'If uncertain, omit the item or state unknown in concise wording.',
    'Never include raw email bodies or attachment content.'
  ].join(' ');

export const buildRollupUserPrompt = (input: {
  contextLevel: LLMContextLevel;
  contextJson: Record<string, unknown>;
}): string => {
  return JSON.stringify({
    instructions: {
      task: 'Create a concise weekly deal rollup from context_json',
      context_level: input.contextLevel,
      output_schema: {
        summary_md: 'string <= 1200 chars',
        highlights: {
          events: 'string[]',
          risks: 'string[]',
          next_actions: 'string[]'
        },
        confidence: 'number 0..1',
        field_deltas: 'Array<{key:string,value:any,confidence:number 0..1}>'
      }
    },
    context_json: input.contextJson
  });
};
