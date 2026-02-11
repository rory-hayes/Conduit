import { describe, expect, it, vi } from 'vitest';

const createClientSpy = vi.fn(() => ({ mocked: true }));
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientSpy }));

describe('supabaseClient', () => {
  it('constructs client from env defaults', async () => {
    const mod = await import('../src/lib/supabaseClient');
    expect(createClientSpy).toHaveBeenCalled();
    expect(mod.supabaseClient).toEqual({ mocked: true });
  });
});
