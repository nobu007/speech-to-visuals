---
title: Module src-lib
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
# Module src-lib

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 3
- Bytes: 13743

## Key Files

- `src/lib/actualVideoRenderer.ts`
- `src/lib/utils.ts`
- `src/lib/videoRenderer.ts`

## Risk Signals

- RISK-0602 (medium, Concurrency Or Timing) in `src/lib/actualVideoRenderer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L131: private async bundleComposition(
- RISK-0603 (medium, Parser Or Heuristic) in `src/lib/actualVideoRenderer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L153: const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
- RISK-0604 (medium, Persistence Or State) in `src/lib/actualVideoRenderer.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L33: private bundleCachePath: string | null = null;
- RISK-0605 (low, High Attention File) in `src/lib/actualVideoRenderer.ts`: The digest found several implementation signals worth manual review. Evidence: L33: private bundleCachePath: string | null = null;
- RISK-0606 (medium, Concurrency Or Timing) in `src/lib/videoRenderer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L74: private async simulateRender(

## Files

- `src/lib/actualVideoRenderer.ts` — typescript, 336 lines, attention 100
- `src/lib/utils.ts` — typescript, 7 lines, attention 0
- `src/lib/videoRenderer.ts` — typescript, 151 lines, attention 42
