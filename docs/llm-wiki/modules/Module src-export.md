---
title: Module src-export
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
# Module src-export

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: tsx, typescript
- Files: 7
- Bytes: 112670

## Key Files

- `src/export/enhanced-export-engine.ts`
- `src/export/export-ui.tsx`
- `src/export/export-verifier.ts`
- `src/export/multi-format-exporter.ts`
- `src/export/production-exporter.ts`
- `src/export/__tests__/enhanced-export-engine.test.ts`
- `src/export/apng-encoder.ts`

## Risk Signals

- RISK-0548 (medium, Parser Or Heuristic) in `src/export/__tests__/enhanced-export-engine.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L15: parsePngChunks,
- RISK-0549 (low, High Attention File) in `src/export/__tests__/enhanced-export-engine.test.ts`: The digest found several implementation signals worth manual review. Evidence: L15: parsePngChunks,
- RISK-0550 (medium, Concurrency Or Timing) in `src/export/apng-encoder.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L73: const blockCount = Math.ceil(raw.length / maxBlock) || 1;
- RISK-0551 (medium, Parser Or Heuristic) in `src/export/apng-encoder.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L254: export function parsePngChunks(apng: Uint8Array): PngChunkInfo[] {
- RISK-0552 (low, High Attention File) in `src/export/apng-encoder.ts`: The digest found several implementation signals worth manual review. Evidence: L68: /** Wrap raw bytes in a zlib "store" (no-compression) container */
- RISK-0553 (high, Security Boundary) in `src/export/enhanced-export-engine.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L84: author?: string;
- RISK-0554 (medium, Concurrency Or Timing) in `src/export/enhanced-export-engine.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L249: private async processExportJob(job: ExportJob): Promise<ExportResult> {
- RISK-0555 (low, High Attention File) in `src/export/enhanced-export-engine.ts`: The digest found several implementation signals worth manual review. Evidence: L84: author?: string;
- RISK-0556 (medium, Concurrency Or Timing) in `src/export/export-ui.tsx`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L78: const handleExport = async () => {
- RISK-0557 (medium, Parser Or Heuristic) in `src/export/export-ui.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L252: quality: { fps: parseInt(value) as VideoQuality['fps'] }
- RISK-0558 (medium, Persistence Or State) in `src/export/export-ui.tsx`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L8: import React, { useState, useEffect } from 'react';
- RISK-0559 (medium, Parser Or Heuristic) in `src/export/export-verifier.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L312: const parsed = JSON.parse(text);
- RISK-0560 (low, High Attention File) in `src/export/export-verifier.ts`: The digest found several implementation signals worth manual review. Evidence: L77: private readonly options: VerificationOptions;
- RISK-0561 (medium, Concurrency Or Timing) in `src/export/multi-format-exporter.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L85: private async exportSVG(
- RISK-0562 (medium, Parser Or Heuristic) in `src/export/multi-format-exporter.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L192: private exportJSON(
- RISK-0563 (low, High Attention File) in `src/export/multi-format-exporter.ts`: The digest found several implementation signals worth manual review. Evidence: L49: private defaultWidth = 1920;
- RISK-0564 (medium, Concurrency Or Timing) in `src/export/production-exporter.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L237: private async processJob(jobId: string): Promise<void> {
- RISK-0565 (low, High Attention File) in `src/export/production-exporter.ts`: The digest found several implementation signals worth manual review. Evidence: L65: * Internal types for production exporter pipeline

## Files

- `src/export/__tests__/enhanced-export-engine.test.ts` — typescript, 555 lines, attention 100
- `src/export/apng-encoder.ts` — typescript, 285 lines, attention 100
- `src/export/enhanced-export-engine.ts` — typescript, 907 lines, attention 100
- `src/export/export-ui.tsx` — tsx, 510 lines, attention 14
- `src/export/export-verifier.ts` — typescript, 337 lines, attention 100
- `src/export/multi-format-exporter.ts` — typescript, 459 lines, attention 100
- `src/export/production-exporter.ts` — typescript, 687 lines, attention 100
