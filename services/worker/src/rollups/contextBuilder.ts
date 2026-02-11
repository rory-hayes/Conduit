import type { LLMContextLevel } from '../llm/types.js';
import { redactSnippet, truncateSnippet } from '../llm/redaction.js';

export interface RollupContextInput {
  deal: { title?: string | null; stage?: string | null };
  weekWindow: { start: string; end: string };
  facts: Array<{ key: string; value: unknown; confidence: number }>;
  readiness: { score: number; missingKeys: string[] };
  events: Array<{ timestamp: string; label: string; description: string }>;
  risks: string[];
  suggestedNextActions: string[];
  driftPaused: boolean;
  reviewItems: Array<{ reason: string }>;
  snippets?: Array<{ text: string; signalTag: 'pricing_request' | 'objection' | 'legal' | 'other' }>;
}

const allowedSnippetTags = new Set(['pricing_request', 'objection', 'legal']);

export const buildRollupContext = (
  input: RollupContextInput,
  contextLevel: LLMContextLevel,
  maxSnippets = 3
): Record<string, unknown> => {
  const keyFacts = input.facts
    .filter((fact) => ['budget', 'timeline', 'need', 'authority'].includes(fact.key))
    .map((fact) => ({ key: fact.key, value: fact.value, confidence: fact.confidence }));

  const output: Record<string, unknown> = {
    deal: {
      title: input.deal.title ?? null,
      stage: input.deal.stage ?? null
    },
    week_window: input.weekWindow,
    key_facts: keyFacts,
    readiness: {
      score: input.readiness.score,
      missing_keys: input.readiness.missingKeys
    },
    notable_events: input.events.map((event) => ({
      timestamp: event.timestamp,
      label: event.label,
      description: truncateSnippet(event.description, 180)
    })),
    risks: [...new Set([...input.risks, ...(input.driftPaused ? ['crm_writes_paused_due_to_drift'] : [])])],
    suggested_next_actions: input.suggestedNextActions,
    review_reasons: [...new Set(input.reviewItems.map((item) => item.reason))]
  };

  if (contextLevel === 'structured_plus_snippets') {
    output.snippets = (input.snippets ?? [])
      .filter((snippet) => allowedSnippetTags.has(snippet.signalTag))
      .slice(0, maxSnippets)
      .map((snippet) => ({
        signal_tag: snippet.signalTag,
        text: truncateSnippet(redactSnippet(snippet.text), 240)
      }));
  }

  return output;
};
