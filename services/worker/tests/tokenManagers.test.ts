import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.TOKEN_ENC_KEY_B64 = Buffer.alloc(32, 7).toString('base64');
process.env.HUBSPOT_CLIENT_ID = 'hid';
process.env.HUBSPOT_CLIENT_SECRET = 'hsecret';
process.env.SALESFORCE_CLIENT_ID = 'sid';
process.env.SALESFORCE_CLIENT_SECRET = 'ssecret';

const dbState: { connection: any } = { connection: null };

vi.mock('../src/db.js', () => ({
  withClient: async (fn: any) =>
    fn({
      query: async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes("crm = 'hubspot'")) return { rows: [dbState.connection] };
        if (sql.includes('SELECT') && sql.includes("crm = 'salesforce'")) return { rows: [dbState.connection] };
        return { rows: [] };
      }
    })
}));

vi.mock('../src/audit/audit.js', () => ({ writeAuditEvent: async () => undefined }));

const { encryptToB64 } = await import('@conduit/shared');
const { createHubSpotTokenManager } = await import('../src/connectors/hubspot/tokenManager.js');
const { createSalesforceTokenManager } = await import('../src/connectors/salesforce/tokenManager.js');

describe('token managers', () => {
  beforeEach(async () => {
    dbState.connection = {
      id: 'c1',
      workspace_id: 'w1',
      crm: 'hubspot',
      status: 'connected',
      access_token_ciphertext: await encryptToB64('old-access'),
      refresh_token_ciphertext: await encryptToB64('refresh-token'),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
      external_account_json: { instance_url: 'https://sf.local' }
    };
  });

  it('refreshes hubspot token near expiry', async () => {
    const manager = createHubSpotTokenManager({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'new-token', expires_in: 1800 }), { status: 200 })) as any
    });

    const token = await manager.getAccessToken('w1');
    expect(token).toBe('new-token');
  });

  it('refreshes salesforce token near expiry', async () => {
    dbState.connection.crm = 'salesforce';
    const manager = createSalesforceTokenManager({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'sf-new', instance_url: 'https://sf.local' }), { status: 200 })) as any
    });

    const token = await manager.getAccessToken('w1');
    expect(token.accessToken).toBe('sf-new');
  });
});
