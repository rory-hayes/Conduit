'use client';

import { useMemo, useState } from 'react';
import { ClaimInstallCard } from '../../components/ClaimInstallCard';

const defaultWorkspaces = [{ id: process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? '', name: 'Default Workspace' }].filter((item) => item.id);

export default function ClaimInstallPage() {
  const params = useMemo(() => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search), []);
  const crm = (params.get('crm') ?? 'hubspot') as 'hubspot' | 'salesforce';
  const installId = params.get('install_id') ?? '';
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaces[0]?.id ?? '');
  const [status, setStatus] = useState<string>('');

  return (
    <main className="space-y-4 p-6">
      <ClaimInstallCard
        crm={crm}
        installId={installId}
        workspaces={defaultWorkspaces}
        selectedWorkspaceId={workspaceId}
        onWorkspaceChange={setWorkspaceId}
        onClaim={async () => {
          const response = await fetch('/functions/v1/claim-install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ install_id: installId, workspace_id: workspaceId, user_id: 'web-user' })
          });
          setStatus(response.ok ? 'Install claimed.' : 'Unable to claim install.');
        }}
      />
      {status ? <p className="text-sm text-slate-300">{status}</p> : null}
    </main>
  );
}
