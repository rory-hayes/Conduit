import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectMock = vi.fn();
const inMock = vi.fn();
const fromMock = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock
  })
}));

beforeEach(() => {
  selectMock.mockReset();
  inMock.mockReset();
  fromMock.mockReset();

  inMock.mockResolvedValue({ data: [{ crm: 'hubspot', status: 'connected', last_checked_at: 'ts', last_error: null }] });
  selectMock.mockReturnValue({ in: inMock });
  fromMock.mockReturnValue({ select: selectMock });
});

describe('integrations lib', () => {
  it('lists redacted crm connections', async () => {
    const { listCrmConnections } = await import('../src/lib/integrations');
    const rows = await listCrmConnections();
    expect(rows[0].crm).toBe('hubspot');
    expect(selectMock).toHaveBeenCalledWith('crm,status,last_checked_at,last_error');
  });

  it('returns authorize url from oauth start endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ authorizeUrl: 'https://example.com/auth' }) });
    vi.stubGlobal('fetch', fetchMock as any);
    const { startOAuth } = await import('../src/lib/integrations');

    const url = await startOAuth('hubspot', 'w1');
    expect(url).toBe('https://example.com/auth');
  });

  it('disconnect calls server endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock as any);
    const { disconnectCrm } = await import('../src/lib/integrations');

    await disconnectCrm('salesforce', 'w1');
    expect(fetchMock).toHaveBeenCalledWith('/functions/v1/crm-disconnect', expect.any(Object));
  });
});
