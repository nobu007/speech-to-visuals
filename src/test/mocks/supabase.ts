/**
 * Mock factory for the Supabase client.
 *
 * Provides chainable query builders for from/insert/update/delete,
 * storage operations, and auth helpers -- all backed by vi.fn().
 */

interface MockQueryBuilder {
  select: vi.Mock;
  eq: vi.Mock;
  single: vi.Mock;
}

interface MockInsertBuilder {
  select: vi.Mock;
  single: vi.Mock;
}

interface MockUpdateDeleteBuilder {
  eq: vi.Mock;
}

interface MockStorageBucket {
  upload: vi.Mock;
  download: vi.Mock;
  getPublicUrl: vi.Mock;
  remove: vi.Mock;
}

interface MockAuth {
  signInWithPassword: vi.Mock;
  signOut: vi.Mock;
  getSession: vi.Mock;
  onAuthStateChange: vi.Mock;
}

export interface MockSupabaseClient {
  from: vi.Mock;
  storage: { from: vi.Mock };
  auth: MockAuth;
}

/**
 * Create a fully mocked Supabase client.
 *
 * Query chain example:
 *   supabase.from('table').select().eq('id', '1').single()
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const queryEqFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const querySingleFn = jest
    .fn()
    .mockResolvedValue({ data: null, error: null });
  const querySelectFn = vi.fn().mockReturnValue({
    eq: queryEqFn,
    single: querySingleFn,
  }) as unknown as vi.Mock;

  const insertSingleFn = jest
    .fn()
    .mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingleFn });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

  const updateEqFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

  const deleteEqFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEqFn });

  const storageUploadFn = jest
    .fn()
    .mockResolvedValue({ data: { path: 'mock/path' }, error: null });
  const storageDownloadFn = jest
    .fn()
    .mockResolvedValue({ data: new Blob(['mock']), error: null });
  const storageGetPublicUrlFn = jest
    .fn()
    .mockReturnValue({ data: { publicUrl: 'https://mock.url' } });
  const storageRemoveFn = jest
    .fn()
    .mockResolvedValue({ data: null, error: null });

  return {
    from: vi.fn().mockReturnValue({
      select: querySelectFn,
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: storageUploadFn,
        download: storageDownloadFn,
        getPublicUrl: storageGetPublicUrlFn,
        remove: storageRemoveFn,
      }),
    },
    auth: {
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({
          data: { user: { id: 'mock-user-id' } },
          error: null,
        }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
}
