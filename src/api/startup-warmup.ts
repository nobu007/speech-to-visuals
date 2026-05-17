/**
 * REQ-202: Startup cache warmup helper
 *
 * Encapsulates the fire-and-forget cache warmup logic so it can be
 * tested independently from the Express server lifecycle.
 */

import type { LLMService } from '../analysis/llm-service';
import { logger } from '../utils/logger';

/**
 * Trigger cache warmup if the LLM service is enabled.
 *
 * Non-blocking: returns immediately while warmup runs in the background.
 * Failures are logged but never propagate (non-fatal).
 */
export function triggerStartupWarmup(service: LLMService): void {
  if (!service.isEnabled()) {
    return;
  }

  service.warmupCache()
    .then((warmed) => {
      if (warmed) {
        logger.info('[startup] Cache warmup completed successfully');
      }
    })
    .catch((err: unknown) => {
      logger.warn('[startup] Cache warmup failed (non-fatal):', err);
    });
}
