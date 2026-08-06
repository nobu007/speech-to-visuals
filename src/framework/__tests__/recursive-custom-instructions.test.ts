/**
 * Tests for RecursiveCustomInstructionsFramework
 * Covers: executeDevelopmentCycle, prepareNextIteration (improvement propagation),
 *         recovery strategies, evaluateIteration, state management, progress reporting
 */

import { jest } from '@jest/globals';
import { RecursiveCustomInstructionsFramework } from '../recursive-custom-instructions';
import * as loggerModule from '../../utils/logger';

// Spy on the actual logger methods so ESM module resolution works correctly
const infoSpy = jest.spyOn(loggerModule.logger, 'info');
const errorSpy = jest.spyOn(loggerModule.logger, 'error');
const warnSpy = jest.spyOn(loggerModule.logger, 'warn');
const debugSpy = jest.spyOn(loggerModule.logger, 'debug');

describe('RecursiveCustomInstructionsFramework', () => {
  let framework: RecursiveCustomInstructionsFramework;

  beforeEach(() => {
    infoSpy.mockClear();
    errorSpy.mockClear();
    warnSpy.mockClear();
    debugSpy.mockClear();
    framework = new RecursiveCustomInstructionsFramework({});
  });

  describe('constructor', () => {
    it('initializes with default development cycles', () => {
      const report = framework.generateProgressReport();
      expect(report.framework).toBe('Recursive Custom Instructions');
      expect(report.status).toBe('implementing');
      expect(report.iteration).toBe(1);
    });

    it('accepts custom config', () => {
      const fw = new RecursiveCustomInstructionsFramework({ customKey: 'val' });
      expect(fw.generateProgressReport()).toBeDefined();
    });
  });

  describe('prepareNextIteration — improvement propagation (BUG FIX)', () => {
    it('moves improvements to nextActions', async () => {
      // Populate improvements via recordStageFailure (directly modifies state)
      await framework.recordStageFailure('transcription', new Error('test'), 1000);
      expect(framework.generateProgressReport().improvements.length).toBeGreaterThan(0);

      await framework.prepareNextIteration('test-phase', 2);
      const report = framework.generateProgressReport();
      expect(report.nextActions.length).toBeGreaterThan(0);
    });

    it('logs when improvements are applied', async () => {
      await framework.recordStageFailure('transcription', new Error('test'), 1000);
      await framework.prepareNextIteration('test-phase', 2);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Applied')
      );
    });

    it('does nothing when no improvements exist', async () => {
      await framework.prepareNextIteration('clean-phase', 1);
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });

  describe('recovery strategies (BUG FIX: were empty stubs)', () => {
    it('handleIterationFailure triggers recovery logging', async () => {
      const error = new Error('Module not found: missing-dep');
      await framework.handleIterationFailure('test-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements.length).toBeGreaterThan(0);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('API failure sets ANALYSIS_DISABLE_GEMINI flag', async () => {
      process.env.ANALYSIS_DISABLE_GEMINI = '';
      const error = new Error('API rate limit exceeded (429)');
      await framework.handleIterationFailure('api-phase', 1, error);
      expect(process.env.ANALYSIS_DISABLE_GEMINI).toBe('1');
    });

    it('logic error triggers rollback (decrements iteration)', async () => {
      await framework.startCycle('logic-test', 3);
      const error = new Error('TypeError: undefined is not a function');
      await framework.handleIterationFailure('logic-test', 3, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Rollback')
      );
    });

    it('performance error triggers optimization warning', async () => {
      const error = new Error('performance timeout exceeded');
      await framework.handleIterationFailure('perf-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Optimize performance')
      );
    });

    it('unknown error categorized as logic triggers rollback', async () => {
      // Errors not matching any pattern default to 'logic' → rollbackAndRefactor
      const error = new Error('something unexpected happened');
      await framework.handleIterationFailure('unknown-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Rollback')
      );
    });

    it('dependency error adds dependency resolution improvement', async () => {
      const error = new Error('Cannot resolve module');
      await framework.handleIterationFailure('dep-phase', 1, error);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('dependency')
      );
    });
  });

  describe('executeDevelopmentCycle', () => {
    it('runs implementation callback and returns state', async () => {
      const mockImpl = jest.fn().mockResolvedValue('success');
      const state = await framework.executeDevelopmentCycle('test', mockImpl);
      expect(state).toBeDefined();
      expect(state.status).toBe('completed');
      expect(mockImpl).toHaveBeenCalled();
    });

    it('handles implementation error gracefully', async () => {
      const mockImpl = jest.fn().mockRejectedValue(new Error('test error'));
      const state = await framework.executeDevelopmentCycle('fail-test', mockImpl);
      expect(state).toBeDefined();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('evaluateIteration', () => {
    it('passes when all thresholds met', async () => {
      const goodMetrics = {
        transcriptionAccuracy: 0.9,
        sceneSegmentationF1: 0.8,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(goodMetrics, {});
      expect(result.passed).toBe(true);
      expect(result.shouldAdvancePhase).toBe(true);
      expect(result.shouldCommit).toBe(true);
    });

    it('fails when transcription accuracy below threshold', async () => {
      const badMetrics = {
        transcriptionAccuracy: 0.5,
        sceneSegmentationF1: 0.9,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(badMetrics, {});
      expect(result.passed).toBe(false);
      expect(result.issues).toContainEqual(
        expect.stringContaining('Transcription')
      );
    });

    it('iterates when criteria not met but iterations remain', async () => {
      // Use a known phase so currentPhaseConfig is found
      await framework.startCycle('MVP構築', 1);

      const badMetrics = {
        transcriptionAccuracy: 0.5,
        sceneSegmentationF1: 0.4,
        layoutOverlap: 0,
        renderTime: 10000,
        memoryUsage: 0,
        timestamp: new Date(),
      };

      const result = await framework.evaluateIteration(badMetrics, {});
      expect(result.shouldIterate).toBe(true);
      expect(result.shouldAdvancePhase).toBe(false);
    });
  });

  describe('recordStageSuccess', () => {
    it('updates metrics for transcription stage', async () => {
      await framework.recordStageSuccess('transcription', { accuracy: 0.92, duration: 1500 });
      const report = framework.generateProgressReport();
      expect(report.metrics.transcriptionAccuracy).toBe(0.92);
    });

    it('updates metrics for analysis stage', async () => {
      await framework.recordStageSuccess('analysis', { accuracy: 0.88, duration: 2000 });
      const report = framework.generateProgressReport();
      expect(report.metrics.sceneSegmentationF1).toBe(0.88);
    });

    it('updates metrics for layout stage', async () => {
      await framework.recordStageSuccess('layout', { duration: 5000, memoryUsage: 128 });
      const report = framework.generateProgressReport();
      expect(report.metrics.layoutOverlap).toBe(0);
    });
  });

  describe('recordStageFailure', () => {
    it('records failure metrics and improvement', async () => {
      await framework.recordStageFailure('transcription', new Error('whisper failed'), 3000);
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('Fix transcription')
      );
    });
  });

  describe('recordQualityIssue', () => {
    it('adds quality issue to improvements', async () => {
      await framework.recordQualityIssue('layout', 'overlap', 'Node overlap at (100,200)');
      const report = framework.generateProgressReport();
      expect(report.improvements).toContainEqual(
        expect.stringContaining('layout')
      );
    });
  });

  describe('advanceToPhase', () => {
    it('resets iteration and clears improvements', async () => {
      await framework.recordQualityIssue('test', 'issue', 'test issue');
      await framework.advanceToPhase('new-phase');
      const report = framework.generateProgressReport();
      expect(report.iteration).toBe(1);
      expect(report.improvements).toEqual([]);
    });
  });

  describe('generateProgressReport', () => {
    it('returns a complete report object', () => {
      const report = framework.generateProgressReport();
      expect(report).toHaveProperty('framework');
      expect(report).toHaveProperty('currentPhase');
      expect(report).toHaveProperty('iteration');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('qualityScore');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('improvements');
      expect(report).toHaveProperty('nextActions');
      expect(report).toHaveProperty('timestamp');
    });
  });
});
