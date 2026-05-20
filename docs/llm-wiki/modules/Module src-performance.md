---
title: Module src-performance
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
# Module src-performance

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 4
- Bytes: 108714

## Key Files

- `src/performance/index.ts`
- `src/performance/intelligent-cache.ts`
- `src/performance/__tests__/intelligent-cache-robustness.test.ts`
- `src/performance/__tests__/intelligent-cache.test.ts`

## Risk Signals

- RISK-0642 (medium, Concurrency Or Timing) in `src/performance/__tests__/intelligent-cache-robustness.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L45: test('should handle complex data types in cache', async () => {
- RISK-0643 (medium, Parser Or Heuristic) in `src/performance/__tests__/intelligent-cache-robustness.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData
- RISK-0644 (medium, Persistence Or State) in `src/performance/__tests__/intelligent-cache-robustness.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0645 (low, High Attention File) in `src/performance/__tests__/intelligent-cache-robustness.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Tests for ISS-019: JSON.parse robustness in intelligent-cache.ts decompressData
- RISK-0646 (medium, Parser Or Heuristic) in `src/performance/__tests__/intelligent-cache.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L1818: const customKeyGen = (args: unknown[]) => `custom-${JSON.stringify(args)}`;
- RISK-0647 (medium, Persistence Or State) in `src/performance/__tests__/intelligent-cache.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0648 (low, High Attention File) in `src/performance/__tests__/intelligent-cache.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Comprehensive tests for IntelligentCache
- RISK-0649 (medium, Persistence Or State) in `src/performance/index.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: export { IntelligentCache, globalCache } from './intelligent-cache';
- RISK-0650 (medium, Persistence Or State) in `src/performance/intelligent-cache.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0651 (low, High Attention File) in `src/performance/intelligent-cache.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * performance, memory efficiency, and intelligent content matching.

## Files

- `src/performance/__tests__/intelligent-cache-robustness.test.ts` — typescript, 76 lines, attention 100
- `src/performance/__tests__/intelligent-cache.test.ts` — typescript, 1951 lines, attention 100
- `src/performance/index.ts` — typescript, 1 lines, attention 14
- `src/performance/intelligent-cache.ts` — typescript, 1021 lines, attention 100
