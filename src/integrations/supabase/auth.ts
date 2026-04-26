import {
  AuthChangeEvent,
  Session,
  User,
  SignInWithPasswordCredentials,
  SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export async function signIn(credentials: SignInWithPasswordCredentials): Promise<AuthState> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) throw error;
  return { user: data.user, session: data.session, loading: false };
}

export async function signUp(credentials: SignUpWithPasswordCredentials): Promise<AuthState> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp(credentials);
  if (error) throw error;
  return { user: data.user, session: data.session, loading: false };
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  const client = getSupabaseClient();
  return client.auth.onAuthStateChange(callback);
}
