/**
 * Tests for RegressionDetector module
 * Covers: getInstance, establishBaseline, loadBaseline, detectRegressions,
 *         resetBaseline, formatRegressionReport, getRegressionDetector
 */

import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import type { RegressionDetector as RegressionDetectorType } from '@/quality/regression-detector';

// --- Mocks ---
const mockGetLatestMetrics = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// Lazy-loaded imports (avoids top-level await in CJS mode)
let RegressionDetector: typeof RegressionDetectorType;
let formatRegressionReport: typeof import('@/quality/regression-detector').formatRegressionReport;
let getRegressionDetector: typeof import('@/quality/regression-detector').getRegressionDetector;

beforeAll(async () => {
  const mod = await import('@/quality/regression-detector');
  RegressionDetector = mod.RegressionDetector;
  formatRegressionReport = mod.formatRegressionReport;
  getRegressionDetector = mod.getRegressionDetector;
});

// --- Helpers ---
let testCounter = 0;

function uniqueTestPath(): string {
  testCounter++;
  return path.join('/tmp', `test-regression-baseline-${process.pid}-${testCounter}.json`);
}

function makeMetrics(overrides: Record<string, unknown> = {}) {
  return {
    timestamp: new Date('2025-01-01'),
    phase: 'test',
    iteration: 1,
    processingTime: 1000,
    memoryUsage: 256,
    layoutOverlap: 0,
    errorCount: 0,
    warningCount: 0,
    fallbackTriggered: false,
    transcriptionAccuracy: 0.9,
    entityExtractionF1: 0.85,
    relationshipAccuracy: 0.88,
    edgeCompleteness: 0.8,
    ...overrides,
  };
}

function resetSingleton() {
  const Ctor = RegressionDetector as unknown as { instance: RegressionDetectorType | null };
  Ctor.instance = null;
}

/**
 * Inject a mock qualityMonitor onto the detector instance.
 * ESM jest.mock cannot intercept the relative import used by the source,
 * so we override the property directly after construction.
 */
function injectMockQualityMonitor(detector: RegressionDetectorType) {
  Object.defineProperty(detector, 'qualityMonitor', {
    value: { getLatestMetrics: mockGetLatestMetrics },
    writable: true,
    configurable: true,
  });
  (detector as Record<string, unknown>).baseline = null;
}

// --- Tests ---
describe('RegressionDetector', () => {
  let currentTestPath: string;

  beforeEach(() => {
    resetSingleton();
    mockGetLatestMetrics.mockReset();
    currentTestPath = uniqueTestPath();
  });

  afterEach(() => {
    // Clean up real baseline files
    try { fs.unlinkSync(currentTestPath); } catch { /* expected if file was never created */ }
  });

  describe('getInstance', () => {
    test('returns singleton instance', () => {
      const a = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(a);
      const b = RegressionDetector.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('establishBaseline', () => {
    test('throws when no metrics available', async () => {
      mockGetLatestMetrics.mockReturnValue(null);
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await expect(d.establishBaseline()).rejects.toThrow('No metrics available');
    });

    test('creates baseline with correct confidence', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      const bl = await d.establishBaseline(20);
      expect(bl.sampleSize).toBe(20);
      expect(bl.confidenceLevel).toBe(0.2);
    });

    test('caps confidence at 0.95', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect((await d.establishBaseline(200)).confidenceLevel).toBe(0.95);
    });
  });

  describe('loadBaseline', () => {
    test('returns null when no file exists', async () => {
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();
    });

    test('loads and parses baseline from disk', async () => {
      const metrics = makeMetrics();
      const baselineData = {
        timestamp: '2025-01-01T00:00:00.000Z',
        metrics: { ...metrics, timestamp: '2025-01-01T00:00:00.000Z' },
        sampleSize: 10,
        confidenceLevel: 0.1,
      };
      fs.writeFileSync(currentTestPath, JSON.stringify(baselineData));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      const loaded = await d.loadBaseline();
      expect(loaded).not.toBeNull();
      expect(loaded!.sampleSize).toBe(10);
      expect(loaded!.timestamp).toBeInstanceOf(Date);
    });

    test('returns null on parse error', async () => {
      fs.writeFileSync(currentTestPath, 'invalid json{{{');
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();
    });

    // --- finiteness guard (TASK-0217, mirrors c9216907 Lottie export fix) ---
    //
    // JSON.parse('1e400') returns Infinity and `new Date(Infinity)` returns
    // an Invalid Date — silently poisoning the regression baseline. These
    // tests assert the rejection surface: any payload whose timestamp cannot
    // produce a finite Date is dropped, the poisoned file is removed, and
    // loadBaseline returns null so the caller falls back to "no baseline yet".

    test('rejects Infinity timestamp (1e400 → poisoned baseline deleted)', async () => {
      const metrics = makeMetrics();
      const baseline = {
        timestamp: 1e400,
        metrics: { ...metrics, timestamp: '2025-01-01T00:00:00.000Z' },
        sampleSize: 10,
        confidenceLevel: 0.1,
      };
      fs.writeFileSync(currentTestPath, JSON.stringify(baseline));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();

      // The poisoned baseline must NOT linger on disk for the next call.
      expect(fs.existsSync(currentTestPath)).toBe(false);
    });

    test('rejects Infinity timestamp at metrics level', async () => {
      const metrics = makeMetrics();
      const baseline = {
        timestamp: '2025-01-01T00:00:00.000Z',
        metrics: { ...metrics, timestamp: -1e400 },
        sampleSize: 10,
        confidenceLevel: 0.1,
      };
      fs.writeFileSync(currentTestPath, JSON.stringify(baseline));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();
      expect(fs.existsSync(currentTestPath)).toBe(false);
    });

    test('rejects non-date string that JSON.parse cannot rescue', async () => {
      const metrics = makeMetrics();
      const baseline = {
        timestamp: 'not-a-date',
        metrics: { ...metrics, timestamp: '2025-01-01T00:00:00.000Z' },
        sampleSize: 10,
        confidenceLevel: 0.1,
      };
      fs.writeFileSync(currentTestPath, JSON.stringify(baseline));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();
    });

    test('rejects object payload without metrics', async () => {
      fs.writeFileSync(currentTestPath, JSON.stringify({ timestamp: '2025-01-01T00:00:00.000Z' }));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      expect(await d.loadBaseline()).toBeNull();
    });

    test('still accepts legitimate ISO-string timestamps (no regression)', async () => {
      const metrics = makeMetrics();
      const baseline = {
        timestamp: '2025-01-01T00:00:00.000Z',
        metrics: { ...metrics, timestamp: '2025-01-01T00:00:00.000Z' },
        sampleSize: 10,
        confidenceLevel: 0.1,
      };
      fs.writeFileSync(currentTestPath, JSON.stringify(baseline));

      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      const loaded = await d.loadBaseline();
      expect(loaded).not.toBeNull();
      expect(loaded!.timestamp).toBeInstanceOf(Date);
      expect(loaded!.timestamp.getTime()).toBe(new Date('2025-01-01T00:00:00.000Z').getTime());
    });
  });

  describe('detectRegressions', () => {
    test('throws when no baseline available', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await expect(d.detectRegressions()).rejects.toThrow('No baseline available');
    });

    test('throws when no current metrics', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics())
        .mockReturnValueOnce(null);
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      await expect(d.detectRegressions()).rejects.toThrow('No current metrics');
    });

    test('detects regression for lower-is-better metric (processingTime +30%)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 1300 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      const r = report.regressions.find(x => x.metric === 'processingTime');
      expect(r).toBeDefined();
      expect(r!.severity).toBe('severe');
    });

    test('detects regression for higher-is-better metric (accuracy -20%)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ transcriptionAccuracy: 0.9 }))
        .mockReturnValueOnce(makeMetrics({ transcriptionAccuracy: 0.72 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      const r = report.regressions.find(x => x.metric === 'transcriptionAccuracy');
      expect(r).toBeDefined();
      expect(r!.severity).toBe('moderate');
    });

    test('detects improvement when processingTime decreases', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 700 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      const imp = report.improvements.find(x => x.metric === 'processingTime');
      expect(imp).toBeDefined();
      expect(imp!.changePercent).toBeLessThan(0);
    });

    test('returns stable when no significant changes', async () => {
      const m = makeMetrics();
      mockGetLatestMetrics.mockReturnValueOnce(m).mockReturnValueOnce({ ...m });
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.overallStatus).toBe('stable');
      expect(report.regressions).toHaveLength(0);
    });

    test('classifies critical severity for 50%+ degradation', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 1600 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.severity).toBe('critical');
      expect(report.overallStatus).toBe('regressed');
    });

    test('skips metric when baseline is zero but current is non-zero (no Infinity)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 0 }))
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 5 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      // Should not produce Infinity regressions
      const r = report.regressions.find(x => x.metric === 'layoutOverlap');
      expect(r).toBeUndefined();
      expect(report.regressions.every(x => Number.isFinite(x.changePercent))).toBe(true);
    });

    test('skips metrics where both values are zero', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 0, errorCount: 0 }))
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 0, errorCount: 0 }));
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.regressions.find(x => x.metric === 'layoutOverlap')).toBeUndefined();
    });

    test('does not detect improvement below threshold (2% change)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 981 })); // -1.9%, below 5% threshold
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.improvements.find(x => x.metric === 'processingTime')).toBeUndefined();
    });
  });

  describe('resetBaseline', () => {
    test('clears baseline from memory and disk', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(currentTestPath);
      injectMockQualityMonitor(d);
      await d.establishBaseline();
      expect(d.getBaseline()).not.toBeNull();
      expect(fs.existsSync(currentTestPath)).toBe(true);

      await d.resetBaseline();
      expect(d.getBaseline()).toBeNull();
      expect(fs.existsSync(currentTestPath)).toBe(false);
    });
  });
});

describe('formatRegressionReport', () => {
  test('formats report with regressions', () => {
    const report = {
      timestamp: new Date(),
      overallStatus: 'degraded' as const,
      regressions: [
        {
          metric: 'processingTime',
          baselineValue: 1000,
          currentValue: 1300,
          changePercent: 30,
          severity: 'severe' as const,
          impact: 'Processing time increased',
          recommendation: 'Optimize prompts',
        },
      ],
      improvements: [],
      baseline: makeMetrics(),
      current: makeMetrics(),
      recommendations: ['Optimize prompts'],
      severity: 'severe' as const,
    };

    const out = formatRegressionReport(report);
    expect(out).toContain('DEGRADED');
    expect(out).toContain('processingTime');
  });

  test('formats stable report', () => {
    const report = {
      timestamp: new Date(),
      overallStatus: 'stable' as const,
      regressions: [],
      improvements: [],
      baseline: makeMetrics(),
      current: makeMetrics(),
      recommendations: ['Stable'],
      severity: 'none' as const,
    };

    const out = formatRegressionReport(report);
    expect(out).toContain('STABLE');
  });
});

describe('getRegressionDetector', () => {
  test('returns RegressionDetector instance', () => {
    const detector = getRegressionDetector();
    expect(detector).toBeInstanceOf(RegressionDetector);
  });
});
