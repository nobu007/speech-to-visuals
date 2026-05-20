---
title: Module src-remotion
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
# Module src-remotion

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: tsx, typescript
- Files: 22
- Bytes: 161099

## Key Files

- `src/remotion/CaptionOverlay.tsx`
- `src/remotion/DiagramScene.tsx`
- `src/remotion/DiagramVideo.tsx`
- `src/remotion/EdgeAnimation.tsx`
- `src/remotion/NodeAnimation.tsx`
- `src/remotion/Root.tsx`
- `src/remotion/Video.tsx`
- `src/remotion/animation-strategies.ts`

## Risk Signals

- RISK-0725 (medium, Parser Or Heuristic) in `src/remotion/CaptionOverlay.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L9: import { SrtCaption } from './srt-parser';
- RISK-0726 (low, High Attention File) in `src/remotion/EdgeAnimation.tsx`: The digest found several implementation signals worth manual review. Evidence: L3: * Edge drawing animation: 0.5s = 15 frames at 30fps
- RISK-0727 (medium, Parser Or Heuristic) in `src/remotion/__tests__/CaptionOverlay.test.tsx`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L8: import { SrtCaption } from '../srt-parser';
- RISK-0728 (low, High Attention File) in `src/remotion/__tests__/EdgeAnimation.test.tsx`: The digest found several implementation signals worth manual review. Evidence: L3: * Edge drawing animation: 0.5s = 15 frames at 30fps
- RISK-0729 (low, High Attention File) in `src/remotion/__tests__/animation-strategies.test.ts`: The digest found several implementation signals worth manual review. Evidence: L12: EDGE_DRAW_DURATION_FRAMES,
- RISK-0730 (medium, Parser Or Heuristic) in `src/remotion/__tests__/scene-synchronizer.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L16: import { SrtCaption } from '../srt-parser';
- RISK-0731 (medium, Parser Or Heuristic) in `src/remotion/__tests__/srt-parser.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `parse`
- RISK-0732 (low, High Attention File) in `src/remotion/__tests__/srt-parser.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Tests for srt-parser.ts
- RISK-0733 (low, High Attention File) in `src/remotion/animation-strategies.ts`: The digest found several implementation signals worth manual review. Evidence: L12: /** Edge drawing duration: 0.5s = 15 frames at 30fps */
- RISK-0734 (medium, Concurrency Or Timing) in `src/remotion/renderer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L206: export async function renderVideo(
- RISK-0735 (medium, Parser Or Heuristic) in `src/remotion/scene-synchronizer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L10: import { SrtCaption } from './srt-parser';
- RISK-0736 (low, High Attention File) in `src/remotion/scene-synchronizer.ts`: The digest found several implementation signals worth manual review. Evidence: L10: import { SrtCaption } from './srt-parser';
- RISK-0737 (medium, Parser Or Heuristic) in `src/remotion/srt-parser.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `parse`
- RISK-0738 (low, High Attention File) in `src/remotion/srt-parser.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * SRT (SubRip Text) Format Parser

## Files

- `src/remotion/CaptionOverlay.tsx` — tsx, 222 lines, attention 28
- `src/remotion/DiagramScene.tsx` — tsx, 185 lines, attention 0
- `src/remotion/DiagramVideo.tsx` — tsx, 106 lines, attention 0
- `src/remotion/EdgeAnimation.tsx` — tsx, 128 lines, attention 100
- `src/remotion/NodeAnimation.tsx` — tsx, 99 lines, attention 0
- `src/remotion/Root.tsx` — tsx, 41 lines, attention 14
- `src/remotion/Video.tsx` — tsx, 199 lines, attention 0
- `src/remotion/__tests__/CaptionOverlay.test.tsx` — tsx, 312 lines, attention 28
- `src/remotion/__tests__/DiagramScene.test.tsx` — tsx, 340 lines, attention 56
- `src/remotion/__tests__/EdgeAnimation.test.tsx` — tsx, 312 lines, attention 100
- `src/remotion/__tests__/NodeAnimation.test.tsx` — tsx, 221 lines, attention 14
- `src/remotion/__tests__/Root.test.tsx` — tsx, 142 lines, attention 0
- `src/remotion/__tests__/Video.test.tsx` — tsx, 344 lines, attention 14
- `src/remotion/__tests__/animation-strategies.test.ts` — typescript, 433 lines, attention 100
- `src/remotion/__tests__/renderer.test.ts` — typescript, 488 lines, attention 0
- `src/remotion/__tests__/scene-synchronizer.test.ts` — typescript, 525 lines, attention 14
- `src/remotion/__tests__/srt-parser.test.ts` — typescript, 264 lines, attention 100
- `src/remotion/animation-strategies.ts` — typescript, 285 lines, attention 100
- `src/remotion/index.ts` — typescript, 10 lines, attention 0
- `src/remotion/renderer.ts` — typescript, 217 lines, attention 0
- `src/remotion/scene-synchronizer.ts` — typescript, 320 lines, attention 70
- `src/remotion/srt-parser.ts` — typescript, 152 lines, attention 100
