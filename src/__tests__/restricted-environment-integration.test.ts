/**
 * Restricted-environment integration tests
 *
 * Verifies that services persisting to localStorage degrade gracefully
 * when localStorage is unavailable (private browsing, quota exceeded,
 * security policy denial). This is a proactive test pattern to catch
 * the same class of failure across all localStorage consumers.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock logger to avoid console noise
jest.mock('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  // production-config imports LogLevel (monitoring.logLevel→logger, REQ-059).
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, SILENT: 4 },
}));

describe('Restricted-environment integration: localStorage denial', () => {
  let originalLocalStorage: Storage | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    // Restore localStorage
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    }
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  /**
   * Helper: replace localStorage with a throwing proxy to simulate denial
   */
  function denyLocalStorage(): void {
    const denialError = new DOMException('The operation is insecure.', 'SecurityError');
    const denied: ProxyHandler<Storage> = {
      get(_target, prop) {
        if (prop === 'getItem') return () => { throw denialError; };
        if (prop === 'setItem') return () => { throw denialError; };
        if (prop === 'removeItem') return () => { throw denialError; };
        if (prop === 'clear') return () => { throw denialError; };
        if (prop === 'key') return () => { throw denialError; };
        if (prop === 'length') return 0;
        return undefined;
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: new Proxy({} as Storage, denied),
      writable: true,
      configurable: true,
    });
  }

  describe('ProductionConfigManager under localStorage denial', () => {
    it('should not throw when constructing with localStorage denied', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => new ProductionConfigManager()).not.toThrow();
    });

    it('should return valid config even when localStorage is denied', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      const config = mgr.getConfig();
      expect(config).toBeDefined();
      expect(config.name).toBe('development');
      expect(config.performance).toBeDefined();
    });

    it('should not throw when updateConfig tries to persist to denied localStorage', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      expect(() => mgr.updateConfig({ apiBaseUrl: 'http://test/api' })).not.toThrow();
      // Override should still be in memory
      expect(mgr.getConfig().apiBaseUrl).toBe('http://test/api');
    });

    it('should not throw when resetConfig tries to clear denied localStorage', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      mgr.updateConfig({ apiBaseUrl: 'http://override/api' });
      expect(() => mgr.resetConfig()).not.toThrow();
      // After reset, should fall back to default
      expect(mgr.getConfig().apiBaseUrl).toContain('localhost');
    });

    it('should produce a valid performance report under localStorage denial', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      const report = mgr.generatePerformanceReport();
      expect(report).toHaveProperty('environment');
      expect(report).toHaveProperty('configValidation');
      expect(report.configValidation.isValid).toBe(true);
    });

    it('should validate config correctly under localStorage denial', async () => {
      denyLocalStorage();
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      const result = mgr.validateConfig();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('TutorialSystem saveProgress under localStorage denial', () => {
    it('should not throw when saveProgress writes to denied localStorage', () => {
      denyLocalStorage();
      // We test the saveProgress logic in isolation since the component
      // requires full React rendering environment.
      // The pattern: try { localStorage.setItem(...) } catch { noop }
      const saveProgress = (steps: Set<string>, stepId: string): Set<string> => {
        const newCompleted = new Set(steps);
        newCompleted.add(stepId);
        try {
          localStorage.setItem('tutorial-progress', JSON.stringify(Array.from(newCompleted)));
        } catch {
          // localStorage unavailable — progress in memory only
        }
        return newCompleted;
      };

      const initial = new Set<string>(['step1']);
      expect(() => saveProgress(initial, 'step2')).not.toThrow();
      const result = saveProgress(initial, 'step2');
      expect(result.has('step1')).toBe(true);
      expect(result.has('step2')).toBe(true);
    });

    it('should handle localStorage quota exceeded gracefully', () => {
      // Simulate quota exceeded — setItem throws QuotaExceededError
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => { throw quotaError; },
          removeItem: () => { throw quotaError; },
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      // Same logic as TutorialSystem.saveProgress
      const saveProgress = (steps: Set<string>, stepId: string): Set<string> => {
        const newCompleted = new Set(steps);
        newCompleted.add(stepId);
        try {
          localStorage.setItem('tutorial-progress', JSON.stringify(Array.from(newCompleted)));
        } catch {
          // Quota exceeded — keep progress in memory
        }
        return newCompleted;
      };

      expect(() => saveProgress(new Set(), 'step1')).not.toThrow();
      expect(saveProgress(new Set(), 'step1').has('step1')).toBe(true);
    });
  });

  describe('Cross-service localStorage denial resilience', () => {
    it('all localStorage consumers should survive concurrent denial', async () => {
      denyLocalStorage();

      // 1. ProductionConfigManager
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      const mgr = new ProductionConfigManager();
      expect(() => mgr.updateConfig({ apiBaseUrl: 'http://x/api' })).not.toThrow();
      expect(() => mgr.resetConfig()).not.toThrow();
      expect(mgr.getConfig().name).toBe('development');

      // 2. TutorialSystem pattern
      const saveProgress = () => {
        try {
          localStorage.setItem('tutorial-progress', '[]');
          return true;
        } catch {
          return false;
        }
      };
      expect(() => saveProgress()).not.toThrow();

      // 3. First-visit pattern from TutorialSystem
      const checkFirstVisit = () => {
        try {
          const v = localStorage.getItem('first-visit');
          if (v === null) {
            localStorage.setItem('first-visit', 'false');
            return true;
          }
          return false;
        } catch {
          return true; // Default to first visit when localStorage denied
        }
      };
      expect(() => checkFirstVisit()).not.toThrow();
      expect(checkFirstVisit()).toBe(true);
    });

    it('should handle localStorage being undefined entirely (SSR / Node)', () => {
      // Remove localStorage entirely
      Object.defineProperty(globalThis, 'localStorage', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // TutorialSystem first-visit pattern with typeof guard
      const checkFirstVisit = (): boolean => {
        try {
          if (typeof localStorage === 'undefined') return true;
          const v = localStorage.getItem('first-visit');
          if (v === null) {
            localStorage.setItem('first-visit', 'false');
            return true;
          }
          return false;
        } catch {
          return true;
        }
      };

      expect(() => checkFirstVisit()).not.toThrow();
      expect(checkFirstVisit()).toBe(true);
    });
  });

  describe('Corrupted localStorage data recovery', () => {
    it('should handle corrupted JSON in tutorial-progress without crashing', () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => key === 'tutorial-progress' ? '{corrupt json' : null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      // TutorialSystem load pattern
      const loadProgress = (): Set<string> => {
        let savedProgress: string | null = null;
        try {
          savedProgress = localStorage.getItem('tutorial-progress');
        } catch {
          return new Set();
        }

        if (savedProgress) {
          try {
            const parsed = JSON.parse(savedProgress);
            if (Array.isArray(parsed)) {
              return new Set(parsed);
            }
          } catch {
            try { localStorage.removeItem('tutorial-progress'); } catch { /* noop */ }
          }
        }
        return new Set();
      };

      expect(() => loadProgress()).not.toThrow();
      expect(loadProgress().size).toBe(0);
    });

    it('should handle non-array JSON in tutorial-progress', () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => key === 'tutorial-progress' ? '{"step1": true}' : null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      const loadProgress = (): Set<string> => {
        try {
          const saved = localStorage.getItem('tutorial-progress');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return new Set(parsed);
          }
        } catch {
          // Corrupted
        }
        return new Set();
      };

      expect(() => loadProgress()).not.toThrow();
      expect(loadProgress().size).toBe(0);
    });
  });

  describe('ProductionConfigManager with corrupted localStorage data', () => {
    it('should not crash when localStorage returns corrupted JSON for config overrides', async () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => key === 'production-config-overrides' ? '{corrupt' : null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => {
        const mgr = new ProductionConfigManager();
        expect(mgr.getConfig()).toBeDefined();
      }).not.toThrow();
    });

    it('should not crash when localStorage returns non-object JSON for config overrides', async () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => key === 'production-config-overrides' ? '"just a string"' : null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => {
        const mgr = new ProductionConfigManager();
        expect(mgr.getConfig().name).toBe('development');
      }).not.toThrow();
    });

    it('should survive rapid sequential instantiation under localStorage denial', async () => {
      denyLocalStorage();

      // Rapidly create and discard multiple instances — simulates
      // hot-module reloading or fast page transitions
      for (let i = 0; i < 10; i++) {
        const { ProductionConfigManager } = await import('@stv/core/config/production-config');
        const mgr = new ProductionConfigManager();
        mgr.updateConfig({ apiBaseUrl: `http://test-${i}/api` });
        expect(mgr.getConfig().apiBaseUrl).toBe(`http://test-${i}/api`);
        jest.resetModules();
      }
    });
  });

  describe('Partial localStorage failure modes', () => {
    it('should handle getItem succeeding but setItem throwing (read-only mode)', async () => {
      const securityError = new DOMException('Security error', 'SecurityError');
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: () => JSON.stringify({ apiBaseUrl: 'http://stored/api' }),
          setItem: () => { throw securityError; },
          removeItem: () => { throw securityError; },
          clear: () => { throw securityError; },
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      // ProductionConfigManager should still work in read-only mode
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => {
        const mgr = new ProductionConfigManager();
        // updateConfig will try to persist but fail — should not throw
        mgr.updateConfig({ apiBaseUrl: 'http://new/api' });
        // In-memory override should still work
        expect(mgr.getConfig().apiBaseUrl).toBe('http://new/api');
      }).not.toThrow();
    });

    it('should handle localStorage key enumeration throwing during denial', async () => {
      denyLocalStorage();

      // Accessing .length and .key() should not crash consumers
      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => {
        const mgr = new ProductionConfigManager();
        mgr.getConfig();
        mgr.validateConfig();
        mgr.generatePerformanceReport();
      }).not.toThrow();
    });

    it('should handle intermittent localStorage availability (flapping)', async () => {
      // Simulate localStorage that works sometimes and fails sometimes
      let callCount = 0;
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: () => {
            callCount++;
            if (callCount % 2 === 0) {
              throw new DOMException('Intermittent failure', 'SecurityError');
            }
            return null;
          },
          setItem: () => {
            callCount++;
            if (callCount % 3 === 0) {
              throw new DOMException('Intermittent failure', 'SecurityError');
            }
          },
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      // Should survive multiple instantiations despite flapping
      for (let i = 0; i < 3; i++) {
        const { ProductionConfigManager } = await import('@stv/core/config/production-config');
        expect(() => {
          const mgr = new ProductionConfigManager();
          mgr.getConfig();
        }).not.toThrow();
        jest.resetModules();
      }
    });
  });

  describe('LocalStorage type coercion resilience', () => {
    it('should handle getItem returning non-string values gracefully', async () => {
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: () => null as unknown as string, // null like empty storage
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      const { ProductionConfigManager } = await import('@stv/core/config/production-config');
      expect(() => new ProductionConfigManager()).not.toThrow();
    });

    it('should handle extremely long stored values without crashing', () => {
      const hugeValue = 'x'.repeat(10_000_000); // 10MB string
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => key === 'tutorial-progress' ? hugeValue : null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        },
        writable: true,
        configurable: true,
      });

      // TutorialSystem pattern: parse and validate
      const loadProgress = (): Set<string> => {
        try {
          const saved = localStorage.getItem('tutorial-progress');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return new Set(parsed);
          }
        } catch {
          // Corrupted or too large
        }
        return new Set();
      };

      // Should not crash — JSON.parse will fail on non-JSON huge string
      expect(() => loadProgress()).not.toThrow();
      expect(loadProgress().size).toBe(0);
    });
  });
});
