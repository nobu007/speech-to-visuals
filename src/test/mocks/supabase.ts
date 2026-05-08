/**
 * Mock factory for the Supabase client.
 *
 * Provides chainable query builders for from/insert/update/delete,
 * storage operations, and auth helpers -- all backed by jest.fn().
 */

interface MockQueryBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

interface MockInsertBuilder {
  select: jest.Mock;
  single: jest.Mock;
}

interface MockUpdateDeleteBuilder {
  eq: jest.Mock;
}

interface MockStorageBucket {
  upload: jest.Mock;
  download: jest.Mock;
  getPublicUrl: jest.Mock;
  remove: jest.Mock;
}

interface MockAuth {
  signInWithPassword: jest.Mock;
  signOut: jest.Mock;
  getSession: jest.Mock;
  onAuthStateChange: jest.Mock;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  storage: { from: jest.Mock };
  auth: MockAuth;
}

/**
 * Create a fully mocked Supabase client.
 *
 * Query chain example:
 *   supabase.from('table').select().eq('id', '1').single()
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  const queryEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
  const querySingleFn = jest
    .fn()
    .mockResolvedValue({ data: null, error: null });
  const querySelectFn = jest.fn().mockReturnValue({
    eq: queryEqFn,
    single: querySingleFn,
  }) as unknown as jest.Mock;

  const insertSingleFn = jest
    .fn()
    .mockResolvedValue({ data: { id: 'mock-id' }, error: null });
  const insertSelectFn = jest.fn().mockReturnValue({ single: insertSingleFn });
  const insertFn = jest.fn().mockReturnValue({ select: insertSelectFn });

  const updateEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
  const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

  const deleteEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
  const deleteFn = jest.fn().mockReturnValue({ eq: deleteEqFn });

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
    from: jest.fn().mockReturnValue({
      select: querySelectFn,
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
    }),
    storage: {
      from: jest.fn().mockReturnValue({
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
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  };
}
