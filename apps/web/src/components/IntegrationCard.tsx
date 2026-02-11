'use client';

export interface IntegrationCardProps {
  crm: 'hubspot' | 'salesforce';
  status: 'connected' | 'disconnected' | 'error' | 'pending_claim';
  lastCheckedAt?: string | null;
  lastError?: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export const IntegrationCard = ({ crm, status, lastCheckedAt, lastError, onConnect, onDisconnect }: IntegrationCardProps) => {
  const title = crm === 'hubspot' ? 'HubSpot' : 'Salesforce';
  const badgeClass = status === 'connected' ? 'bg-emerald-500/20 text-emerald-200' : status === 'error' ? 'bg-rose-500/20 text-rose-200' : status === 'pending_claim' ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-500/20 text-slate-200';

  return (
    <article className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className={`rounded px-2 py-1 text-xs ${badgeClass}`}>{status}</span>
      </div>
      <p className="text-xs text-slate-400">Last checked: {lastCheckedAt ?? 'never'}</p>
      {lastError ? <p className="text-xs text-rose-300">{lastError}</p> : null}
      <div className="flex gap-2">
        <button className="rounded bg-blue-600 px-3 py-1 text-sm" onClick={() => void onConnect()}>
          Connect
        </button>
        <button className="rounded border border-slate-600 px-3 py-1 text-sm" onClick={() => void onDisconnect()}>
          Disconnect
        </button>
      </div>
    </article>
  );
};
