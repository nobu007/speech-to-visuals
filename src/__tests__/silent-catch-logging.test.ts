/**
 * Tests verifying that previously-silent catch blocks now log errors/warnings.
 * Covers: BaseLayoutStrategy, DagreLayoutStrategy, code-size-audit, production-config,
 *         enhanced-error-recovery (executeWithFallback + executeWithLoadBalancing).
 */

// ESM: jest.mock is a no-op — must use unstable_mockModule and obtain the
// mocked logger via dynamic import so the production modules under test share
// the same mocked instance. See [[jest-esm-mock-pattern]].
jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const { logger } = await import('@/utils/logger');

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

  // -----------------------------------------------------------------------
  // BaseLayoutStrategy apply() catch block
  // -----------------------------------------------------------------------
  describe('BaseLayoutStrategy apply() fallback', () => {
    it('logs warning with strategy name when performLayout throws', async () => {
      const { BaseLayoutStrategy } = await import(
        '@/visualization/layout/strategies/LayoutStrategy'
      );

      // Create a concrete strategy that always throws in performLayout
      class FailingStrategy extends BaseLayoutStrategy {
        readonly name = 'FailingTestStrategy';
        readonly canEscapeLocalMinimum = false;

        protected async performLayout(): Promise<{ nodes: any[]; edges: any[] }> {
          throw new Error('Layout computation exploded');
        }
      }

      const strategy = new FailingStrategy();
      const config = { nodeWidth: 120, nodeHeight: 60 } as any;
      const nodes = [{ id: 'a', label: 'A' }] as any;
      const edges: any[] = [];

      const result = await strategy.apply(nodes, edges, config);

      // Should return fallback layout
      expect(result.success).toBe(false);
      expect(result.error).toContain('Layout computation exploded');

      // Should have logged the failure
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[BaseLayoutStrategy]'),
        expect.any(Error),
      );
      const warnCall = (logger.warn as jest.Mock).mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('FailingTestStrategy'),
      );
      expect(warnCall).toBeDefined();
      expect(warnCall![0]).toContain('FailingTestStrategy');
    });

    it('does not log when performLayout succeeds', async () => {
      const { BaseLayoutStrategy } = await import(
        '@/visualization/layout/strategies/LayoutStrategy'
      );

      class SuccessStrategy extends BaseLayoutStrategy {
        readonly name = 'SuccessTestStrategy';
        readonly canEscapeLocalMinimum = false;

        protected async performLayout(nodes: any[]) {
          return { nodes, edges: [] };
        }
      }

      const strategy = new SuccessStrategy();
      const config = { nodeWidth: 120, nodeHeight: 60 } as any;
      const nodes = [{ id: 'a', label: 'A' }] as any;

      const result = await strategy.apply(nodes, [], config);

      expect(result.success).toBe(true);
      // No warning should be logged for successful execution
      const strategyWarnCalls = (logger.warn as jest.Mock).mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('SuccessTestStrategy'),
      );
      expect(strategyWarnCalls).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // EnhancedErrorRecovery executeWithLoadBalancing catch block
  // -----------------------------------------------------------------------
  describe('EnhancedErrorRecovery executeWithLoadBalancing', () => {
    it('logs warning when request fails at a known stage', async () => {
      const { EnhancedErrorRecovery } = await import('@/quality/enhanced-error-recovery');
      const recovery = new EnhancedErrorRecovery();

      const stage = 'analysis' as any;
      const boom = new Error('Stage operation failed');

      // executeWithLoadBalancing re-throws, so we must catch
      await expect(
        recovery.executeWithLoadBalancing(
          'req-test-1',
          async () => { throw boom; },
          stage,
        ),
      ).rejects.toThrow('Stage operation failed');

      // The catch block should have logged with the stage and request id
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancedErrorRecovery]'),
        expect.any(Error),
      );
      const warnCall = (logger.warn as jest.Mock).mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('req-test-1') &&
          c[0].includes('analysis'),
      );
      expect(warnCall).toBeDefined();
    });

    it('does not log warning when request succeeds', async () => {
      const { EnhancedErrorRecovery } = await import('@/quality/enhanced-error-recovery');
      const recovery = new EnhancedErrorRecovery();

      const result = await recovery.executeWithLoadBalancing(
        'req-success-1',
        async () => 'ok',
        'analysis' as any,
      );

      expect(result).toBe('ok');

      const stageWarnCalls = (logger.warn as jest.Mock).mock.calls.filter(
        (c: unknown[]) =>
          typeof c[0] === 'string' && c[0].includes('req-success-1'),
      );
      expect(stageWarnCalls).toHaveLength(0);
    });
  });
});
