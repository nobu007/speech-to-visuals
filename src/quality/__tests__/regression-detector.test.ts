/**
 * Tests for RegressionDetector.
 *
 * Covers baseline establishment, regression detection across all metric types,
 * severity classification, report formatting, and lower-is-better logic.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('../../pipeline/quality-monitor');

import { RegressionDetector } from '../regression-detector';
import { formatRegressionReport } from '../regression-detector';
import type { QualityMetrics } from '../../pipeline/quality-monitor';
import { QualityMonitor } from '../../pipeline/quality-monitor';

describe('RegressionDetector', () => {
  let detector: RegressionDetector;
  let tmpDir: string;
  let baselinePath: string;
  let mockGetLatestMetrics: jest.Mock;

  const baseMetrics: QualityMetrics = {
    timestamp: new Date(),
    phase: 'test',
    iteration: 1,
    processingTime: 1000,
    memoryUsage: 100,
    transcriptionAccuracy: 0.95,
    sceneSegmentationF1: 0.9,
    entityExtractionF1: 0.88,
    relationshipAccuracy: 0.85,
    layoutOverlap: 0,
    edgeCompleteness: 0.92,
    errorCount: 0,
    warningCount: 2,
    fallbackTriggered: false,
  };

  beforeEach(() => {
    // Create a unique temp baseline path for each test
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-det-'));
    baselinePath = path.join(tmpDir, '.quality-baseline.json');

    // Reset singleton
    (RegressionDetector as unknown as { instance: null }).instance = null;

    // Mock QualityMonitor.getInstance
    mockGetLatestMetrics = jest.fn();
    (QualityMonitor.getInstance as jest.Mock) = jest.fn().mockReturnValue({
      getLatestMetrics: mockGetLatestMetrics,
    });

    detector = RegressionDetector.getInstance(baselinePath);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getInstance', () => {
    test('returns a singleton instance', () => {
      const d1 = RegressionDetector.getInstance(baselinePath);
      const d2 = RegressionDetector.getInstance(baselinePath);
      expect(d1).toBe(d2);
    });
  });

  describe('establishBaseline', () => {
    test('creates baseline from current metrics', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      const baseline = await detector.establishBaseline(20);
      expect(baseline.sampleSize).toBe(20);
      expect(baseline.confidenceLevel).toBeCloseTo(0.2);
      expect(baseline.metrics.processingTime).toBe(1000);
    });

    test('caps confidence at 0.95', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      const baseline = await detector.establishBaseline(200);
      expect(baseline.confidenceLevel).toBeCloseTo(0.95);
    });

    test('throws when no metrics available', async () => {
      mockGetLatestMetrics.mockReturnValue(null);
      await expect(detector.establishBaseline()).rejects.toThrow();
    });

    test('saves baseline to disk', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);
      expect(fs.existsSync(baselinePath)).toBe(true);
      const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
      expect(raw.sampleSize).toBe(10);
    });
  });

  describe('getBaseline', () => {
    test('returns null before establishment', () => {
      expect(detector.getBaseline()).toBeNull();
    });

    test('returns baseline after establishment', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      const baseline = await detector.establishBaseline(10);
      expect(detector.getBaseline()).toEqual(baseline);
    });
  });

  describe('loadBaseline', () => {
    test('loads baseline from disk', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      // Reset singleton to simulate fresh instance
      (RegressionDetector as unknown as { instance: null }).instance = null;
      (QualityMonitor.getInstance as jest.Mock) = jest.fn().mockReturnValue({
        getLatestMetrics: mockGetLatestMetrics,
      });
      const freshDetector = RegressionDetector.getInstance(baselinePath);
      const loaded = await freshDetector.loadBaseline();
      expect(loaded).not.toBeNull();
      expect(loaded!.sampleSize).toBe(10);
    });

    test('returns null when no baseline file exists', async () => {
      const result = await detector.loadBaseline();
      expect(result).toBeNull();
    });
  });

  describe('detectRegressions', () => {
    test('throws when no baseline established', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await expect(detector.detectRegressions()).rejects.toThrow();
    });

    test('throws when no current metrics', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);
      mockGetLatestMetrics.mockReturnValue(null);
      await expect(detector.detectRegressions()).rejects.toThrow();
    });

    test('returns stable when metrics unchanged', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);
      const report = await detector.detectRegressions();
      expect(report.overallStatus).toBe('stable');
      expect(report.regressions).toHaveLength(0);
      expect(report.improvements).toHaveLength(0);
      expect(report.severity).toBe('none');
    });

    test('detects regression in processingTime (lower is better)', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      // 50% increase in processing time
      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 1500,
      });
      const report = await detector.detectRegressions();
      expect(report.regressions.length).toBeGreaterThanOrEqual(1);
      const ptRegression = report.regressions.find((r) => r.metric === 'processingTime');
      expect(ptRegression).toBeDefined();
      expect(ptRegression!.severity).toBe('critical'); // 50% → critical
    });

    test('detects improvement in processingTime (lower is better)', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      // 50% decrease in processing time = improvement
      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 500,
      });
      const report = await detector.detectRegressions();
      expect(report.regressions).toHaveLength(0);
      const improvements = report.improvements.filter((i) => i.metric === 'processingTime');
      expect(improvements.length).toBeGreaterThanOrEqual(1);
      expect(report.overallStatus).toBe('improved');
    });

    test('detects regression in transcriptionAccuracy (higher is better)', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      // Significant drop from 0.95 to 0.75 (~-21%)
      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        transcriptionAccuracy: 0.75,
      });
      const report = await detector.detectRegressions();
      const accRegression = report.regressions.find((r) => r.metric === 'transcriptionAccuracy');
      expect(accRegression).toBeDefined();
      expect(accRegression!.severity).toBe('moderate'); // ~20% → moderate
    });

    test('detects regression in errorCount (lower is better)', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        errorCount: 5, // 0→5 is infinite %, but 0 baseline is skipped
      });
      const report = await detector.detectRegressions();
      // errorCount baseline is 0, so it's skipped per the code
      const errRegression = report.regressions.find((r) => r.metric === 'errorCount');
      expect(errRegression).toBeUndefined(); // skipped because baseline is 0
    });

    test('severity escalation: moderate regression', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      // 35% increase in memory → severe
      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        memoryUsage: 135,
      });
      const report = await detector.detectRegressions();
      const memRegression = report.regressions.find((r) => r.metric === 'memoryUsage');
      expect(memRegression).toBeDefined();
      expect(memRegression!.severity).toBe('severe');
    });

    test('generates recommendations for regressions', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 2000,
      });
      const report = await detector.detectRegressions();
      expect(report.recommendations.length).toBeGreaterThan(0);
      // Should contain the processingTime recommendation
      expect(
        report.recommendations.some((r) => r.includes('Optimize') || r.includes('processingTime'))
      ).toBe(true);
    });

    test('generates stable recommendation when no changes', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);
      const report = await detector.detectRegressions();
      expect(report.recommendations).toContain(
        'Quality metrics are stable. No significant changes detected.'
      );
    });

    test('overall status is regressed for critical/severe', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 2000, // +100% → critical
      });
      const report = await detector.detectRegressions();
      expect(report.overallStatus).toBe('regressed');
    });

    test('overall status is improved when improvements > regressions', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 500,   // -50% improvement
        memoryUsage: 50,       // -50% improvement
      });
      const report = await detector.detectRegressions();
      expect(report.regressions).toHaveLength(0);
      expect(report.improvements.length).toBeGreaterThanOrEqual(2);
      expect(report.overallStatus).toBe('improved');
    });

    test('report includes baseline and current metrics', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      const current = { ...baseMetrics, processingTime: 1200 };
      mockGetLatestMetrics.mockReturnValue(current);
      const report = await detector.detectRegressions();
      expect(report.baseline.processingTime).toBe(1000);
      expect(report.current.processingTime).toBe(1200);
    });
  });

  describe('resetBaseline', () => {
    test('removes baseline file and clears memory', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);
      expect(fs.existsSync(baselinePath)).toBe(true);

      await detector.resetBaseline();
      expect(detector.getBaseline()).toBeNull();
      expect(fs.existsSync(baselinePath)).toBe(false);
    });

    test('does not throw when baseline file does not exist', async () => {
      await expect(detector.resetBaseline()).resolves.not.toThrow();
    });
  });

  describe('impact descriptions', () => {
    test('processingTime regression has user experience impact text', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        processingTime: 1500,
      });
      const report = await detector.detectRegressions();
      const ptReg = report.regressions.find((r) => r.metric === 'processingTime');
      expect(ptReg!.impact).toContain('Processing time');
      expect(ptReg!.impact).toContain('user experience');
    });

    test('entityExtractionF1 regression has diagram completeness impact', async () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      await detector.establishBaseline(10);

      mockGetLatestMetrics.mockReturnValue({
        ...baseMetrics,
        entityExtractionF1: 0.70, // ~-20%
      });
      const report = await detector.detectRegressions();
      const eeReg = report.regressions.find((r) => r.metric === 'entityExtractionF1');
      expect(eeReg!.impact).toContain('Entity extraction');
      expect(eeReg!.impact).toContain('diagram completeness');
    });
  });

  describe('formatRegressionReport', () => {
    test('formats a stable report', () => {
      mockGetLatestMetrics.mockReturnValue({ ...baseMetrics });
      const report = {
        timestamp: new Date(),
        overallStatus: 'stable' as const,
        regressions: [],
        improvements: [],
        baseline: baseMetrics,
        current: baseMetrics,
        recommendations: ['Quality metrics are stable.'],
        severity: 'none' as const,
      };
      const formatted = formatRegressionReport(report);
      expect(formatted).toContain('STABLE');
      expect(formatted).toContain('Quality metrics are stable.');
    });

    test('formats a regressed report with regression details', () => {
      const report = {
        timestamp: new Date(),
        overallStatus: 'regressed' as const,
        regressions: [{
          metric: 'processingTime',
          baselineValue: 1000,
          currentValue: 2000,
          changePercent: 100,
          severity: 'critical' as const,
          impact: 'Processing time increased by 100.0%',
          recommendation: 'Optimize LLM prompt length',
        }],
        improvements: [],
        baseline: baseMetrics,
        current: baseMetrics,
        recommendations: ['Optimize LLM prompt length'],
        severity: 'critical' as const,
      };
      const formatted = formatRegressionReport(report);
      expect(formatted).toContain('REGRESSED');
      expect(formatted).toContain('CRITICAL');
      expect(formatted).toContain('processingTime');
      expect(formatted).toContain('Optimize LLM prompt length');
    });

    test('formats an improved report with improvement details', () => {
      const report = {
        timestamp: new Date(),
        overallStatus: 'improved' as const,
        regressions: [],
        improvements: [{
          metric: 'processingTime',
          baselineValue: 1000,
          currentValue: 500,
          changePercent: -50,
          impact: 'Processing time decreased by 50.0%',
        }],
        baseline: baseMetrics,
        current: baseMetrics,
        recommendations: ['System showing improvements!'],
        severity: 'none' as const,
      };
      const formatted = formatRegressionReport(report);
      expect(formatted).toContain('IMPROVED');
      expect(formatted).toContain('processingTime');
      expect(formatted).toContain('-50.0%');
    });
  });
});
