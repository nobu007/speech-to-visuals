import { BudgetAlertSystem, BudgetConfigError } from '../budget-alert';

describe('BudgetAlertSystem', () => {
  let system: BudgetAlertSystem;

  beforeEach(() => {
    jest.restoreAllMocks();
    system = new BudgetAlertSystem({
      sessionBudget: 1.00,
      dailyBudget: 10.00,
      alertThreshold: 0.8,
    });
  });

  describe('constructor', () => {
    it('uses defaults when no config provided', () => {
      const s = new BudgetAlertSystem();
      // Default session budget is $1.00, threshold 0.8
      const alerts = s.addCost(0.8);
      expect(alerts.some(a => a.type === 'session')).toBe(true);
    });

    it('throws on invalid sessionBudget', () => {
      expect(() => new BudgetAlertSystem({ sessionBudget: -1 }))
        .toThrow(BudgetConfigError);
      expect(() => new BudgetAlertSystem({ sessionBudget: NaN }))
        .toThrow(BudgetConfigError);
      expect(() => new BudgetAlertSystem({ sessionBudget: Infinity }))
        .toThrow(BudgetConfigError);
    });

    it('throws on invalid dailyBudget', () => {
      expect(() => new BudgetAlertSystem({ dailyBudget: -5 }))
        .toThrow(BudgetConfigError);
    });

    it('throws on invalid alertThreshold', () => {
      expect(() => new BudgetAlertSystem({ alertThreshold: 1.5 }))
        .toThrow(BudgetConfigError);
      expect(() => new BudgetAlertSystem({ alertThreshold: -0.1 }))
        .toThrow(BudgetConfigError);
    });
  });

  describe('addCost', () => {
    it('accumulates session and daily cost', () => {
      system.addCost(0.3);
      system.addCost(0.2);
      expect(system.getSessionCost()).toBeCloseTo(0.5);
      expect(system.getDailyCost()).toBeCloseTo(0.5);
    });

    it('returns alerts when threshold crossed', () => {
      const alerts = system.addCost(0.85); // 85% of $1.00 session budget
      expect(alerts.some(a => a.type === 'session')).toBe(true);
    });

    it('returns no alerts when below threshold', () => {
      const alerts = system.addCost(0.5);
      expect(alerts).toHaveLength(0);
    });

    it('triggers daily alert at 80% of daily budget', () => {
      const s = new BudgetAlertSystem({ dailyBudget: 10, alertThreshold: 0.8 });
      const alerts = s.addCost(8);
      expect(alerts.some(a => a.type === 'daily')).toBe(true);
    });

    it('throws on invalid cost', () => {
      expect(() => system.addCost(-1)).toThrow(BudgetConfigError);
      expect(() => system.addCost(NaN)).toThrow(BudgetConfigError);
      expect(() => system.addCost(Infinity)).toThrow(BudgetConfigError);
    });
  });

  describe('adjustCost', () => {
    it('adjusts cost by positive delta', () => {
      system.addCost(0.5);
      system.adjustCost(0.3);
      expect(system.getSessionCost()).toBeCloseTo(0.8);
    });

    it('adjusts cost by negative delta (refund)', () => {
      system.addCost(0.5);
      system.adjustCost(-0.2);
      expect(system.getSessionCost()).toBeCloseTo(0.3);
    });

    it('throws if adjustment makes cost negative', () => {
      system.addCost(0.1);
      expect(() => system.adjustCost(-0.5)).toThrow(BudgetConfigError);
    });

    it('throws on non-finite delta', () => {
      expect(() => system.adjustCost(NaN)).toThrow(BudgetConfigError);
    });
  });

  describe('onAlert callback', () => {
    it('invokes registered callbacks on alert', () => {
      const cb = jest.fn();
      system.onAlert(cb);

      system.addCost(0.85);
      expect(cb).toHaveBeenCalled();
    });

    it('logs callback errors instead of swallowing silently', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      system.onAlert(() => { throw new Error('callback crash'); });

      // Should not throw — error should be logged
      expect(() => system.addCost(0.85)).not.toThrow();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('continues notifying other callbacks after one throws', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const goodCb = jest.fn();

      system.onAlert(() => { throw new Error('crash'); });
      system.onAlert(goodCb);

      system.addCost(0.85);
      expect(goodCb).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('resetSession', () => {
    it('resets session cost and alerts', () => {
      system.addCost(0.9);
      system.resetSession();

      expect(system.getSessionCost()).toBe(0);
      expect(system.getSessionAlerts()).toHaveLength(0);
    });
  });

  describe('resetDaily', () => {
    it('resets daily cost and alerts', () => {
      system.addCost(9);
      system.resetDaily();

      expect(system.getDailyCost()).toBe(0);
      expect(system.getDailyAlerts()).toHaveLength(0);
    });
  });

  describe('alert messages', () => {
    it('includes percentage in session alert', () => {
      const alerts = system.addCost(0.85);
      const sessionAlert = alerts.find(a => a.type === 'session');
      expect(sessionAlert).toBeDefined();
      expect(sessionAlert!.percentage).toBeCloseTo(0.85, 2);
      expect(sessionAlert!.message).toContain('85.0%');
    });
  });
});
