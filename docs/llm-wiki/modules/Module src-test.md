---
title: Module src-test
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
# Module src-test

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 16
- Bytes: 89029

## Key Files

- `src/test/setup.test.ts`
- `src/test/alias-resolve.test.ts`
- `src/test/generators.ts`
- `src/test/helpers.ts`
- `src/test/__tests__/generators.test.ts`
- `src/test/__tests__/helpers.test.ts`
- `src/test/layout/GridSnapStrategy.test.ts`
- `src/test/layout/LayoutStrategy.test.ts`

## Risk Signals

- RISK-0759 (medium, Concurrency Or Timing) in `src/test/helpers.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L39: export async function waitMs(ms: number): Promise<void> {
- RISK-0760 (medium, Concurrency Or Timing) in `src/test/layout/LayoutStrategy.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L64: it('returns fallback layout with success=false when performLayout throws', async () => {
- RISK-0761 (medium, Parser Or Heuristic) in `src/test/layout/LayoutStrategy.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L63: // ---------- apply() catch / fallback (lines 128-153) ----------
- RISK-0762 (low, High Attention File) in `src/test/layout/LayoutStrategy.test.ts`: The digest found several implementation signals worth manual review. Evidence: L13: private shouldThrow: boolean;
- RISK-0763 (medium, Concurrency Or Timing) in `src/test/layout/OverlapResolver.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L42: it('resolves overlapping nodes (fallback to grid if needed)', async () => {
- RISK-0764 (medium, Parser Or Heuristic) in `src/test/layout/OverlapResolver.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L42: it('resolves overlapping nodes (fallback to grid if needed)', async () => {
- RISK-0765 (low, High Attention File) in `src/test/layout/OverlapResolver.test.ts`: The digest found several implementation signals worth manual review. Evidence: L6: /** Type helper to access OverlapResolver private members in tests */
- RISK-0766 (high, Destructive Mutation) in `src/test/layout/ProgressiveForceStrategy.test.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: path contains `force`
- RISK-0767 (medium, Concurrency Or Timing) in `src/test/layout/layout-engine.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L217: // Trigger the catch block by mocking internal method
- RISK-0768 (high, Security Boundary) in `src/test/mocks/supabase.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L5: * storage operations, and auth helpers -- all backed by jest.fn().
- RISK-0769 (high, Destructive Mutation) in `src/test/mocks/supabase.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L19: interface MockUpdateDeleteBuilder {
- RISK-0770 (medium, Persistence Or State) in `src/test/mocks/supabase.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L34: onAuthStateChange: jest.Mock;
- RISK-0771 (low, High Attention File) in `src/test/mocks/supabase.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * storage operations, and auth helpers -- all backed by jest.fn().

## Files

- `src/test/__tests__/generators.test.ts` — typescript, 119 lines, attention 0
- `src/test/__tests__/helpers.test.ts` — typescript, 142 lines, attention 0
- `src/test/alias-resolve.test.ts` — typescript, 21 lines, attention 0
- `src/test/generators.ts` — typescript, 72 lines, attention 14
- `src/test/helpers.ts` — typescript, 66 lines, attention 14
- `src/test/layout/GridSnapStrategy.test.ts` — typescript, 230 lines, attention 0
- `src/test/layout/LayoutStrategy.test.ts` — typescript, 515 lines, attention 100
- `src/test/layout/OverlapResolver.test.ts` — typescript, 394 lines, attention 100
- `src/test/layout/ProgressiveForceStrategy.test.ts` — typescript, 188 lines, attention 0
- `src/test/layout/layout-engine.test.ts` — typescript, 302 lines, attention 14
- `src/test/layout/test-utils.test.ts` — typescript, 151 lines, attention 0
- `src/test/layout/test-utils.ts` — typescript, 89 lines, attention 28
- `src/test/mocks/gemini.ts` — typescript, 36 lines, attention 0
- `src/test/mocks/supabase.ts` — typescript, 114 lines, attention 100
- `src/test/mocks/whisper.ts` — typescript, 41 lines, attention 0
- `src/test/setup.test.ts` — typescript, 11 lines, attention 0
