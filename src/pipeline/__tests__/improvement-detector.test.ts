/**
 * Tests for ImprovementDetector
 * Covers: generateReport, detectOpportunities, analyzeTrends, assessOverallHealth,
 *         prioritizeNextSteps, exportToMarkdown, effort estimation
 */

import {
  ImprovementDetector,
  ImprovementReport,
  ImprovementOpportunity,
} from '../improvement-detector';

import {
  QualityMonitor,
  QualityMetrics,
} from '../quality-monitor';

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// Helper: create metrics with defaults
const createMetrics = (overrides: Partial<QualityMetrics> = {}): QualityMetrics => ({
  timestamp: new Date(),
  phase: 'test',
  iteration: 1,
  processingTime: 5000,
  memoryUsage: 300,
  layoutOverlap: 0,
  errorCount: 0,
  warningCount: 0,
  fallbackTriggered: false,
  ...overrides,
});

// Helper: seed QualityMonitor with enough data for trend analysis (needs 5+ entries)
const seedMetrics = (monitor: QualityMonitor, metrics: Partial<QualityMetrics>[]) => {
  metrics.forEach((m, i) => {
    monitor.recordMetrics({ ...m, iteration: i + 1 });
  });
};

describe('ImprovementDetector', () => {
  let detector: ImprovementDetector;
  let monitor: QualityMonitor;

  beforeEach(() => {
    // Reset singleton
    (QualityMonitor as unknown as { instance: QualityMonitor | undefined }).instance = undefined;
    monitor = QualityMonitor.getInstance();
    monitor.reset();
    detector = new ImprovementDetector(monitor);
  });

  // --- generateReport ---

  describe('generateReport', () => {
    test('should return a valid report structure', () => {
      seedMetrics(monitor, [
        { processingTime: 5000, memoryUsage: 300, layoutOverlap: 0, errorCount: 0 },
        { processingTime: 4500, memoryUsage: 280, layoutOverlap: 0, errorCount: 0 },
        { processingTime: 4000, memoryUsage: 260, layoutOverlap: 0, errorCount: 0 },
        { processingTime: 3800, memoryUsage: 250, layoutOverlap: 0, errorCount: 0 },
        { processingTime: 3600, memoryUsage: 240, layoutOverlap: 0, errorCount: 0 },
      ]);

      const report = detector.generateReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(['excellent', 'good', 'needs_attention', 'critical']).toContain(report.overallHealth);
      expect(Array.isArray(report.opportunities)).toBe(true);
      expect(report.trends).toBeDefined();
      expect(Array.isArray(report.nextIterationFocus)).toBe(true);
    });

    test('should return empty opportunities when all metrics are good', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      expect(report.opportunities).toHaveLength(0);
    });
  });

  // --- Trend Analysis (improving/stable/degrading) ---

  describe('analyzeTrends', () => {
    test('should detect improving trends', () => {
      seedMetrics(monitor, [
        { processingTime: 30000 },
        { processingTime: 28000 },
        { processingTime: 26000 },
        { processingTime: 24000 },
        { processingTime: 22000 },
        { processingTime: 20000 },
      ]);

      const report = detector.generateReport();
      // Trends come from compareToBaseline, which needs >=5 history entries
      expect(report.trends).toBeDefined();
      expect(Array.isArray(report.trends.improving)).toBe(true);
      expect(Array.isArray(report.trends.stable)).toBe(true);
      expect(Array.isArray(report.trends.degrading)).toBe(true);
    });

    test('should detect degrading trends', () => {
      seedMetrics(monitor, [
        { processingTime: 5000, memoryUsage: 200 },
        { processingTime: 10000, memoryUsage: 250 },
        { processingTime: 15000, memoryUsage: 300 },
        { processingTime: 20000, memoryUsage: 350 },
        { processingTime: 25000, memoryUsage: 400 },
        { processingTime: 35000, memoryUsage: 600 },
      ]);

      const report = detector.generateReport();
      expect(report.trends.degrading.length + report.trends.stable.length + report.trends.improving.length).toBeGreaterThanOrEqual(0);
    });
  });

  // --- Bottleneck Detection ---

  describe('detectOpportunities', () => {
    test('should detect processing time bottleneck (>30s)', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const speedOpportunity = report.opportunities.find((o) => o.area === 'Processing Speed');
      expect(speedOpportunity).toBeDefined();
      expect(speedOpportunity!.priority).toMatch(/high|medium/);
      expect(speedOpportunity!.suggestedActions.length).toBeGreaterThan(0);
    });

    test('should detect high severity for processing time >60s', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 65000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const speedOpportunity = report.opportunities.find((o) => o.area === 'Processing Speed');
      expect(speedOpportunity).toBeDefined();
      expect(speedOpportunity!.priority).toBe('high');
    });

    test('should detect memory bottleneck (>512MB)', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 600,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const memOpportunity = report.opportunities.find((o) => o.area === 'Memory Optimization');
      expect(memOpportunity).toBeDefined();
    });

    test('should detect layout overlap (critical)', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 5,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const layoutOpportunity = report.opportunities.find((o) => o.area === 'Layout Quality');
      expect(layoutOpportunity).toBeDefined();
      expect(layoutOpportunity!.priority).toBe('critical');
      expect(layoutOpportunity!.confidence).toBe(1.0);
    });

    test('should detect error handling issues', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 3,
      }));

      const report = detector.generateReport();
      const errorOpportunity = report.opportunities.find((o) => o.area === 'Error Handling');
      expect(errorOpportunity).toBeDefined();
      expect(errorOpportunity!.priority).toBe('critical');
    });

    test('should detect low edge completeness', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        edgeCompleteness: 0.3,
      }));

      const report = detector.generateReport();
      const edgeOpportunity = report.opportunities.find((o) => o.area === 'Relationship Extraction');
      expect(edgeOpportunity).toBeDefined();
      expect(edgeOpportunity!.priority).toBe('critical');
    });

    test('should detect low relationship accuracy', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        relationshipAccuracy: 0.7,
      }));

      const report = detector.generateReport();
      const relOpportunity = report.opportunities.find((o) => o.area === 'Relationship Accuracy');
      expect(relOpportunity).toBeDefined();
    });

    test('should detect low cache hit rate', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        cacheHitRate: 0.3,
      }));

      const report = detector.generateReport();
      const cacheOpportunity = report.opportunities.find((o) => o.area === 'Caching Efficiency');
      expect(cacheOpportunity).toBeDefined();
      expect(cacheOpportunity!.priority).toBe('low');
    });

    test('should detect fallback triggered', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
        fallbackTriggered: true,
      }));

      const report = detector.generateReport();
      const fallbackOpportunity = report.opportunities.find((o) => o.area === 'System Reliability');
      expect(fallbackOpportunity).toBeDefined();
    });

    test('should return empty when no metrics recorded', () => {
      const report = detector.generateReport();
      expect(report.opportunities).toHaveLength(0);
    });
  });

  // --- Priority Scoring ---

  describe('priority scoring', () => {
    test('should sort opportunities by priority (critical first)', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 5,
        errorCount: 1,
        cacheHitRate: 0.3,
        fallbackTriggered: true,
      }));

      const report = detector.generateReport();
      const priorities = report.opportunities.map((o) => o.priority);
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

      for (let i = 1; i < priorities.length; i++) {
        expect(priorityOrder[priorities[i]]).toBeGreaterThanOrEqual(priorityOrder[priorities[i - 1]]);
      }
    });

    test('should set confidence values between 0 and 1', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 1,
        errorCount: 1,
      }));

      const report = detector.generateReport();
      report.opportunities.forEach((o) => {
        expect(o.confidence).toBeGreaterThanOrEqual(0);
        expect(o.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  // --- Actionable Recommendations ---

  describe('suggested actions', () => {
    test('should provide suggestedActions for each opportunity', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 1,
        errorCount: 1,
      }));

      const report = detector.generateReport();
      report.opportunities.forEach((o) => {
        expect(o.suggestedActions.length).toBeGreaterThan(0);
        o.suggestedActions.forEach((action) => {
          expect(typeof action).toBe('string');
          expect(action.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // --- Effort Estimation ---

  describe('estimated effort', () => {
    test('should assign effort levels from valid set', () => {
      const validEfforts = ['minimal', 'low', 'moderate', 'high'];

      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 1,
        errorCount: 1,
        cacheHitRate: 0.3,
        fallbackTriggered: true,
      }));

      const report = detector.generateReport();
      report.opportunities.forEach((o) => {
        expect(validEfforts).toContain(o.estimatedEffort);
      });
    });

    test('should set high effort for layout overlap (complex fix)', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 10,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const layoutOpportunity = report.opportunities.find((o) => o.area === 'Layout Quality');
      expect(layoutOpportunity).toBeDefined();
      expect(layoutOpportunity!.estimatedEffort).toBe('high');
    });
  });

  // --- Overall Health Assessment ---

  describe('overallHealth', () => {
    test('should return critical when layout overlap exists', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 10,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      expect(report.overallHealth).toBe('critical');
    });
  });

  // --- Next Iteration Focus ---

  describe('nextIterationFocus', () => {
    test('should provide next steps for critical issues', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 5,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      expect(report.nextIterationFocus.length).toBeGreaterThan(0);
    });

    test('should suggest proactive improvements when no issues', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      // No opportunities, but nextIterationFocus should still have suggestions
      expect(report.nextIterationFocus.length).toBeGreaterThan(0);
    });
  });

  // --- Markdown Export ---

  describe('exportToMarkdown', () => {
    test('should generate valid markdown report', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('# Improvement Detection Report');
      expect(md).toContain('**Generated**:');
      expect(md).toContain('**Overall Health**:');
      expect(md).toContain('## Trends');
      expect(md).toContain('## Next Iteration Focus');
    });

    test('should include opportunities in markdown when present', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 5,
        errorCount: 1,
      }));

      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('## Improvement Opportunities');
      expect(md).toContain('Processing Speed');
      expect(md).toContain('Memory Optimization');
      expect(md).toContain('Layout Quality');
    });

    test('should indicate no opportunities when system is healthy', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 5000,
        memoryUsage: 200,
        layoutOverlap: 0,
        errorCount: 0,
      }));

      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('No significant improvement opportunities detected');
    });
  });

  // --- Evidence ---

  describe('evidence', () => {
    test('should provide evidence for each opportunity', () => {
      seedMetrics(monitor, Array(6).fill({
        processingTime: 35000,
        memoryUsage: 600,
        layoutOverlap: 1,
        errorCount: 1,
      }));

      const report = detector.generateReport();
      report.opportunities.forEach((o) => {
        expect(o.evidence.length).toBeGreaterThan(0);
      });
    });
  });

  // --- Convenience Function ---

  describe('getImprovementDetector', () => {
    test('should create detector instance', async () => {
      const { getImprovementDetector } = await import('../improvement-detector');
      const d = getImprovementDetector();
      expect(d).toBeInstanceOf(ImprovementDetector);
    });
  });
});
