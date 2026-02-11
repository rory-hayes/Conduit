import { decryptFromB64, encryptToB64 } from '@conduit/shared';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';

interface SalesforceConnectionRow {
  id: string;
  workspace_id: string;
  crm: 'salesforce';
  status: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
  external_account_json: { instance_url?: string } | null;
}

interface SalesforceTokenResponse {
  access_token: string;
  instance_url?: string;
}

export interface SalesforceTokenManagerDeps {
  fetch?: typeof fetch;
  now?: () => Date;
}

const getAuthBaseUrl = () => process.env.SALESFORCE_AUTH_BASE_URL ?? 'https://login.salesforce.com';

export const createSalesforceTokenManager = ({ fetch: fetchImpl = fetch, now = () => new Date() }: SalesforceTokenManagerDeps = {}) => {
  const getConnection = async (workspaceId: string): Promise<SalesforceConnectionRow | null> => {
    return withClient(async (client) => {
      const result = await client.query(
        `SELECT id, workspace_id, crm, status, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, external_account_json
         FROM crm_connections WHERE workspace_id = $1 AND crm = 'salesforce' LIMIT 1`,
        [workspaceId]
      );
      return (result.rows[0] as SalesforceConnectionRow | undefined) ?? null;
    });
  };

  const refreshToken = async (workspaceId: string, row: SalesforceConnectionRow): Promise<string> => {
    const refreshTokenPlain = row.refresh_token_ciphertext ? await decryptFromB64(row.refresh_token_ciphertext) : '';
    if (!refreshTokenPlain) {
      throw new Error('Salesforce connection missing refresh token');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.SALESFORCE_CLIENT_ID ?? '',
      client_secret: process.env.SALESFORCE_CLIENT_SECRET ?? '',
      refresh_token: refreshTokenPlain
    });

    const response = await fetchImpl(new URL('/services/oauth2/token', getAuthBaseUrl()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      if (/invalid_grant|invalid_client/i.test(text)) {
        await withClient((client) =>
          client.query(`UPDATE crm_connections SET status = 'error', last_error = $2, updated_at = now() WHERE id = $1`, [row.id, 'refresh_token_revoked'])
        );
        await writeAuditEvent({
          workspaceId,
          type: 'crm_token_refresh_failed',
          data: { crm: 'salesforce', reason: 'refresh_token_revoked' }
        });
      }
      throw new Error(`Salesforce token refresh failed: ${response.status}`);
    }

    const token = (await response.json()) as SalesforceTokenResponse;
    const encryptedAccess = await encryptToB64(token.access_token);

    await withClient((client) =>
      client.query(
        `UPDATE crm_connections
         SET status = 'connected',
             access_token_ciphertext = $2,
             token_expires_at = $3,
             external_account_json = COALESCE($4::jsonb, external_account_json),
             last_checked_at = now(),
             last_error = null,
             updated_at = now()
         WHERE id = $1`,
        [
          row.id,
          encryptedAccess,
          new Date(now().getTime() + 30 * 60 * 1000).toISOString(),
          token.instance_url ? JSON.stringify({ instance_url: token.instance_url }) : null
        ]
      )
    );

    return token.access_token;
  };

  const getAccessToken = async (workspaceId: string): Promise<{ accessToken: string; instanceUrl: string }> => {
    const row = await getConnection(workspaceId);
    if (!row || row.status !== 'connected') {
      throw new Error('Salesforce connection not found or disconnected');
    }

    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;
    const shouldRefresh = !expiresAt || expiresAt.getTime() - now().getTime() <= 120_000;

    const accessToken = shouldRefresh ? await refreshToken(workspaceId, row) : await decryptFromB64(row.access_token_ciphertext);
    const instanceUrl = row.external_account_json?.instance_url ?? '';
    if (!instanceUrl) {
      throw new Error('Salesforce connection missing instance_url');
    }

    return { accessToken, instanceUrl };
  };

  return { getAccessToken };
};
