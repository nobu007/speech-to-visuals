---
title: Module supabase
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Module supabase

## Role

- Rationale: Files under supabase form a shared path-level boundary.
- Roots: supabase
- Languages: text, toml, typescript
- Files: 11
- Bytes: 38949

## Key Files

- `supabase/migrations/verify_rls_policies.sql`
- `supabase/migrations/verify_storage_policies.sql`
- `supabase/config.toml`
- `supabase/migrations/00001_create_diagram_projects.sql`
- `supabase/migrations/00002_create_audio_bucket.sql`
- `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/error-handler.ts`

## Risk Signals

- RISK-0880 (medium, Parser Or Heuristic) in `supabase/config.toml`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `toml`
- RISK-0881 (high, Security Boundary) in `supabase/functions/_shared/auth.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `auth`
- RISK-0882 (medium, Concurrency Or Timing) in `supabase/functions/_shared/auth.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L52: export async function validateToken(
- RISK-0883 (low, High Attention File) in `supabase/functions/_shared/auth.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Shared Auth Module for Supabase Edge Functions
- RISK-0884 (high, Security Boundary) in `supabase/functions/_shared/error-handler.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L12: 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
- RISK-0885 (medium, Concurrency Or Timing) in `supabase/functions/_shared/error-handler.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L175: export async function fetchWithTimeout(
- RISK-0886 (low, High Attention File) in `supabase/functions/_shared/error-handler.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * timeout handling with AbortController, and error classification.
- RISK-0887 (high, Security Boundary) in `supabase/functions/generate-scenes/index.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0888 (medium, Network Or IPC) in `supabase/functions/generate-scenes/index.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
- RISK-0889 (medium, Concurrency Or Timing) in `supabase/functions/generate-scenes/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L260: export async function handleGenerateScenes(
- RISK-0890 (medium, Parser Or Heuristic) in `supabase/functions/generate-scenes/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L344: // Parse body
- RISK-0891 (low, High Attention File) in `supabase/functions/generate-scenes/index.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0892 (high, Security Boundary) in `supabase/functions/render-video/index.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0893 (medium, Network Or IPC) in `supabase/functions/render-video/index.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
- RISK-0894 (medium, Concurrency Or Timing) in `supabase/functions/render-video/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L71: export async function handleRenderVideo(
- RISK-0895 (medium, Parser Or Heuristic) in `supabase/functions/render-video/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L138: // Parse body
- RISK-0896 (low, High Attention File) in `supabase/functions/render-video/index.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0897 (high, Security Boundary) in `supabase/functions/transcribe-audio/index.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0898 (medium, Network Or IPC) in `supabase/functions/transcribe-audio/index.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L1: import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
- RISK-0899 (medium, Concurrency Or Timing) in `supabase/functions/transcribe-audio/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L42: export async function handleTranscribe(
- RISK-0900 (low, High Attention File) in `supabase/functions/transcribe-audio/index.ts`: The digest found several implementation signals worth manual review. Evidence: L2: import { authenticateRequest, SupabaseAuthClient } from '../_shared/auth.ts';
- RISK-0901 (high, Security Boundary) in `supabase/migrations/00001_create_diagram_projects.sql`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
- RISK-0902 (high, Destructive Mutation) in `supabase/migrations/00001_create_diagram_projects.sql`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
- RISK-0903 (medium, Persistence Or State) in `supabase/migrations/00001_create_diagram_projects.sql`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `migration`
- RISK-0904 (low, High Attention File) in `supabase/migrations/00001_create_diagram_projects.sql`: The digest found several implementation signals worth manual review. Evidence: L17: user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
- RISK-0905 (high, Security Boundary) in `supabase/migrations/00002_create_audio_bucket.sql`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L16: CREATE POLICY "audio_bucket_authenticated_insert" ON storage.objects
- RISK-0906 (high, Destructive Mutation) in `supabase/migrations/00002_create_audio_bucket.sql`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L24: CREATE POLICY "audio_bucket_authenticated_delete" ON storage.objects
- RISK-0907 (medium, Persistence Or State) in `supabase/migrations/00002_create_audio_bucket.sql`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `migration`
- RISK-0908 (low, High Attention File) in `supabase/migrations/00002_create_audio_bucket.sql`: The digest found several implementation signals worth manual review. Evidence: L16: CREATE POLICY "audio_bucket_authenticated_insert" ON storage.objects
- RISK-0909 (high, Security Boundary) in `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L11: CREATE POLICY "Authenticated users can upload audio"
- RISK-0910 (high, Destructive Mutation) in `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L15: CREATE POLICY "Authenticated users can delete their audio"
- RISK-0911 (medium, Persistence Or State) in `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `migration`
- RISK-0912 (low, High Attention File) in `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql`: The digest found several implementation signals worth manual review. Evidence: L11: CREATE POLICY "Authenticated users can upload audio"
- RISK-0913 (medium, Persistence Or State) in `supabase/migrations/verify_rls_policies.sql`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `migration`
- RISK-0914 (medium, Persistence Or State) in `supabase/migrations/verify_storage_policies.sql`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `migration`

## Files

- `supabase/config.toml` — toml, 8 lines, attention 0
- `supabase/functions/_shared/auth.ts` — typescript, 121 lines, attention 100
- `supabase/functions/_shared/error-handler.ts` — typescript, 302 lines, attention 100
- `supabase/functions/generate-scenes/index.ts` — typescript, 357 lines, attention 84
- `supabase/functions/render-video/index.ts` — typescript, 151 lines, attention 84
- `supabase/functions/transcribe-audio/index.ts` — typescript, 164 lines, attention 100
- `supabase/migrations/00001_create_diagram_projects.sql` — sql, 63 lines, attention 70
- `supabase/migrations/00002_create_audio_bucket.sql` — sql, 30 lines, attention 84
- `supabase/migrations/20250930171109_612ba1fa-31c3-424e-af25-861822582ce3.sql` — sql, 62 lines, attention 100
- `supabase/migrations/verify_rls_policies.sql` — sql, 19 lines, attention 0
- `supabase/migrations/verify_storage_policies.sql` — sql, 9 lines, attention 0
