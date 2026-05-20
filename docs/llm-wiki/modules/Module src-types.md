---
title: Module src-types
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
# Module src-types

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 15
- Bytes: 34237

## Key Files

- `src/types/api.ts`
- `src/types/cache.ts`
- `src/types/diagram.ts`
- `src/types/index.ts`
- `src/types/llm.ts`
- `src/types/pipeline.ts`
- `src/types/quality.ts`
- `src/types/workspace.ts`

## Risk Signals

- RISK-0778 (medium, Persistence Or State) in `src/types/__tests__/cache.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0779 (low, High Attention File) in `src/types/__tests__/cache.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Tests for Cache types
- RISK-0780 (high, Security Boundary) in `src/types/api/index.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L183: // Authentication Types
- RISK-0781 (medium, Network Or IPC) in `src/types/api/index.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L236: // WebSocket Event Types
- RISK-0782 (medium, Concurrency Or Timing) in `src/types/api/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L217: // Rate Limiting Types
- RISK-0783 (low, High Attention File) in `src/types/api/index.ts`: The digest found several implementation signals worth manual review. Evidence: L183: // Authentication Types
- RISK-0784 (medium, Persistence Or State) in `src/types/cache.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0785 (low, High Attention File) in `src/types/cache.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Cache Type Definitions
- RISK-0786 (medium, Persistence Or State) in `src/types/index.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L58: // Cache types
- RISK-0787 (low, High Attention File) in `src/types/index.ts`: The digest found several implementation signals worth manual review. Evidence: L58: // Cache types
- RISK-0788 (high, Security Boundary) in `src/types/llm.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L37: maxOutputTokens?: number;
- RISK-0789 (medium, Concurrency Or Timing) in `src/types/llm.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L39: timeout?: number;
- RISK-0790 (medium, Parser Or Heuristic) in `src/types/llm.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L42: parseResponse: (raw: string) => T;
- RISK-0791 (medium, Persistence Or State) in `src/types/llm.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L52: fromCache: boolean;
- RISK-0792 (low, High Attention File) in `src/types/llm.ts`: The digest found several implementation signals worth manual review. Evidence: L37: maxOutputTokens?: number;
- RISK-0793 (medium, Concurrency Or Timing) in `src/types/pipeline.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L47: timeout?: number;
- RISK-0794 (high, Security Boundary) in `src/types/workspace.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L151: token: string;

## Files

- `src/types/__tests__/api.test.ts` — typescript, 57 lines, attention 0
- `src/types/__tests__/cache.test.ts` — typescript, 40 lines, attention 100
- `src/types/__tests__/diagram.test.ts` — typescript, 124 lines, attention 0
- `src/types/__tests__/index.test.ts` — typescript, 52 lines, attention 0
- `src/types/__tests__/llm.test.ts` — typescript, 33 lines, attention 0
- `src/types/__tests__/pipeline.test.ts` — typescript, 38 lines, attention 0
- `src/types/api.ts` — typescript, 57 lines, attention 0
- `src/types/api/index.ts` — typescript, 288 lines, attention 100
- `src/types/cache.ts` — typescript, 49 lines, attention 100
- `src/types/diagram.ts` — typescript, 97 lines, attention 14
- `src/types/index.ts` — typescript, 73 lines, attention 84
- `src/types/llm.ts` — typescript, 58 lines, attention 84
- `src/types/pipeline.ts` — typescript, 86 lines, attention 14
- `src/types/quality.ts` — typescript, 65 lines, attention 0
- `src/types/workspace.ts` — typescript, 296 lines, attention 14
