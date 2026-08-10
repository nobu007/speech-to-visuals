/**
 * Tests for AutoImprovementEngine
 * Covers: constructor, analyzeMetrics, calculateQualityScore,
 *         runImprovementCycle, autonomousImprovement, generateReport,
 *         linkIterationManager, edge cases
 */

import { jest } from '@jest/globals';

// Mock IterationManager
const mockIterationManager = {
  startIteration: jest.fn(),
  recordSuccess: jest.fn(),
  recordFailure: jest.fn(),
};

jest.unstable_mockModule('@/framework/iteration-manager', () => ({
  IterationManager: jest.fn().mockImplementation(() => mockIterationManager),
  createIterationManager: jest.fn().mockReturnValue(mockIterationManager),
}));

const {
  AutoImprovementEngine,
  createAutoImprovementEngine,
  QualityMetrics,
  ImprovementStrategy,
  QualityRecommendation,
  toQualityRecommendations,
  MAX_IMPROVEMENT_HISTORY,
} = await import('../auto-improvement-engine');
const { IterationManager } = await import('@/framework/iteration-manager');

// Suppress console
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const goodMetrics: QualityMetrics = {
  processingTime: 10000,
  memoryUsage: 300,
  throughput: 50,
  transcriptionAccuracy: 0.95,
  sceneSegmentationF1: 0.85,
  entityExtractionF1: 0.90,
  relationAccuracy: 0.90,
  layoutOverlap: 0,
  errorRate: 0.01,
  successRate: 0.99,
  crashCount: 0,
  overallScore: 95,
};

const badMetrics: QualityMetrics = {
  processingTime: 45000,
  memoryUsage: 700,
  throughput: 5,
  transcriptionAccuracy: 0.60,
  sceneSegmentationF1: 0.50,
  entityExtractionF1: 0.55,
  relationAccuracy: 0.60,
  layoutOverlap: 5,
  errorRate: 0.3,
  successRate: 0.70,
  crashCount: 3,
  overallScore: 45,
};

describe('AutoImprovementEngine', () => {
  let engine: AutoImprovementEngine;

  beforeEach(() => {
    engine = new AutoImprovementEngine();
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      const e = new AutoImprovementEngine();
      expect(e).toBeDefined();
    });

    it('should accept custom thresholds', () => {
      const e = new AutoImprovementEngine({
        transcriptionAccuracy: 0.90,
        memoryUsage: 256,
        overallScore: 80,
      });
      expect(e).toBeDefined();
    });

    it('should initialize with partial thresholds', () => {
      const e = new AutoImprovementEngine({ renderTime: 60000 });
      expect(e).toBeDefined();
    });

    // Regression: a threshold of 0 is the natural "disable this gate" sentinel
    // for `metric < threshold` checks. Previously `||` rewrote an explicit 0 back
    // to the default (0.85/0.75/0.80/0.85/90), silently re-enabling a gate the
    // caller disabled. Must use `??` to preserve the legit-zero sentinel.
    it('should preserve legit-zero thresholds as a gate-disable sentinel', () => {
      const e = new AutoImprovementEngine({
        transcriptionAccuracy: 0,
        sceneSegmentationF1: 0,
        entityExtractionF1: 0,
        relationAccuracy: 0,
        overallScore: 0,
      });
      const thresholds = (e as unknown as { thresholds: Record<string, number> }).thresholds;
      expect(thresholds.transcriptionAccuracy).toBe(0);
      expect(thresholds.sceneSegmentationF1).toBe(0);
      expect(thresholds.entityExtractionF1).toBe(0);
      expect(thresholds.relationAccuracy).toBe(0);
      expect(thresholds.overallScore).toBe(0);
    });

    it('threshold 0 disables the transcription gate even for 0% accuracy', () => {
      const e = new AutoImprovementEngine({ transcriptionAccuracy: 0 });
      const result = e.analyzeMetrics({ ...goodMetrics, transcriptionAccuracy: 0 });
      // With threshold 0, `0 < 0` is false → no transcription issue raised.
      // (Before the fix, threshold 0 became 0.85, so 0% accuracy was flagged.)
      expect(result.issues.some(i => i.includes('Transcription accuracy'))).toBe(false);
    });
  });

  // --- analyzeMetrics ---

  describe('analyzeMetrics', () => {
    it('should return no issues for good metrics', () => {
      const result = engine.analyzeMetrics(goodMetrics);
      expect(result.needsImprovement).toBe(false);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('should detect transcription accuracy issue', () => {
      const metrics = { ...goodMetrics, transcriptionAccuracy: 0.70 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Transcription accuracy'))).toBe(true);
    });

    it('should detect scene segmentation issue', () => {
      const metrics = { ...goodMetrics, sceneSegmentationF1: 0.60 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Scene segmentation'))).toBe(true);
    });

    it('should detect layout overlap issue', () => {
      const metrics = { ...goodMetrics, layoutOverlap: 3 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Layout overlap'))).toBe(true);
    });

    it('should detect processing time issue', () => {
      const metrics = { ...goodMetrics, processingTime: 40000 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Processing time'))).toBe(true);
    });

    it('should detect memory usage issue', () => {
      const metrics = { ...goodMetrics, memoryUsage: 700 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Memory usage'))).toBe(true);
    });

    it('should detect entity extraction issue', () => {
      const metrics = { ...goodMetrics, entityExtractionF1: 0.60 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Entity extraction'))).toBe(true);
    });

    it('should detect relation accuracy issue', () => {
      const metrics = { ...goodMetrics, relationAccuracy: 0.70 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Relation accuracy'))).toBe(true);
    });

    it('should detect overall score issue', () => {
      const metrics = { ...goodMetrics, overallScore: 80 };
      const result = engine.analyzeMetrics(metrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.some(i => i.includes('Overall quality score'))).toBe(true);
    });

    // Regression: analyzeMetrics MUST echo the input overallScore in its result.
    // The score is computed upstream (calculateQualityScore, 0-100) and passed in
    // via metrics.overallScore. FrameworkIntegratedPipeline.execute() returns this
    // analysis as `qualityAnalysis`, and useFrameworkPipeline reads
    // `execution.qualityAnalysis.overallScore || 0`. Before the fix the field was
    // absent, so the FrameworkDashboard headline "総合品質スコア / 100" was always 0
    // even for a 95-point run. The value must surface dynamically (not be a
    // constant) so two different inputs yield two different results.
    it('should surface the computed overallScore in its result (consumer wiring)', () => {
      const hi = engine.analyzeMetrics({ ...goodMetrics, overallScore: 92 });
      const lo = engine.analyzeMetrics({ ...goodMetrics, overallScore: 41 });
      expect(hi.overallScore).toBe(92);
      expect(lo.overallScore).toBe(41);
      // Positive + negative anchors: a high score reads back high, a low one low.
      expect(hi.overallScore).not.toBe(lo.overallScore);
    });

    it('should detect multiple issues simultaneously', () => {
      const result = engine.analyzeMetrics(badMetrics);
      expect(result.needsImprovement).toBe(true);
      expect(result.issues.length).toBeGreaterThan(3);
    });

    it('should sort recommendations by expected improvement (descending)', () => {
      const result = engine.analyzeMetrics(badMetrics);
      for (let i = 1; i < result.recommendations.length; i++) {
        expect(result.recommendations[i - 1].expectedImprovement).toBeGreaterThanOrEqual(
          result.recommendations[i].expectedImprovement
        );
      }
    });

    it('should produce recommendations with correct strategy fields', () => {
      const result = engine.analyzeMetrics(badMetrics);
      for (const rec of result.recommendations) {
        expect(rec).toHaveProperty('name');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('targetMetric');
        expect(rec).toHaveProperty('expectedImprovement');
        expect(rec).toHaveProperty('complexity');
        expect(rec).toHaveProperty('execute');
        expect(typeof rec.execute).toBe('function');
      }
    });

    // Regression (A124): analyzeMetrics returns ImprovementStrategy[], each
    // carrying a non-serializable `execute` closure (used by runImprovementCycle).
    // The framework dashboard / JSON API boundary cannot carry functions, so
    // recommendations must be projected to QualityRecommendation[] before crossing
    // out of the engine. Before this fix, consumers declared `recommendations:
    // string[]` (useFrameworkPipeline) / rendered each entry as `{rec}`
    // (FrameworkDashboard), which produced "[object Object]" (and is a latent
    // React crash: "Objects are not valid as a React child"). toQualityRecommendations
    // is the single boundary projection; FrameworkIntegratedPipeline.execute()
    // applies it and types its `qualityAnalysis` return accordingly.
    it('toQualityRecommendations projects ImprovementStrategy[] to a serializable {name, description}[]', () => {
      const strategies = engine.analyzeMetrics(badMetrics).recommendations;
      expect(strategies.length).toBeGreaterThan(0);
      // source strategies DO carry the non-serializable execute closure
      expect(typeof strategies[0].execute).toBe('function');

      const projected: QualityRecommendation[] = toQualityRecommendations(strategies);
      expect(projected).toHaveLength(strategies.length);
      for (const r of projected) {
        expect(typeof r.name).toBe('string');
        expect(r.name.length).toBeGreaterThan(0);
        expect(typeof r.description).toBe('string');
        // execute / targetMetric / etc. must NOT cross the boundary
        expect(r).not.toHaveProperty('execute');
        expect(r).not.toHaveProperty('targetMetric');
        // JSON round-trip safe (functions serialize away and break React children)
        expect(JSON.parse(JSON.stringify(r))).toEqual(r);
      }
      // name/description preserved 1:1 from the source strategies
      expect(projected.map(r => r.name)).toEqual(strategies.map(s => s.name));
    });

    it('execute() should improve the target metric (higher-is-better)', async () => {
      const metrics = { ...badMetrics, transcriptionAccuracy: 0.60 };
      const result = engine.analyzeMetrics(metrics);
      const rec = result.recommendations.find(r => r.targetMetric === 'transcriptionAccuracy');
      expect(rec).toBeDefined();

      const improved = await rec!.execute();
      expect(improved.transcriptionAccuracy).toBeGreaterThan(metrics.transcriptionAccuracy);
      expect(improved.transcriptionAccuracy).toBeLessThanOrEqual(1);
    });

    it('execute() should reduce lower-is-better metrics', async () => {
      const metrics = { ...badMetrics, processingTime: 45000 };
      const result = engine.analyzeMetrics(metrics);
      const rec = result.recommendations.find(r => r.targetMetric === 'processingTime');
      expect(rec).toBeDefined();

      const improved = await rec!.execute();
      expect(improved.processingTime).toBeLessThan(metrics.processingTime);
    });

    it('execute() should recalculate overallScore after improvement', async () => {
      const metrics = { ...badMetrics, layoutOverlap: 5 };
      const result = engine.analyzeMetrics(metrics);
      const rec = result.recommendations.find(r => r.targetMetric === 'layoutOverlap');
      expect(rec).toBeDefined();

      const improved = await rec!.execute();
      expect(improved.layoutOverlap).toBe(0); // 100% reduction
      expect(improved.overallScore).toBeGreaterThan(metrics.overallScore);
    });

    it('execute() should not mutate the original metrics', async () => {
      const metrics = { ...badMetrics, memoryUsage: 700 };
      const original = { ...metrics };
      const result = engine.analyzeMetrics(metrics);
      const rec = result.recommendations.find(r => r.targetMetric === 'memoryUsage');
      expect(rec).toBeDefined();

      await rec!.execute();
      expect(metrics).toEqual(original);
    });
  });

  // --- calculateQualityScore ---

  describe('calculateQualityScore', () => {
    it('should return 0 for empty metrics', () => {
      const score = engine.calculateQualityScore({});
      expect(score).toBe(0);
    });

    it('should return a high score for good partial metrics', () => {
      const score = engine.calculateQualityScore({
        transcriptionAccuracy: 0.95,
        sceneSegmentationF1: 0.90,
        entityExtractionF1: 0.88,
        relationAccuracy: 0.92,
      });
      expect(score).toBeGreaterThan(85);
    });

    it('should return a low score for bad metrics', () => {
      const score = engine.calculateQualityScore({
        transcriptionAccuracy: 0.50,
        processingTime: 60000,
      });
      expect(score).toBeLessThan(60);
    });

    it('should factor in processing time relative to threshold', () => {
      const scoreFast = engine.calculateQualityScore({
        processingTime: 10000, // well under 30000 threshold
      });
      const scoreSlow = engine.calculateQualityScore({
        processingTime: 60000, // over 30000 threshold
      });
      expect(scoreFast).toBeGreaterThan(scoreSlow);
    });

    it('should factor in memory usage relative to threshold', () => {
      const scoreLowMem = engine.calculateQualityScore({
        memoryUsage: 200, // well under 512 threshold
      });
      const scoreHighMem = engine.calculateQualityScore({
        memoryUsage: 1000, // over 512 threshold
      });
      expect(scoreLowMem).toBeGreaterThan(scoreHighMem);
    });

    it('should factor in layout overlap', () => {
      const scoreNoOverlap = engine.calculateQualityScore({
        layoutOverlap: 0,
      });
      const scoreHighOverlap = engine.calculateQualityScore({
        layoutOverlap: 15,
      });
      expect(scoreNoOverlap).toBeGreaterThan(scoreHighOverlap);
    });

    it('should factor in success rate', () => {
      const scoreHighSuccess = engine.calculateQualityScore({
        successRate: 1.0,
      });
      const scoreLowSuccess = engine.calculateQualityScore({
        successRate: 0.5,
      });
      expect(scoreHighSuccess).toBeGreaterThan(scoreLowSuccess);
    });

    it('should factor in all individual metrics independently', () => {
      const score = engine.calculateQualityScore({
        transcriptionAccuracy: 0.9,
        sceneSegmentationF1: 0.8,
        entityExtractionF1: 0.85,
        relationAccuracy: 0.88,
        layoutOverlap: 0,
        processingTime: 15000,
        memoryUsage: 300,
        successRate: 0.98,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // --- runImprovementCycle ---

  describe('runImprovementCycle', () => {
    it('should return early when no improvement needed', async () => {
      const getMetrics = jest.fn().mockResolvedValue(goodMetrics);
      const result = await engine.runImprovementCycle(getMetrics);
      expect(result.improved).toBe(false);
      expect(result.results).toHaveLength(0);
      expect(result.finalScore).toBe(goodMetrics.overallScore);
    });

    it('should apply strategies when improvement is needed', async () => {
      let callCount = 0;
      const getMetrics = jest.fn().mockImplementation(async () => {
        callCount++;
        // Simulate improvement after first call
        if (callCount <= 2) return badMetrics;
        return { ...badMetrics, overallScore: 75, transcriptionAccuracy: 0.80 };
      });

      const strategy: ImprovementStrategy = {
        name: 'Test Strategy',
        description: 'Test',
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 20,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, transcriptionAccuracy: 0.80, overallScore: 75 }),
      };

      const result = await engine.runImprovementCycle(getMetrics, [strategy]);
      expect(result.results.length).toBeGreaterThan(0);
      expect(getMetrics).toHaveBeenCalled();
    });

    it('should handle strategy execution errors gracefully', async () => {
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);

      const failingStrategy: ImprovementStrategy = {
        name: 'Failing Strategy',
        description: 'Always fails',
        targetMetric: 'processingTime',
        expectedImprovement: 10,
        complexity: 'low',
        execute: async () => {
          throw new Error('Strategy execution failed');
        },
      };

      const result = await engine.runImprovementCycle(getMetrics, [failingStrategy]);
      // Should not throw, should handle error
      expect(result).toBeDefined();
    });

    it('should limit to top 3 strategies', async () => {
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);

      const strategies: ImprovementStrategy[] = Array.from({ length: 6 }, (_, i) => ({
        name: `Strategy ${i}`,
        description: `Test strategy ${i}`,
        targetMetric: 'processingTime' as keyof QualityMetrics,
        expectedImprovement: 10 + i * 5,
        complexity: 'low' as const,
        execute: async () => badMetrics,
      }));

      const result = await engine.runImprovementCycle(getMetrics, strategies);
      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('marks a successful lower-is-better improvement as success (sign fix)', async () => {
      // layoutOverlap is LOWER_IS_BETTER: a strategy that reduces overlap
      // 5 -> 0 is a genuine improvement. Before the sign fix, after < before
      // made the raw after-before delta negative, so success (improvement > 0)
      // was false and the cycle reported `improved: false` with a negative %.
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'Fix Layout Overlaps',
        description: 'Resolve every overlap',
        targetMetric: 'layoutOverlap',
        expectedImprovement: 100,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, layoutOverlap: 0 }),
      };

      const result = await engine.runImprovementCycle(getMetrics, [strategy]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].improvement).toBeGreaterThan(0);
      expect(result.improved).toBe(true);
    });

    it('reports a positive improvement % for lower-is-better metrics', async () => {
      // processingTime 45000 -> 31500 is a 30% reduction; improvement must read
      // +30%, not -30%. Matches the report's `improvement > 0 ? '+' : ''` sign.
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'Reduce Processing Time',
        description: 'Optimize hot path',
        targetMetric: 'processingTime',
        expectedImprovement: 30,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, processingTime: 31500 }),
      };

      const result = await engine.runImprovementCycle(getMetrics, [strategy]);
      expect(result.results[0].improvement).toBeCloseTo(30, 0);
      expect(result.results[0].success).toBe(true);
    });

    it('still marks a successful higher-is-better improvement as success', async () => {
      // Regression guard: the sign flip must not break the higher-is-better
      // path (transcriptionAccuracy 0.60 -> 0.90 is +50%).
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'Improve Transcription',
        description: 'Better model',
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 30,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, transcriptionAccuracy: 0.90 }),
      };

      const result = await engine.runImprovementCycle(getMetrics, [strategy]);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].improvement).toBeGreaterThan(0);
      expect(result.improved).toBe(true);
    });

    it('still marks a no-op (unchanged value) lower-is-better strategy as not improved', async () => {
      // delta 0 must stay success=false after the sign flip (-0 === 0).
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'No-op',
        description: 'Changes nothing',
        targetMetric: 'layoutOverlap',
        expectedImprovement: 10,
        complexity: 'low',
        execute: async () => ({ ...badMetrics }),
      };

      const result = await engine.runImprovementCycle(getMetrics, [strategy]);
      expect(result.results[0].success).toBe(false);
      expect(result.results[0].improvement).toBe(0);
      expect(result.improved).toBe(false);
    });
  });

  // --- autonomousImprovement ---

  describe('autonomousImprovement', () => {
    it('should succeed when target score is reached', async () => {
      let callCount = 0;
      const getMetrics = jest.fn().mockImplementation(async () => {
        callCount++;
        return callCount <= 1 ? badMetrics : { ...badMetrics, overallScore: 96 };
      });

      const result = await engine.autonomousImprovement(getMetrics, 95, 3);
      expect(result.finalScore).toBeGreaterThanOrEqual(0);
      expect(result.cycles).toBeGreaterThanOrEqual(1);
    });

    it('should reach max cycles if target is never met', async () => {
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const result = await engine.autonomousImprovement(getMetrics, 99, 2);
      expect(result.cycles).toBe(2);
    });

    it('should use default targetScore and maxCycles', async () => {
      const getMetrics = jest.fn().mockResolvedValue({ ...goodMetrics, overallScore: 96 });
      const result = await engine.autonomousImprovement(getMetrics);
      expect(result.cycles).toBeGreaterThanOrEqual(1);
    });
  });

  // --- getImprovementHistory ---

  describe('getImprovementHistory', () => {
    it('should return empty history initially', () => {
      const history = engine.getImprovementHistory();
      // improvementHistory is a CappedArray (FIFO-bounded). An empty CappedArray
      // carries a `maxSize` own property, so assert length rather than toEqual([]).
      expect(history).toHaveLength(0);
    });

    it('should return history after running improvement cycle', async () => {
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'Test',
        description: 'Test',
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 10,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, transcriptionAccuracy: 0.75 }),
      };

      await engine.runImprovementCycle(getMetrics, [strategy]);
      const history = engine.getImprovementHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('strategy', 'Test');
      expect(history[0]).toHaveProperty('before');
      expect(history[0]).toHaveProperty('after');
      expect(history[0]).toHaveProperty('improvement');
      expect(history[0]).toHaveProperty('success');
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('caps improvementHistory FIFO — session-lifetime growth stays bounded', async () => {
      // Regression guard: the engine is held for a dashboard session
      // (FrameworkIntegratedPipeline → useFrameworkPipeline useRef) and each
      // runImprovementCycle appends results. Before CappedArray this grew without
      // bound for the session. Pin the FIFO cap so a future push site cannot
      // reintroduce unbounded growth.
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const mkStrategy = (name: string): ImprovementStrategy => ({
        name,
        description: name,
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 10,
        complexity: 'low',
        execute: async () => ({ ...badMetrics, transcriptionAccuracy: 0.75 }),
      });
      const strategies = [mkStrategy('S0'), mkStrategy('S1'), mkStrategy('S2')];

      // runImprovementCycle applies up to 3 strategies per call (top-3 slice),
      // each pushing one ImprovementResult. 25 cycles × 3 = 75 pushes ≫ 50.
      for (let i = 0; i < 25; i++) {
        await engine.runImprovementCycle(getMetrics, strategies);
      }

      const history = engine.getImprovementHistory();
      expect(history.length).toBe(MAX_IMPROVEMENT_HISTORY); // bounded, NOT 75
      // FIFO: oldest evicted, the collection never exceeds the cap.
      expect(history.length).toBeLessThanOrEqual(MAX_IMPROVEMENT_HISTORY);
    });
  });

  // --- generateReport ---

  describe('generateReport', () => {
    it('should generate report with no history', () => {
      const report = engine.generateReport();
      expect(report).toContain('AutoImprovementEngine Report');
      expect(report).toContain('Total Improvements Attempted**: 0');
      expect(report).toContain('Successful Improvements**: 0');
    });

    it('should include current metrics in report after analysis', () => {
      engine.analyzeMetrics(goodMetrics);
      const report = engine.generateReport();
      expect(report).toContain('Current Quality Metrics');
    });

    it('should include improvement history in report', async () => {
      const getMetrics = jest.fn().mockResolvedValue(badMetrics);
      const strategy: ImprovementStrategy = {
        name: 'Test Strategy',
        description: 'Test',
        targetMetric: 'transcriptionAccuracy',
        expectedImprovement: 10,
        complexity: 'low',
        execute: async () => badMetrics,
      };

      await engine.runImprovementCycle(getMetrics, [strategy]);
      const report = engine.generateReport();
      expect(report).toContain('Improvement History');
      expect(report).toContain('Test Strategy');
    });
  });

  // --- linkIterationManager ---

  describe('linkIterationManager', () => {
    it('should link with IterationManager', () => {
      expect(() => {
        engine.linkIterationManager(mockIterationManager as unknown as IterationManager);
      }).not.toThrow();
    });
  });

  // --- createAutoImprovementEngine factory ---

  describe('createAutoImprovementEngine', () => {
    it('should create an engine with default thresholds', () => {
      const e = createAutoImprovementEngine();
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(AutoImprovementEngine);
    });

    it('should create an engine with custom thresholds', () => {
      const e = createAutoImprovementEngine({ overallScore: 80 });
      expect(e).toBeDefined();
    });
  });
});
