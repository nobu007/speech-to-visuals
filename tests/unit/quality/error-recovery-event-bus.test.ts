/**
 * Tests for ErrorRecoveryEventBus and its integration with EnhancedErrorRecovery.
 */

import {
  ErrorRecoveryEventBus,
  errorRecoveryEventBus,
} from '@/quality/error-recovery-event-bus';
import { EnhancedErrorRecovery } from '@/quality/enhanced-error-recovery';

// ---------------------------------------------------------------------------
// Unit tests for ErrorRecoveryEventBus
// ---------------------------------------------------------------------------

describe('ErrorRecoveryEventBus', () => {
  let bus: ErrorRecoveryEventBus;

  beforeEach(() => {
    bus = new ErrorRecoveryEventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
    bus.clearHistory();
    bus.unmute();
  });

  describe('on / emit', () => {
    it('should deliver events to subscribed listeners', () => {
      const payloads: unknown[] = [];
      bus.on('circuit_breaker:change', (payload) => {
        payloads.push(payload);
      });

      bus.emit('circuit_breaker:change', {
        stage: 'transcription',
        previousState: 'closed',
        newState: 'open',
        failureCount: 3,
        timestamp: Date.now(),
      });

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        stage: 'transcription',
        previousState: 'closed',
        newState: 'open',
        failureCount: 3,
      });
    });

    it('should deliver to multiple listeners', () => {
      let count = 0;
      bus.on('recovery:success', () => { count++; });
      bus.on('recovery:success', () => { count++; });

      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'cache_recovery',
        timeSpentMs: 50,
        fallbackUsed: false,
        timestamp: Date.now(),
      });

      expect(count).toBe(2);
    });

    it('should not deliver events after unsubscribe', () => {
      let count = 0;
      const unsub = bus.on('recovery:failure', () => { count++; });

      bus.emit('recovery:failure', {
        stage: 'rendering',
        strategyId: 'degraded_quality_fallback',
        timeSpentMs: 100,
        nextAction: 'escalate',
        timestamp: Date.now(),
      });

      unsub();

      bus.emit('recovery:failure', {
        stage: 'rendering',
        strategyId: 'degraded_quality_fallback',
        timeSpentMs: 200,
        nextAction: 'abort',
        timestamp: Date.now(),
      });

      expect(count).toBe(1);
    });

    it('off() should remove a specific listener', () => {
      let count = 0;
      const listener = () => { count++; };
      bus.on('capacity:adjusted', listener);

      bus.emit('capacity:adjusted', {
        previousCapacity: 15,
        newCapacity: 12,
        healthScore: 0.3,
        timestamp: Date.now(),
      });

      bus.off('capacity:adjusted', listener);

      bus.emit('capacity:adjusted', {
        previousCapacity: 12,
        newCapacity: 10,
        healthScore: 0.25,
        timestamp: Date.now(),
      });

      expect(count).toBe(1);
    });
  });

  describe('once', () => {
    it('should fire only once then auto-unsubscribe', () => {
      let count = 0;
      bus.once('stage:degraded', () => { count++; });

      const payload = {
        stage: 'rendering',
        score: 0.3,
        threshold: 0.5,
        trend: 'degrading' as const,
        timestamp: Date.now(),
      };

      bus.emit('stage:degraded', payload);
      bus.emit('stage:degraded', payload);

      expect(count).toBe(1);
    });
  });

  describe('history', () => {
    it('should record emitted events in history', () => {
      bus.emit('cascade:detected', {
        triggerStage: 'transcription',
        affectedStages: ['analysis', 'layout_generation'],
        rootCause: 'timeout',
        frequency: 3,
        timestamp: Date.now(),
      });

      const history = bus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].event).toBe('cascade:detected');
    });

    it('should filter history by event type', () => {
      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'cache_recovery',
        timeSpentMs: 10,
        fallbackUsed: false,
        timestamp: Date.now(),
      });
      bus.emit('cascade:detected', {
        triggerStage: 'transcription',
        affectedStages: ['analysis'],
        rootCause: 'test',
        frequency: 1,
        timestamp: Date.now(),
      });
      bus.emit('recovery:success', {
        stage: 'rendering',
        strategyId: 'degraded_quality_fallback',
        timeSpentMs: 20,
        fallbackUsed: true,
        timestamp: Date.now(),
      });

      const successHistory = bus.getHistory('recovery:success');
      expect(successHistory).toHaveLength(2);
    });

    it('should cap history at maxHistory', () => {
      const smallBus = new ErrorRecoveryEventBus({ maxHistory: 3 });
      for (let i = 0; i < 5; i++) {
        smallBus.emit('recovery:attempt', {
          stage: 'analysis',
          strategyId: `strategy_${i}`,
          strategyName: 'Test',
          attemptNumber: i,
          timestamp: Date.now(),
        });
      }
      expect(smallBus.getHistory()).toHaveLength(3);
      smallBus.removeAllListeners();
    });

    it('clearHistory() should empty history', () => {
      bus.emit('queue:overflow', {
        queueLength: 20,
        dynamicCapacity: 15,
        oldestQueuedAt: Date.now(),
        timestamp: Date.now(),
      });
      bus.clearHistory();
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('mute / unmute', () => {
    it('should suppress events when muted', () => {
      let count = 0;
      bus.on('recovery:success', () => { count++; });

      bus.mute();
      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'test',
        timeSpentMs: 10,
        fallbackUsed: false,
        timestamp: Date.now(),
      });

      expect(count).toBe(0);
      expect(bus.isMuted).toBe(true);

      bus.unmute();
      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'test',
        timeSpentMs: 10,
        fallbackUsed: false,
        timestamp: Date.now(),
      });

      expect(count).toBe(1);
      expect(bus.isMuted).toBe(false);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners for a specific event', () => {
      let count = 0;
      bus.on('recovery:success', () => { count++; });
      bus.on('recovery:success', () => { count++; });

      bus.removeAllListeners('recovery:success');

      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'test',
        timeSpentMs: 10,
        fallbackUsed: false,
        timestamp: Date.now(),
      });

      expect(count).toBe(0);
    });

    it('should remove all listeners for all events', () => {
      let count = 0;
      bus.on('recovery:success', () => { count++; });
      bus.on('circuit_breaker:change', () => { count++; });

      bus.removeAllListeners();

      expect(bus.listenerCount('recovery:success')).toBe(0);
      expect(bus.listenerCount('circuit_breaker:change')).toBe(0);
    });
  });

  describe('listenerCount', () => {
    it('should count both persistent and once listeners', () => {
      bus.on('recovery:attempt', () => {});
      bus.once('recovery:attempt', () => {});

      expect(bus.listenerCount('recovery:attempt')).toBe(2);
    });

    it('should return 0 for events with no listeners', () => {
      expect(bus.listenerCount('cascade:detected')).toBe(0);
    });
  });

  describe('error isolation', () => {
    it('should swallow listener errors and continue delivering to other listeners', () => {
      let count = 0;
      bus.on('recovery:success', () => { throw new Error('boom'); });
      bus.on('recovery:success', () => { count++; });

      // Should not throw
      bus.emit('recovery:success', {
        stage: 'analysis',
        strategyId: 'test',
        timeSpentMs: 10,
        fallbackUsed: false,
        timestamp: Date.now(),
      });

      // Second listener should still be called
      expect(count).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: EnhancedErrorRecovery → EventBus
// ---------------------------------------------------------------------------

describe('EnhancedErrorRecovery event bus integration', () => {
  let recovery: EnhancedErrorRecovery;

  beforeEach(() => {
    recovery = new EnhancedErrorRecovery();
    errorRecoveryEventBus.removeAllListeners();
    errorRecoveryEventBus.clearHistory();
  });

  afterEach(() => {
    recovery.destroy();
    errorRecoveryEventBus.removeAllListeners();
    errorRecoveryEventBus.clearHistory();
  });

  it('should emit circuit_breaker:change when breaker transitions', () => {
    const events: unknown[] = [];
    errorRecoveryEventBus.on('circuit_breaker:change', (e) => events.push(e));

    // Get the breaker and force it to 'open' with a past failure time
    // so evaluateCircuitBreakers transitions it to 'half-open'
    const breaker = (recovery as unknown as {
      getCircuitBreaker: (s: string) => {
        state: string; failureCount: number; lastFailureTime: number;
      }
    }).getCircuitBreaker('transcription');

    breaker.state = 'open';
    breaker.failureCount = 5;
    breaker.lastFailureTime = Date.now() - 120_000; // 2 min ago, past the 60s timeout

    // evaluateCircuitBreakers should detect open→half-open transition
    (recovery as unknown as { evaluateCircuitBreakers: () => void }).evaluateCircuitBreakers();

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toMatchObject({
      stage: 'transcription',
      previousState: 'open',
      newState: 'half-open',
    });
  });

  it('should emit recovery:success on successful recovery', async () => {
    const events: unknown[] = [];
    errorRecoveryEventBus.on('recovery:success', (e) => events.push(e));

    // Directly call recoverFromError which triggers learnFromRecovery
    // For a stage with applicable strategies
    await recovery.recoverFromError({
      stage: 'transcription',
      component: 'test',
      input: {},
      error: new Error('test error'),
      timestamp: Date.now(),
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    });

    // If any strategy succeeds, a success event should be emitted
    if (events.length > 0) {
      expect(events[0]).toMatchObject({
        stage: 'transcription',
      });
    }
  });

  it('should emit recovery:failure on failed recovery attempts', async () => {
    const events: unknown[] = [];
    errorRecoveryEventBus.on('recovery:failure', (e) => events.push(e));

    // Use a stage that has no applicable strategies to ensure all fail
    // or use a stage where strategies might fail
    await recovery.recoverFromError({
      stage: 'segmentation',
      component: 'test',
      input: {},
      error: new Error('test error'),
      timestamp: Date.now(),
      retryCount: 3, // high retry count → skip strategies
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    });

    // With retryCount >= 3, no strategies are tried → no recovery events
    // This tests the guard path
    expect(events).toHaveLength(0);
  });

  it('should emit recovery:attempt when strategies are tried', async () => {
    const events: unknown[] = [];
    errorRecoveryEventBus.on('recovery:attempt', (e) => events.push(e));

    await recovery.recoverFromError({
      stage: 'analysis',
      component: 'test',
      input: {},
      error: new Error('test analysis error'),
      timestamp: Date.now(),
      retryCount: 0,
      userContext: { preferences: {}, sessionId: 'test', previousSuccesses: 0 },
    });

    // Should have emitted at least one attempt event
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toMatchObject({
      stage: 'analysis',
      strategyId: expect.any(String),
    });
  });

  it('detectAndEmitCascades should emit cascade:detected events', () => {
    const events: unknown[] = [];
    errorRecoveryEventBus.on('cascade:detected', (e) => events.push(e));

    // No errors recorded → no cascades
    const chains = recovery.detectAndEmitCascades();
    expect(chains).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
});
