'use client';

export interface AIRollupsToggleProps {
  enabled: boolean;
  contextLevel: 'structured_only' | 'structured_plus_snippets';
  onEnabledChange: (enabled: boolean) => void;
  onContextLevelChange: (level: 'structured_only' | 'structured_plus_snippets') => void;
}

export const AIRollupsToggle = ({
  enabled,
  contextLevel,
  onEnabledChange,
  onContextLevelChange
}: AIRollupsToggleProps) => {
  return (
    <div className="space-y-3 rounded border border-amber-700/40 bg-amber-950/20 p-3 text-sm">
      <p className="text-amber-200">
        AI Rollups send minimized context only. Default mode excludes raw email bodies; snippet mode adds short redacted
        excerpts.
      </p>
      <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
        <span>Enable AI-generated weekly rollups</span>
        <input
          aria-label="Enable AI rollups"
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        />
      </label>
      <label className="flex items-center justify-between rounded border border-slate-800 bg-slate-900 p-3">
        <span>Context level</span>
        <select
          aria-label="AI rollup context level"
          value={contextLevel}
          onChange={(event) => onContextLevelChange(event.currentTarget.value as 'structured_only' | 'structured_plus_snippets')}
        >
          <option value="structured_only">Structured only (recommended)</option>
          <option value="structured_plus_snippets">Structured + redacted snippets</option>
        </select>
      </label>
    </div>
  );
};
