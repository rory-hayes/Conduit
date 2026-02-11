import { describe, expect, it, vi } from 'vitest';
import { createSalesforceClient } from '../src/connectors/salesforce/client.js';

describe('salesforce client', () => {
  it('upsertLeadMinimal patches existing lead', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [{ Id: 'L1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'L1' }), { status: 200 }));

    const client = createSalesforceClient({
      fetch: fetchMock as any,
      tokenManager: { getAccessToken: async () => ({ accessToken: 'token', instanceUrl: 'https://sf.local' }) },
      workspaceId: 'w1'
    });

    const result = await client.upsertLeadMinimal('a@b.com', 'Jane', 'ACME', {});
    expect(result).toEqual({ mode: 'updated', id: 'L1' });
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/sobjects/Lead/L1');
  });

  it('upsertLeadMinimal creates when absent and applies fallback required fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ records: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'L2' }), { status: 200 }));

    const client = createSalesforceClient({ fetch: fetchMock as any, tokenManager: { getAccessToken: async () => ({ accessToken: 'token', instanceUrl: 'https://sf.local' }) }, workspaceId: 'w1' });
    const result = await client.upsertLeadMinimal('a@b.com', '', '', {});

    expect(result).toEqual({ mode: 'created', id: 'L2' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ LastName: 'Unknown', Company: 'Unknown' });
  });

  it('creates weekly summary task', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 'T1' }), { status: 200 }));
    const client = createSalesforceClient({ fetch: fetchMock as any, tokenManager: { getAccessToken: async () => ({ accessToken: 'token', instanceUrl: 'https://sf.local' }) }, workspaceId: 'w1' });

    await client.createTask({ Subject: 'Weekly deal summary', Description: 'rollup', WhoId: 'L1' });
    expect(fetchMock.mock.calls[0][0].toString()).toContain('/sobjects/Task');
  });
});
