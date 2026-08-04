/**
 * End-to-end integration test for corruption recovery.
 *
 * Verifies that when localStorage contains corrupted data, the application
 * gracefully degrades: hooks/services return safe defaults, no crash occurs,
 * and the user can still interact with all config sections.
 */

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ProductionConfigManager } from '@/config/production-config';
import { setCorruptionHandler, type CorruptionReport } from '@/utils/report-corruption';

// ── localStorage mock ──
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key]; }),
  clear: jest.fn(() => { for (const k of Object.keys(mockStorage)) delete mockStorage[k]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

Object.defineProperty(globalThis, 'navigator', {
  value: { hardwareConcurrency: 8 },
  writable: true,
});

Object.defineProperty(globalThis, 'performance', {
  value: {
    ...globalThis.performance,
    memory: { jsHeapSizeLimit: 2048 * 1024 * 1024 },
  },
  writable: true,
});

describe('corruption recovery: end-to-end integration', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('scenario 1: completely garbled localStorage', () => {
    it('manager constructs without crash and returns valid config', () => {
      mockStorage['production-config-overrides'] = '}}}garbled{{{';

      expect(() => new ProductionConfigManager()).not.toThrow();

      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();

      // All sections must be present and usable
      expect(config.name).toBe('development');
      expect(typeof config.apiBaseUrl).toBe('string');
      expect(config.features).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.monitoring).toBeDefined();
      expect(config.export).toBeDefined();
    });

    it('validateConfig passes after recovery', () => {
      mockStorage['production-config-overrides'] = '}}}garbled{{{';
      const mgr = new ProductionConfigManager();
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('can update and persist new config after recovery', () => {
      mockStorage['production-config-overrides'] = '}}}garbled{{{';
      const mgr = new ProductionConfigManager();

      // User can still update config
      mgr.updateConfig({ apiBaseUrl: 'http://recovered/api' });
      expect(mgr.getConfig().apiBaseUrl).toBe('http://recovered/api');
    });
  });

  describe('scenario 2: malformed object (wrong field types)', () => {
    it('rejects config with numeric apiBaseUrl and recovers', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        apiBaseUrl: 12345,
        features: 'not-an-object',
      });

      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();

      // Should fall back to default apiBaseUrl
      expect(typeof config.apiBaseUrl).toBe('string');
      expect(config.apiBaseUrl).toContain('localhost');
      expect(typeof config.features).toBe('object');
    });

    it('rejects config with wrong performance types and recovers', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        performance: { maxConcurrentJobs: 'many', timeoutMs: 'never' },
      });

      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();

      expect(typeof config.performance.maxConcurrentJobs).toBe('number');
      expect(config.performance.maxConcurrentJobs).toBeGreaterThan(0);
      expect(typeof config.performance.timeoutMs).toBe('number');
    });
  });

  describe('scenario 3: partial corruption (valid fields mixed with invalid)', () => {
    it('handles valid apiBaseUrl but corrupted performance section', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        apiBaseUrl: 'http://test/api',
        performance: 42, // wrong type
      });

      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();

      // The malformed config should have been rejected entirely
      // (validateConfigOverrides returns false for any field mismatch)
      // So we get defaults
      expect(config.apiBaseUrl).toContain('localhost');
    });
  });

  describe('scenario 4: corruption during runtime operations', () => {
    it('resetConfig clears corruption and returns clean defaults', () => {
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2, 3]);
      const mgr = new ProductionConfigManager();

      mgr.resetConfig();
      const config = mgr.getConfig();
      expect(config.apiBaseUrl).toContain('localhost');
      expect(mgr.validateConfig().isValid).toBe(true);
    });

    it('getOptimizedConfig works after corruption recovery', () => {
      mockStorage['production-config-overrides'] = 'null';
      const mgr = new ProductionConfigManager();

      expect(() => mgr.getOptimizedConfig()).not.toThrow();
      const optimized = mgr.getOptimizedConfig();
      expect(optimized.performance).toBeDefined();
      expect(optimized.export).toBeDefined();
    });

    it('generatePerformanceReport works after corruption recovery', () => {
      mockStorage['production-config-overrides'] = JSON.stringify(42);
      const mgr = new ProductionConfigManager();

      expect(() => mgr.generatePerformanceReport()).not.toThrow();
      const report = mgr.generatePerformanceReport();
      expect(report.configValidation.isValid).toBe(true);
    });
  });

  describe('scenario 5: corruption telemetry', () => {
    it('emits warning when corruption is detected', () => {
      const receivedReports: CorruptionReport[] = [];
      setCorruptionHandler((r) => receivedReports.push(r));

      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 999 });

      new ProductionConfigManager();

      setCorruptionHandler(null);
      expect(receivedReports.length).toBeGreaterThan(0);
      expect(receivedReports[0].source).toBe('ProductionConfig');
    });

    it('removes corrupted entry from localStorage', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 999 });

      new ProductionConfigManager();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('production-config-overrides');
    });
  });

  describe('scenario 6: no corruption — normal operation unaffected', () => {
    it('valid overrides are applied without warnings', () => {
      const receivedReports: CorruptionReport[] = [];
      setCorruptionHandler((r) => receivedReports.push(r));

      mockStorage['production-config-overrides'] = JSON.stringify({
        apiBaseUrl: 'http://custom/api',
      });

      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();

      setCorruptionHandler(null);
      expect(config.apiBaseUrl).toBe('http://custom/api');
      expect(receivedReports).toHaveLength(0);
    });

    it('empty localStorage produces default config', () => {
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config.name).toBe('development');
      expect(mgr.validateConfig().isValid).toBe(true);
    });
  });

  // ── Centralized reportCorruption integration ──
  describe('scenario 7: reportCorruption is called from production-config', () => {
    let receivedReports: CorruptionReport[];

    beforeEach(() => {
      receivedReports = [];
      setCorruptionHandler((r) => receivedReports.push(r));
    });

    afterEach(() => {
      setCorruptionHandler(null);
    });

    it('emits reportCorruption when localStorage has malformed field types', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ apiBaseUrl: 999 });

      new ProductionConfigManager();

      expect(receivedReports.length).toBeGreaterThanOrEqual(1);
      expect(receivedReports[0].source).toBe('ProductionConfig');
      expect(receivedReports[0].detail).toContain('failed type validation');
    });

    it('emits reportCorruption when localStorage has non-object value', () => {
      mockStorage['production-config-overrides'] = JSON.stringify([1, 2, 3]);

      new ProductionConfigManager();

      expect(receivedReports.length).toBeGreaterThanOrEqual(1);
      expect(receivedReports[0].source).toBe('ProductionConfig');
      expect(receivedReports[0].detail).toContain('failed type validation');
    });

    it('does NOT emit reportCorruption for valid config', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({
        apiBaseUrl: 'http://valid/api',
      });

      new ProductionConfigManager();

      expect(receivedReports).toHaveLength(0);
    });

    it('recovered flag is true (corruption is recovered from)', () => {
      mockStorage['production-config-overrides'] = JSON.stringify({ features: null });

      new ProductionConfigManager();

      expect(receivedReports.length).toBeGreaterThanOrEqual(1);
      expect(receivedReports[0].recovered).toBe(true);
    });
  });
});
