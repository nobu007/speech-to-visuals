---
title: Module src-monitoring
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
# Module src-monitoring

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 6
- Bytes: 107721

## Key Files

- `src/monitoring/health-check-service.ts`
- `src/monitoring/performance-dashboard.ts`
- `src/monitoring/production-error-handler.ts`
- `src/monitoring/production-monitor.ts`
- `src/monitoring/production-monitoring-excellence.ts`
- `src/monitoring/real-time-performance-monitor.ts`

## Risk Signals

- RISK-0607 (medium, Concurrency Or Timing) in `src/monitoring/health-check-service.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L64: checks.memory = await this.checkMemoryHealth();
- RISK-0608 (medium, Persistence Or State) in `src/monitoring/health-check-service.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L10: import { globalCache } from '@/performance/intelligent-cache';
- RISK-0609 (low, High Attention File) in `src/monitoring/health-check-service.ts`: The digest found several implementation signals worth manual review. Evidence: L9: import { realTimeMonitor, PerformanceSnapshot } from './real-time-performance-monitor';
- RISK-0610 (high, Security Boundary) in `src/monitoring/performance-dashboard.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L10: import { TokenUsageTracker, type StageType } from '../analysis/token-usage-tracker';
- RISK-0611 (medium, Persistence Or State) in `src/monitoring/performance-dashboard.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L12: import { globalCache } from '../performance/intelligent-cache';
- RISK-0612 (low, High Attention File) in `src/monitoring/performance-dashboard.ts`: The digest found several implementation signals worth manual review. Evidence: L8: import { getMemoryUsage } from '@/utils/memory-usage';
- RISK-0613 (high, Security Boundary) in `src/monitoring/production-error-handler.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L13: sessionId: string;
- RISK-0614 (medium, Concurrency Or Timing) in `src/monitoring/production-error-handler.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L61: private metricsIntervalId: NodeJS.Timeout | null = null;
- RISK-0615 (low, High Attention File) in `src/monitoring/production-error-handler.ts`: The digest found several implementation signals worth manual review. Evidence: L13: sessionId: string;
- RISK-0616 (low, High Attention File) in `src/monitoring/production-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L88: private static instance: ProductionMonitor;
- RISK-0617 (medium, Concurrency Or Timing) in `src/monitoring/production-monitoring-excellence.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L491: export async function executeMonitoringEnhancement(): Promise<MonitoringEnhancement> {
- RISK-0618 (medium, Persistence Or State) in `src/monitoring/production-monitoring-excellence.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L78: cache: HealthMetric;
- RISK-0619 (low, High Attention File) in `src/monitoring/production-monitoring-excellence.ts`: The digest found several implementation signals worth manual review. Evidence: L74: memory: HealthMetric;
- RISK-0620 (medium, Network Or IPC) in `src/monitoring/real-time-performance-monitor.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L5: * Provides WebSocket-based real-time metrics streaming for production monitoring
- RISK-0621 (medium, Persistence Or State) in `src/monitoring/real-time-performance-monitor.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L49: cacheHitRate: number;
- RISK-0622 (low, High Attention File) in `src/monitoring/real-time-performance-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * Provides WebSocket-based real-time metrics streaming for production monitoring

## Files

- `src/monitoring/health-check-service.ts` — typescript, 592 lines, attention 100
- `src/monitoring/performance-dashboard.ts` — typescript, 682 lines, attention 100
- `src/monitoring/production-error-handler.ts` — typescript, 639 lines, attention 100
- `src/monitoring/production-monitor.ts` — typescript, 571 lines, attention 100
- `src/monitoring/production-monitoring-excellence.ts` — typescript, 493 lines, attention 100
- `src/monitoring/real-time-performance-monitor.ts` — typescript, 617 lines, attention 100
