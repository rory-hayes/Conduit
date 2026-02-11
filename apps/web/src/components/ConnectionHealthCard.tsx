'use client';

export interface ConnectionHealthCardProps {
  crm: 'hubspot' | 'salesforce';
  status: 'ok' | 'warning' | 'error';
  lastCheckedAt: string | null;
  details?: string;
  onReconnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export const ConnectionHealthCard = ({ crm, status, lastCheckedAt, details, onReconnect, onDisconnect }: ConnectionHealthCardProps) => {
  const title = crm === 'hubspot' ? 'HubSpot' : 'Salesforce';
  const badgeClass = status === 'ok' ? 'bg-emerald-500/20 text-emerald-200' : status === 'warning' ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200';

  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title} health</h3>
        <span className={`rounded px-2 py-1 text-xs ${badgeClass}`}>{status}</span>
      </div>
      <p className="text-xs text-slate-400">Last checked: {lastCheckedAt ?? 'never'}</p>
      {details ? <p className="text-xs text-slate-300">{details}</p> : null}
      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-3 py-1 text-sm" onClick={() => void onReconnect()}>
          Reconnect
        </button>
        <button className="rounded border border-slate-600 px-3 py-1 text-sm" onClick={() => void onDisconnect()}>
          Disconnect
        </button>
      </div>
    </article>
  );
};
