---
title: Module src-workers
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
# Module src-workers

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 14
- Bytes: 74252

## Key Files

- `src/workers/export-worker.ts`
- `src/workers/worker-pool.ts`
- `src/workers/__tests__/export-delegation-helpers.test.ts`
- `src/workers/__tests__/export-engine-integration.test.ts`
- `src/workers/__tests__/export-worker.test.ts`
- `src/workers/__tests__/worker-pool.test.ts`
- `src/workers/index.ts`
- `src/workers/layout-worker.ts`

## Risk Signals

- RISK-0868 (medium, Concurrency Or Timing) in `src/workers/__tests__/export-delegation-helpers.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L96: const result = await testInternals(engine).processExportViaWorker(createJob(), 30, 10);
- RISK-0869 (low, High Attention File) in `src/workers/__tests__/export-delegation-helpers.test.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * private methods at unit level, including the disposed-flag guard.
- RISK-0870 (medium, Concurrency Or Timing) in `src/workers/__tests__/export-engine-integration.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L85: it('exports successfully when workers unavailable (fallback)', async () => {
- RISK-0871 (medium, Parser Or Heuristic) in `src/workers/__tests__/export-engine-integration.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L85: it('exports successfully when workers unavailable (fallback)', async () => {
- RISK-0872 (medium, Persistence Or State) in `src/workers/__tests__/export-engine-integration.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L94: it('isWorkerEnabled reflects pool state', () => {
- RISK-0873 (medium, Parser Or Heuristic) in `src/workers/__tests__/fallback.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `fallback`
- RISK-0874 (medium, Parser Or Heuristic) in `src/workers/__tests__/layout-delegation-helpers.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L10: import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy';
- RISK-0875 (low, High Attention File) in `src/workers/__tests__/layout-delegation-helpers.test.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * Tests computeLayoutViaWorker private method at unit level,
- RISK-0876 (medium, Parser Or Heuristic) in `src/workers/__tests__/layout-engine-integration.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L12: import type { FallbackLayoutStrategy } from '../../visualization/strategies/FallbackLayoutStrategy';
- RISK-0877 (low, High Attention File) in `src/workers/__tests__/worker-pool.test.ts`: The digest found several implementation signals worth manual review. Evidence: L18: dispatchMessage: (data: WorkerResponse) => void;
- RISK-0878 (medium, Parser Or Heuristic) in `src/workers/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L38: // Re-export worker processing functions for testing and fallback
- RISK-0879 (low, High Attention File) in `src/workers/worker-pool.ts`: The digest found several implementation signals worth manual review. Evidence: L31: private workers: PooledWorker[] = [];

## Files

- `src/workers/__tests__/export-delegation-helpers.test.ts` — typescript, 303 lines, attention 100
- `src/workers/__tests__/export-engine-integration.test.ts` — typescript, 124 lines, attention 28
- `src/workers/__tests__/export-worker.test.ts` — typescript, 86 lines, attention 0
- `src/workers/__tests__/fallback.test.ts` — typescript, 43 lines, attention 28
- `src/workers/__tests__/layout-delegation-helpers.test.ts` — typescript, 415 lines, attention 100
- `src/workers/__tests__/layout-engine-integration.test.ts` — typescript, 190 lines, attention 42
- `src/workers/__tests__/layout-worker.test.ts` — typescript, 156 lines, attention 0
- `src/workers/__tests__/worker-pool.test.ts` — typescript, 369 lines, attention 100
- `src/workers/export-worker.ts` — typescript, 89 lines, attention 0
- `src/workers/index.ts` — typescript, 45 lines, attention 28
- `src/workers/layout-worker.ts` — typescript, 179 lines, attention 0
- `src/workers/types.ts` — typescript, 72 lines, attention 0
- `src/workers/worker-factories.ts` — typescript, 30 lines, attention 14
- `src/workers/worker-pool.ts` — typescript, 242 lines, attention 100
