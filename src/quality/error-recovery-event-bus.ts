/**
 * ErrorRecoveryEventBus: Typed event emitter for error recovery lifecycle.
 *
 * Bridges the EnhancedErrorRecovery internals to external consumers
 * (WebSocket progress, monitoring dashboards, alerting) via a lightweight
 * publish/subscribe model.  No external dependencies — pure TypeScript.
 *
 * Events are emitted at key lifecycle moments:
 * - Circuit breaker state transitions
 * - Recovery strategy attempts / outcomes
 * - Stage degradation detection
 * - Dynamic capacity adjustments
 * - Error cascade detection
 */

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/** Emitted when a circuit breaker transitions state. */
export interface CircuitBreakerEvent {
  stage: string;
  previousState: CircuitBreakerState;
  newState: CircuitBreakerState;
  failureCount: number;
  timestamp: number;
}

/** Emitted when a recovery strategy is attempted. */
export interface RecoveryAttemptEvent {
  stage: string;
  strategyId: string;
  strategyName: string;
  attemptNumber: number;
  timestamp: number;
}

/** Emitted when a recovery succeeds. */
export interface RecoverySuccessEvent {
  stage: string;
  strategyId: string;
  timeSpentMs: number;
  fallbackUsed: boolean;
  timestamp: number;
}

/** Emitted when a recovery fails. */
export interface RecoveryFailureEvent {
  stage: string;
  strategyId: string;
  timeSpentMs: number;
  nextAction: 'retry' | 'fallback' | 'escalate' | 'abort';
  timestamp: number;
}

/** Emitted when dynamic capacity is adjusted. */
export interface CapacityAdjustedEvent {
  previousCapacity: number;
  newCapacity: number;
  healthScore: number;
  timestamp: number;
}

/** Emitted when a stage's health drops below the degradation threshold. */
export interface StageDegradedEvent {
  stage: string;
  score: number;
  threshold: number;
  trend: 'improving' | 'stable' | 'degrading';
  timestamp: number;
}

/** Emitted when an error cascade is detected across pipeline stages. */
export interface CascadeDetectedEvent {
  triggerStage: string;
  affectedStages: string[];
  rootCause: string;
  frequency: number;
  timestamp: number;
}

/** Emitted when the request queue exceeds dynamic capacity. */
export interface QueueOverflowEvent {
  queueLength: number;
  dynamicCapacity: number;
  oldestQueuedAt: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Event name → payload mapping
// ---------------------------------------------------------------------------

export interface ErrorRecoveryEventMap {
  'circuit_breaker:change': CircuitBreakerEvent;
  'recovery:attempt': RecoveryAttemptEvent;
  'recovery:success': RecoverySuccessEvent;
  'recovery:failure': RecoveryFailureEvent;
  'capacity:adjusted': CapacityAdjustedEvent;
  'stage:degraded': StageDegradedEvent;
  'cascade:detected': CascadeDetectedEvent;
  'queue:overflow': QueueOverflowEvent;
}

export type ErrorRecoveryEventType = keyof ErrorRecoveryEventMap;

type EventListener<T> = (payload: T) => void;

// ---------------------------------------------------------------------------
// ErrorRecoveryEventBus
// ---------------------------------------------------------------------------

/**
 * Lightweight typed event bus for error recovery lifecycle events.
 *
 * Usage:
 * ```ts
 * const bus = errorRecoveryEventBus;
 *
 * bus.on('circuit_breaker:change', (evt) => {
 *   websocket.to(`job:${jobId}`).emit('error_recovery:circuit_breaker', evt);
 * });
 *
 * bus.on('recovery:success', (evt) => {
 *   logger.info(`Recovery succeeded for ${evt.stage} via ${evt.strategyId}`);
 * });
 * ```
 */
export class ErrorRecoveryEventBus {
  private readonly listeners = new Map<string, Set<EventListener<unknown>>>();
  private readonly onceListeners = new Map<string, Set<EventListener<unknown>>>();
  private readonly history: Array<{ event: string; payload: unknown; timestamp: number }> = [];
  private readonly maxHistory: number;
  private muted = false;

  constructor(options?: { maxHistory?: number }) {
    this.maxHistory = options?.maxHistory ?? 200;
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Subscribe to an event.  Returns an unsubscribe function.
   */
  on<E extends ErrorRecoveryEventType>(
    event: E,
    listener: EventListener<ErrorRecoveryEventMap[E]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown>);
    return () => this.off(event, listener);
  }

  /**
   * Subscribe to an event for a single invocation only.
   */
  once<E extends ErrorRecoveryEventType>(
    event: E,
    listener: EventListener<ErrorRecoveryEventMap[E]>,
  ): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(listener as EventListener<unknown>);
    return () => {
      const set = this.onceListeners.get(event);
      if (set) set.delete(listener as EventListener<unknown>);
    };
  }

  /**
   * Unsubscribe a listener from an event.
   */
  off<E extends ErrorRecoveryEventType>(
    event: E,
    listener: EventListener<ErrorRecoveryEventMap[E]>,
  ): void {
    this.listeners.get(event)?.delete(listener as EventListener<unknown>);
    this.onceListeners.get(event)?.delete(listener as EventListener<unknown>);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<E extends ErrorRecoveryEventType>(
    event: E,
    payload: ErrorRecoveryEventMap[E],
  ): void {
    if (this.muted) return;

    // Record in history
    this.history.push({ event, payload, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Deliver to persistent listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const fn of listeners) {
        try { fn(payload); } catch { /* swallow listener errors */ }
      }
    }

    // Deliver to once-only listeners and clean up
    const once = this.onceListeners.get(event);
    if (once) {
      for (const fn of once) {
        try { fn(payload); } catch { /* swallow listener errors */ }
      }
      once.clear();
    }
  }

  /**
   * Remove all listeners, optionally for a single event only.
   */
  removeAllListeners(event?: ErrorRecoveryEventType): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: ErrorRecoveryEventType): number {
    return (this.listeners.get(event)?.size ?? 0) + (this.onceListeners.get(event)?.size ?? 0);
  }

  /**
   * Return event history, optionally filtered by event type.
   */
  getHistory(): Array<{ event: string; payload: unknown; timestamp: number }>;
  getHistory<E extends ErrorRecoveryEventType>(event: E): Array<{ event: string; payload: ErrorRecoveryEventMap[E]; timestamp: number }>;
  getHistory<E extends ErrorRecoveryEventType>(
    event?: E,
  ): Array<{ event: string; payload: unknown; timestamp: number }> {
    if (event) {
      return this.history.filter(h => h.event === event) as unknown as Array<{ event: string; payload: unknown; timestamp: number }>;
    }
    return [...this.history] as Array<{ event: string; payload: unknown; timestamp: number }>;
  }

  /**
   * Clear event history.
   */
  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Temporarily suppress all event emissions (for tests or batch operations).
   */
  mute(): void {
    this.muted = true;
  }

  /**
   * Resume event emissions after a `mute()`.
   */
  unmute(): void {
    this.muted = false;
  }

  /** Whether the bus is currently muted. */
  get isMuted(): boolean {
    return this.muted;
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const errorRecoveryEventBus = new ErrorRecoveryEventBus();
