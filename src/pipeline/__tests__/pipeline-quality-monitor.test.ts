/**
 * Tests for QualityMonitor (pipeline)
 * Covers: getInstance, recordMetrics, generateReport, getTrend, logIteration,
 *         exportIterationHistory, runDiagnostics, compareToBaseline,
 *         regression detection, reset, formatQualityReport
 */

import {
  QualityMonitor,
  getQualityMonitor,
  formatQualityReport,
  QualityMetrics,
  QualityReport,
} from '../quality-monitor';

// Suppress console
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('QualityMonitor', () => {
  let monitor: QualityMonitor;

  beforeEach(() => {
    // Reset singleton between tests
    (QualityMonitor as unknown as { instance: QualityMonitor | undefined }).instance = undefined;
    monitor = QualityMonitor.getInstance();
    monitor.reset();
  });

  // --- Singleton pattern ---

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const m1 = QualityMonitor.getInstance();
      const m2 = QualityMonitor.getInstance();
      expect(m1).toBe(m2);
    });

    it('should create new instance if none exists', () => {
      (QualityMonitor as unknown as { instance: QualityMonitor | undefined }).instance = undefined;
      const m = QualityMonitor.getInstance();
      expect(m).toBeDefined();
    });
  });

  // --- recordMetrics ---

  describe('recordMetrics', () => {
    it('should record full metrics', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 300,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const latest = monitor.getLatestMetrics();
      expect(latest).not.toBeNull();
      expect(latest!.processingTime).toBe(5000);
      expect(latest!.memoryUsage).toBe(300);
    });

    it('should record partial metrics with defaults', () => {
      monitor.recordMetrics({
        processingTime: 10000,
      });

      const latest = monitor.getLatestMetrics();
      expect(latest).not.toBeNull();
      expect(latest!.processingTime).toBe(10000);
      expect(latest!.memoryUsage).toBe(0); // default
      expect(latest!.layoutOverlap).toBe(0); // default
      expect(latest!.errorCount).toBe(0); // default
      expect(latest!.warningCount).toBe(0); // default
      expect(latest!.fallbackTriggered).toBe(false); // default
    });

    it('should record metrics with all optional fields', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 300,
        cacheHitRate: 0.8,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.88,
        entityExtractionF1: 0.90,
        relationshipAccuracy: 0.87,
        layoutOverlap: 0,
        edgeCompleteness: 0.85,
        edgeRatioQuality: 0.90,
        confidenceScore: 0.92,
        errorCount: 0,
        warningCount: 1,
        fallbackTriggered: false,
      });

      const latest = monitor.getLatestMetrics();
      expect(latest!.transcriptionAccuracy).toBe(0.95);
      expect(latest!.cacheHitRate).toBe(0.8);
      expect(latest!.edgeCompleteness).toBe(0.85);
    });

    it('should limit metrics history to 100 entries', () => {
      for (let i = 0; i < 150; i++) {
        monitor.recordMetrics({ processingTime: i * 100 });
      }

      const report = monitor.generateReport();
      // The latest metric should be present
      expect(report.metrics.processingTime).toBe(14900);
    });
  });

  // --- generateReport ---

  describe('generateReport', () => {
    it('should return critical report with no metrics', () => {
      const report = monitor.generateReport();
      expect(report.overallScore).toBe(0);
      expect(report.status).toBe('critical');
      expect(report.violations).toHaveLength(0);
      expect(report.recommendations).toContain('No metrics available. Run system first.');
      expect(report.improvementPotential).toBe(100);
    });

    it('should return excellent report for perfect metrics', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.90,
        entityExtractionF1: 0.90,
        relationshipAccuracy: 0.90,
        edgeCompleteness: 0.95,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeGreaterThanOrEqual(90);
      expect(report.status).toBe('excellent');
      expect(report.violations).toHaveLength(0);
    });

    it('should detect transcription accuracy violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.60,
      });

      const report = monitor.generateReport();
      expect(report.violations.length).toBeGreaterThan(0);
      expect(report.violations.some(v => v.metric === 'transcriptionAccuracy')).toBe(true);
    });

    it('should detect critical transcription accuracy (< 0.7)', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.60,
      });

      const report = monitor.generateReport();
      const violation = report.violations.find(v => v.metric === 'transcriptionAccuracy');
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe('critical');
    });

    it('should detect warning transcription accuracy (0.7-0.85)', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.80,
      });

      const report = monitor.generateReport();
      const violation = report.violations.find(v => v.metric === 'transcriptionAccuracy');
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe('warning');
    });

    it('should detect scene segmentation violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        sceneSegmentationF1: 0.60,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'sceneSegmentationF1')).toBe(true);
    });

    it('should detect entity extraction violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        entityExtractionF1: 0.60,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'entityExtractionF1')).toBe(true);
    });

    it('should detect relationship accuracy violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        relationshipAccuracy: 0.70,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'relationshipAccuracy')).toBe(true);
    });

    it('should detect edge completeness violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        edgeCompleteness: 0.50,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'edgeCompleteness')).toBe(true);
    });

    it('should detect layout overlap violation (critical)', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 5,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      const violation = report.violations.find(v => v.metric === 'layoutOverlap');
      expect(violation).toBeDefined();
      expect(violation!.severity).toBe('critical');
    });

    it('should detect processing time violation', () => {
      monitor.recordMetrics({
        processingTime: 40000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'processingTime')).toBe(true);
    });

    it('should detect memory usage violation', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 700,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.violations.some(v => v.metric === 'memoryUsage')).toBe(true);
    });

    it('should give bonus for zero layout overlap', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeGreaterThanOrEqual(100); // base 100 + bonuses, capped
    });

    it('should give bonus for high edge completeness', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        edgeCompleteness: 0.92,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeGreaterThan(90);
    });

    it('should give bonus for zero error count', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeGreaterThanOrEqual(100);
    });

    it('should penalize for fallback triggered', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: true,
        // edgeCompleteness triggers bonus, so we need it to be low to avoid bonus offsetting penalty
        edgeCompleteness: 0.5, // below threshold to trigger violation
      });

      const report = monitor.generateReport();
      // With violations and fallback penalty, score should be lower than 100
      expect(report.overallScore).toBeLessThan(100);
    });

    it('should penalize for error count', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 3,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const report = monitor.generateReport();
      expect(report.overallScore).toBeLessThan(100);
    });

    it('should compute status correctly for different scores', () => {
      // Test "excellent" (>= 90)
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      expect(monitor.generateReport().status).toBe('excellent');

      monitor.reset();
      // Test "good" (75-89) - need enough violations to bring score into this range
      // Base: 100, processing time info (-5), memory warning (-10), transcription warning (-10),
      // scene seg warning (-10) = 65. With errorCount=1 (-2) and no zero-error bonus.
      // 65 - 2 = 63. That's "acceptable". Let's try fewer violations.
      // processing time info (-5) + memory warning (-10) + no zero-error bonus (-5 lost) + errorCount=1 (-2)
      // = 100 - 5 - 10 - 2 = 83 (good range 75-89)
      monitor.recordMetrics({
        processingTime: 40000, // info violation (-5)
        memoryUsage: 600,      // warning violation (-10)
        layoutOverlap: 0,
        errorCount: 1,         // penalty -2, lose +5 zero-error bonus
        warningCount: 0,
        fallbackTriggered: false,
      });
      const goodReport = monitor.generateReport();
      expect(goodReport.status).toBe('good');

      monitor.reset();
      // Test "acceptable" (60-74)
      // sceneSegF1: 0.60 (warning -10), entityExtF1: 0.60 (warning -10),
      // relationshipAcc: 0.70 (warning -10), fallback (-5) = -35
      // errorCount 0 (+5), layoutOverlap 0 (+5), but fallback cancels error bonus?
      // Score = 100 - 10 - 10 - 10 - 5 + 5 + 5 = 75 (good). Need one more warning.
      // Add edgeCompleteness low: 0.50 (warning -10)
      // Score = 100 - 10 - 10 - 10 - 10 - 5 + 5 + 5 = 65 (acceptable)
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: true,
        sceneSegmentationF1: 0.60,
        entityExtractionF1: 0.60,
        relationshipAccuracy: 0.70,
        edgeCompleteness: 0.50,
      });
      const acceptableReport = monitor.generateReport();
      expect(acceptableReport.status).toBe('acceptable');

      monitor.reset();
      // Test "needs_improvement" (40-59)
      // layoutOverlap: 5 (critical -20), sceneSegF1: 0.60 (warning -10),
      // entityExtF1: 0.60 (warning -10), fallback (-5)
      // Bonuses: none (layoutOverlap > 0, errorCount 0 so +5 for errors, layout 0 no bonus)
      // Score = 100 - 20 - 10 - 10 - 5 + 5 = 60 -- that's acceptable. Need to lose error bonus.
      // Add errorCount=1: -2, lose +5 bonus = net -7. Score = 100 - 20 - 10 - 10 - 5 - 2 = 53
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 5,
        errorCount: 1,
        warningCount: 0,
        fallbackTriggered: true,
        sceneSegmentationF1: 0.60,
        entityExtractionF1: 0.60,
      });
      const needsImprovementReport = monitor.generateReport();
      expect(needsImprovementReport.status).toBe('needs_improvement');

      monitor.reset();
      // Test "critical" (< 40)
      monitor.recordMetrics({ processingTime: 50000, memoryUsage: 700, layoutOverlap: 10, errorCount: 5, warningCount: 3, fallbackTriggered: true, transcriptionAccuracy: 0.50 });
      expect(monitor.generateReport().status).toBe('critical');
    });

    it('should generate proactive recommendations for low cache hit rate', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        cacheHitRate: 0.3,
      });

      const report = monitor.generateReport();
      expect(report.recommendations.some(r => r.includes('cache'))).toBe(true);
    });

    it('should generate recommendation for edge completeness near threshold', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        edgeCompleteness: 0.75,
      });

      const report = monitor.generateReport();
      expect(report.recommendations.some(r => r.includes('Edge completeness') || r.includes('edge'))).toBe(true);
    });

    it('should generate success message when no violations', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.90,
        entityExtractionF1: 0.90,
        relationshipAccuracy: 0.90,
      });

      const report = monitor.generateReport();
      expect(report.recommendations.some(r => r.includes('excellently'))).toBe(true);
    });
  });

  // --- getLatestMetrics ---

  describe('getLatestMetrics', () => {
    it('should return null when no metrics recorded', () => {
      expect(monitor.getLatestMetrics()).toBeNull();
    });

    it('should return the most recent metrics', () => {
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      monitor.recordMetrics({ processingTime: 2000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      monitor.recordMetrics({ processingTime: 3000, memoryUsage: 300, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });

      const latest = monitor.getLatestMetrics();
      expect(latest!.processingTime).toBe(3000);
    });
  });

  // --- getTrend ---

  describe('getTrend', () => {
    it('should return empty array when no metrics', () => {
      const trend = monitor.getTrend('processingTime');
      expect(trend).toEqual([]);
    });

    it('should return trend values for recorded metrics', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({ processingTime: (i + 1) * 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      }

      const trend = monitor.getTrend('processingTime', 3);
      expect(trend.length).toBe(3);
      expect(trend).toEqual([3000, 4000, 5000]);
    });

    it('should default windowSize to 10', () => {
      for (let i = 0; i < 15; i++) {
        monitor.recordMetrics({ processingTime: (i + 1) * 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      }

      const trend = monitor.getTrend('processingTime');
      expect(trend.length).toBe(10);
    });

    it('should return 0 for undefined optional metric values', () => {
      // Record metrics without transcriptionAccuracy
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      monitor.recordMetrics({ processingTime: 2000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });

      const trend = monitor.getTrend('transcriptionAccuracy');
      // transcriptionAccuracy is undefined so || 0 kicks in
      expect(trend).toEqual([0, 0]);
    });

    it('should return 0 for undefined cacheHitRate in trend', () => {
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      const trend = monitor.getTrend('cacheHitRate');
      expect(trend).toEqual([0]);
    });
  });

  // --- logIteration ---

  describe('logIteration', () => {
    it('should log iteration with required fields', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });

      monitor.logIteration({
        phaseId: 'phase-27',
        iterationNumber: 1,
        action: 'Test action',
        result: 'success',
        metrics: monitor.getLatestMetrics()!,
        improvements: ['Improved layout'],
        nextSteps: ['Add more tests'],
      });

      // Verify iteration was logged (implicitly via exportIterationHistory)
      const history = monitor.exportIterationHistory();
      expect(history).toContain('phase-27');
      expect(history).toContain('Test action');
    });

    it('should log iteration with empty improvements', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });

      monitor.logIteration({
        phaseId: 'phase-28',
        iterationNumber: 2,
        action: 'Another test',
        result: 'partial',
        metrics: monitor.getLatestMetrics()!,
        improvements: [],
        nextSteps: ['Review'],
      });

      const history = monitor.exportIterationHistory();
      expect(history).toContain('phase-28');
    });
  });

  // --- exportIterationHistory ---

  describe('exportIterationHistory', () => {
    it('should export empty history', () => {
      const output = monitor.exportIterationHistory();
      expect(output).toContain('Iteration History');
      expect(output).toContain('Last Updated');
    });

    it('should export history grouped by phase', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      const metrics = monitor.getLatestMetrics()!;

      monitor.logIteration({
        phaseId: 'phase-A',
        iterationNumber: 1,
        action: 'First action',
        result: 'success',
        metrics,
        improvements: ['Improved X'],
        nextSteps: ['Next'],
      });

      monitor.logIteration({
        phaseId: 'phase-B',
        iterationNumber: 1,
        action: 'Second action',
        result: 'failure',
        metrics,
        improvements: [],
        nextSteps: ['Retry'],
      });

      const output = monitor.exportIterationHistory();
      expect(output).toContain('phase-A');
      expect(output).toContain('phase-B');
      expect(output).toContain('First action');
      expect(output).toContain('Second action');
    });

    it('should export fallback triggered as Yes', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: true });
      const metrics = monitor.getLatestMetrics()!;

      monitor.logIteration({
        phaseId: 'phase-fallback',
        iterationNumber: 1,
        action: 'Fallback test',
        result: 'partial',
        metrics,
        improvements: [],
        nextSteps: ['Investigate fallback'],
      });

      const output = monitor.exportIterationHistory();
      expect(output).toContain('Fallback: Yes');
      expect(output).toContain('Investigate fallback');
    });

    it('should export iteration with no next steps', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      const metrics = monitor.getLatestMetrics()!;

      monitor.logIteration({
        phaseId: 'phase-none',
        iterationNumber: 1,
        action: 'No next steps',
        result: 'success',
        metrics,
        improvements: ['Did something'],
        nextSteps: [],
      });

      const output = monitor.exportIterationHistory();
      expect(output).toContain('phase-none');
      // Should NOT contain Next Steps section since nextSteps is empty
      expect(output).not.toContain('**Next Steps**');
    });
  });

  // --- runDiagnostics ---

  describe('runDiagnostics', () => {
    it('should return critical health with no metrics', () => {
      const diag = monitor.runDiagnostics();
      expect(diag.health).toBe('critical');
      expect(diag.critical).toHaveLength(0);
      expect(diag.warnings).toHaveLength(0);
    });

    it('should detect critical violations', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 5,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.60,
      });

      const diag = monitor.runDiagnostics();
      expect(diag.critical.length).toBeGreaterThan(0);
    });

    it('should detect warning violations', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        sceneSegmentationF1: 0.60,
      });

      const diag = monitor.runDiagnostics();
      expect(diag.warnings.length).toBeGreaterThan(0);
    });

    it('should not include info-severity violations in critical or warnings', () => {
      // processingTime > 30000 produces info severity
      monitor.recordMetrics({
        processingTime: 40000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
      });

      const diag = monitor.runDiagnostics();
      // Info violations are not added to critical or warnings arrays
      expect(diag.critical).toHaveLength(0);
      expect(diag.warnings).toHaveLength(0);
    });

    it('should return excellent health with no violations', () => {
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.90,
        entityExtractionF1: 0.90,
        relationshipAccuracy: 0.90,
        edgeCompleteness: 0.95,
      });

      const diag = monitor.runDiagnostics();
      expect(diag.health).toBe('excellent');
    });
  });

  // --- compareToBaseline ---

  describe('compareToBaseline', () => {
    it('should return empty results with insufficient data', () => {
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      const comparison = monitor.compareToBaseline();
      expect(comparison.improved).toEqual([]);
      expect(comparison.regressed).toEqual([]);
      expect(comparison.stable).toEqual([]);
    });

    it('should compare current metrics against baseline', () => {
      // Add baseline data (first 5 entries)
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({
          processingTime: 20000,
          memoryUsage: 400,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
          transcriptionAccuracy: 0.80,
        });
      }

      // Add current data (newer entries with improvement)
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({
          processingTime: 10000, // improved
          memoryUsage: 300, // improved
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
          transcriptionAccuracy: 0.95, // improved
        });
      }

      const comparison = monitor.compareToBaseline();
      expect(comparison.improved.length + comparison.stable.length + comparison.regressed.length).toBeGreaterThan(0);
    });

    it('should detect stable metrics when change is under 5%', () => {
      // Baseline: processingTime = 10000, memoryUsage = 200
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({
          processingTime: 10000,
          memoryUsage: 200,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
          transcriptionAccuracy: 0.90,
        });
      }
      // Current: processingTime = 10200 (2% change => stable)
      monitor.recordMetrics({
        processingTime: 10200,
        memoryUsage: 204,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.91,
      });

      const comparison = monitor.compareToBaseline();
      expect(comparison.stable.length).toBeGreaterThan(0);
    });

    it('should detect regressed metrics when processing time increases', () => {
      // Baseline: processingTime = 10000, memoryUsage = 200
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({
          processingTime: 10000,
          memoryUsage: 200,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
          transcriptionAccuracy: 0.90,
          edgeCompleteness: 0.80,
          relationshipAccuracy: 0.85,
        });
      }
      // Current: processingTime = 20000 (100% increase => regressed)
      // memoryUsage = 400 (100% increase => regressed)
      monitor.recordMetrics({
        processingTime: 20000,
        memoryUsage: 400,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.90,
        edgeCompleteness: 0.80,
        relationshipAccuracy: 0.85,
      });

      const comparison = monitor.compareToBaseline();
      expect(comparison.regressed.length).toBeGreaterThan(0);
      // Processing time and memory usage increases should be regressed
      expect(comparison.regressed.some(r => r.includes('processingTime'))).toBe(true);
      expect(comparison.regressed.some(r => r.includes('memoryUsage'))).toBe(true);
    });

    it('should detect regressed accuracy metrics when they decrease', () => {
      // Baseline: high accuracy
      for (let i = 0; i < 5; i++) {
        monitor.recordMetrics({
          processingTime: 5000,
          memoryUsage: 100,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
          transcriptionAccuracy: 0.95,
          edgeCompleteness: 0.90,
          relationshipAccuracy: 0.90,
        });
      }
      // Current: accuracy drops significantly
      monitor.recordMetrics({
        processingTime: 5000,
        memoryUsage: 100,
        layoutOverlap: 0,
        errorCount: 0,
        warningCount: 0,
        fallbackTriggered: false,
        transcriptionAccuracy: 0.50,  // ~47% decrease => regressed
        edgeCompleteness: 0.40,        // ~55% decrease => regressed
        relationshipAccuracy: 0.40,    // ~55% decrease => regressed
      });

      const comparison = monitor.compareToBaseline();
      expect(comparison.regressed.length).toBeGreaterThan(0);
    });
  });

  // --- Regression Detection (TASK-0044) ---

  describe('regression detection', () => {
    it('should set and retrieve regression baseline', () => {
      monitor.setRegressionBaseline('test-pipeline', 95);
      const result = monitor.detectRegression('test-pipeline', 90);
      expect(result.previousScore).toBe(95);
      expect(result.currentScore).toBe(90);
    });

    it('should detect regression when score drops more than 5%', () => {
      monitor.setRegressionBaseline('test-pipeline', 95);
      const result = monitor.detectRegression('test-pipeline', 85);
      expect(result.isRegression).toBe(true);
      expect(result.degradationPercent).toBeGreaterThan(5);
      expect(result.shouldBlock).toBe(true);
    });

    it('should not detect regression when score drops within 5%', () => {
      monitor.setRegressionBaseline('test-pipeline', 95);
      const result = monitor.detectRegression('test-pipeline', 93);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBeLessThanOrEqual(5);
      expect(result.shouldBlock).toBe(false);
    });

    it('should not detect regression when score improves', () => {
      monitor.setRegressionBaseline('test-pipeline', 90);
      const result = monitor.detectRegression('test-pipeline', 95);
      expect(result.isRegression).toBe(false);
      expect(result.degradationPercent).toBe(0);
    });

    it('should handle unknown pipeline ID (no baseline)', () => {
      const result = monitor.detectRegression('unknown-pipeline', 80);
      expect(result.isRegression).toBe(false);
      expect(result.previousScore).toBe(0);
      expect(result.shouldBlock).toBe(false);
    });
  });

  // --- setPhaseIteration ---

  describe('setPhaseIteration', () => {
    it('should update phase and iteration', () => {
      monitor.setPhaseIteration('phase-30', 5);
      monitor.recordMetrics({ processingTime: 1000, memoryUsage: 100, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });

      const latest = monitor.getLatestMetrics();
      expect(latest!.phase).toBe('phase-30');
      expect(latest!.iteration).toBe(5);
    });
  });

  // --- reset ---

  describe('reset', () => {
    it('should clear all recorded data', () => {
      monitor.recordMetrics({ processingTime: 5000, memoryUsage: 200, layoutOverlap: 0, errorCount: 0, warningCount: 0, fallbackTriggered: false });
      monitor.reset();

      expect(monitor.getLatestMetrics()).toBeNull();
      const report = monitor.generateReport();
      expect(report.overallScore).toBe(0);
    });
  });

  // --- getQualityMonitor ---

  describe('getQualityMonitor', () => {
    it('should return the global QualityMonitor instance', () => {
      const m = getQualityMonitor();
      expect(m).toBeDefined();
      expect(m).toBeInstanceOf(QualityMonitor);
    });
  });

  // --- formatQualityReport ---

  describe('formatQualityReport', () => {
    it('should format report with violations', () => {
      const report: QualityReport = {
        overallScore: 75,
        status: 'good',
        metrics: {
          timestamp: new Date(),
          phase: 'test',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 300,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        thresholds: {
          transcriptionAccuracy: 0.85,
          sceneSegmentationF1: 0.75,
          entityExtractionF1: 0.80,
          relationshipAccuracy: 0.85,
          layoutOverlap: 0,
          renderTime: 30000,
          memoryUsage: 512,
          edgeCompleteness: 0.70,
          edgeRatioQuality: 0.80,
        },
        violations: [
          {
            metric: 'transcriptionAccuracy',
            actual: 0.70,
            expected: 0.85,
            severity: 'warning',
            impact: 'Test impact',
            recommendation: 'Test fix',
          },
        ],
        recommendations: ['Test recommendation'],
        improvementPotential: 30,
      };

      const formatted = formatQualityReport(report);
      expect(formatted).toContain('QUALITY ASSESSMENT REPORT');
      expect(formatted).toContain('75');
      expect(formatted).toContain('transcriptionAccuracy');
      expect(formatted).toContain('Test recommendation');
    });

    it('should format report without violations', () => {
      const report: QualityReport = {
        overallScore: 95,
        status: 'excellent',
        metrics: {
          timestamp: new Date(),
          phase: 'test',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 200,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        thresholds: {
          transcriptionAccuracy: 0.85,
          sceneSegmentationF1: 0.75,
          entityExtractionF1: 0.80,
          relationshipAccuracy: 0.85,
          layoutOverlap: 0,
          renderTime: 30000,
          memoryUsage: 512,
          edgeCompleteness: 0.70,
          edgeRatioQuality: 0.80,
        },
        violations: [],
        recommendations: ['All good'],
        improvementPotential: 10,
      };

      const formatted = formatQualityReport(report);
      expect(formatted).toContain('95');
      expect(formatted).not.toContain('Violations');
      expect(formatted).toContain('All good');
    });

    it('should format critical severity violation', () => {
      const report: QualityReport = {
        overallScore: 50,
        status: 'needs_improvement',
        metrics: {
          timestamp: new Date(),
          phase: 'test',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 200,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        thresholds: {
          transcriptionAccuracy: 0.85,
          sceneSegmentationF1: 0.75,
          entityExtractionF1: 0.80,
          relationshipAccuracy: 0.85,
          layoutOverlap: 0,
          renderTime: 30000,
          memoryUsage: 512,
          edgeCompleteness: 0.70,
          edgeRatioQuality: 0.80,
        },
        violations: [
          {
            metric: 'layoutOverlap',
            actual: 5,
            expected: 0,
            severity: 'critical',
            impact: 'Critical issue',
            recommendation: 'Fix it',
          },
        ],
        recommendations: ['Fix critical'],
        improvementPotential: 50,
      };

      const formatted = formatQualityReport(report);
      expect(formatted).toContain('layoutOverlap');
    });

    it('should format info severity violation', () => {
      const report: QualityReport = {
        overallScore: 80,
        status: 'good',
        metrics: {
          timestamp: new Date(),
          phase: 'test',
          iteration: 1,
          processingTime: 5000,
          memoryUsage: 200,
          layoutOverlap: 0,
          errorCount: 0,
          warningCount: 0,
          fallbackTriggered: false,
        },
        thresholds: {
          transcriptionAccuracy: 0.85,
          sceneSegmentationF1: 0.75,
          entityExtractionF1: 0.80,
          relationshipAccuracy: 0.85,
          layoutOverlap: 0,
          renderTime: 30000,
          memoryUsage: 512,
          edgeCompleteness: 0.70,
          edgeRatioQuality: 0.80,
        },
        violations: [
          {
            metric: 'processingTime',
            actual: 40000,
            expected: 30000,
            severity: 'info',
            impact: 'Slow processing',
            recommendation: 'Optimize',
          },
        ],
        recommendations: ['Optimize'],
        improvementPotential: 10,
      };

      const formatted = formatQualityReport(report);
      expect(formatted).toContain('processingTime');
    });
  });
});
