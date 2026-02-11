import { z } from 'zod';

export const llmRollupSchema = z
  .object({
    summary_md: z.string().min(1).max(1200),
    highlights: z.object({
      events: z.array(z.string()),
      risks: z.array(z.string()),
      next_actions: z.array(z.string())
    }),
    confidence: z.number().min(0).max(1),
    field_deltas: z.array(
      z.object({
        key: z.string().min(1),
        value: z.unknown(),
        confidence: z.number().min(0).max(1)
      })
    )
  })
  .strict();

export type LLMRollupOutput = z.infer<typeof llmRollupSchema>;

export const parseRollupOutput = (text: string): LLMRollupOutput => {
  const parsed = JSON.parse(text) as unknown;
  return llmRollupSchema.parse(parsed);
};
