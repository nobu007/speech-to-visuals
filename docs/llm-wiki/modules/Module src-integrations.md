---
title: Module src-integrations
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module src-integrations

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 5
- Bytes: 20621

## Key Files

- `src/integrations/__tests__/auth.test.ts`
- `src/integrations/__tests__/client.test.ts`
- `src/integrations/supabase/auth.ts`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

## Risk Signals

- RISK-0586 (high, Security Boundary) in `src/integrations/__tests__/auth.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0587 (medium, Concurrency Or Timing) in `src/integrations/__tests__/auth.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L37: it('should call signInWithPassword and return auth state', async () => {
- RISK-0588 (medium, Parser Or Heuristic) in `src/integrations/__tests__/auth.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: import * as jwt from 'jsonwebtoken';
- RISK-0589 (medium, Persistence Or State) in `src/integrations/__tests__/auth.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L5: // 1) Auth functions tests (signIn / signOut / signUp / onAuthStateChange)
- RISK-0590 (low, High Attention File) in `src/integrations/__tests__/auth.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import * as jwt from 'jsonwebtoken';
- RISK-0591 (high, Security Boundary) in `src/integrations/__tests__/client.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L38: const fakeClient = { auth: {} };
- RISK-0592 (low, High Attention File) in `src/integrations/__tests__/client.test.ts`: The digest found several implementation signals worth manual review. Evidence: L38: const fakeClient = { auth: {} };
- RISK-0593 (high, Security Boundary) in `src/integrations/supabase/auth.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0594 (medium, Concurrency Or Timing) in `src/integrations/supabase/auth.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L16: export async function signIn(credentials: SignInWithPasswordCredentials): Promise<AuthState> {
- RISK-0595 (medium, Persistence Or State) in `src/integrations/supabase/auth.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: export interface AuthState {
- RISK-0596 (low, High Attention File) in `src/integrations/supabase/auth.ts`: The digest found several implementation signals worth manual review. Evidence: L2: AuthChangeEvent,
- RISK-0597 (high, Security Boundary) in `src/integrations/supabase/client.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L40: auth: {
- RISK-0598 (medium, Persistence Or State) in `src/integrations/supabase/client.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L32: export function getSupabaseClient(): SupabaseClient<Database> {
- RISK-0599 (medium, Parser Or Heuristic) in `src/integrations/supabase/types.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L1: export type Json =
- RISK-0600 (medium, Persistence Or State) in `src/integrations/supabase/types.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L63: type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
- RISK-0601 (low, High Attention File) in `src/integrations/supabase/types.ts`: The digest found several implementation signals worth manual review. Evidence: L12: __InternalSupabase: {

## Files

- `src/integrations/__tests__/auth.test.ts` — typescript, 294 lines, attention 100
- `src/integrations/__tests__/client.test.ts` — typescript, 92 lines, attention 98
- `src/integrations/supabase/auth.ts` — typescript, 42 lines, attention 100
- `src/integrations/supabase/client.ts` — typescript, 52 lines, attention 42
- `src/integrations/supabase/types.ts` — typescript, 185 lines, attention 100
