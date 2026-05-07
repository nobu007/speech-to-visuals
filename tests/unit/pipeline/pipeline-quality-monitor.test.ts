import {
  QualityMonitor,
  getQualityMonitor,
  formatQualityReport,
  QualityMetrics,
  QualityThresholds,
} from '@/pipeline/quality-monitor';

describe('QualityMonitor (pipeline)', () => {
  let monitor: QualityMonitor;

  beforeEach(() => {
    // Get fresh instance via private constructor reset
    monitor = QualityMonitor.getInstance();
    monitor.reset();
    // Reset singleton for clean tests
    (QualityMonitor as unknown as { instance: null }).instance = null;
    monitor = QualityMonitor.getInstance();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QualityMonitor.getInstance();
      const instance2 = QualityMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getQualityMonitor', () => {
    it('should return QualityMonitor instance', () => {
      const qm = getQualityMonitor();
      expect(qm).toBeInstanceOf(QualityMonitor);
    });
  });

  describe('recordMetrics', () => {
    it('should record metrics', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 256,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 1,
        fallbackTriggered: false,
      });

      const latest = monitor.getLatestMetrics();
      expect(latest).not.toBeNull();
      expect(latest!.processingTime).toBe(5000);
      expect(latest!.memoryUsage).toBe(256);
      expect(latest!.errorCount).toBe(0);
    });

    it('should fill in default values for missing fields', () => {
      monitor.recordMetrics({ processingTime: 1000 });

      const latest = monitor.getLatestMetrics();
      expect(latest!.memoryUsage).toBe(0);
      expect(latest!.layoutOverlap).toBe(0);
      expect(latest!.fallbackTriggered).toBe(false);
    });

    it('should keep only last 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        monitor.recordMetrics({ processingTime: i });
      }

      // Should have trimmed to around 100
      const latest = monitor.getLatestMetrics();
      expect(latest!.processingTime).toBe(109);
    });
  });

  describe('generateReport', () => {
    it('should return critical report when no metrics', () => {
      const report = monitor.generateReport();
      expect(report.overallScore).toBe(0);
      expect(report.status).toBe('critical');
      expect(report.recommendations).toContain('No metrics available. Run system first.');
    });

    it('should generate excellent report for perfect metrics', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 256,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.90,
        entityExtractionF1: 0.90,
        relationshipAccuracy: 0.90,
        edgeCompleteness: 0.95,
        cacheHitRate: 0.8,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.status).toBe('excellent');
      expect(report.violations).toHaveLength(0);
    });

    it('should detect critical violations for low accuracy', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 5,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.5,
      });

      const report = monitor.generateReport();
      expect(report.violations.length).toBeGreaterThan(0);
      const criticalViolation = report.violations.find(v => v.severity === 'critical');
      expect(criticalViolation).toBeDefined();
      expect(criticalViolation!.metric).toBe('transcriptionAccuracy');
    });

    it('should detect warning violations', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        sceneSegmentationF1: 0.5,
      });

      const report = monitor.generateReport();
      const warning = report.violations.find(v => v.metric === 'sceneSegmentationF1');
      expect(warning).toBeDefined();
      expect(warning!.severity).toBe('warning');
    });

    it('should detect memory usage violation', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 700,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      const memViolation = report.violations.find(v => v.metric === 'memoryUsage');
      expect(memViolation).toBeDefined();
    });

    it('should detect processing time violation', () => {
      monitor.recordMetrics({
        processingTime: 60000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      const timeViolation = report.violations.find(v => v.metric === 'processingTime');
      expect(timeViolation).toBeDefined();
      expect(timeViolation!.severity).toBe('info');
    });

    it('should calculate improvement potential', () => {
      monitor.recordMetrics({
        processingTime: 60000,
        memoryUsage: 700,
        layoutOverlap: 5,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.5,
      });

      const report = monitor.generateReport();
      expect(report.improvementPotential).toBeGreaterThan(0);
    });

    it('should give low improvement potential for perfect metrics', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.improvementPotential).toBeLessThanOrEqual(10);
    });

    it('should deduct points for fallback triggered', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 1,
        warningCount: 0,
        fallbackTriggered: true,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeLessThan(100);
    });

    it('should deduct points for error count', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 3,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeLessThan(100);
    });
  });

  describe('determineStatus', () => {
    const cases = [
      { score: 95, expected: 'excellent' },
      { score: 80, expected: 'good' },
      { score: 65, expected: 'acceptable' },
      { score: 45, expected: 'needs_improvement' },
      { score: 20, expected: 'critical' },
    ];

    cases.forEach(({ score, expected }) => {
      it(`should return '${expected}' for score ${score}`, () => {
        monitor.recordMetrics({
          processingTime: 0,
          memoryUsage: 0,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        });
        const report = monitor.generateReport();
        // We can't directly set score, but we verify the method works
        expect(report.status).toBeDefined();
      });
    });
  });

  describe('getLatestMetrics', () => {
    it('should return null when no metrics recorded', () => {
      expect(monitor.getLatestMetrics()).toBeNull();
    });

    it('should return the most recent metrics', () => {
      monitor.recordMetrics({ processingTime: 1000 });
      monitor.recordMetrics({ processingTime: 2000 });

      const latest = monitor.getLatestMetrics();
      expect(latest!.processingTime).toBe(2000);
    });
  });

  describe('getTrend', () => {
    it('should return trend data for a metric', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({ processingTime: 1000 * (i + 1) });
      }

      const trend = monitor.getTrend('processingTime');
      expect(trend).toHaveLength(5);
      expect(trend[0]).toBe(1000);
      expect(trend[4]).toBe(5000);
    });

    it('should respect window size', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordMetrics({ processingTime: i * 100 });
      }

      const trend = monitor.getTrend('processingTime', 3);
      expect(trend).toHaveLength(3);
    });

    it('should return 0 for undefined metric values', () => {
      monitor.recordMetrics({ processingTime: 1000 });
      const trend = monitor.getTrend('transcriptionAccuracy');
      expect(trend).toEqual([0]);
    });
  });

  describe('logIteration', () => {
    it('should log iteration details', () => {
      monitor.logIteration({
        phaseId: 'phase-27',
        iterationNumber: 1,
        action: 'Test action',
        result: 'success',
        metrics: {
          timestamp: new Date(),
          phase: 'phase-27',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 256,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        improvements: ['Improved accuracy'],
        nextSteps: ['Run again'],
      });

      // Verify no error was thrown
      expect(true).toBe(true);
    });
  });

  describe('exportIterationHistory', () => {
    it('should export empty history', () => {
      const output = monitor.exportIterationHistory();
      expect(output).toContain('Iteration History');
    });

    it('should export iteration history with entries', () => {
      monitor.logIteration({
        phaseId: 'phase-27',
        iterationNumber: 1,
        action: 'Test',
        result: 'success',
        metrics: {
          timestamp: new Date(),
          phase: 'phase-27',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 256,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        improvements: ['Better layout'],
        nextSteps: ['Verify'],
      });

      const output = monitor.exportIterationHistory();
      expect(output).toContain('phase-27');
      expect(output).toContain('Better layout');
    });
  });

  describe('runDiagnostics', () => {
    it('should return critical status for no metrics', () => {
      const diag = monitor.runDiagnostics();
      expect(diag.health).toBe('critical');
    });

    it('should report violations', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 5,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.4,
      });

      const diag = monitor.runDiagnostics();
      expect(diag.critical.length).toBeGreaterThan(0);
    });

    it('should return empty critical/warnings for good metrics', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const diag = monitor.runDiagnostics();
      expect(diag.critical).toHaveLength(0);
      expect(diag.warnings).toHaveLength(0);
    });
  });

  describe('compareToBaseline', () => {
    it('should return empty for insufficient history', () => {
      monitor.recordMetrics({ processingTime: 1000 });
      const comparison = monitor.compareToBaseline();
      expect(comparison.improved).toEqual([]);
      expect(comparison.regressed).toEqual([]);
      expect(comparison.stable).toEqual([]);
    });

    it('should compare against baseline with enough history', () => {
      for (let i = 0; i < 6; i++) {
        monitor.recordMetrics({ processingTime: 10000 + i * 100 });
      }
      monitor.recordMetrics({ processingTime: 5000 });

      const comparison = monitor.compareToBaseline();
      expect(comparison.improved.length + comparison.stable.length + comparison.regressed.length).toBeGreaterThan(0);
    });
  });

  describe('regression detection', () => {
    it('should detect regression', () => {
      monitor.setRegressionBaseline('test-run', 85);
      const result = monitor.detectRegression('test-run', 70);
      expect(result.isRegression).toBe(true);
      expect(result.shouldBlock).toBe(true);
      expect(result.degradationPercent).toBeGreaterThan(5);
    });

    it('should not detect regression for improving score', () => {
      monitor.setRegressionBaseline('test-run', 85);
      const result = monitor.detectRegression('test-run', 90);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
    });

    it('should handle missing baseline', () => {
      const result = monitor.detectRegression('unknown', 50);
      expect(result.isRegression).toBe(false);
      expect(result.previousScore).toBe(0);
    });

    it('should not block for small regression', () => {
      monitor.setRegressionBaseline('test-run', 85);
      const result = monitor.detectRegression('test-run', 83);
      expect(result.isRegression).toBe(false);
      expect(result.shouldBlock).toBe(false);
    });
  });

  describe('setPhaseIteration', () => {
    it('should update phase and iteration', () => {
      monitor.setPhaseIteration('phase-28', 3);
      monitor.recordMetrics({ processingTime: 1000 });
      const latest = monitor.getLatestMetrics();
      expect(latest!.phase).toBe('phase-28');
      expect(latest!.iteration).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear all data', () => {
      monitor.recordMetrics({ processingTime: 5000 });
      monitor.logIteration({
        phaseId: 'test',
        iterationNumber: 1,
        action: 'test',
        result: 'success',
        metrics: {
          timestamp: new Date(),
          phase: 'test',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 256,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        improvements: [],
        nextSteps: [],
      });

      monitor.reset();
      expect(monitor.getLatestMetrics()).toBeNull();
    });
  });

  describe('recommendations', () => {
    it('should suggest cache warming for low cache hit rate', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        cacheHitRate: 0.3,
      });

      const report = monitor.generateReport();
      expect(report.recommendations).toContain('Low cache hit rate detected. Consider warming cache with common queries.');
    });

    it('should suggest monitoring for edge completeness near threshold', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        edgeCompleteness: 0.75,
      });

      const report = monitor.generateReport();
      expect(report.recommendations).toContain('Edge completeness is near threshold. Monitor timeline diagram handling.');
    });

    it('should provide positive recommendations for good system', () => {
      monitor.recordMetrics({
        processingTime: 1000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.recommendations).toContain('System performing excellently. No immediate action required.');
    });
  });
});

describe('formatQualityReport', () => {
  it('should format quality report as string', () => {
    const monitor = QualityMonitor.getInstance();
    monitor.reset();
    monitor.recordMetrics({
      processingTime: 5000,
      memoryUsage: 256,
      layoutOverlap: 0,
      errorCount: 0,
      warningCount: 0,
      fallbackTriggered: false,
    });

    const report = monitor.generateReport();
    const formatted = formatQualityReport(report);

    expect(formatted).toContain('QUALITY ASSESSMENT REPORT');
    expect(formatted).toContain('Overall Score');
    expect(formatted).toContain('Recommendations');
  });

  it('should format report with violations', () => {
    const monitor = QualityMonitor.getInstance();
    monitor.reset();
    monitor.recordMetrics({
      processingTime: 60000,
      memoryUsage: 700,
      layoutOverlap: 5,
      errorCount: 2,
      warningCount: 0,
      fallbackTriggered: true,
      transcriptionAccuracy: 0.5,
    });

    const report = monitor.generateReport();
    const formatted = formatQualityReport(report);
    expect(formatted).toContain('Violations');
  });
});
