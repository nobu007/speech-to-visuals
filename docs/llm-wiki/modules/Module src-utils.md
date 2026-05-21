---
title: Module src-utils
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
# Module src-utils

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 8
- Bytes: 24296

## Key Files

- `src/utils/audio-duration.ts`
- `src/utils/audio-validation.ts`
- `src/utils/iteration-logger.ts`
- `src/utils/logger.ts`
- `src/utils/memory-usage.ts`
- `src/utils/sanitize.ts`
- `src/utils/__tests__/logger.test.ts`
- `src/utils/__tests__/memory-usage.test.ts`

## Risk Signals

- RISK-0813 (low, High Attention File) in `src/utils/__tests__/memory-usage.test.ts`: The digest found several implementation signals worth manual review. Evidence: L1: import { getMemoryUsage, getHeapUsed } from '../memory-usage';
- RISK-0814 (medium, Concurrency Or Timing) in `src/utils/iteration-logger.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L73: private async ensureLogFile(): Promise<void> {
- RISK-0815 (medium, Parser Or Heuristic) in `src/utils/iteration-logger.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L58: // Parse existing entries to maintain history
- RISK-0816 (low, High Attention File) in `src/utils/iteration-logger.ts`: The digest found several implementation signals worth manual review. Evidence: L27: memoryUsage?: number;
- RISK-0817 (low, High Attention File) in `src/utils/memory-usage.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Cross-platform memory usage utility (ISS-006)
- RISK-0818 (medium, Parser Or Heuristic) in `src/utils/sanitize.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L27: * - Empty result fallback → `unnamed`

## Files

- `src/utils/__tests__/logger.test.ts` — typescript, 68 lines, attention 0
- `src/utils/__tests__/memory-usage.test.ts` — typescript, 45 lines, attention 100
- `src/utils/audio-duration.ts` — typescript, 60 lines, attention 0
- `src/utils/audio-validation.ts` — typescript, 149 lines, attention 0
- `src/utils/iteration-logger.ts` — typescript, 312 lines, attention 100
- `src/utils/logger.ts` — typescript, 32 lines, attention 0
- `src/utils/memory-usage.ts` — typescript, 45 lines, attention 100
- `src/utils/sanitize.ts` — typescript, 44 lines, attention 42
