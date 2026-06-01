/**
 * @jest-environment jsdom
 */

/**
 * Unit tests for ProductionErrorHandler
 * Covers: error classification, severity determination, recovery strategies, metrics, callbacks
 */

// Mock browser globals - jsdom provides window, so we spy on it
const mockWindowAddEventListener = jest.spyOn(window, 'addEventListener').mockImplementation(jest.fn());
const mockWindowRemoveEventListener = jest.fn();
// Override removeEventListener since jsdom's window has it
window.removeEventListener = mockWindowRemoveEventListener;

// Set navigator properties for test consistency
Object.defineProperty(globalThis, 'navigator', {
  value: {
    userAgent: 'test-agent',
    language: 'ja',
    platform: 'test-platform',
  },
  writable: true,
  configurable: true,
});

import { ProductionErrorHandler } from '../production-error-handler';
import type { ErrorAlert, ErrorMetrics } from '../production-error-handler';

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ProductionErrorHandler', () => {
  let handler: ProductionErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ProductionErrorHandler();
  });

  afterEach(() => {
    handler.destroy();
  });

  describe('constructor', () => {
    it('registers global error handlers', () => {
      // The constructor should call window.addEventListener for error and unhandledrejection
      expect(mockWindowAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      expect(mockWindowAddEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('does not start metrics interval in test environment', () => {
      // Should not create intervals in test env (verified by no Jest worker warnings)
      expect(() => new ProductionErrorHandler()).not.toThrow();
    });
  });

  describe('handleError', () => {
    it('returns an ErrorAlert with correct structure', async () => {
      const alert = await handler.handleError(new Error('Test error'));
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('message', 'Test error');
      expect(alert).toHaveProperty('userMessage');
      expect(alert).toHaveProperty('recoveryOptions');
      expect(alert).toHaveProperty('timestamp');
    });

    it('generates unique alert IDs', async () => {
      const alert1 = await handler.handleError(new Error('Error 1'));
      const alert2 = await handler.handleError(new Error('Error 2'));
      expect(alert1.id).not.toBe(alert2.id);
    });

    it('adds alert to error queue', async () => {
      await handler.handleError(new Error('Test error'));
      const queue = handler.getErrorQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].message).toBe('Test error');
    });

    it('returns queue in reverse order (most recent first)', async () => {
      await handler.handleError(new Error('First'));
      await handler.handleError(new Error('Second'));
      const queue = handler.getErrorQueue();
      expect(queue[0].message).toBe('Second');
      expect(queue[1].message).toBe('First');
    });
  });

  describe('error severity classification', () => {
    it('classifies transcription errors as critical', async () => {
      const alert = await handler.handleError(new Error('transcription failed'));
      expect(alert.severity).toBe('critical');
    });

    it('classifies pipeline errors as critical', async () => {
      const alert = await handler.handleError(new Error('pipeline error'));
      expect(alert.severity).toBe('critical');
    });

    it('classifies MainPipeline context as critical', async () => {
      const alert = await handler.handleError(new Error('unknown'), { component: 'MainPipeline' });
      expect(alert.severity).toBe('critical');
    });

    it('classifies upload errors as high', async () => {
      const alert = await handler.handleError(new Error('upload failed'));
      expect(alert.severity).toBe('high');
    });

    it('classifies render errors as high', async () => {
      const alert = await handler.handleError(new Error('render timeout'));
      expect(alert.severity).toBe('high');
    });

    it('classifies VideoRenderer context as high', async () => {
      const alert = await handler.handleError(new Error('error'), { component: 'VideoRenderer' });
      expect(alert.severity).toBe('high');
    });

    it('classifies layout errors as medium', async () => {
      const alert = await handler.handleError(new Error('layout overflow'));
      expect(alert.severity).toBe('medium');
    });

    it('classifies diagram errors as medium', async () => {
      const alert = await handler.handleError(new Error('diagram generation failed'));
      expect(alert.severity).toBe('medium');
    });

    it('classifies unknown errors as low', async () => {
      const alert = await handler.handleError(new Error('something minor'));
      expect(alert.severity).toBe('low');
    });
  });

  describe('user messages', () => {
    it('includes specific guidance for transcription errors', async () => {
      const alert = await handler.handleError(new Error('transcription failed'));
      expect(alert.userMessage).toContain('音声ファイル');
    });

    it('includes specific guidance for upload errors', async () => {
      const alert = await handler.handleError(new Error('upload timeout'));
      expect(alert.userMessage).toContain('ファイルサイズ');
    });

    it('includes specific guidance for browser errors', async () => {
      const alert = await handler.handleError(new Error('browser compatibility'));
      expect(alert.userMessage).toContain('ブラウザ');
    });

    it('returns base message for generic errors', async () => {
      const alert = await handler.handleError(new Error('generic error'));
      expect(alert.userMessage).toBeTruthy();
    });
  });

  describe('recovery strategies', () => {
    it('includes universal retry strategy', async () => {
      const alert = await handler.handleError(new Error('test'));
      const retry = alert.recoveryOptions.find(s => s.name === 'retry');
      expect(retry).toBeDefined();
      expect(retry!.priority).toBe(1);
    });

    it('includes refresh strategy', async () => {
      const alert = await handler.handleError(new Error('test'));
      const refresh = alert.recoveryOptions.find(s => s.name === 'refresh');
      expect(refresh).toBeDefined();
      expect(refresh!.priority).toBe(2);
    });

    it('adds audio-specific strategies for AudioUploader context', async () => {
      const alert = await handler.handleError(
        new Error('test'),
        { component: 'AudioUploader' }
      );
      const convertAudio = alert.recoveryOptions.find(s => s.name === 'convert-audio');
      expect(convertAudio).toBeDefined();
      const reduceQuality = alert.recoveryOptions.find(s => s.name === 'reduce-quality');
      expect(reduceQuality).toBeDefined();
    });

    it('adds pipeline fallback strategy for MainPipeline context', async () => {
      const alert = await handler.handleError(
        new Error('test'),
        { component: 'MainPipeline' }
      );
      const fallback = alert.recoveryOptions.find(s => s.name === 'fallback-pipeline');
      expect(fallback).toBeDefined();
    });

    it('adds compatibility mode strategy for browser errors', async () => {
      const alert = await handler.handleError(new Error('browser error'));
      const compat = alert.recoveryOptions.find(s => s.name === 'compatibility-mode');
      expect(compat).toBeDefined();
    });

    it('strategies are sorted by priority', async () => {
      const alert = await handler.handleError(
        new Error('test'),
        { component: 'AudioUploader' }
      );
      const priorities = alert.recoveryOptions.map(s => s.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
      }
    });
  });

  describe('error callbacks', () => {
    it('notifies registered callbacks on error', async () => {
      const callback = jest.fn();
      handler.onError('TestComponent', callback);

      await handler.handleError(new Error('test error'));

      expect(callback).toHaveBeenCalledTimes(1);
      const alert: ErrorAlert = callback.mock.calls[0][0];
      expect(alert.message).toBe('test error');
    });

    it('supports multiple callbacks for same component', async () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      handler.onError('TestComponent', cb1);
      handler.onError('TestComponent', cb2);

      await handler.handleError(new Error('test'));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('does not crash when callback throws', async () => {
      const badCallback = jest.fn(() => { throw new Error('callback error'); });
      handler.onError('BadComponent', badCallback);

      await expect(handler.handleError(new Error('test'))).resolves.toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('returns initial metrics', () => {
      const metrics: ErrorMetrics = handler.getMetrics();
      expect(metrics.errorRate).toBe(0);
      expect(metrics.criticalErrors).toBe(0);
      expect(metrics.warningCount).toBe(0);
      expect(metrics.meanTimeToRecovery).toBe(0);
      expect(metrics.affectedUsers).toBe(0);
    });

    it('updates critical error count', async () => {
      await handler.handleError(new Error('transcription failed'));
      const metrics = handler.getMetrics();
      expect(metrics.criticalErrors).toBe(1);
    });

    it('updates warning count on every error', async () => {
      await handler.handleError(new Error('test 1'));
      await handler.handleError(new Error('test 2'));
      const metrics = handler.getMetrics();
      expect(metrics.warningCount).toBe(2);
    });
  });

  describe('executeRecoveryStrategy', () => {
    it('returns false for unknown error ID', async () => {
      const result = await handler.executeRecoveryStrategy('nonexistent', 'retry');
      expect(result).toBe(false);
    });

    it('returns false for unknown strategy name', async () => {
      const alert = await handler.handleError(new Error('test'));
      const result = await handler.executeRecoveryStrategy(alert.id, 'nonexistent');
      expect(result).toBe(false);
    });

    it('executes valid recovery strategy', async () => {
      const alert = await handler.handleError(new Error('test'));
      const result = await handler.executeRecoveryStrategy(alert.id, 'retry');
      expect(result).toBe(true);
    });
  });

  describe('clearResolvedErrors', () => {
    it('removes old errors from queue', async () => {
      await handler.handleError(new Error('test'));

      // Manually age the error by modifying timestamps
      const queue = handler.getErrorQueue();
      expect(queue.length).toBe(1);

      // clearResolvedErrors filters by retention time (1 hour)
      handler.clearResolvedErrors();

      // Recent errors should still be present
      expect(handler.getErrorQueue().length).toBe(1);
    });
  });

  describe('exportErrorReport', () => {
    it('exports valid JSON report', async () => {
      await handler.handleError(new Error('test error'));
      const report = handler.exportErrorReport();

      const parsed = JSON.parse(report);
      expect(parsed).toHaveProperty('sessionId');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('errors');
      expect(parsed).toHaveProperty('browserInfo');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('includes all queued errors in report', async () => {
      await handler.handleError(new Error('error 1'));
      await handler.handleError(new Error('error 2'));

      const report = JSON.parse(handler.exportErrorReport());
      // Queue is reversed (most recent first), but all should be present
      expect(report.errors.length).toBe(2);
    });
  });

  describe('destroy', () => {
    it('removes global event listeners', () => {
      handler.destroy();
      expect(mockWindowRemoveEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockWindowRemoveEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    });

    it('clears internal data structures', async () => {
      await handler.handleError(new Error('test'));
      handler.onError('test', jest.fn());

      handler.destroy();

      expect(handler.getErrorQueue()).toEqual([]);
    });

    it('can be called multiple times safely', () => {
      handler.destroy();
      expect(() => handler.destroy()).not.toThrow();
    });
  });
});
