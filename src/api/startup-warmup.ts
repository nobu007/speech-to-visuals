/**
 * REQ-202: Startup cache warmup helper
 *
 * Encapsulates the fire-and-forget cache warmup logic so it can be
 * tested independently from the Express server lifecycle.
 *
 * Tracks warmup status (pending → completed/failed/skipped) and exposes
 * it via getWarmupStatus() so monitoring/health endpoints can report
 * whether the cache was warmed before the first LLM query.
 */

import type { LLMService } from '../analysis/llm-service';
import { logger } from '../utils/logger';

export type WarmupStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface WarmupStatusInfo {
  status: WarmupStatus;
  timestamp?: string;
  patternsProcessed?: number;
  error?: string;
}

let warmupStatusInfo: WarmupStatusInfo = { status: 'pending' };

/**
 * Get the current warmup status for observability/health checks.
 */
export function getWarmupStatus(): WarmupStatusInfo {
  return { ...warmupStatusInfo };
}

/**
 * Reset warmup status (for testing).
 */
export function resetWarmupStatus(): void {
  warmupStatusInfo = { status: 'pending' };
}

/**
 * Trigger cache warmup if the LLM service is enabled.
 *
 * Non-blocking: returns immediately while warmup runs in the background.
 * Failures are logged but never propagate (non-fatal).
 */
export function triggerStartupWarmup(service: LLMService): void {
  if (!service.isEnabled()) {
    warmupStatusInfo = { status: 'skipped', timestamp: new Date().toISOString() };
    return;
  }

  service.warmupCache()
    .then((warmed) => {
      const stats = service.getCacheWarmupStats();
      if (warmed) {
        warmupStatusInfo = {
          status: 'completed',
          timestamp: new Date().toISOString(),
          patternsProcessed: stats.totalPatternsProcessed,
        };
        logger.info('[startup] Cache warmup completed successfully');
      } else {
        warmupStatusInfo = {
          status: 'skipped',
          timestamp: new Date().toISOString(),
        };
      }
    })
    .catch((err: unknown) => {
      warmupStatusInfo = {
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      };
      logger.warn('[startup] Cache warmup failed (non-fatal):', err);
    });
}
