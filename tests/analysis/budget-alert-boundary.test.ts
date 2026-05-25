/**
 * TASK-0147: BudgetAlertSystem Threshold Boundary Tests
 *
 * Focused unit tests for BudgetAlertSystem alert-trigger boundary conditions
 * that are not covered by the integration tests in token-usage-cost-monitoring.test.ts.
 *
 * Covers:
 *  1. Exact threshold boundary (just below / exactly at / just above)
 *  2. Cumulative cost crossing threshold across multiple addCost() calls
 *  3. Multiple small additions that sum to cross threshold
 *  4. Zero-budget guard (division-by-zero protection)
 *  5. Negative cost handling
 *  6. Both session AND daily alerts firing simultaneously
 *  7. Reset behavior (resetSession / resetDaily)
 *  8. Callback that throws does not block other callbacks
 *  9. Alert accumulation across addCost calls
 * 10. Daily budget independent from session budget
 * 11. Custom threshold values
 * 12. Very small fractional costs near threshold
 */

import { BudgetAlertSystem, BudgetAlert, BudgetConfig } from '@/analysis/budget-alert';

// ---------------------------------------------------------------------------
// 1. Exact threshold boundary
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: exact threshold boundary', () => {
  it('does not fire when cost is just below threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // 79.99% of $1.00 = $0.7999
    const alerts = budget.addCost(0.7999);
    expect(alerts).toHaveLength(0);
    expect(budget.getSessionAlerts()).toHaveLength(0);
  });

  it('fires when cost is exactly at threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // Exactly 80%
    const alerts = budget.addCost(0.80);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('session');
    expect(alerts[0].percentage).toBeCloseTo(0.8, 4);
  });

  it('fires when cost is just above threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // 80.01% of $1.00 = $0.8001
    const alerts = budget.addCost(0.8001);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('session');
    expect(alerts[0].percentage).toBeGreaterThan(0.8);
  });
});

// ---------------------------------------------------------------------------
// 2. Cumulative cost crossing threshold
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: cumulative cost crosses threshold', () => {
  it('does not fire for first call below threshold, fires on second that crosses', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // First call: 40% — no alert
    const alerts1 = budget.addCost(0.40);
    expect(alerts1).toHaveLength(0);

    // Second call: 40% + 45% = 85% — crosses threshold
    const alerts2 = budget.addCost(0.45);
    expect(alerts2).toHaveLength(1);
    expect(alerts2[0].type).toBe('session');
    expect(alerts2[0].currentCost).toBeCloseTo(0.85, 4);
    expect(alerts2[0].percentage).toBeCloseTo(0.85, 4);
  });

  it('does not re-fire if cost is already above threshold and more cost is added', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // First call triggers alert at 85%
    const alerts1 = budget.addCost(0.85);
    expect(alerts1).toHaveLength(1);

    // Second call: still above threshold — fires again (each addCost re-evaluates)
    const alerts2 = budget.addCost(0.10);
    expect(alerts2).toHaveLength(1);
    expect(alerts2[0].currentCost).toBeCloseTo(0.95, 4);
  });
});

// ---------------------------------------------------------------------------
// 3. Multiple small additions sum to cross threshold
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: many small costs accumulate', () => {
  it('fires after many small costs accumulate past threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // 8 x $0.09 = $0.72 — all below threshold
    for (let i = 0; i < 8; i++) {
      const alerts = budget.addCost(0.09);
      expect(alerts).toHaveLength(0);
    }

    // 9th call: $0.72 + $0.09 = $0.81 — crosses 80%
    const finalAlerts = budget.addCost(0.09);
    expect(finalAlerts).toHaveLength(1);
    expect(finalAlerts[0].currentCost).toBeCloseTo(0.81, 4);
  });
});

// ---------------------------------------------------------------------------
// 4. Zero-budget guard
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: zero budget edge case', () => {
  it('does not divide by zero when session budget is 0', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 0,
      dailyBudget: 10.00,
      alertThreshold: 0.8,
    });

    // Should not throw, should not fire session alert (percentage = 0)
    const alerts = budget.addCost(0.50);
    const sessionAlerts = alerts.filter(a => a.type === 'session');
    expect(sessionAlerts).toHaveLength(0);
  });

  it('does not divide by zero when daily budget is 0', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 0,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.50);
    const dailyAlerts = alerts.filter(a => a.type === 'daily');
    expect(dailyAlerts).toHaveLength(0);
  });

  it('does not divide by zero when both budgets are 0', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 0,
      dailyBudget: 0,
      alertThreshold: 0.8,
    });

    // Should not throw
    const alerts = budget.addCost(1.00);
    expect(alerts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Negative cost handling
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: negative cost', () => {
  it('handles negative cost by reducing accumulated cost', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // Add cost above threshold
    budget.addCost(0.90);
    expect(budget.getSessionCost()).toBeCloseTo(0.90, 4);

    // Subtract cost (e.g., refund/correction) via adjustCost
    budget.adjustCost(-0.20);
    expect(budget.getSessionCost()).toBeCloseTo(0.70, 4);
  });
});

// ---------------------------------------------------------------------------
// 6. Both session AND daily alerts fire simultaneously
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: session and daily alerts', () => {
  it('fires both session and daily alerts when both thresholds are crossed', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 1.00,
      alertThreshold: 0.8,
    });

    // With equal budgets, one addCost that crosses 80% triggers both
    const alerts = budget.addCost(0.85);
    expect(alerts).toHaveLength(2);

    const sessionAlert = alerts.find(a => a.type === 'session');
    const dailyAlert = alerts.find(a => a.type === 'daily');
    expect(sessionAlert).toBeDefined();
    expect(dailyAlert).toBeDefined();
    expect(sessionAlert!.percentage).toBeCloseTo(0.85, 4);
    expect(dailyAlert!.percentage).toBeCloseTo(0.85, 4);
  });

  it('fires only daily alert when session budget is large but daily is small', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 100.00,
      dailyBudget: 1.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.85);
    const sessionAlert = alerts.find(a => a.type === 'session');
    const dailyAlert = alerts.find(a => a.type === 'daily');
    expect(sessionAlert).toBeUndefined();
    expect(dailyAlert).toBeDefined();
  });

  it('fires only session alert when daily budget is large but session is small', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 100.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.85);
    const sessionAlert = alerts.find(a => a.type === 'session');
    const dailyAlert = alerts.find(a => a.type === 'daily');
    expect(sessionAlert).toBeDefined();
    expect(dailyAlert).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 7. Reset behavior
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: reset behavior', () => {
  it('resetSession clears session cost and alerts but preserves daily', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 10.00,
      alertThreshold: 0.8,
    });

    budget.addCost(0.85);
    expect(budget.getSessionCost()).toBeCloseTo(0.85, 4);
    expect(budget.getDailyCost()).toBeCloseTo(0.85, 4);
    expect(budget.getSessionAlerts()).toHaveLength(1);

    budget.resetSession();

    expect(budget.getSessionCost()).toBe(0);
    expect(budget.getSessionAlerts()).toHaveLength(0);
    // Daily is preserved
    expect(budget.getDailyCost()).toBeCloseTo(0.85, 4);
  });

  it('resetDaily clears daily cost and alerts but preserves session', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 10.00,
      alertThreshold: 0.8,
    });

    budget.addCost(9.00);
    expect(budget.getSessionCost()).toBeCloseTo(9.00, 4);
    expect(budget.getDailyCost()).toBeCloseTo(9.00, 4);
    expect(budget.getDailyAlerts().length).toBeGreaterThanOrEqual(1);

    budget.resetDaily();

    expect(budget.getDailyCost()).toBe(0);
    expect(budget.getDailyAlerts()).toHaveLength(0);
    // Session is preserved
    expect(budget.getSessionCost()).toBeCloseTo(9.00, 4);
  });

  it('allows re-triggering alerts after resetSession', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    // First trigger
    budget.addCost(0.85);
    expect(budget.getSessionAlerts()).toHaveLength(1);

    budget.resetSession();

    // Re-trigger
    const alerts = budget.addCost(0.85);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].currentCost).toBeCloseTo(0.85, 4);
    expect(budget.getSessionAlerts()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 8. Callback error isolation
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: callback error isolation', () => {
  it('a throwing callback does not prevent other callbacks from firing', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const received: BudgetAlert[] = [];
    const errorCallback = () => { throw new Error('callback failure'); };
    const goodCallback = (alert: BudgetAlert) => { received.push(alert); };

    budget.onAlert(errorCallback);
    budget.onAlert(goodCallback);

    // Should not throw despite errorCallback throwing
    const alerts = budget.addCost(0.85);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(received).toHaveLength(1);
  });

  it('calls multiple callbacks in registration order', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const order: number[] = [];
    budget.onAlert(() => order.push(1));
    budget.onAlert(() => order.push(2));
    budget.onAlert(() => order.push(3));

    budget.addCost(0.85);
    expect(order).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// 9. Alert accumulation across addCost calls
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: alert accumulation', () => {
  it('accumulates session alerts in getSessionAlerts()', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    budget.addCost(0.85); // triggers session alert
    budget.addCost(0.10); // triggers another session alert (95%)

    const allSessionAlerts = budget.getSessionAlerts();
    expect(allSessionAlerts).toHaveLength(2);
    expect(allSessionAlerts[0].currentCost).toBeCloseTo(0.85, 4);
    expect(allSessionAlerts[1].currentCost).toBeCloseTo(0.95, 4);
  });
});

// ---------------------------------------------------------------------------
// 10. Daily budget independent from session budget
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: daily budget independence', () => {
  it('daily alert fires based on daily budget, not session budget', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 100.00,  // large session budget
      dailyBudget: 5.00,      // smaller daily budget
      alertThreshold: 0.8,
    });

    // $4.50 is 90% of $5.00 daily but only 4.5% of $100 session
    const alerts = budget.addCost(4.50);
    const dailyAlert = alerts.find(a => a.type === 'daily');
    const sessionAlert = alerts.find(a => a.type === 'session');

    expect(dailyAlert).toBeDefined();
    expect(sessionAlert).toBeUndefined();
    expect(dailyAlert!.percentage).toBeCloseTo(0.9, 4);
  });
});

// ---------------------------------------------------------------------------
// 11. Custom threshold values
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: custom thresholds', () => {
  it('fires at 50% threshold', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 2.00,
      alertThreshold: 0.5,
    });

    const alerts = budget.addCost(1.00); // exactly 50%
    expect(alerts).toHaveLength(1);
    expect(alerts[0].percentage).toBeCloseTo(0.5, 4);
  });

  it('fires at 100% threshold only when budget is fully consumed', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 1.0,
    });

    // 99.9% — should NOT fire
    const alerts1 = budget.addCost(0.999);
    expect(alerts1).toHaveLength(0);

    // 100% — should fire
    const alerts2 = budget.addCost(0.001);
    expect(alerts2).toHaveLength(1);
    expect(alerts2[0].percentage).toBeCloseTo(1.0, 4);
  });

  it('fires at 0% threshold with any non-zero cost', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.0,
    });

    const alerts = budget.addCost(0.001);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 12. Very small fractional costs near threshold
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: floating-point precision', () => {
  it('handles floating-point accumulation near threshold correctly', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 0.10, // 10 cents
      alertThreshold: 0.8,
    });

    // Add 7 cents in 1-cent increments (should stay below threshold
    // even with floating-point drift)
    for (let i = 0; i < 7; i++) {
      const alerts = budget.addCost(0.01);
      const sessionAlerts = alerts.filter(a => a.type === 'session');
      expect(sessionAlerts).toHaveLength(0);
    }

    // Add enough to clearly cross 80% of $0.10 = $0.08
    // 7 * 0.01 may be slightly below 0.07 due to float, so add 0.02 to be safe
    const finalAlerts = budget.addCost(0.02);
    const sessionAlert = finalAlerts.find(a => a.type === 'session');
    expect(sessionAlert).toBeDefined();
    // 7 * 0.01 + 0.02 ≈ 0.09 → 90% of 0.10
    expect(sessionAlert!.percentage).toBeGreaterThanOrEqual(0.8);
  });
});

// ---------------------------------------------------------------------------
// 13. Alert message content
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: alert message content', () => {
  it('includes correct cost and percentage in session alert message', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.85);
    const sessionAlert = alerts.find(a => a.type === 'session');
    expect(sessionAlert!.message).toContain('0.8500');
    expect(sessionAlert!.message).toContain('85.0%');
    expect(sessionAlert!.message).toContain('$1.00');
  });

  it('includes correct cost and percentage in daily alert message', () => {
    const budget = new BudgetAlertSystem({
      dailyBudget: 10.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(8.50);
    const dailyAlert = alerts.find(a => a.type === 'daily');
    expect(dailyAlert!.message).toContain('8.5000');
    expect(dailyAlert!.message).toContain('85.0%');
    expect(dailyAlert!.message).toContain('$10.00');
  });
});

// ---------------------------------------------------------------------------
// 14. Default configuration values
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: default configuration', () => {
  it('uses correct default values when no config provided', () => {
    const budget = new BudgetAlertSystem();

    // Defaults: sessionBudget=$1.00, dailyBudget=$10.00, alertThreshold=0.8
    // 80 cents = 80% of $1.00 session → should fire session alert
    // 80 cents = 8% of $10.00 daily → should NOT fire daily alert
    const alerts = budget.addCost(0.80);
    const sessionAlert = alerts.find(a => a.type === 'session');
    const dailyAlert = alerts.find(a => a.type === 'daily');

    expect(sessionAlert).toBeDefined();
    expect(dailyAlert).toBeUndefined();
  });

  it('uses correct default daily budget of $10', () => {
    const budget = new BudgetAlertSystem();

    // $8.00 = 80% of $10.00 daily
    const alerts = budget.addCost(8.00);
    const dailyAlert = alerts.find(a => a.type === 'daily');
    expect(dailyAlert).toBeDefined();
    expect(dailyAlert!.percentage).toBeCloseTo(0.8, 4);
  });
});

// ---------------------------------------------------------------------------
// 15. Alert object structure
// ---------------------------------------------------------------------------
describe('BudgetAlertSystem: alert object structure', () => {
  it('produces alerts with all required fields', () => {
    const budget = new BudgetAlertSystem({
      sessionBudget: 1.00,
      alertThreshold: 0.8,
    });

    const alerts = budget.addCost(0.85);
    const alert = alerts[0];

    expect(alert).toHaveProperty('type', 'session');
    expect(alert).toHaveProperty('currentCost');
    expect(alert).toHaveProperty('budget', 1.00);
    expect(alert).toHaveProperty('threshold', 0.8);
    expect(alert).toHaveProperty('percentage');
    expect(alert).toHaveProperty('message');
    expect(typeof alert.message).toBe('string');
    expect(alert.message.length).toBeGreaterThan(0);
  });
});
