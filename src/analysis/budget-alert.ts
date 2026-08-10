/**
 * TASK-0144: Budget Alert System (REQ-098)
 *
 * Monitors cumulative session/daily cost against configurable
 * budget thresholds and fires alerts when thresholds are exceeded.
 */

import { logger } from '@/utils/logger';

export interface BudgetConfig {
  sessionBudget: number;   // e.g. 1.00 = $1.00 per session
  dailyBudget: number;     // e.g. 10.00 = $10.00 per day
  alertThreshold: number;  // e.g. 0.8 = alert at 80% of budget
}

export interface BudgetAlert {
  type: 'session' | 'daily';
  currentCost: number;
  budget: number;
  threshold: number;
  percentage: number;
  message: string;
}

export class BudgetAlertSystem {
  private config: BudgetConfig;
  private sessionCost: number = 0;
  private dailyCost: number = 0;
  private sessionAlerts: BudgetAlert[] = [];
  private dailyAlerts: BudgetAlert[] = [];
  private alertCallbacks: Array<(alert: BudgetAlert) => void> = [];
  /**
   * Re-armed edge detectors: an alert fires only on the UPWARD threshold
   * crossing, not on every `addCost` while cost stays at/above the threshold.
   * Without this, once cumulative cost crosses `alertThreshold` it never comes
   * back down (cost is monotonic up via `addCost`), so EVERY subsequent LLM
   * call pushed a new alert + logged a warning (llm-service recordApiCallMetrics)
   * — unbounded growth and log spam on the per-call hot path. Re-arming when
   * cost drops back below the threshold keeps a legitimate refund→re-cross
   * able to fire again.
   */
  private sessionAlerted: boolean = false;
  private dailyAlerted: boolean = false;

  constructor(config: Partial<BudgetConfig> = {}) {
    const sessionBudget = config.sessionBudget ?? 1.00;
    const dailyBudget = config.dailyBudget ?? 10.00;
    const alertThreshold = config.alertThreshold ?? 0.8;

    if (!Number.isFinite(sessionBudget) || sessionBudget < 0) {
      throw new BudgetConfigError('sessionBudget must be a non-negative finite number', { sessionBudget });
    }
    if (!Number.isFinite(dailyBudget) || dailyBudget < 0) {
      throw new BudgetConfigError('dailyBudget must be a non-negative finite number', { dailyBudget });
    }
    if (!Number.isFinite(alertThreshold) || alertThreshold < 0 || alertThreshold > 1) {
      throw new BudgetConfigError('alertThreshold must be a number between 0 and 1', { alertThreshold });
    }

    this.config = { sessionBudget, dailyBudget, alertThreshold };
  }

  /**
   * Add cost and check thresholds.
   * Returns any new alerts generated.
   * @throws {BudgetConfigError} if cost is not a valid non-negative finite number
   */
  addCost(cost: number): BudgetAlert[] {
    if (!Number.isFinite(cost) || cost < 0) {
      throw new BudgetConfigError('cost must be a non-negative finite number', { cost });
    }

    const newAlerts: BudgetAlert[] = [];

    this.sessionCost += cost;
    this.dailyCost += cost;

    // Check session threshold
    const sessionPct = this.config.sessionBudget > 0 && Number.isFinite(this.sessionCost)
      ? this.sessionCost / this.config.sessionBudget
      : 0;

    if (sessionPct >= this.config.alertThreshold) {
      if (!this.sessionAlerted) {
        const alert: BudgetAlert = {
          type: 'session',
          currentCost: this.sessionCost,
          budget: this.config.sessionBudget,
          threshold: this.config.alertThreshold,
          percentage: sessionPct,
          message: `Session cost $${this.sessionCost.toFixed(4)} has reached ${(sessionPct * 100).toFixed(1)}% of $${this.config.sessionBudget.toFixed(2)} budget`,
        };
        this.sessionAlerts.push(alert);
        newAlerts.push(alert);
        this.sessionAlerted = true;
      }
    } else {
      // Re-arm so a refund→re-cross (via adjustCost) can fire again.
      this.sessionAlerted = false;
    }

    // Check daily threshold
    const dailyPct = this.config.dailyBudget > 0 && Number.isFinite(this.dailyCost)
      ? this.dailyCost / this.config.dailyBudget
      : 0;

    if (dailyPct >= this.config.alertThreshold) {
      if (!this.dailyAlerted) {
        const alert: BudgetAlert = {
          type: 'daily',
          currentCost: this.dailyCost,
          budget: this.config.dailyBudget,
          threshold: this.config.alertThreshold,
          percentage: dailyPct,
          message: `Daily cost $${this.dailyCost.toFixed(4)} has reached ${(dailyPct * 100).toFixed(1)}% of $${this.config.dailyBudget.toFixed(2)} budget`,
        };
        this.dailyAlerts.push(alert);
        newAlerts.push(alert);
        this.dailyAlerted = true;
      }
    } else {
      this.dailyAlerted = false;
    }

    // Notify callbacks
    for (const alert of newAlerts) {
      for (const cb of this.alertCallbacks) {
        try { cb(alert); } catch (e) { logger.error('[BudgetAlertSystem] Callback error:', e); }
      }
    }

    return newAlerts;
  }

  /**
   * Adjust session/daily cost by a positive or negative delta.
   * Unlike addCost, this allows negative values for refunds/corrections.
   * Does not trigger alerts — used for post-hoc adjustments.
   * @throws {BudgetConfigError} if the resulting cost would be negative
   */
  adjustCost(delta: number): void {
    if (!Number.isFinite(delta)) {
      throw new BudgetConfigError('delta must be a finite number', { delta });
    }
    const newSession = this.sessionCost + delta;
    const newDaily = this.dailyCost + delta;
    if (newSession < 0 || newDaily < 0) {
      throw new BudgetConfigError('adjustment would make cost negative', {
        sessionCost: this.sessionCost,
        dailyCost: this.dailyCost,
        delta,
      });
    }
    this.sessionCost = newSession;
    this.dailyCost = newDaily;

    // Re-arm the alert edge when an adjustment (typically a refund) drops cost
    // back below threshold, so a subsequent upward re-crossing via addCost
    // fires again. Mirrors the re-arm in addCost's below-threshold branch.
    const sessionPct = this.config.sessionBudget > 0 && Number.isFinite(newSession)
      ? newSession / this.config.sessionBudget
      : 0;
    const dailyPct = this.config.dailyBudget > 0 && Number.isFinite(newDaily)
      ? newDaily / this.config.dailyBudget
      : 0;
    if (sessionPct < this.config.alertThreshold) this.sessionAlerted = false;
    if (dailyPct < this.config.alertThreshold) this.dailyAlerted = false;
  }

  /**
   * Register a callback to be invoked on budget alerts.
   *
   * Returns an unsubscribe function. `BudgetAlertSystem` is owned by the
   * process-lifetime singleton `llmService`, so its `alertCallbacks` array
   * lives for the whole session: without unsubscribe a callback registered per
   * mount/request accumulates, retaining its closure and re-firing on every
   * future alert — the listener-registration leak (cannot be solved by a cap,
   * only by explicit unsubscribe). Same ref-count rule as
   * ProductionErrorHandler.onError: registering the same reference N times
   * needs N unsubscribes to fully release.
   */
  onAlert(callback: (alert: BudgetAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    return () => {
      const idx = this.alertCallbacks.indexOf(callback);
      if (idx !== -1) this.alertCallbacks.splice(idx, 1);
    };
  }

  /** Get current session cost. */
  getSessionCost(): number {
    return this.sessionCost;
  }

  /** Get current daily cost. */
  getDailyCost(): number {
    return this.dailyCost;
  }

  /** Get all session alerts. */
  getSessionAlerts(): ReadonlyArray<BudgetAlert> {
    return this.sessionAlerts;
  }

  /** Get all daily alerts. */
  getDailyAlerts(): ReadonlyArray<BudgetAlert> {
    return this.dailyAlerts;
  }

  /**
   * Reset session cost and alerts (call at start of new session).
   */
  resetSession(): void {
    this.sessionCost = 0;
    this.sessionAlerts = [];
    this.sessionAlerted = false;
  }

  /**
   * Reset daily cost and alerts (call at start of new day).
   */
  resetDaily(): void {
    this.dailyCost = 0;
    this.dailyAlerts = [];
    this.dailyAlerted = false;
  }
}

/**
 * Thrown when BudgetAlertSystem receives invalid configuration or cost input.
 */
export class BudgetConfigError extends Error {
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'BudgetConfigError';
    this.context = context;
  }
}
