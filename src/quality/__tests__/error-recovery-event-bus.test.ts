import { ErrorRecoveryEventBus } from '../error-recovery-event-bus';

describe('ErrorRecoveryEventBus', () => {
  let bus: ErrorRecoveryEventBus;

  beforeEach(() => {
    bus = new ErrorRecoveryEventBus({ maxHistory: 10 });
    jest.restoreAllMocks();
  });

  describe('on / emit', () => {
    it('delivers events to subscribed listeners', () => {
      const received: unknown[] = [];
      bus.on('circuit_breaker:change', (evt) => received.push(evt));

      bus.emit('circuit_breaker:change', {
        stage: 'analysis',
        previousState: 'closed',
        newState: 'open',
        failureCount: 5,
        timestamp: Date.now(),
      });

      expect(received).toHaveLength(1);
    });

    it('returns unsubscribe function', () => {
      const unsub = bus.on('recovery:success', () => {});
      expect(typeof unsub).toBe('function');
      unsub();
      expect(bus.listenerCount('recovery:success')).toBe(0);
    });
  });

  describe('once', () => {
    it('delivers event only once', () => {
      let count = 0;
      bus.once('cascade:detected', () => count++);

      const payload = {
        triggerStage: 's1',
        affectedStages: ['s2'],
        rootCause: 'test',
        frequency: 1,
        timestamp: Date.now(),
      };

      bus.emit('cascade:detected', payload);
      bus.emit('cascade:detected', payload);
      expect(count).toBe(1);
    });
  });

  describe('off', () => {
    it('removes a listener', () => {
      const fn = jest.fn();
      bus.on('stage:degraded', fn);
      bus.off('stage:degraded', fn);

      bus.emit('stage:degraded', {
        stage: 's', score: 0.3, threshold: 0.5,
        trend: 'degrading', timestamp: Date.now(),
      });
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('listener error handling', () => {
    it('logs listener errors instead of swallowing silently', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const goodFn = jest.fn();

      bus.on('capacity:adjusted', () => { throw new Error('listener bug'); });
      bus.on('capacity:adjusted', goodFn);

      bus.emit('capacity:adjusted', {
        previousCapacity: 10,
        newCapacity: 5,
        healthScore: 0.4,
        timestamp: Date.now(),
      });

      // The throwing listener should not prevent delivery to subsequent listeners
      expect(goodFn).toHaveBeenCalled();
      // Error should be logged
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('logs once-listener errors instead of swallowing silently', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      bus.once('queue:overflow', () => { throw new Error('once bug'); });

      bus.emit('queue:overflow', {
        queueLength: 100,
        dynamicCapacity: 50,
        oldestQueuedAt: Date.now() - 5000,
        timestamp: Date.now(),
      });

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('mute / unmute', () => {
    it('suppresses events when muted', () => {
      const fn = jest.fn();
      bus.on('recovery:attempt', fn);

      bus.mute();
      bus.emit('recovery:attempt', {
        stage: 's', strategyId: 'r1', strategyName: 'retry',
        attemptNumber: 1, timestamp: Date.now(),
      });

      expect(fn).not.toHaveBeenCalled();
      expect(bus.isMuted).toBe(true);

      bus.unmute();
      bus.emit('recovery:attempt', {
        stage: 's', strategyId: 'r1', strategyName: 'retry',
        attemptNumber: 2, timestamp: Date.now(),
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('history', () => {
    it('records event history', () => {
      bus.emit('recovery:failure', {
        stage: 's', strategyId: 'r1', timeSpentMs: 100,
        nextAction: 'abort', timestamp: Date.now(),
      });

      const history = bus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].event).toBe('recovery:failure');
    });

    it('filters history by event type', () => {
      bus.emit('recovery:success', {
        stage: 's', strategyId: 'r1', timeSpentMs: 50,
        fallbackUsed: false, timestamp: Date.now(),
      });
      bus.emit('recovery:failure', {
        stage: 's', strategyId: 'r1', timeSpentMs: 100,
        nextAction: 'abort', timestamp: Date.now(),
      });

      const successHistory = bus.getHistory('recovery:success');
      expect(successHistory).toHaveLength(1);
    });

    it('trims history to maxHistory', () => {
      for (let i = 0; i < 15; i++) {
        bus.emit('recovery:success', {
          stage: `s${i}`, strategyId: 'r1', timeSpentMs: 50,
          fallbackUsed: false, timestamp: Date.now(),
        });
      }

      expect(bus.getHistory().length).toBeLessThanOrEqual(10);
    });

    it('clears history', () => {
      bus.emit('recovery:success', {
        stage: 's', strategyId: 'r1', timeSpentMs: 50,
        fallbackUsed: false, timestamp: Date.now(),
      });

      bus.clearHistory();
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('removeAllListeners', () => {
    it('removes all listeners for a specific event', () => {
      bus.on('circuit_breaker:change', () => {});
      bus.on('circuit_breaker:change', () => {});
      bus.on('recovery:success', () => {});

      bus.removeAllListeners('circuit_breaker:change');

      expect(bus.listenerCount('circuit_breaker:change')).toBe(0);
      expect(bus.listenerCount('recovery:success')).toBe(1);
    });

    it('removes all listeners globally', () => {
      bus.on('circuit_breaker:change', () => {});
      bus.on('recovery:success', () => {});

      bus.removeAllListeners();

      expect(bus.listenerCount('circuit_breaker:change')).toBe(0);
      expect(bus.listenerCount('recovery:success')).toBe(0);
    });
  });
});
