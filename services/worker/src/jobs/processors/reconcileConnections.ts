import type { JobProcessor } from '../types.js';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';
import { createHubSpotTokenManager } from '../../connectors/hubspot/tokenManager.js';
import { createSalesforceTokenManager } from '../../connectors/salesforce/tokenManager.js';

const checkConnection = async (workspaceId: string, crm: 'hubspot' | 'salesforce') => {
  try {
    if (crm === 'hubspot') {
      await createHubSpotTokenManager().getAccessToken(workspaceId);
    } else {
      await createSalesforceTokenManager().getAccessToken(workspaceId);
    }
    return { status: 'ok', details: { check: 'token_refresh' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: /401|403/.test(message) ? 'error' : 'warning', details: { error: message } };
  }
};

export const reconcileConnections: JobProcessor = async () => {
  const { rows } = await withClient((client) =>
    client.query(`SELECT workspace_id, crm FROM crm_connections WHERE status = 'connected' AND crm IN ('hubspot','salesforce')`)
  );

  for (const row of rows) {
    const workspaceId = String(row.workspace_id);
    const crm = String(row.crm) as 'hubspot' | 'salesforce';
    const result = await checkConnection(workspaceId, crm);

    await withClient((client) =>
      client.query(
        `INSERT INTO connection_health (workspace_id, crm, status, last_ok_at, last_checked_at, details_json, updated_at)
         VALUES ($1, $2, $3, CASE WHEN $3 = 'ok' THEN now() ELSE NULL END, now(), $4, now())
         ON CONFLICT (workspace_id, crm)
         DO UPDATE SET status = EXCLUDED.status,
                       last_ok_at = CASE WHEN EXCLUDED.status = 'ok' THEN now() ELSE connection_health.last_ok_at END,
                       last_checked_at = now(),
                       details_json = EXCLUDED.details_json,
                       updated_at = now()`,
        [workspaceId, crm, result.status, result.details]
      )
    );

    if (result.status === 'error') {
      await withClient((client) =>
        client.query(`UPDATE crm_connections SET status = 'error', last_error = $3, updated_at = now() WHERE workspace_id = $1 AND crm = $2`, [workspaceId, crm, result.details.error ?? 'health_check_failed'])
      );
    }

    await writeAuditEvent({ workspaceId, type: 'connection_health_checked', data: { crm, status: result.status, ...result.details } });
  }
};
