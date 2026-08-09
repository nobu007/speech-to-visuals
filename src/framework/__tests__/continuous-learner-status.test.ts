/**
 * Tests for ContinuousLearner scheduling status and dashboard integration methods.
 * Covers: getLearningStatus, getDetectedPatterns, getSystemInsights,
 * lastAnalysisAt tracking, nextAnalysisAt calculation.
 */

import { ContinuousLearner } from '../continuous-learner';

// Suppress logger output during tests
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ContinuousLearner scheduling status', () => {
  let learner: ContinuousLearner;

  beforeEach(() => {
    learner = new ContinuousLearner(false);
  });

  afterEach(() => {
    learner.stopLearning();
  });

  describe('getLearningStatus', () => {
    it('should return not-running status when autoStart=false', () => {
      const status = learner.getLearningStatus();
      expect(status.isRunning).toBe(false);
      expect(status.iteration).toBe(0);
      expect(status.intervalMs).toBe(60_000);
      expect(status.nextAnalysisAt).toBeNull();
      expect(status.lastAnalysisAt).toBeNull();
      expect(status.lastAnalysisSuccess).toBe(false);
    });

    it('should return running status when autoStart=true', () => {
      const l = new ContinuousLearner(true);
      try {
        const status = l.getLearningStatus();
        expect(status.isRunning).toBe(true);
        expect(status.intervalMs).toBe(60_000);
      } finally {
        l.stopLearning();
      }
    });

    it('should return running=false after stopLearning', () => {
      const l = new ContinuousLearner(true);
      l.stopLearning();
      const status = l.getLearningStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should return running=false when constructed with autoStart=false and never started', () => {
      const status = learner.getLearningStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('lastAnalysisAt tracking via fake timers', () => {
    let timerLearner: ContinuousLearner;

    beforeEach(() => {
      jest.useFakeTimers();
      timerLearner = new ContinuousLearner(true);
    });

    afterEach(() => {
      timerLearner.stopLearning();
      jest.useRealTimers();
    });

    it('should set lastAnalysisAt after first interval tick', async () => {
      // Before first tick
      expect(timerLearner.getLearningStatus().lastAnalysisAt).toBeNull();

      await jest.advanceTimersByTimeAsync(60_000);

      const status = timerLearner.getLearningStatus();
      expect(status.lastAnalysisAt).not.toBeNull();
      expect(typeof status.lastAnalysisAt).toBe('number');
    });

    it('should set lastAnalysisSuccess=true on successful analysis', async () => {
      // Add some data so analysis has something to process
      await timerLearner.learnFromProcessingResult(
        'test', {}, {}, 5000, 0.9, true, [], {}
      );

      await jest.advanceTimersByTimeAsync(60_000);

      const status = timerLearner.getLearningStatus();
      expect(status.lastAnalysisSuccess).toBe(true);
    });

    it('should increment iteration count on each tick', async () => {
      expect(timerLearner.getLearningStatus().iteration).toBe(0);

      await jest.advanceTimersByTimeAsync(60_000);
      expect(timerLearner.getLearningStatus().iteration).toBe(1);

      await jest.advanceTimersByTimeAsync(60_000);
      expect(timerLearner.getLearningStatus().iteration).toBe(2);
    });

    it('should calculate nextAnalysisAt as lastAnalysisAt + intervalMs', async () => {
      await timerLearner.learnFromProcessingResult(
        'test', {}, {}, 5000, 0.9, true, [], {}
      );

      await jest.advanceTimersByTimeAsync(60_000);

      const status = timerLearner.getLearningStatus();
      expect(status.nextAnalysisAt).not.toBeNull();
      expect(status.lastAnalysisAt).not.toBeNull();
      expect(status.nextAnalysisAt! - status.lastAnalysisAt!).toBe(60_000);
    });

    it('should preserve lastAnalysisAt after stopLearning', async () => {
      await timerLearner.learnFromProcessingResult(
        'test', {}, {}, 5000, 0.9, true, [], {}
      );

      await jest.advanceTimersByTimeAsync(60_000);

      const beforeStop = timerLearner.getLearningStatus();
      timerLearner.stopLearning();
      const afterStop = timerLearner.getLearningStatus();

      expect(afterStop.lastAnalysisAt).toBe(beforeStop.lastAnalysisAt);
      expect(afterStop.lastAnalysisSuccess).toBe(beforeStop.lastAnalysisSuccess);
      // nextAnalysisAt preserved from before stop
      expect(afterStop.nextAnalysisAt).toBe(beforeStop.nextAnalysisAt);
    });

    it('should have nextAnalysisAt=null before first analysis runs', () => {
      const status = timerLearner.getLearningStatus();
      expect(status.nextAnalysisAt).toBeNull();
    });
  });

  describe('getDetectedPatterns', () => {
    it('should return empty array initially', () => {
      const patterns = learner.getDetectedPatterns();
      expect(patterns).toEqual([]);
    });

    it('should return patterns after data triggers detection', async () => {
      // Feed enough data with recurring errors to trigger pattern detection
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'error_component', {}, {}, 5000, 0.5, false,
          ['recurring_timeout'], {}
        );
      }

      const patterns = learner.getDetectedPatterns();
      expect(patterns.length).toBeGreaterThanOrEqual(1);

      // Verify pattern structure
      const p = patterns[0];
      expect(p.pattern).toBeDefined();
      expect(p.confidence).toBeGreaterThan(0);
      expect(p.confidence).toBeLessThanOrEqual(1);
      expect(p.improvementSuggestion).toBeDefined();
      expect(p.expectedGain).toBeGreaterThan(0);
      expect(p.validationCount).toBeGreaterThan(0);
    });

    it('should return a copy (not mutable reference)', () => {
      const p1 = learner.getDetectedPatterns();
      const p2 = learner.getDetectedPatterns();
      expect(p1).not.toBe(p2); // Different array instances
      expect(p1).toEqual(p2); // Same content
    });
  });

  describe('getSystemInsights', () => {
    it('should return empty array initially', () => {
      const insights = learner.getSystemInsights();
      expect(insights).toEqual([]);
    });

    it('should return insights after periodic analysis generates them', async () => {
      jest.useFakeTimers();
      const tl = new ContinuousLearner(true);

      try {
        // Add data that will trigger quality insight (avg quality < 0.85)
        for (let i = 0; i < 15; i++) {
          await tl.learnFromProcessingResult(
            'component', {}, {}, 25_000, 0.7, true, [], {}
          );
        }

        await jest.advanceTimersByTimeAsync(60_000);

        const insights = tl.getSystemInsights();
        expect(insights.length).toBeGreaterThanOrEqual(1);

        // Verify insight structure
        const insight = insights[0];
        expect(insight.type).toBeDefined();
        expect(['performance', 'quality', 'reliability', 'usability']).toContain(insight.type);
        expect(insight.description).toBeDefined();
        expect(insight.confidence).toBeGreaterThan(0);
        expect(insight.confidence).toBeLessThanOrEqual(1);
        expect(typeof insight.actionable).toBe('boolean');
        expect(insight.recommendation).toBeDefined();
      } finally {
        tl.stopLearning();
        jest.useRealTimers();
      }
    });

    it('should return a copy (not mutable reference)', () => {
      const i1 = learner.getSystemInsights();
      const i2 = learner.getSystemInsights();
      expect(i1).not.toBe(i2);
      expect(i1).toEqual(i2);
    });

    it('caps systemInsights on every insert path (secondary-bypass regression)', async () => {
      // analyzeSuccessRateTrends (called by performComprehensiveAnalysis) pushes
      // one insight per component with a declining success trend — a SECONDARY
      // insert path that historically bypassed the only trim, which lived inside
      // generateSystemInsights. When generateSystemInsights early-returns
      // (< 10 data points) that trim never runs, so the secondary pushes grew
      // without bound. The fix routes every push through addSystemInsight, which
      // enforces the MAX_SYSTEM_INSIGHTS FIFO ceiling unconditionally.
      jest.useFakeTimers();
      const tl = new ContinuousLearner(false); // no interval — fire cycles manually
      try {
        const HOUR = 3600_000;
        // 4 components, each 2 hourly buckets: success (rate 1.0) then failure
        // (rate 0.0) -> calculateTrend([1.0, 0.0]) = -1.0 < -0.1 triggers a push.
        // 8 entries < 10, so generateSystemInsights early-returns (no primary trim).
        for (let c = 0; c < 4; c++) {
          const comp = `decliningComp${c}`;
          jest.setSystemTime(HOUR * 1);
          await tl.learnFromProcessingResult(comp, {}, {}, 1000, 0.9, true, [], {});
          jest.setSystemTime(HOUR * 2);
          await tl.learnFromProcessingResult(comp, {}, {}, 1000, 0.9, false, [], {});
        }

        // Mirror the interval body (performComprehensiveAnalysis then
        // generateSystemInsights) across several cycles. Each cycle pushes 4
        // insights (one per declining component); generateSystemInsights
        // early-returns and adds/trims nothing.
        const internal = tl as unknown as {
          performComprehensiveAnalysis: () => Promise<void>;
          generateSystemInsights: () => Promise<void>;
        };
        for (let i = 0; i < 4; i++) {
          await internal.performComprehensiveAnalysis();
          await internal.generateSystemInsights();
        }

        // 4 components × 4 cycles = 16 secondary pushes; without the cap this
        // would be 16. With addSystemInsight it plateaus at MAX_SYSTEM_INSIGHTS.
        const insights = tl.getSystemInsights();
        expect(insights.length).toBeLessThanOrEqual(10);
        expect(insights.length).toBe(10);
      } finally {
        tl.stopLearning();
        jest.useRealTimers();
      }
    });
  });

  describe('integration with getLearningReport', () => {
    it('should have consistent counts between getDetectedPatterns and getLearningReport', async () => {
      for (let i = 0; i < 10; i++) {
        await learner.learnFromProcessingResult(
          'test_comp', {}, {}, 5000, 0.5, false,
          ['error_a'], {}
        );
      }

      const report = learner.getLearningReport();
      const patterns = learner.getDetectedPatterns();
      expect(patterns.length).toBe(report.detectedPatterns);
    });
  });
});
