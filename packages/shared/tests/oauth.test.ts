import { describe, expect, it } from 'vitest';
import { buildHubSpotAuthorizeUrl, buildSalesforceAuthorizeUrl } from '../src/oauth';

describe('oauth url builders', () => {
  it('builds hubspot authorize url', () => {
    const url = buildHubSpotAuthorizeUrl({
      clientId: 'hub-client',
      redirectUri: 'https://app.local/callback',
      state: 'abc123',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write']
    });

    expect(url).toContain('app.hubspot.com/oauth/authorize');
    expect(url).toContain('client_id=hub-client');
    expect(url).toContain('state=abc123');
    expect(decodeURIComponent(url)).toContain('crm.objects.contacts.read crm.objects.contacts.write');
  });

  it('builds salesforce authorize url', () => {
    const url = buildSalesforceAuthorizeUrl({
      authBaseUrl: 'https://test.salesforce.com',
      clientId: 'sf-client',
      redirectUri: 'https://app.local/sf-callback',
      state: 'state-1'
    });

    expect(url).toContain('test.salesforce.com/services/oauth2/authorize');
    expect(url).toContain('response_type=code');
    expect(url).toContain('scope=refresh_token+api');
  });
});
