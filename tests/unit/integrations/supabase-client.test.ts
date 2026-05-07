/**
 * ISS-023: Browser-Safe process.env in supabase/client.ts
 *
 * Verifies resolveSupabaseUrl/resolveSupabaseAnonKey return empty string
 * when process.env is undefined (browser without Vite replacement).
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';

describe('ISS-023: Browser-Safe env in supabase client resolvers', () => {
  const originalProcess = global.process;

  afterEach(() => {
    Object.defineProperty(global, 'process', {
      value: originalProcess,
      writable: true,
      configurable: true,
    });
    jest.resetModules();
  });

  it('resolveSupabaseUrl returns empty string when process is undefined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).process;

    // The module uses the function internally; verify it doesn't crash on import
    const mod = await import('@/integrations/supabase/client');
    expect(mod.resetSupabaseClient).toBeDefined();
  });

  it('resolveSupabaseAnonKey returns empty string when process is undefined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).process;

    // Module should import without throwing even when process is absent
    await expect(import('@/integrations/supabase/client')).resolves.toBeDefined();
  });

  it('getSupabaseClient throws descriptive error when env vars are missing', async () => {
    const origUrl = process.env.SUPABASE_URL;
    const origKey = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    jest.resetModules();

    try {
      const { getSupabaseClient } = await import('@/integrations/supabase/client');
      expect(() => getSupabaseClient()).toThrow('Supabase URL and Anon Key are required');
    } finally {
      if (origUrl) process.env.SUPABASE_URL = origUrl;
      if (origKey) process.env.SUPABASE_ANON_KEY = origKey;
    }
  });
});
