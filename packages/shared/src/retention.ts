export interface RetentionPolicy {
  raw_email_retention_days: number;
  attachment_retention_days: number;
  purge_enabled: boolean;
  keep_extracted_fields: boolean;
  keep_audit_events: boolean;
}

export const defaultRetentionPolicy = (): RetentionPolicy => ({
  raw_email_retention_days: 30,
  attachment_retention_days: 30,
  purge_enabled: true,
  keep_extracted_fields: true,
  keep_audit_events: true
});

export const normalizeRetentionPolicy = (input: Partial<RetentionPolicy>): RetentionPolicy => ({
  ...defaultRetentionPolicy(),
  ...input,
  raw_email_retention_days: Math.max(1, Math.floor(input.raw_email_retention_days ?? 30)),
  attachment_retention_days: Math.max(1, Math.floor(input.attachment_retention_days ?? 30))
});

export const shouldRedactMessage = (receivedAtIso: string, retentionDays: number, now = new Date()): boolean => {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return new Date(receivedAtIso).getTime() < cutoff;
};

export const shouldRemoveAttachment = (createdAtIso: string, retentionDays: number, now = new Date()): boolean => {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  return new Date(createdAtIso).getTime() < cutoff;
};
