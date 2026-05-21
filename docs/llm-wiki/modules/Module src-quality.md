---
title: Module src-quality
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
# Module src-quality

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 16
- Bytes: 327777

## Key Files

- `src/quality/adaptive-quality-gates.ts`
- `src/quality/batch-operation-recovery.ts`
- `src/quality/enhanced-error-recovery.ts`
- `src/quality/error-classifier.ts`
- `src/quality/error-recovery-event-bus.ts`
- `src/quality/error-recovery-health-tracker.ts`
- `src/quality/error-recovery-monitor.ts`
- `src/quality/index.ts`

## Risk Signals

- RISK-0698 (high, Security Boundary) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L51: sessionId: 'test-session',
- RISK-0699 (medium, Concurrency Or Timing) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff,
- RISK-0700 (medium, Parser Or Heuristic) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L4: * executeWithFallback, createErrorNotification, load balancing, resilience metrics,
- RISK-0701 (medium, Persistence Or State) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: // Mock the intelligent-cache module - define mocks outside factory for test access
- RISK-0702 (low, High Attention File) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: The digest found several implementation signals worth manual review. Evidence: L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff,
- RISK-0703 (medium, Persistence Or State) in `src/quality/adaptive-quality-gates.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L121: name: 'LLM Cache Hit Rate',
- RISK-0704 (low, High Attention File) in `src/quality/adaptive-quality-gates.ts`: The digest found several implementation signals worth manual review. Evidence: L9: import { realTimeMonitor, PerformanceSnapshot } from '@/monitoring/real-time-performance-monitor';
- RISK-0705 (medium, Concurrency Or Timing) in `src/quality/batch-operation-recovery.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L23: retryDelayMs: number;
- RISK-0706 (medium, Parser Or Heuristic) in `src/quality/batch-operation-recovery.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L20: /** Maximum retries per item before using fallback. Default 2. */
- RISK-0707 (low, High Attention File) in `src/quality/batch-operation-recovery.ts`: The digest found several implementation signals worth manual review. Evidence: L20: /** Maximum retries per item before using fallback. Default 2. */
- RISK-0708 (high, Security Boundary) in `src/quality/enhanced-error-recovery.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L24: sessionId: string;
- RISK-0709 (medium, Concurrency Or Timing) in `src/quality/enhanced-error-recovery.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L157: timeout: number;
- RISK-0710 (medium, Parser Or Heuristic) in `src/quality/enhanced-error-recovery.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L42: fallbackUsed: boolean;
- RISK-0711 (medium, Persistence Or State) in `src/quality/enhanced-error-recovery.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: import { globalCache } from '../performance/intelligent-cache';
- RISK-0712 (low, High Attention File) in `src/quality/enhanced-error-recovery.ts`: The digest found several implementation signals worth manual review. Evidence: L10: import { globalCache } from '../performance/intelligent-cache';
- RISK-0713 (medium, Concurrency Or Timing) in `src/quality/error-classifier.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L21: | 'LLM_TIMEOUT'
- RISK-0714 (low, High Attention File) in `src/quality/error-classifier.ts`: The digest found several implementation signals worth manual review. Evidence: L21: | 'LLM_TIMEOUT'
- RISK-0715 (medium, Network Or IPC) in `src/quality/error-recovery-event-bus.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L5: * (WebSocket progress, monitoring dashboards, alerting) via a lightweight
- RISK-0716 (medium, Concurrency Or Timing) in `src/quality/error-recovery-event-bus.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L54: nextAction: 'retry' | 'fallback' | 'escalate' | 'abort';
- RISK-0717 (medium, Parser Or Heuristic) in `src/quality/error-recovery-event-bus.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L45: fallbackUsed: boolean;
- RISK-0718 (medium, Persistence Or State) in `src/quality/error-recovery-event-bus.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L20: export type CircuitBreakerState = 'closed' | 'open' | 'half-open';
- RISK-0719 (low, High Attention File) in `src/quality/error-recovery-event-bus.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * Bridges the EnhancedErrorRecovery internals to external consumers
- RISK-0720 (low, High Attention File) in `src/quality/error-recovery-health-tracker.ts`: The digest found several implementation signals worth manual review. Evidence: L80: private readonly recovery: EnhancedErrorRecovery;
- RISK-0721 (medium, Network Or IPC) in `src/quality/error-recovery-monitor.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L6: *   - ErrorRecoveryEventBus     → typed lifecycle events for WebSocket / alerts
- RISK-0722 (low, High Attention File) in `src/quality/error-recovery-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * Bridges the individually-tested modules into a cohesive runtime service:
- RISK-0723 (medium, Concurrency Or Timing) in `src/quality/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L21: RetryOptions,
- RISK-0724 (medium, Parser Or Heuristic) in `src/quality/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L23: FallbackResult,
- RISK-0725 (medium, Parser Or Heuristic) in `src/quality/pipeline-error-recovery-orchestrator.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L10: *  2. Uses the strategy chain for sequential fallback
- RISK-0726 (low, High Attention File) in `src/quality/pipeline-error-recovery-orchestrator.ts`: The digest found several implementation signals worth manual review. Evidence: L10: *  2. Uses the strategy chain for sequential fallback
- RISK-0727 (medium, Concurrency Or Timing) in `src/quality/pipeline-run-recovery-tracker.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L19: *   recoveryStrategy: 'intelligent_retry',
- RISK-0728 (medium, Parser Or Heuristic) in `src/quality/pipeline-run-recovery-tracker.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L20: *   fallbackUsed: false,
- RISK-0729 (medium, Persistence Or State) in `src/quality/pipeline-run-recovery-tracker.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L110: export interface RunStateSnapshot {
- RISK-0730 (low, High Attention File) in `src/quality/pipeline-run-recovery-tracker.ts`: The digest found several implementation signals worth manual review. Evidence: L19: *   recoveryStrategy: 'intelligent_retry',
- RISK-0731 (medium, Concurrency Or Timing) in `src/quality/quality-gate.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0732 (medium, Parser Or Heuristic) in `src/quality/quality-gate.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0733 (low, High Attention File) in `src/quality/quality-gate.ts`: The digest found several implementation signals worth manual review. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0734 (medium, Concurrency Or Timing) in `src/quality/quality-monitor.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L184: private async assessPerformance(result: PipelineResult): Promise<number> {
- RISK-0735 (low, High Attention File) in `src/quality/quality-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L15: memoryUsage: number;
- RISK-0736 (medium, Concurrency Or Timing) in `src/quality/recovery-strategy-chain.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L124: *   .then('retry', 'Retry with backoff', async () => { ... })
- RISK-0737 (medium, Parser Or Heuristic) in `src/quality/recovery-strategy-chain.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: * RecoveryStrategyChain: Composable sequential fallback chains for error recovery.
- RISK-0738 (medium, Persistence Or State) in `src/quality/recovery-strategy-chain.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L9: * - Per-stage strategy chains (e.g. transcription: retry → cache → minimal)
- RISK-0739 (low, High Attention File) in `src/quality/recovery-strategy-chain.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * RecoveryStrategyChain: Composable sequential fallback chains for error recovery.
- RISK-0740 (medium, Parser Or Heuristic) in `src/quality/regression-detector.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L133: const parsed = JSON.parse(data);
- RISK-0741 (low, High Attention File) in `src/quality/regression-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L64: private static instance: RegressionDetector;
- RISK-0742 (medium, Concurrency Or Timing) in `src/quality/user-guided-error-recovery.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L118: const result = await retryFunction();
- RISK-0743 (medium, Parser Or Heuristic) in `src/quality/user-guided-error-recovery.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L7: * - Automatic retry with fallback strategies
- RISK-0744 (low, High Attention File) in `src/quality/user-guided-error-recovery.ts`: The digest found several implementation signals worth manual review. Evidence: L7: * - Automatic retry with fallback strategies

## Files

- `src/quality/__tests__/enhanced-error-recovery.test.ts` — typescript, 1332 lines, attention 100
- `src/quality/adaptive-quality-gates.ts` — typescript, 580 lines, attention 100
- `src/quality/batch-operation-recovery.ts` — typescript, 277 lines, attention 100
- `src/quality/enhanced-error-recovery.ts` — typescript, 2776 lines, attention 100
- `src/quality/error-classifier.ts` — typescript, 275 lines, attention 100
- `src/quality/error-recovery-event-bus.ts` — typescript, 289 lines, attention 100
- `src/quality/error-recovery-health-tracker.ts` — typescript, 310 lines, attention 100
- `src/quality/error-recovery-monitor.ts` — typescript, 269 lines, attention 100
- `src/quality/index.ts` — typescript, 81 lines, attention 56
- `src/quality/pipeline-error-recovery-orchestrator.ts` — typescript, 361 lines, attention 100
- `src/quality/pipeline-run-recovery-tracker.ts` — typescript, 507 lines, attention 100
- `src/quality/quality-gate.ts` — typescript, 673 lines, attention 100
- `src/quality/quality-monitor.ts` — typescript, 799 lines, attention 100
- `src/quality/recovery-strategy-chain.ts` — typescript, 511 lines, attention 100
- `src/quality/regression-detector.ts` — typescript, 460 lines, attention 100
- `src/quality/user-guided-error-recovery.ts` — typescript, 600 lines, attention 100
