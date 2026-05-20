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
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Module src-quality

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 9
- Bytes: 209039

## Key Files

- `src/quality/adaptive-quality-gates.ts`
- `src/quality/enhanced-error-recovery.ts`
- `src/quality/error-classifier.ts`
- `src/quality/index.ts`
- `src/quality/quality-gate.ts`
- `src/quality/quality-monitor.ts`
- `src/quality/regression-detector.ts`
- `src/quality/user-guided-error-recovery.ts`

## Risk Signals

- RISK-0699 (high, Security Boundary) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L51: sessionId: 'test-session',
- RISK-0700 (medium, Concurrency Or Timing) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff,
- RISK-0701 (medium, Parser Or Heuristic) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L4: * executeWithFallback, createErrorNotification, load balancing, resilience metrics,
- RISK-0702 (medium, Persistence Or State) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: // Mock the intelligent-cache module - define mocks outside factory for test access
- RISK-0703 (low, High Attention File) in `src/quality/__tests__/enhanced-error-recovery.test.ts`: The digest found several implementation signals worth manual review. Evidence: L3: * Covers: EnhancedErrorRecovery class, CircuitBreaker, retryWithBackoff,
- RISK-0704 (medium, Persistence Or State) in `src/quality/adaptive-quality-gates.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L121: name: 'LLM Cache Hit Rate',
- RISK-0705 (low, High Attention File) in `src/quality/adaptive-quality-gates.ts`: The digest found several implementation signals worth manual review. Evidence: L9: import { realTimeMonitor, PerformanceSnapshot } from '@/monitoring/real-time-performance-monitor';
- RISK-0706 (high, Security Boundary) in `src/quality/enhanced-error-recovery.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L23: sessionId: string;
- RISK-0707 (medium, Concurrency Or Timing) in `src/quality/enhanced-error-recovery.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L72: timeout: number;
- RISK-0708 (medium, Parser Or Heuristic) in `src/quality/enhanced-error-recovery.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L41: fallbackUsed: boolean;
- RISK-0709 (medium, Persistence Or State) in `src/quality/enhanced-error-recovery.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: import { globalCache } from '../performance/intelligent-cache';
- RISK-0710 (low, High Attention File) in `src/quality/enhanced-error-recovery.ts`: The digest found several implementation signals worth manual review. Evidence: L10: import { globalCache } from '../performance/intelligent-cache';
- RISK-0711 (medium, Concurrency Or Timing) in `src/quality/error-classifier.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L21: | 'LLM_TIMEOUT'
- RISK-0712 (low, High Attention File) in `src/quality/error-classifier.ts`: The digest found several implementation signals worth manual review. Evidence: L21: | 'LLM_TIMEOUT'
- RISK-0713 (medium, Concurrency Or Timing) in `src/quality/index.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L21: RetryOptions,
- RISK-0714 (medium, Parser Or Heuristic) in `src/quality/index.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L23: FallbackResult,
- RISK-0715 (medium, Concurrency Or Timing) in `src/quality/quality-gate.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0716 (medium, Parser Or Heuristic) in `src/quality/quality-gate.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0717 (low, High Attention File) in `src/quality/quality-gate.ts`: The digest found several implementation signals worth manual review. Evidence: L39: fallbackAction?: 'retry' | 'skip' | 'abort';
- RISK-0718 (medium, Concurrency Or Timing) in `src/quality/quality-monitor.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L184: private async assessPerformance(result: PipelineResult): Promise<number> {
- RISK-0719 (low, High Attention File) in `src/quality/quality-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L15: memoryUsage: number;
- RISK-0720 (medium, Parser Or Heuristic) in `src/quality/regression-detector.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L133: const parsed = JSON.parse(data);
- RISK-0721 (low, High Attention File) in `src/quality/regression-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L64: private static instance: RegressionDetector;
- RISK-0722 (medium, Concurrency Or Timing) in `src/quality/user-guided-error-recovery.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L118: const result = await retryFunction();
- RISK-0723 (medium, Parser Or Heuristic) in `src/quality/user-guided-error-recovery.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L7: * - Automatic retry with fallback strategies
- RISK-0724 (low, High Attention File) in `src/quality/user-guided-error-recovery.ts`: The digest found several implementation signals worth manual review. Evidence: L7: * - Automatic retry with fallback strategies

## Files

- `src/quality/__tests__/enhanced-error-recovery.test.ts` — typescript, 1332 lines, attention 100
- `src/quality/adaptive-quality-gates.ts` — typescript, 580 lines, attention 100
- `src/quality/enhanced-error-recovery.ts` — typescript, 1744 lines, attention 100
- `src/quality/error-classifier.ts` — typescript, 275 lines, attention 100
- `src/quality/index.ts` — typescript, 33 lines, attention 56
- `src/quality/quality-gate.ts` — typescript, 671 lines, attention 100
- `src/quality/quality-monitor.ts` — typescript, 799 lines, attention 100
- `src/quality/regression-detector.ts` — typescript, 460 lines, attention 100
- `src/quality/user-guided-error-recovery.ts` — typescript, 600 lines, attention 100
