/**
 * Ambient declarations for the Deno edge functions under supabase/functions/.
 *
 * tsconfig.test.json includes `supabase` so the function sources (and the
 * tests that import them via the `#supabase/*` subpath) are type-checked by
 * Node tsc — but tsc cannot resolve Deno's https:// module specifiers or the
 * `Deno` global. These minimal structural shims (matching exactly what the
 * functions use) let the check pass without weakening the rest of the program.
 * The real runtime types come from Deno itself at deploy time.
 */

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  // Call sites immediately treat the result as their local SupabaseAuthClient
  // structural interface (see _shared/auth.ts), so `unknown` keeps the shim
  // minimal while preserving the intentional cast.
  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: Record<string, unknown>,
  ): unknown;
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
