'use client';

import { useEffect, useState } from 'react';
import { IntegrationCard } from '../../components/IntegrationCard';
import { disconnectCrm, listCrmConnections, startOAuth, type CrmConnectionMeta } from '../../lib/integrations';

const defaults: CrmConnectionMeta[] = [
  { crm: 'hubspot', status: 'disconnected', last_checked_at: null, last_error: null },
  { crm: 'salesforce', status: 'disconnected', last_checked_at: null, last_error: null }
];

export const IntegrationsPanel = () => {
  const [connections, setConnections] = useState<CrmConnectionMeta[]>(defaults);
  const workspaceId = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? '';

  const refresh = async () => {
    const rows = await listCrmConnections();
    const byCrm = new Map(rows.map((row) => [row.crm, row]));
    setConnections(defaults.map((item) => byCrm.get(item.crm) ?? item));
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {connections.map((item) => (
        <IntegrationCard
          key={item.crm}
          crm={item.crm}
          status={item.status}
          lastCheckedAt={item.last_checked_at}
          lastError={item.last_error}
          onConnect={async () => {
            const authorizeUrl = await startOAuth(item.crm, workspaceId);
            window.location.assign(authorizeUrl);
          }}
          onDisconnect={async () => {
            await disconnectCrm(item.crm, workspaceId);
            await refresh();
          }}
        />
      ))}
    </div>
  );
};
