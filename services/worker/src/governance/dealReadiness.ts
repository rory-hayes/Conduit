export type BantKey = 'budget' | 'authority' | 'need' | 'timeline';

const orderedBantKeys: BantKey[] = ['budget', 'authority', 'need', 'timeline'];

export interface DealFact {
  key: BantKey;
  confidence: number;
  value_json: unknown;
  evidence_json?: unknown;
}

export interface BantReadiness {
  missingKeys: BantKey[];
  readinessScore: number;
}

export const computeBantReadiness = (facts: DealFact[]): BantReadiness => {
  const present = new Set(facts.map((fact) => fact.key));
  const missingKeys = orderedBantKeys.filter((key) => !present.has(key));
  const readinessScore = ((orderedBantKeys.length - missingKeys.length) / orderedBantKeys.length) * 100;
  return { missingKeys, readinessScore };
};

const questionMap: Record<BantKey, string> = {
  budget: 'Do you have a budget range allocated for this?',
  authority: 'Who besides you needs to approve this?',
  need: 'What problem are you trying to solve and what happens if you don’t solve it?',
  timeline: 'When do you need this live?'
};

export const suggestQuestions = (missingKeys: BantKey[]): string[] => {
  return orderedBantKeys.filter((key) => missingKeys.includes(key)).map((key) => questionMap[key]);
};
