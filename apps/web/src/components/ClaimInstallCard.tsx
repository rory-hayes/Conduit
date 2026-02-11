'use client';

export interface ClaimInstallCardProps {
  crm: 'hubspot' | 'salesforce';
  installId: string;
  workspaces: Array<{ id: string; name: string }>;
  selectedWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
  onClaim: () => Promise<void>;
}

export const ClaimInstallCard = ({ crm, installId, workspaces, selectedWorkspaceId, onWorkspaceChange, onClaim }: ClaimInstallCardProps) => {
  const title = crm === 'hubspot' ? 'HubSpot' : 'Salesforce';

  return (
    <article className="max-w-xl rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
      <h2 className="text-xl font-semibold">Claim {title} install</h2>
      <p className="text-xs text-slate-400">Install ID: {installId}</p>
      <label className="block text-sm">
        Workspace
        <select className="mt-1 w-full rounded bg-slate-950 p-2" value={selectedWorkspaceId} onChange={(event) => onWorkspaceChange(event.target.value)}>
          <option value="">Select workspace</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      <button disabled={!selectedWorkspaceId} className="rounded bg-blue-600 px-4 py-2 text-sm disabled:opacity-50" onClick={() => void onClaim()}>
        Claim install
      </button>
    </article>
  );
};
