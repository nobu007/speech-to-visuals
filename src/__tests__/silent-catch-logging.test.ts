/**
 * Tests verifying that previously-silent catch blocks now log errors/warnings.
 * Covers: DagreLayoutStrategy, code-size-audit, production-config, enhanced-error-recovery.
 */

import { logger } from '@/utils/logger';

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Silent catch blocks now log errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // DagreLayoutStrategy
  // -----------------------------------------------------------------------
  describe('DagreLayoutStrategy', () => {
    it('logs warning when Dagre layout fails and falls back', async () => {
      const { DagreLayoutStrategy } = await import(
        '@/visualization/strategies/DagreLayoutStrategy'
      );
      const { FallbackLayoutStrategy } = await import(
        '@/visualization/strategies/FallbackLayoutStrategy'
      );

      const config = { nodeWidth: 120, nodeHeight: 60, canvasWidth: 800, canvasHeight: 600 };
      const fallback = new FallbackLayoutStrategy(config);
      const strategy = new DagreLayoutStrategy(config, fallback);

      // Nodes with circular-like invalid data that won't crash but may trigger fallback
      const nodes = [
        { id: '', label: 'A' },
        { id: 'b', label: 'B' },
      ] as any;

      const edges = [
        { from: '', to: 'b', label: '' },
      ] as any;

      const result = await strategy.applyLayout(nodes, edges, 'flow' as any);

      // Should either succeed or fall back — either way, if it fell back, it should log
      if (result.nodes.length > 0) {
        // The layout succeeded or fell back — if fallback was used, warn was called
        // This test passes as long as no uncaught exception is thrown
      }

      // Force a guaranteed failure by passing null nodes (will throw inside dagre)
      try {
        await strategy.applyLayout(null as any, [], 'flow' as any);
      } catch {
        // May throw if fallback also fails on null — that's fine
      }

      // The catch block in applyLayout should have logged if dagre threw
      // (null nodes will throw inside the try block)
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // code-size-audit
  // -----------------------------------------------------------------------
  describe('code-size-audit collectMetrics', () => {
    it('logs warning when directory read fails', async () => {
      const { collectMetrics } = await import('@/config/code-size-audit');

      // Use a non-existent directory to trigger the catch block
      const metrics = collectMetrics('/nonexistent/path/that/does/not/exist', {
        srcOnly: false,
      });

      expect(metrics).toBeDefined();
      expect(metrics.fileCount).toBe(0);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      const warnArgs = (logger.warn as jest.Mock).mock.calls[0];
      expect(warnArgs[0]).toContain('[code-size-audit]');
      expect(warnArgs[1]).toBeTruthy();
      expect(typeof (warnArgs[1] as Error).message).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // production-config getSystemInfo
  // -----------------------------------------------------------------------
  describe('ProductionConfigManager getSystemInfo', () => {
    it('logs warning when system info gathering fails', async () => {
      const mod = await import('@/config/production-config');

      // Access the ProductionConfigManager class
      const { ProductionConfigManager } = mod as any;

      // Create instance
      const manager = new ProductionConfigManager();

      // Mock performance to throw
      const originalPerformance = global.performance;
      Object.defineProperty(global, 'performance', {
        value: {
          get memory() { throw new Error('Cannot access memory'); },
        },
        configurable: true,
      });

      // Mock navigator to throw
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        value: {
          get hardwareConcurrency() { throw new Error('Cannot access hardwareConcurrency'); },
        },
        configurable: true,
      });

      const info = manager.getSystemInfo();

      // Restore
      Object.defineProperty(global, 'performance', {
        value: originalPerformance,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });

      expect(info).toEqual({ availableMemory: 1024, cpuCores: 4 });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[ProductionConfig]'),
        expect.any(Error),
      );
    });
  });

  // -----------------------------------------------------------------------
  // enhanced-error-recovery executeWithFallback
  // -----------------------------------------------------------------------
  describe('EnhancedErrorRecovery executeWithFallback', () => {
    it('logs error when both primary and fallback operations fail', async () => {
      const { EnhancedErrorRecovery } = await import('@/quality/enhanced-error-recovery');
      const recovery = new EnhancedErrorRecovery();

      const primaryError = new Error('Primary failed');
      const fallbackError = new Error('Fallback also failed');

      const result = await recovery.executeWithFallback(
        async () => { throw primaryError; },
        async () => { throw fallbackError; },
      );

      expect(result.success).toBe(false);
      expect(result.fallbackUsed).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancedErrorRecovery]'),
        expect.objectContaining({
          primaryError: 'Primary failed',
          fallbackError: 'Fallback also failed',
        }),
      );
    });

    it('does not log error when primary succeeds', async () => {
      const { EnhancedErrorRecovery } = await import('@/quality/enhanced-error-recovery');
      const recovery = new EnhancedErrorRecovery();

      const result = await recovery.executeWithFallback(
        async () => 'success',
        async () => 'fallback',
      );

      expect(result.success).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('does not log error when primary fails but fallback succeeds', async () => {
      const { EnhancedErrorRecovery } = await import('@/quality/enhanced-error-recovery');
      const recovery = new EnhancedErrorRecovery();

      const result = await recovery.executeWithFallback(
        async () => { throw new Error('Primary failed'); },
        async () => 'fallback success',
      );

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      // The catch block for fallback failure should NOT fire when fallback succeeds
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('[EnhancedErrorRecovery]'),
        expect.anything(),
      );
    });
  });
});
