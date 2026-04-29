/**
 * Mock for Deno's serve function and Supabase createClient.
 * These are URL-imported in edge functions and cannot be resolved by Jest.
 */

export function serve(_handler: (req: Request) => Promise<Response>): void {
  // No-op in test environment
}

export function createClient(_url: string, _key: string) {
  return {
    auth: {
      getUser: async (_token: string) => ({
        data: { user: null },
        error: { message: 'Mock: not configured' },
      }),
    },
  };
}
