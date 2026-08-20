import {
  ImprovementDetector,
  type ImprovementOpportunity,
  type ImprovementReport,
} from '@/pipeline/improvement-detector';
import type {
  QualityMetrics,
  QualityReport,
} from '@/pipeline/quality-monitor';

/**
 * Fail-loud helper replacing the old `opp!` postfixes: a missing
 * opportunity keeps the RED verdict with its area name instead of
 * surfacing `new undefined()` mid-test.
 */
function requireOpportunity(report: ImprovementReport, area: string): ImprovementOpportunity {
  const opp = report.opportunities.find(o => o.area === area);
  if (opp === undefined) {
    throw new Error(`opportunity '${area}' not found in report`);
  }
  return opp;
}

// ---------------------------------------------------------------------------
// Mock QualityMonitor
// ---------------------------------------------------------------------------

function makeMetrics(overrides: Partial<QualityMetrics> = {}): QualityMetrics {
  return {
    timestamp: new Date(),
    phase: 'test',
    iteration: 1,
    processingTime: 5000,
    memoryUsage: 256,
    layoutOverlap: 0,
    errorCount: 0,
    warningCount: 0,
    fallbackTriggered: false,
    ...overrides,
  };
}

function createMockMonitor(metrics: QualityMetrics | null, opts?: {
  improved?: string[];
  regressed?: string[];
  stable?: string[];
  overallScore?: number;
  violations?: Array<{ severity: string }>;
}) {
  return {
    getLatestMetrics: jest.fn().mockReturnValue(metrics),
    generateReport: jest.fn().mockReturnValue({
      overallScore: opts?.overallScore ?? 90,
      status: 'good',
      metrics,
      thresholds: {},
      violations: (opts?.violations ?? []).map(s => ({ severity: s.severity })),
      recommendations: [],
      improvementPotential: 10,
    } as unknown as QualityReport),
    compareToBaseline: jest.fn().mockReturnValue({
      improved: opts?.improved ?? [],
      regressed: opts?.regressed ?? [],
      stable: opts?.stable ?? [],
    }),
  };
}

// ---------------------------------------------------------------------------
// detectOpportunities (via generateReport)
// ---------------------------------------------------------------------------

describe('ImprovementDetector', () => {
  describe('generateReport - no opportunities', () => {
    it('returns empty opportunities when all metrics are healthy', () => {
      const monitor = createMockMonitor(makeMetrics());
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.opportunities).toHaveLength(0);
      expect(report.overallHealth).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.nextIterationFocus).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('returns empty opportunities when no metrics available', () => {
      const monitor = createMockMonitor(null);
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.opportunities).toHaveLength(0);
    });
  });

  describe('generateReport - processing time opportunity', () => {
    it('detects medium priority for 30-60s processing time', () => {
      const monitor = createMockMonitor(makeMetrics({ processingTime: 45000 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Processing Speed');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Processing Speed').priority).toBe('medium');
      expect(requireOpportunity(report, 'Processing Speed').confidence).toBeGreaterThan(0);
      expect(requireOpportunity(report, 'Processing Speed').suggestedActions.length).toBeGreaterThan(0);
    });

    it('detects high priority for >60s processing time', () => {
      const monitor = createMockMonitor(makeMetrics({ processingTime: 90000 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Processing Speed');
      expect(requireOpportunity(report, 'Processing Speed').priority).toBe('high');
    });
  });

  describe('generateReport - memory opportunity', () => {
    it('detects memory issue above 512 MB', () => {
      const monitor = createMockMonitor(makeMetrics({ memoryUsage: 600 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Memory Optimization');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Memory Optimization').priority).toBe('medium');
    });

    it('detects high priority memory issue above 1024 MB', () => {
      const monitor = createMockMonitor(makeMetrics({ memoryUsage: 1200 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Memory Optimization');
      expect(requireOpportunity(report, 'Memory Optimization').priority).toBe('high');
    });
  });

  describe('generateReport - layout overlap opportunity', () => {
    it('detects layout overlap as critical', () => {
      const monitor = createMockMonitor(makeMetrics({ layoutOverlap: 3 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Layout Quality');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Layout Quality').priority).toBe('critical');
      expect(requireOpportunity(report, 'Layout Quality').targetValue).toBe(0);
    });
  });

  describe('generateReport - error handling opportunity', () => {
    it('detects high priority for 1-2 errors', () => {
      const monitor = createMockMonitor(makeMetrics({ errorCount: 1 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Error Handling');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Error Handling').priority).toBe('high');
    });

    it('detects critical priority for 3+ errors', () => {
      const monitor = createMockMonitor(makeMetrics({ errorCount: 5 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Error Handling');
      expect(requireOpportunity(report, 'Error Handling').priority).toBe('critical');
    });
  });

  describe('generateReport - edge completeness opportunity', () => {
    it('detects critical edge completeness below 50%', () => {
      const monitor = createMockMonitor(makeMetrics({ edgeCompleteness: 0.3 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Relationship Extraction');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Relationship Extraction').priority).toBe('critical');
    });

    it('detects high edge completeness between 50-70%', () => {
      const monitor = createMockMonitor(makeMetrics({ edgeCompleteness: 0.6 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Relationship Extraction');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Relationship Extraction').priority).toBe('high');
    });
  });

  describe('generateReport - relationship accuracy opportunity', () => {
    it('detects low relationship accuracy', () => {
      const monitor = createMockMonitor(makeMetrics({ relationshipAccuracy: 0.7 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Relationship Accuracy');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Relationship Accuracy').priority).toBe('medium');
    });
  });

  describe('generateReport - cache efficiency opportunity', () => {
    it('detects low cache hit rate', () => {
      const monitor = createMockMonitor(makeMetrics({ cacheHitRate: 0.3 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'Caching Efficiency');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'Caching Efficiency').priority).toBe('low');
    });
  });

  describe('generateReport - fallback triggered opportunity', () => {
    it('detects when fallback was triggered', () => {
      const monitor = createMockMonitor(makeMetrics({ fallbackTriggered: true }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const opp = report.opportunities.find(o => o.area === 'System Reliability');
      expect(opp).toBeDefined();
      expect(requireOpportunity(report, 'System Reliability').priority).toBe('medium');
    });
  });

  describe('generateReport - sorting by priority', () => {
    it('sorts critical before high before medium before low', () => {
      const monitor = createMockMonitor(makeMetrics({
        processingTime: 45000,   // medium
        memoryUsage: 600,         // medium
        layoutOverlap: 1,         // critical
        errorCount: 1,            // high
        cacheHitRate: 0.3,        // low
      }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      const priorities = report.opportunities.map(o => o.priority);
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < priorities.length; i++) {
        expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
      }
    });
  });

  // --- assessOverallHealth ---

  describe('assessOverallHealth', () => {
    it('returns excellent when score >= 85 and no degrading', () => {
      const monitor = createMockMonitor(makeMetrics(), {
        overallScore: 90,
        improved: ['speed'],
      });
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.overallHealth).toBe('excellent');
    });

    it('returns good when score 60-84', () => {
      const monitor = createMockMonitor(makeMetrics(), {
        overallScore: 75,
      });
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.overallHealth).toBe('good');
    });

    it('returns needs_attention when score < 60', () => {
      const monitor = createMockMonitor(makeMetrics(), {
        overallScore: 50,
      });
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.overallHealth).toBe('needs_attention');
    });

    it('returns critical with critical violations', () => {
      const monitor = createMockMonitor(makeMetrics(), {
        overallScore: 90,
        violations: [{ severity: 'critical' }],
      });
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.overallHealth).toBe('critical');
    });
  });

  // --- exportToMarkdown ---

  describe('exportToMarkdown', () => {
    it('produces valid markdown with expected sections', () => {
      const monitor = createMockMonitor(makeMetrics());
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('# Improvement Detection Report');
      expect(md).toContain('**Overall Health**');
      expect(md).toContain('## Trends');
      expect(md).toContain('## Next Iteration Focus');
    });

    it('includes opportunity details when present', () => {
      const monitor = createMockMonitor(makeMetrics({ layoutOverlap: 1 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('Layout Quality');
      expect(md).toContain('Suggested Actions');
      expect(md).toContain('Evidence');
    });

    it('includes no-opportunities message when none found', () => {
      const monitor = createMockMonitor(makeMetrics());
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();
      const md = detector.exportToMarkdown(report);

      expect(md).toContain('No significant improvement opportunities detected');
    });
  });

  // --- prioritizeNextSteps ---

  describe('prioritizeNextSteps', () => {
    it('suggests proactive improvements when system is healthy', () => {
      const monitor = createMockMonitor(makeMetrics(), {
        improved: [],
        regressed: [],
        stable: [],
      });
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.nextIterationFocus.some(s => s.includes('performing well') || s.includes('Stress testing'))).toBe(true);
    });

    it('includes critical issues in focus', () => {
      const monitor = createMockMonitor(makeMetrics({ layoutOverlap: 1 }));
      const detector = new ImprovementDetector(monitor as never);
      const report = detector.generateReport();

      expect(report.nextIterationFocus.some(s => s.includes('critical'))).toBe(true);
    });
  });
});
