import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import { logger } from '@/utils/logger';
import type { Database } from './types';

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Resolve the Supabase URL from available environment sources.
 * In the Vite browser context, VITE_SUPABASE_URL is injected by Vite.
 * In Node / test contexts, SUPABASE_URL is read from process.env.
 */
function resolveSupabaseUrl(): string {
  try {
    return (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || '') : '';
  } catch (err) {
    logger.warn('[supabase/client] process.env access failed in resolveSupabaseUrl', err);
    return '';
  }
}

/**
 * Resolve the Supabase Anon Key from available environment sources.
 * In the Vite browser context, VITE_SUPABASE_ANON_KEY is injected by Vite.
 * In Node / test contexts, SUPABASE_ANON_KEY is read from process.env.
 */
function resolveSupabaseAnonKey(): string {
  try {
    return (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_ANON_KEY || '') : '';
  } catch (err) {
    logger.warn('[supabase/client] process.env access failed in resolveSupabaseAnonKey', err);
    return '';
  }
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    const supabaseUrl = resolveSupabaseUrl();
    const supabaseAnonKey = resolveSupabaseAnonKey();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new PipelineConfigError('supabase', 'Supabase URL and Anon Key are required');
    }
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseInstance;
}

export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
