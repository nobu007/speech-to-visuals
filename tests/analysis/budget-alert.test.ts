/**
 * Tests for BudgetAlertSystem (src/analysis/budget-alert.ts)
 */

import { BudgetAlertSystem } from '@/analysis/budget-alert';

describe('BudgetAlertSystem', () => {
  describe('constructor defaults', () => {
    test('uses default config when no options provided', () => {
      const system = new BudgetAlertSystem();
      expect(system.getSessionCost()).toBe(0);
      expect(system.getDailyCost()).toBe(0);
      expect(system.getSessionAlerts()).toHaveLength(0);
      expect(system.getDailyAlerts()).toHaveLength(0);
    });

    test('accepts partial config overrides', () => {
      const system = new BudgetAlertSystem({ sessionBudget: 5.0 });
      // sessionBudget is 5.0, dailyBudget defaults to 10.0
      system.addCost(4.5); // 90% of session (5.0), 45% of daily (10.0)
      const sessionAlerts = system.getSessionAlerts();
      expect(sessionAlerts).toHaveLength(1);
      expect(sessionAlerts[0].budget).toBe(5.0);
    });
  });

  describe('addCost', () => {
    test('returns empty alerts when below threshold', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 10,
        dailyBudget: 100,
        alertThreshold: 0.8,
      });
      const alerts = system.addCost(5);
      expect(alerts).toHaveLength(0);
      expect(system.getSessionCost()).toBe(5);
      expect(system.getDailyCost()).toBe(5);
    });

    test('fires session alert at threshold', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.8,
      });
      const alerts = system.addCost(0.85);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('session');
      expect(alerts[0].percentage).toBeGreaterThanOrEqual(0.8);
    });

    test('fires daily alert at threshold', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 100,
        dailyBudget: 1,
        alertThreshold: 0.8,
      });
      const alerts = system.addCost(0.9);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('daily');
    });

    test('fires both session and daily alerts simultaneously', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 1,
        alertThreshold: 0.8,
      });
      const alerts = system.addCost(0.9);
      expect(alerts).toHaveLength(2);
      expect(alerts.some(a => a.type === 'session')).toBe(true);
      expect(alerts.some(a => a.type === 'daily')).toBe(true);
    });

    test('accumulates costs across multiple addCost calls', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.8,
      });
      system.addCost(0.4);
      expect(system.getSessionAlerts()).toHaveLength(0);
      system.addCost(0.5);
      // total session cost = 0.9 >= 0.8 threshold
      expect(system.getSessionAlerts()).toHaveLength(1);
    });

    test('handles zero budget gracefully (no division by zero)', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 0,
        dailyBudget: 0,
        alertThreshold: 0.8,
      });
      const alerts = system.addCost(100);
      expect(alerts).toHaveLength(0);
    });

    test('alert message contains formatted cost and percentage', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      const alerts = system.addCost(0.6);
      expect(alerts[0].message).toContain('0.6000');
      expect(alerts[0].message).toContain('60.0%');
    });
  });

  describe('onAlert callback', () => {
    test('invokes registered callback on alert', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      const callback = jest.fn();
      system.onAlert(callback);
      system.addCost(0.6);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'session' }),
      );
    });

    test('invokes multiple callbacks in registration order', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      const order: number[] = [];
      system.onAlert(() => order.push(1));
      system.onAlert(() => order.push(2));
      system.addCost(0.6);
      expect(order).toEqual([1, 2]);
    });

    test('does not break when callback throws', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      const badCallback = jest.fn(() => { throw new Error('boom'); });
      const goodCallback = jest.fn();
      system.onAlert(badCallback);
      system.onAlert(goodCallback);
      // Should not throw
      system.addCost(0.6);
      expect(badCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
    });

    test('does not invoke callback when no alert fires', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 100,
        dailyBudget: 100,
        alertThreshold: 0.8,
      });
      const callback = jest.fn();
      system.onAlert(callback);
      system.addCost(1);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('resetSession', () => {
    test('clears session cost and alerts but keeps daily', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      system.addCost(0.6);
      expect(system.getSessionCost()).toBe(0.6);
      expect(system.getSessionAlerts()).toHaveLength(1);

      system.resetSession();
      expect(system.getSessionCost()).toBe(0);
      expect(system.getSessionAlerts()).toHaveLength(0);
      expect(system.getDailyCost()).toBe(0.6); // daily unchanged
    });
  });

  describe('resetDaily', () => {
    test('clears daily cost and alerts but keeps session', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 100,
        dailyBudget: 1,
        alertThreshold: 0.5,
      });
      system.addCost(0.6);
      expect(system.getDailyAlerts()).toHaveLength(1);

      system.resetDaily();
      expect(system.getDailyCost()).toBe(0);
      expect(system.getDailyAlerts()).toHaveLength(0);
      expect(system.getSessionCost()).toBe(0.6); // session unchanged
    });
  });

  describe('alert accumulation', () => {
    test('multiple alerts accumulate in session alerts', () => {
      const system = new BudgetAlertSystem({
        sessionBudget: 1,
        dailyBudget: 100,
        alertThreshold: 0.5,
      });
      system.addCost(0.6); // alert 1
      system.addCost(0.3); // alert 2
      expect(system.getSessionAlerts()).toHaveLength(2);
    });
  });
});
