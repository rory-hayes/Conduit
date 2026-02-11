import { waitForRateLimit } from '../http/rateLimiter.js';
import { withRetry } from '../http/retry.js';

export interface HubSpotTokenManager {
  getAccessToken: (workspaceId: string) => Promise<string>;
}

export interface HubSpotClientDeps {
  fetch?: typeof fetch;
  tokenManager: HubSpotTokenManager;
  workspaceId: string;
  baseUrl?: string;
}

const defaultAssociationTypeId = 204;

export const createHubSpotClient = ({ fetch: fetchImpl = fetch, tokenManager, workspaceId, baseUrl = 'https://api.hubapi.com' }: HubSpotClientDeps) => {
  const associationCache = new Map<string, { expiresAt: number; value: number }>();

  const request = async (path: string, init: RequestInit): Promise<any> => {
    await waitForRateLimit(workspaceId, 'hubspot');
    return withRetry(async () => {
      const accessToken = await tokenManager.getAccessToken(workspaceId);
      const response = await fetchImpl(new URL(path, baseUrl), {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {})
        }
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HubSpot API ${response.status}: ${body}`);
      }

      if (response.status === 204) {
        return null;
      }
      return response.json();
    });
  };

  const searchContactByEmail = async (email: string) => {
    const result = await request('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }], limit: 1 })
    });
    return (result?.results ?? [])[0] ?? null;
  };

  const createContact = async (properties: Record<string, unknown>) => request('/crm/v3/objects/contacts', { method: 'POST', body: JSON.stringify({ properties }) });

  const updateContact = async (id: string, properties: Record<string, unknown>) =>
    request(`/crm/v3/objects/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ properties }) });

  const upsertContactByEmail = async (email: string, properties: Record<string, unknown>) => {
    const existing = await searchContactByEmail(email);
    if (existing?.id) {
      const updated = await updateContact(existing.id, properties);
      return { mode: 'updated' as const, record: updated };
    }
    const created = await createContact({ ...properties, email });
    return { mode: 'created' as const, record: created };
  };

  const getTaskAssociationTypeId = async (): Promise<number> => {
    const key = 'tasks:contacts';
    const cached = associationCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const result = await request('/crm/v4/associations/tasks/contacts/labels', { method: 'GET' });
      const value = Number(result?.results?.[0]?.typeId ?? defaultAssociationTypeId);
      associationCache.set(key, { value, expiresAt: Date.now() + 5 * 60_000 });
      return value;
    } catch {
      return defaultAssociationTypeId;
    }
  };

  const createTask = async (properties: Record<string, unknown>, associations: Array<{ toObjectId: string }>) => {
    const associationTypeId = await getTaskAssociationTypeId();
    return request('/crm/v3/objects/tasks', {
      method: 'POST',
      body: JSON.stringify({
        properties,
        associations: associations.map((assoc) => ({
          to: { id: assoc.toObjectId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }]
        }))
      })
    });
  };

  const createNote = async (properties: Record<string, unknown>, associations: Array<{ toObjectId: string }>) => {
    const associationTypeId = await getTaskAssociationTypeId();
    return request('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties,
        associations: associations.map((assoc) => ({
          to: { id: assoc.toObjectId },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }]
        }))
      })
    });
  };

  return { searchContactByEmail, createContact, updateContact, upsertContactByEmail, createTask, createNote };
};
