'use client';

export interface RetentionSettingsCardProps {
  rawEmailRetentionDays: number;
  attachmentRetentionDays: number;
  purgeEnabled: boolean;
  onRawEmailRetentionDaysChange: (value: number) => void;
  onAttachmentRetentionDaysChange: (value: number) => void;
  onPurgeEnabledChange: (value: boolean) => void;
  onSave: () => Promise<void>;
}

export const RetentionSettingsCard = ({
  rawEmailRetentionDays,
  attachmentRetentionDays,
  purgeEnabled,
  onRawEmailRetentionDaysChange,
  onAttachmentRetentionDaysChange,
  onPurgeEnabledChange,
  onSave
}: RetentionSettingsCardProps) => {
  const rawEmailValid = rawEmailRetentionDays >= 1;
  const attachmentValid = attachmentRetentionDays >= 1;

  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
      <h3 className="text-lg font-semibold">Retention policy</h3>
      <label className="block text-sm">
        Raw email retention (days)
        <input
          type="number"
          className="mt-1 w-full rounded bg-slate-950 p-2"
          value={rawEmailRetentionDays}
          min={1}
          onChange={(event) => onRawEmailRetentionDaysChange(Number(event.target.value))}
        />
      </label>
      {!rawEmailValid ? <p className="text-xs text-rose-300">Raw email retention must be at least 1 day.</p> : null}
      <label className="block text-sm">
        Attachment retention (days)
        <input
          type="number"
          className="mt-1 w-full rounded bg-slate-950 p-2"
          value={attachmentRetentionDays}
          min={1}
          onChange={(event) => onAttachmentRetentionDaysChange(Number(event.target.value))}
        />
      </label>
      {!attachmentValid ? <p className="text-xs text-rose-300">Attachment retention must be at least 1 day.</p> : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={purgeEnabled} onChange={(event) => onPurgeEnabledChange(event.target.checked)} />
        Enable daily purge
      </label>
      <button className="rounded bg-blue-600 px-3 py-1 text-sm" disabled={!rawEmailValid || !attachmentValid} onClick={() => void onSave()}>
        Save retention settings
      </button>
    </article>
  );
};
