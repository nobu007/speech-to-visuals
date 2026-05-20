/**
 * Tests for RegressionDetector module
 * Covers: getInstance, establishBaseline, loadBaseline, detectRegressions,
 *         resetBaseline, formatRegressionReport, getRegressionDetector
 */

import { jest } from '@jest/globals';
import type { RegressionDetector as RegressionDetectorType } from '@/quality/regression-detector';

// --- Mocks ---
const mockGetLatestMetrics = jest.fn();
const mockFsExistsSync = jest.fn().mockReturnValue(false);
const mockFsReadFile = jest.fn();
const mockFsWriteFile = jest.fn().mockResolvedValue(undefined);
const mockFsUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('@/pipeline/quality-monitor', () => ({
  QualityMonitor: {
    getInstance: () => ({ getLatestMetrics: mockGetLatestMetrics }),
  },
}));

jest.mock('fs', () => ({
  existsSync: mockFsExistsSync,
  promises: {
    readFile: mockFsReadFile,
    writeFile: mockFsWriteFile,
    unlink: mockFsUnlink,
  },
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
const TEST_PATH = '/tmp/test-regression-baseline.json';

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

// --- Tests ---
describe('RegressionDetector', () => {
  beforeEach(() => {
    resetSingleton();
    mockGetLatestMetrics.mockReset();
    mockFsExistsSync.mockReset().mockReturnValue(false);
    mockFsReadFile.mockReset();
    mockFsWriteFile.mockReset().mockResolvedValue(undefined);
    mockFsUnlink.mockReset().mockResolvedValue(undefined);
  });

  describe('getInstance', () => {
    test('returns singleton instance', () => {
      const a = RegressionDetector.getInstance(TEST_PATH);
      const b = RegressionDetector.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('establishBaseline', () => {
    test('throws when no metrics available', async () => {
      mockGetLatestMetrics.mockReturnValue(null);
      const d = RegressionDetector.getInstance(TEST_PATH);
      await expect(d.establishBaseline()).rejects.toThrow('No metrics available');
    });

    test('creates baseline with correct confidence', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(TEST_PATH);
      const bl = await d.establishBaseline(20);
      expect(bl.sampleSize).toBe(20);
      expect(bl.confidenceLevel).toBe(0.2);
    });

    test('caps confidence at 0.95', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(TEST_PATH);
      expect((await d.establishBaseline(200)).confidenceLevel).toBe(0.95);
    });
  });

  describe('loadBaseline', () => {
    test('returns null when no file exists', async () => {
      const d = RegressionDetector.getInstance(TEST_PATH);
      expect(await d.loadBaseline()).toBeNull();
    });

    test('loads and parses baseline from disk', async () => {
      const metrics = makeMetrics();
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFile.mockResolvedValue(
        JSON.stringify({
          timestamp: '2025-01-01T00:00:00.000Z',
          metrics: { ...metrics, timestamp: '2025-01-01T00:00:00.000Z' },
          sampleSize: 10,
          confidenceLevel: 0.1,
        }),
      );
      const d = RegressionDetector.getInstance(TEST_PATH);
      const loaded = await d.loadBaseline();
      expect(loaded).not.toBeNull();
      expect(loaded!.sampleSize).toBe(10);
      expect(loaded!.timestamp).toBeInstanceOf(Date);
    });

    test('returns null on parse error', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFile.mockResolvedValue('invalid json{{{');
      const d = RegressionDetector.getInstance(TEST_PATH);
      expect(await d.loadBaseline()).toBeNull();
    });
  });

  describe('detectRegressions', () => {
    test('throws when no baseline available', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(TEST_PATH);
      await expect(d.detectRegressions()).rejects.toThrow('No baseline available');
    });

    test('throws when no current metrics', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics())
        .mockReturnValueOnce(null);
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      await expect(d.detectRegressions()).rejects.toThrow('No current metrics');
    });

    test('detects regression for lower-is-better metric (processingTime +30%)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 1300 }));
      const d = RegressionDetector.getInstance(TEST_PATH);
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
      const d = RegressionDetector.getInstance(TEST_PATH);
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
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      const imp = report.improvements.find(x => x.metric === 'processingTime');
      expect(imp).toBeDefined();
      expect(imp!.changePercent).toBeLessThan(0);
    });

    test('returns stable when no significant changes', async () => {
      const m = makeMetrics();
      mockGetLatestMetrics.mockReturnValueOnce(m).mockReturnValueOnce({ ...m });
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.overallStatus).toBe('stable');
      expect(report.regressions).toHaveLength(0);
    });

    test('classifies critical severity for 50%+ degradation', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 1600 }));
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.severity).toBe('critical');
      expect(report.overallStatus).toBe('regressed');
    });

    test('skips metrics where both values are zero', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 0, errorCount: 0 }))
        .mockReturnValueOnce(makeMetrics({ layoutOverlap: 0, errorCount: 0 }));
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.regressions.find(x => x.metric === 'layoutOverlap')).toBeUndefined();
    });

    test('does not detect improvement below threshold (2% change)', async () => {
      mockGetLatestMetrics
        .mockReturnValueOnce(makeMetrics({ processingTime: 1000 }))
        .mockReturnValueOnce(makeMetrics({ processingTime: 981 })); // -1.9%, below 5% threshold
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      const report = await d.detectRegressions();

      expect(report.improvements.find(x => x.metric === 'processingTime')).toBeUndefined();
    });
  });

  describe('resetBaseline', () => {
    test('clears baseline from memory and disk', async () => {
      mockGetLatestMetrics.mockReturnValue(makeMetrics());
      const d = RegressionDetector.getInstance(TEST_PATH);
      await d.establishBaseline();
      expect(d.getBaseline()).not.toBeNull();

      mockFsExistsSync.mockReturnValue(true);
      await d.resetBaseline();
      expect(d.getBaseline()).toBeNull();
      expect(mockFsUnlink).toHaveBeenCalled();
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
