---
title: Module src-hooks
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
# Module src-hooks

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 2
- Bytes: 14761

## Key Files

- `src/hooks/use-toast.ts`
- `src/hooks/useFrameworkPipeline.ts`

## Risk Signals

- RISK-0580 (high, Destructive Mutation) in `src/hooks/use-toast.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L61: toastTimeouts.delete(toastId);
- RISK-0581 (medium, Concurrency Or Timing) in `src/hooks/use-toast.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L53: const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
- RISK-0582 (medium, Persistence Or State) in `src/hooks/use-toast.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L126: let memoryState: State = { toasts: [] };
- RISK-0583 (low, High Attention File) in `src/hooks/use-toast.ts`: The digest found several implementation signals worth manual review. Evidence: L53: const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
- RISK-0584 (medium, Persistence Or State) in `src/hooks/useFrameworkPipeline.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L19: interface ExecutionState {
- RISK-0585 (low, High Attention File) in `src/hooks/useFrameworkPipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Phase 41: useFrameworkPipeline Hook

## Files

- `src/hooks/use-toast.ts` — typescript, 187 lines, attention 100
- `src/hooks/useFrameworkPipeline.ts` — typescript, 386 lines, attention 92
