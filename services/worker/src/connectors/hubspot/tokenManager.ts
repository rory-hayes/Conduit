import { decryptFromB64, encryptToB64 } from '@conduit/shared';
import { withClient } from '../../db.js';
import { writeAuditEvent } from '../../audit/audit.js';

interface CrmConnectionRow {
  id: string;
  workspace_id: string;
  crm: 'hubspot';
  status: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
}

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface HubSpotTokenManagerDeps {
  fetch?: typeof fetch;
  now?: () => Date;
}

const tokenEndpoint = 'https://api.hubspot.com/oauth/v3/token';

export const createHubSpotTokenManager = ({ fetch: fetchImpl = fetch, now = () => new Date() }: HubSpotTokenManagerDeps = {}) => {
  const getConnection = async (workspaceId: string): Promise<CrmConnectionRow | null> => {
    return withClient(async (client) => {
      const result = await client.query(
        `SELECT id, workspace_id, crm, status, access_token_ciphertext, refresh_token_ciphertext, token_expires_at
         FROM crm_connections
         WHERE workspace_id = $1 AND crm = 'hubspot'
         LIMIT 1`,
        [workspaceId]
      );
      return (result.rows[0] as CrmConnectionRow | undefined) ?? null;
    });
  };

  const refreshToken = async (workspaceId: string, row: CrmConnectionRow): Promise<string> => {
    const refreshTokenPlain = row.refresh_token_ciphertext ? await decryptFromB64(row.refresh_token_ciphertext) : '';

    if (!refreshTokenPlain) {
      await withClient((client) =>
        client.query(`UPDATE crm_connections SET status = 'error', last_error = $2, updated_at = now() WHERE id = $1`, [row.id, 'missing_refresh_token'])
      );
      throw new Error('HubSpot connection missing refresh token');
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.HUBSPOT_CLIENT_ID ?? '',
      client_secret: process.env.HUBSPOT_CLIENT_SECRET ?? '',
      refresh_token: refreshTokenPlain
    });

    const response = await fetchImpl(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      const revoked = /invalid_grant|revoked/i.test(text);
      if (revoked) {
        await withClient((client) =>
          client.query(`UPDATE crm_connections SET status = 'error', last_error = $2, updated_at = now() WHERE id = $1`, [
            row.id,
            'refresh_token_revoked'
          ])
        );
        await writeAuditEvent({
          workspaceId,
          type: 'crm_token_refresh_failed',
          data: { crm: 'hubspot', reason: 'refresh_token_revoked' }
        });
      }
      throw new Error(`HubSpot token refresh failed: ${response.status}`);
    }

    const token = (await response.json()) as HubSpotTokenResponse;
    const encryptedAccess = await encryptToB64(token.access_token);
    const encryptedRefresh = token.refresh_token ? await encryptToB64(token.refresh_token) : row.refresh_token_ciphertext;
    const expiresAt = new Date(now().getTime() + (token.expires_in ?? 1800) * 1000);

    await withClient((client) =>
      client.query(
        `UPDATE crm_connections
         SET status = 'connected',
             access_token_ciphertext = $2,
             refresh_token_ciphertext = $3,
             token_expires_at = $4,
             last_checked_at = now(),
             last_error = null,
             updated_at = now()
         WHERE id = $1`,
        [row.id, encryptedAccess, encryptedRefresh, expiresAt.toISOString()]
      )
    );

    return token.access_token;
  };

  const getAccessToken = async (workspaceId: string): Promise<string> => {
    const row = await getConnection(workspaceId);
    if (!row || row.status !== 'connected') {
      throw new Error('HubSpot connection not found or disconnected');
    }

    if (!row.access_token_ciphertext) {
      throw new Error('HubSpot access token missing');
    }

    const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null;
    const shouldRefresh = !expiresAt || expiresAt.getTime() - now().getTime() <= 120_000;
    if (shouldRefresh) {
      return refreshToken(workspaceId, row);
    }

    return decryptFromB64(row.access_token_ciphertext);
  };

  return { getAccessToken };
};
