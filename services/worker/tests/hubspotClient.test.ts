import { describe, expect, it, vi } from 'vitest';
import { createHubSpotClient } from '../src/connectors/hubspot/client.js';

describe('hubspot client', () => {
  it('upsertContactByEmail creates when not found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c1' }), { status: 200 }));

    const client = createHubSpotClient({
      fetch: fetchMock as unknown as typeof fetch,
      tokenManager: { getAccessToken: async () => 'token' },
      workspaceId: 'w1',
      baseUrl: 'https://hub.local'
    });

    const result = await client.upsertContactByEmail('a@b.com', { firstname: 'A' });
    expect(result.mode).toBe('created');
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/crm/v3/objects/contacts');
  });

  it('upsertContactByEmail updates when found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'c1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'c1' }), { status: 200 }));

    const client = createHubSpotClient({ fetch: fetchMock as any, tokenManager: { getAccessToken: async () => 'token' }, workspaceId: 'w1', baseUrl: 'https://hub.local' });
    const result = await client.upsertContactByEmail('a@b.com', { firstname: 'A' });

    expect(result.mode).toBe('updated');
    expect(fetchMock.mock.calls[1][0].toString()).toContain('/crm/v3/objects/contacts/c1');
  });

  it('createTask and createNote include properties and associations', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ typeId: 999 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 't1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'n1' }), { status: 200 }));

    const client = createHubSpotClient({ fetch: fetchMock as any, tokenManager: { getAccessToken: async () => 'token' }, workspaceId: 'w1', baseUrl: 'https://hub.local' });

    await client.createTask({ hs_task_subject: 'hello' }, [{ toObjectId: 'c1' }]);
    await client.createNote({ hs_note_body: 'summary' }, [{ toObjectId: 'c1' }]);

    const taskBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const noteBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(taskBody).toMatchObject({ properties: { hs_task_subject: 'hello' } });
    expect(taskBody.associations[0].types[0].associationTypeId).toBe(999);
    expect(noteBody).toMatchObject({ properties: { hs_note_body: 'summary' } });
  });
});
