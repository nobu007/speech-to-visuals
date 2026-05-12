/* eslint-disable @typescript-eslint/no-explicit-any */
import * as jwt from 'jsonwebtoken';

// Mock @supabase/supabase-js for the client module tests
const mockCreateClient: any = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Import the real client module — jest.mock will be hoisted above this import
// so the mocked @supabase/supabase-js is used
import {
  getSupabaseClient,
  resetSupabaseClient,
} from '@/integrations/supabase/client';

describe('Supabase client (getSupabaseClient / resetSupabaseClient)', () => {
  const originalEnvUrl = process.env.SUPABASE_URL;
  const originalEnvKey = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    mockCreateClient.mockReset();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    if (originalEnvUrl !== undefined) {
      process.env.SUPABASE_URL = originalEnvUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }
    if (originalEnvKey !== undefined) {
      process.env.SUPABASE_ANON_KEY = originalEnvKey;
    } else {
      delete process.env.SUPABASE_ANON_KEY;
    }
  });

  it('should create a Supabase client on first call', () => {
    const fakeClient = { auth: {} };
    mockCreateClient.mockReturnValue(fakeClient);

    const client = getSupabaseClient();

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
        }),
      })
    );
    expect(client).toBe(fakeClient);
  });

  it('should return the same instance on subsequent calls (singleton)', () => {
    const fakeClient = { auth: {} };
    mockCreateClient.mockReturnValue(fakeClient);

    const client1 = getSupabaseClient();
    const client2 = getSupabaseClient();

    expect(client1).toBe(client2);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it('should throw when URL and Anon Key are missing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;

    expect(() => getSupabaseClient()).toThrow('Supabase URL and Anon Key are required');
  });

  it('should create a new instance after resetSupabaseClient', () => {
    const fakeClient1 = { auth: { name: 'client1' } };
    const fakeClient2 = { auth: { name: 'client2' } };
    mockCreateClient
      .mockReturnValueOnce(fakeClient1)
      .mockReturnValueOnce(fakeClient2);

    const client1 = getSupabaseClient();
    expect(client1).toBe(fakeClient1);

    resetSupabaseClient();

    const client2 = getSupabaseClient();
    expect(client2).toBe(fakeClient2);
    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});
