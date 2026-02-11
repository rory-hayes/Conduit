'use client';

import { useEffect, useState } from 'react';
import { ConnectionHealthCard } from '../../components/ConnectionHealthCard';
import { IntegrationCard } from '../../components/IntegrationCard';
import { RetentionSettingsCard } from '../../components/RetentionSettingsCard';
import { disconnectCrm, listConnectionHealth, listCrmConnections, startOAuth, type ConnectionHealthMeta, type CrmConnectionMeta } from '../../lib/integrations';

const defaults: CrmConnectionMeta[] = [
  { crm: 'hubspot', status: 'disconnected', last_checked_at: null, last_error: null },
  { crm: 'salesforce', status: 'disconnected', last_checked_at: null, last_error: null }
];

export const IntegrationsPanel = () => {
  const [connections, setConnections] = useState<CrmConnectionMeta[]>(defaults);
  const [health, setHealth] = useState<ConnectionHealthMeta[]>([]);
  const [rawDays, setRawDays] = useState(30);
  const [attachmentDays, setAttachmentDays] = useState(30);
  const [purgeEnabled, setPurgeEnabled] = useState(true);
  const workspaceId = process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? '';

  const refresh = async () => {
    const [rows, healthRows] = await Promise.all([listCrmConnections(), listConnectionHealth()]);
    const byCrm = new Map(rows.map((row) => [row.crm, row]));
    setConnections(defaults.map((item) => byCrm.get(item.crm) ?? item));
    setHealth(healthRows);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {connections.map((item) => (
          <IntegrationCard
            key={item.crm}
            crm={item.crm}
            status={item.status === 'pending_claim' ? 'disconnected' : item.status}
            lastCheckedAt={item.last_checked_at}
            lastError={item.last_error}
            onConnect={async () => {
              const authorizeUrl = await startOAuth(item.crm, workspaceId || undefined);
              window.location.assign(authorizeUrl);
            }}
            onDisconnect={async () => {
              await disconnectCrm(item.crm, workspaceId);
              await refresh();
            }}
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {health.map((entry) => (
          <ConnectionHealthCard
            key={entry.crm}
            crm={entry.crm}
            status={entry.status}
            lastCheckedAt={entry.last_checked_at}
            details={entry.details_json?.error ? String(entry.details_json.error) : undefined}
            onReconnect={async () => {
              const authorizeUrl = await startOAuth(entry.crm, workspaceId || undefined);
              window.location.assign(authorizeUrl);
            }}
            onDisconnect={async () => {
              await disconnectCrm(entry.crm, workspaceId);
              await refresh();
            }}
          />
        ))}
      </div>
      <RetentionSettingsCard
        rawEmailRetentionDays={rawDays}
        attachmentRetentionDays={attachmentDays}
        purgeEnabled={purgeEnabled}
        onRawEmailRetentionDaysChange={setRawDays}
        onAttachmentRetentionDaysChange={setAttachmentDays}
        onPurgeEnabledChange={setPurgeEnabled}
        onSave={async () => {
          await fetch('/rest/v1/retention_policies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workspace_id: workspaceId, raw_email_retention_days: rawDays, attachment_retention_days: attachmentDays, purge_enabled: purgeEnabled })
          });
        }}
      />
    </div>
  );
};
