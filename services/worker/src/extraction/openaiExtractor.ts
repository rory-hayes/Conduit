export interface ExtractedField {
  field_key: 'email' | 'name' | 'company' | 'intent' | 'timeline';
  field_value_json: string;
  confidence: number;
  evidence_json: {
    match: string;
    line: number;
  };
}

const matchers: Array<{
  key: ExtractedField['field_key'];
  label: string;
  confidence: number;
}> = [
  { key: 'name', label: 'Name', confidence: 0.9 },
  { key: 'email', label: 'Email', confidence: 0.99 },
  { key: 'company', label: 'Company', confidence: 0.85 },
  { key: 'intent', label: 'Intent', confidence: 0.9 },
  { key: 'timeline', label: 'Timeline', confidence: 0.7 }
];

export const runExtraction = async (text: string): Promise<ExtractedField[]> => {
  return deterministicExtract(text);
};

export const deterministicExtract = (text: string): ExtractedField[] => {
  const lines = text.split(/\r?\n/);
  const output: ExtractedField[] = [];

  for (const [index, line] of lines.entries()) {
    for (const matcher of matchers) {
      const prefix = `${matcher.label}:`;
      if (!line.startsWith(prefix)) {
        continue;
      }

      const value = line.slice(prefix.length).trim();
      if (!value) {
        continue;
      }

      output.push({
        field_key: matcher.key,
        field_value_json: value,
        confidence: matcher.confidence,
        evidence_json: {
          match: line,
          line: index + 1
        }
      });
    }
  }

  return output;
};
