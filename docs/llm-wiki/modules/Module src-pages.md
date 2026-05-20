---
title: Module src-pages
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
# Module src-pages

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: tsx
- Files: 4
- Bytes: 11952

## Key Files

- `src/pages/Index.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/SimplePipeline.tsx`
- `src/pages/__tests__/SimplePipeline.test.tsx`

## Risk Signals

- RISK-0639 (medium, Concurrency Or Timing) in `src/pages/Index.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L23: const handleUpload = async (file: File) => {
- RISK-0640 (medium, Persistence Or State) in `src/pages/Index.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L1: import { useState } from 'react';
- RISK-0641 (medium, Concurrency Or Timing) in `src/pages/__tests__/SimplePipeline.test.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L43: const SimplePipeline = (await import('../SimplePipeline')).default;

## Files

- `src/pages/Index.tsx` — tsx, 270 lines, attention 28
- `src/pages/NotFound.tsx` — tsx, 26 lines, attention 0
- `src/pages/SimplePipeline.tsx` — tsx, 18 lines, attention 0
- `src/pages/__tests__/SimplePipeline.test.tsx` — tsx, 48 lines, attention 0
