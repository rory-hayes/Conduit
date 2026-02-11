import crypto from 'node:crypto';
import type { ExtractedField } from '../extraction/openaiExtractor.js';

export interface SourceMessage {
  fromEmail?: string | null;
  subject?: string | null;
  text?: string | null;
}

const normalizeSubjectPrefix = (subject: string): string => {
  return subject.replace(/^(\s*(re|fwd?|fw)\s*:\s*)+/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
};

const normalizeTextHeader = (text: string): string => {
  return text
    .split(/\r?\n/)[0]
    ?.slice(0, 50)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase() ?? '';
};

const sha = (value: string): string => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);

const getDomain = (email: string): string => {
  const domain = email.split('@')[1] ?? 'unknown';
  return domain.toLowerCase().trim();
};

const byKey = (fields: ExtractedField[], key: ExtractedField['field_key']) => {
  return fields.find((field) => field.field_key === key);
};

export const computeSourceKey = (message: SourceMessage): string => {
  const domain = getDomain(message.fromEmail ?? 'unknown@unknown');
  const subject = normalizeSubjectPrefix(message.subject ?? '');
  const header = normalizeTextHeader(message.text ?? '');
  const hash = sha(`${subject}|${header}`);
  return `domain:${domain}|sub:${subject || 'none'}|h:${hash}`;
};

export const computeExtractionQuality = (fields: ExtractedField[]): number => {
  let quality = 0;

  const email = byKey(fields, 'email');
  if (email?.field_value_json && email.confidence >= 0.85) {
    quality += 0.5;
  }

  const name = byKey(fields, 'name');
  if (name?.field_value_json && name.confidence >= 0.85) {
    quality += 0.3;
  }

  const company = byKey(fields, 'company');
  if (company?.field_value_json && company.confidence >= 0.8) {
    quality += 0.2;
  }

  return Math.min(1, Math.max(0, Number(quality.toFixed(4))));
};

export const shouldTriggerDrift = (currentQuality: number, historicalQuality: number): boolean => {
  return historicalQuality >= 0.85 && currentQuality <= 0.6;
};
