export interface HubSpotAuthorizeInput {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
}

export interface SalesforceAuthorizeInput {
  authBaseUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string;
}

export const buildHubSpotAuthorizeUrl = (input: HubSpotAuthorizeInput): string => {
  const url = new URL('https://app.hubspot.com/oauth/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('scope', input.scopes.join(' '));
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  return url.toString();
};

export const buildSalesforceAuthorizeUrl = (input: SalesforceAuthorizeInput): string => {
  const baseUrl = input.authBaseUrl || 'https://login.salesforce.com';
  const url = new URL('/services/oauth2/authorize', baseUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', input.scopes ?? 'refresh_token api');
  url.searchParams.set('state', input.state);
  return url.toString();
};
