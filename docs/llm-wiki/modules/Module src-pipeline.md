---
title: Module src-pipeline
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
# Module src-pipeline

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 27
- Bytes: 333195

## Key Files

- `src/pipeline/main-pipeline.ts`
- `src/pipeline/parallel-layout-executor.ts`
- `src/pipeline/adaptive-quality-presets.ts`
- `src/pipeline/bottleneck-detector.ts`
- `src/pipeline/cost-efficiency-metrics.ts`
- `src/pipeline/framework-integrated-pipeline.ts`
- `src/pipeline/improvement-detector.ts`
- `src/pipeline/index.ts`

## Risk Signals

- RISK-0652 (low, High Attention File) in `src/pipeline/__tests__/adaptive-quality-presets.test.ts`: The digest found several implementation signals worth manual review. Evidence: L56: expect(preset.expectedMetrics).toHaveProperty('memoryUsageMax');
- RISK-0653 (medium, Parser Or Heuristic) in `src/pipeline/__tests__/improvement-detector.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L38: fallbackTriggered: false,
- RISK-0654 (low, High Attention File) in `src/pipeline/__tests__/improvement-detector.test.ts`: The digest found several implementation signals worth manual review. Evidence: L34: memoryUsage: 300,
- RISK-0655 (medium, Parser Or Heuristic) in `src/pipeline/__tests__/pipeline-quality-monitor.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L62: fallbackTriggered: false,
- RISK-0656 (medium, Persistence Or State) in `src/pipeline/__tests__/pipeline-quality-monitor.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L90: cacheHitRate: 0.8,
- RISK-0657 (low, High Attention File) in `src/pipeline/__tests__/pipeline-quality-monitor.test.ts`: The digest found several implementation signals worth manual review. Evidence: L58: memoryUsage: 300,
- RISK-0658 (medium, Concurrency Or Timing) in `src/pipeline/__tests__/retry.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L13: const { result } = await retryWithBackoff(fn);
- RISK-0659 (low, High Attention File) in `src/pipeline/__tests__/retry.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Unit tests for src/pipeline/retry.ts — retryWithBackoff
- RISK-0660 (medium, Concurrency Or Timing) in `src/pipeline/__tests__/simple-pipeline.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L378: it('should retry on failure and eventually succeed', async () => {
- RISK-0661 (low, High Attention File) in `src/pipeline/__tests__/simple-pipeline.test.ts`: The digest found several implementation signals worth manual review. Evidence: L377: describe('processWithRetry', () => {
- RISK-0662 (medium, Parser Or Heuristic) in `src/pipeline/__tests__/video-generator.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L218: content: 'Scene without layout data for testing fallback behavior',
- RISK-0663 (high, Security Boundary) in `src/pipeline/adaptive-quality-presets.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L38: llmMaxTokens: number;
- RISK-0664 (medium, Concurrency Or Timing) in `src/pipeline/adaptive-quality-presets.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L39: llmTimeout: number;
- RISK-0665 (medium, Persistence Or State) in `src/pipeline/adaptive-quality-presets.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L40: enableLLMCache: boolean;
- RISK-0666 (low, High Attention File) in `src/pipeline/adaptive-quality-presets.ts`: The digest found several implementation signals worth manual review. Evidence: L38: llmMaxTokens: number;
- RISK-0667 (high, Security Boundary) in `src/pipeline/cost-efficiency-metrics.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L6: *   - tokens per analysis (total tokens / analysis count)
- RISK-0668 (low, High Attention File) in `src/pipeline/cost-efficiency-metrics.ts`: The digest found several implementation signals worth manual review. Evidence: L6: *   - tokens per analysis (total tokens / analysis count)
- RISK-0669 (low, High Attention File) in `src/pipeline/framework-integrated-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L19: import { getHeapUsed } from '@/utils/memory-usage';
- RISK-0670 (low, High Attention File) in `src/pipeline/improvement-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L46: private qualityMonitor: QualityMonitor;
- RISK-0671 (medium, Concurrency Or Timing) in `src/pipeline/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L3: export { retryWithBackoff } from './retry';
- RISK-0672 (medium, Concurrency Or Timing) in `src/pipeline/main-pipeline.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L678: const layouts = (await Promise.all(layoutPromises)).filter(Boolean);
- RISK-0673 (medium, Persistence Or State) in `src/pipeline/main-pipeline.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L8: import { globalCache } from '@/performance/intelligent-cache';
- RISK-0674 (low, High Attention File) in `src/pipeline/main-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L8: import { globalCache } from '@/performance/intelligent-cache';
- RISK-0675 (medium, Parser Or Heuristic) in `src/pipeline/parallel-benchmark.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L60: const parallelMs = par?.durationMs ?? seq.durationMs; // fallback: treat as sequential
- RISK-0676 (medium, Concurrency Or Timing) in `src/pipeline/parallel-layout-executor.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L27: export async function runWithConcurrency<T, R>(
- RISK-0677 (low, High Attention File) in `src/pipeline/parallel-layout-executor.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * with configurable concurrency limits and optional retry support.
- RISK-0678 (low, High Attention File) in `src/pipeline/performance-baseline.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * Defines timing and memory baselines for each pipeline stage.
- RISK-0679 (high, Security Boundary) in `src/pipeline/pipeline-health-score.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L10: *   - Cost efficiency: 25% (cost/token regression)
- RISK-0680 (low, High Attention File) in `src/pipeline/pipeline-health-score.ts`: The digest found several implementation signals worth manual review. Evidence: L10: *   - Cost efficiency: 25% (cost/token regression)
- RISK-0681 (medium, Parser Or Heuristic) in `src/pipeline/pipeline-orchestrator.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L10: * - 3-tier fallback chain when quality gates fail
- RISK-0682 (low, High Attention File) in `src/pipeline/pipeline-orchestrator.ts`: The digest found several implementation signals worth manual review. Evidence: L10: * - 3-tier fallback chain when quality gates fail
- RISK-0683 (medium, Parser Or Heuristic) in `src/pipeline/quality-monitor.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L35: fallbackTriggered: boolean;
- RISK-0684 (medium, Persistence Or State) in `src/pipeline/quality-monitor.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L18: cacheHitRate?: number; // 0-1
- RISK-0685 (low, High Attention File) in `src/pipeline/quality-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L17: memoryUsage: number; // MB
- RISK-0686 (high, Security Boundary) in `src/pipeline/retry.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L6: * (UNKNOWN type, auth failures, etc.) propagate immediately.
- RISK-0687 (medium, Concurrency Or Timing) in `src/pipeline/retry.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L47: export async function retryWithBackoff<T>(
- RISK-0688 (low, High Attention File) in `src/pipeline/retry.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Pipeline retry with exponential backoff, driven by ErrorClassifier.
- RISK-0689 (medium, Concurrency Or Timing) in `src/pipeline/simple-pipeline.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L226: const processScene = async (segment: unknown, index: number): Promise<SceneGraph | null> => {
- RISK-0690 (low, High Attention File) in `src/pipeline/simple-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L15: import { getHeapUsed } from '@/utils/memory-usage';
- RISK-0691 (medium, Concurrency Or Timing) in `src/pipeline/stage-timing-metrics.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L70: export async function timeStage<T>(
- RISK-0692 (low, High Attention File) in `src/pipeline/stage-timing-metrics.ts`: The digest found several implementation signals worth manual review. Evidence: L16: /** Number of retry attempts that occurred during this stage (0 = no retries) */
- RISK-0693 (medium, Concurrency Or Timing) in `src/pipeline/types.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L103: /** Total retry attempts across all stages (for observability) */
- RISK-0694 (low, High Attention File) in `src/pipeline/types.ts`: The digest found several implementation signals worth manual review. Evidence: L78: * All fields are optional to remain backward-compatible with existing pipeline outputs.
- RISK-0695 (medium, Concurrency Or Timing) in `src/pipeline/video-generator.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L78: : 2; // Fallback to 2 threads
- RISK-0696 (medium, Parser Or Heuristic) in `src/pipeline/video-generator.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L78: : 2; // Fallback to 2 threads
- RISK-0697 (low, High Attention File) in `src/pipeline/video-generator.ts`: The digest found several implementation signals worth manual review. Evidence: L65: private iteration: number = 1;

## Files

- `src/pipeline/__tests__/adaptive-quality-presets.test.ts` — typescript, 389 lines, attention 70
- `src/pipeline/__tests__/improvement-detector.test.ts` — typescript, 492 lines, attention 100
- `src/pipeline/__tests__/pipeline-errors.test.ts` — typescript, 87 lines, attention 0
- `src/pipeline/__tests__/pipeline-quality-monitor.test.ts` — typescript, 1153 lines, attention 100
- `src/pipeline/__tests__/retry.test.ts` — typescript, 188 lines, attention 100
- `src/pipeline/__tests__/simple-pipeline.test.ts` — typescript, 486 lines, attention 70
- `src/pipeline/__tests__/video-generator.test.ts` — typescript, 466 lines, attention 14
- `src/pipeline/adaptive-quality-presets.ts` — typescript, 387 lines, attention 100
- `src/pipeline/bottleneck-detector.ts` — typescript, 93 lines, attention 0
- `src/pipeline/cost-efficiency-metrics.ts` — typescript, 110 lines, attention 100
- `src/pipeline/framework-integrated-pipeline.ts` — typescript, 458 lines, attention 100
- `src/pipeline/improvement-detector.ts` — typescript, 435 lines, attention 100
- `src/pipeline/index.ts` — typescript, 16 lines, attention 28
- `src/pipeline/main-pipeline.ts` — typescript, 1298 lines, attention 100
- `src/pipeline/parallel-benchmark.ts` — typescript, 104 lines, attention 14
- `src/pipeline/parallel-layout-executor.ts` — typescript, 106 lines, attention 100
- `src/pipeline/performance-baseline.ts` — typescript, 76 lines, attention 100
- `src/pipeline/performance-regression-detector.ts` — typescript, 103 lines, attention 0
- `src/pipeline/pipeline-errors.ts` — typescript, 101 lines, attention 0
- `src/pipeline/pipeline-health-score.ts` — typescript, 244 lines, attention 100
- `src/pipeline/pipeline-orchestrator.ts` — typescript, 1113 lines, attention 100
- `src/pipeline/quality-monitor.ts` — typescript, 657 lines, attention 100
- `src/pipeline/retry.ts` — typescript, 98 lines, attention 100
- `src/pipeline/simple-pipeline.ts` — typescript, 775 lines, attention 100
- `src/pipeline/stage-timing-metrics.ts` — typescript, 82 lines, attention 98
- `src/pipeline/types.ts` — typescript, 116 lines, attention 70
- `src/pipeline/video-generator.ts` — typescript, 627 lines, attention 100
