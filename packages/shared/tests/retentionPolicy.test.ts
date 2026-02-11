import { describe, expect, it } from 'vitest';
import { defaultRetentionPolicy, normalizeRetentionPolicy, shouldRedactMessage, shouldRemoveAttachment } from '../src/retention';

describe('retention helpers', () => {
  it('returns sane defaults', () => {
    expect(defaultRetentionPolicy()).toEqual({
      raw_email_retention_days: 30,
      attachment_retention_days: 30,
      purge_enabled: true,
      keep_extracted_fields: true,
      keep_audit_events: true
    });
  });

  it('normalizes invalid values', () => {
    expect(normalizeRetentionPolicy({ raw_email_retention_days: 0, attachment_retention_days: -4 }).raw_email_retention_days).toBe(1);
    expect(normalizeRetentionPolicy({ raw_email_retention_days: 0, attachment_retention_days: -4 }).attachment_retention_days).toBe(1);
  });

  it('decides redaction and attachment purging by age', () => {
    const now = new Date('2026-01-31T00:00:00.000Z');
    expect(shouldRedactMessage('2025-12-01T00:00:00.000Z', 30, now)).toBe(true);
    expect(shouldRedactMessage('2026-01-20T00:00:00.000Z', 30, now)).toBe(false);
    expect(shouldRemoveAttachment('2025-12-01T00:00:00.000Z', 30, now)).toBe(true);
  });
});
