import { waitForRateLimit } from '../http/rateLimiter.js';
import { withRetry } from '../http/retry.js';

export interface SalesforceTokenManager {
  getAccessToken: (workspaceId: string) => Promise<{ accessToken: string; instanceUrl: string }>;
}

export interface SalesforceClientDeps {
  fetch?: typeof fetch;
  tokenManager: SalesforceTokenManager;
  workspaceId: string;
  apiVersion?: string;
}

export const createSalesforceClient = ({ fetch: fetchImpl = fetch, tokenManager, workspaceId, apiVersion = process.env.SALESFORCE_API_VERSION ?? 'v60.0' }: SalesforceClientDeps) => {
  const request = async (path: string, init: RequestInit): Promise<any> => {
    await waitForRateLimit(workspaceId, 'salesforce');
    return withRetry(async () => {
      const { accessToken, instanceUrl } = await tokenManager.getAccessToken(workspaceId);
      const response = await fetchImpl(new URL(path, instanceUrl), {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {})
        }
      });

      if (!response.ok) {
        throw new Error(`Salesforce API ${response.status}: ${await response.text()}`);
      }

      if (response.status === 204) return null;
      return response.json();
    });
  };

  const soqlQuery = async (q: string) => request(`/services/data/${apiVersion}/query?q=${encodeURIComponent(q)}`, { method: 'GET' });

  const findLeadByEmail = async (email: string) => {
    const result = await soqlQuery(`SELECT Id, Email, LastName, Company FROM Lead WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`);
    return (result?.records ?? [])[0] ?? null;
  };

  const findContactByEmail = async (email: string) => {
    const result = await soqlQuery(`SELECT Id, Email, LastName FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`);
    return (result?.records ?? [])[0] ?? null;
  };

  const upsertLeadMinimal = async (
    email: string,
    name: string | null,
    company: string | null,
    otherProps: Record<string, unknown> = {}
  ) => {
    const lead = await findLeadByEmail(email);
    const payload = {
      Email: email,
      LastName: name && name.trim() ? name : 'Unknown',
      Company: company && company.trim() ? company : 'Unknown',
      ...otherProps
    };

    if (lead?.Id) {
      await request(`/services/data/${apiVersion}/sobjects/Lead/${lead.Id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      return { mode: 'updated' as const, id: lead.Id };
    }

    const created = await request(`/services/data/${apiVersion}/sobjects/Lead`, { method: 'POST', body: JSON.stringify(payload) });
    return { mode: 'created' as const, id: created?.id as string };
  };

  const createTask = async (input: {
    Subject: string;
    Description: string;
    ActivityDate?: string;
    WhoId?: string;
    WhatId?: string;
  }) => {
    return request(`/services/data/${apiVersion}/sobjects/Task`, { method: 'POST', body: JSON.stringify(input) });
  };

  return { soqlQuery, findLeadByEmail, findContactByEmail, upsertLeadMinimal, createTask };
};
