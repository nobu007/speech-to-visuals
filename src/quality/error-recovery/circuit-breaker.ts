/**
 * Circuit breaker primitives for the enhanced error-recovery system.
 *
 * CircuitBreaker (moved verbatim from enhanced-error-recovery.ts) plus a
 * small registry owning the per-stage breaker map: stage initialization,
 * lazy get-or-create, periodic state evaluation (emitting
 * circuit_breaker:change events), and bulk reset.
 */

import { logger } from '@stv/core/utils/logger';
import { errorRecoveryEventBus } from '../error-recovery-event-bus';
import type { ProcessingStage } from './types';

/**
 * Simple circuit breaker implementation
 */
export class CircuitBreaker {
  private _failures = 0;
  private _lastFailureTime = 0;
  private _state: 'closed' | 'open' | 'half-open' = 'closed';
  private _successCount = 0;

  constructor(
    private options: {
      threshold: number;
      timeout: number;
      monitor?: (error: Error) => void;
    }
  ) {}

  /** Current state of the circuit breaker */
  get state(): 'closed' | 'open' | 'half-open' {
    return this._state;
  }
  set state(value: 'closed' | 'open' | 'half-open') {
    this._state = value;
  }

  /** Number of consecutive failures */
  get failureCount(): number {
    return this._failures;
  }
  set failureCount(value: number) {
    this._failures = value;
  }

  /** Number of consecutive successes (used in half-open state) */
  get successCount(): number {
    return this._successCount;
  }
  set successCount(value: number) {
    this._successCount = value;
  }

  /** Timestamp of the last failure */
  get lastFailureTime(): number {
    return this._lastFailureTime;
  }
  set lastFailureTime(value: number) {
    this._lastFailureTime = value;
  }

  /** Failure threshold to open the breaker */
  get threshold(): number {
    return this.options.threshold;
  }

  /** Recovery timeout in milliseconds */
  get timeout(): number {
    return this.options.timeout;
  }

  isOpen(): boolean {
    if (this._state === 'open') {
      if (Date.now() - this._lastFailureTime > this.options.timeout) {
        this._state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this._failures = 0;
    this._state = 'closed';
    this._successCount = 0;
  }

  recordFailure(): void {
    this._failures++;
    this._lastFailureTime = Date.now();

    if (this._failures >= this.options.threshold) {
      this._state = 'open';
      if (this.options.monitor) {
        this.options.monitor(new Error(`Circuit breaker opened after ${this._failures} failures`));
      }
    }
  }
}

/**
 * Global error recovery instance
 */

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(options: { threshold: number; timeout: number }) {
    const stages: ProcessingStage[] = [
      'transcription', 'segmentation', 'analysis',
      'diagram_detection', 'layout_generation', 'animation', 'rendering', 'export'
    ];

    for (const stage of stages) {
      this.breakers.set(stage, new CircuitBreaker({
        threshold: options.threshold,
        timeout: options.timeout
      }));
    }
  }

  /** The live per-stage breaker map (read view for metrics/snapshots). */
  all(): Map<string, CircuitBreaker> {
    return this.breakers;
  }

  /** Get the breaker for a stage, creating a default one if absent. */
  getOrCreate(stage: ProcessingStage): CircuitBreaker {
    let breaker = this.breakers.get(stage);
    if (!breaker) {
      breaker = new CircuitBreaker({
        threshold: 5,
        timeout: 60000, // 1 minute
        monitor: (err) => logger.warn(`Circuit breaker tripped for ${stage}:`, err)
      });
      this.breakers.set(stage, breaker);
    }
    return breaker;
  }

  /**
   * Evaluate and update circuit breaker states
   */
  evaluate(): void {
    const now = Date.now();

    for (const [stage, breaker] of this.breakers.entries()) {
      const previousState = breaker.state;

      switch (breaker.state) {
        case 'open':
          if (now - breaker.lastFailureTime > breaker.timeout) {
            breaker.state = 'half-open';
          }
          break;

        case 'half-open':
          if (breaker.successCount >= 3) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.successCount = 0;
          } else if (breaker.failureCount > 0) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
          }
          break;

        case 'closed':
          if (breaker.failureCount >= breaker.threshold) {
            breaker.state = 'open';
            breaker.lastFailureTime = now;
          }
          break;
      }

      if (breaker.state !== previousState) {
        errorRecoveryEventBus.emit('circuit_breaker:change', {
          stage,
          previousState,
          newState: breaker.state,
          failureCount: breaker.failureCount,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Enhanced queue processing with adaptive scheduling
   */

  /**
   * Reset all circuit breakers to the closed state.
   */
  reset(): void {
    for (const breaker of this.breakers.values()) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
    }
  }
}
