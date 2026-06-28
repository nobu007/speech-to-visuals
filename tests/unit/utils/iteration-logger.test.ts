/**
 * IterationLogger comprehensive tests.
 *
 * Covers: appendIteration, readHistory (fixed parser), calculateImprovementTrends,
 * generatePhaseSummary, MAX_LOG_ENTRIES enforcement, ISS-024 regex escaping,
 * error handling.
 */
import { IterationLogger, type IterationLogEntry } from '@/utils/iteration-logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'iter-log-test-'));
}

function makeEntry(overrides: Partial<IterationLogEntry> = {}): IterationLogEntry {
  return {
    iteration: 1,
    phase: 'Phase 1',
    timestamp: new Date('2024-01-15T10:00:00Z').toISOString(),
    success: true,
    metrics: {
      totalProcessingTime: 15000,
      transcriptionTime: 5000,
      analysisTime: 4000,
      layoutTime: 3000,
      renderTime: 3000,
      segmentCount: 5,
      diagramCount: 3,
      successRate: 1.0,
      memoryUsage: 104857600, // 100MB
    },
    config: {
      transcription: { model: 'whisper-large' },
      analysis: { minSegmentLengthMs: 3000, maxSegmentLengthMs: 15000 },
    },
    improvements: ['Improved accuracy', 'Added caching'],
    nextSteps: ['Optimize layout engine'],
    ...overrides,
  };
}

describe('IterationLogger', () => {
  let tempDir: string;
  let logPath: string;
  let logger: IterationLogger;

  beforeEach(() => {
    tempDir = makeTempDir();
    logPath = path.join(tempDir, 'ITERATION_LOG.md');
    logger = new IterationLogger(logPath);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // ISS-024: Regex escaping
  // ---------------------------------------------------------------------------

  describe('ISS-024: regex escaping in phase names', () => {
    it('escapes regex special characters', () => {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      expect(escapeRegex('Phase 1')).toBe('Phase 1');
      expect(escapeRegex('Phase (test)')).toBe('Phase \\(test\\)');
      expect(escapeRegex('Phase [v2]')).toBe('Phase \\[v2\\]');
      expect(escapeRegex('Phase.v3')).toBe('Phase\\.v3');
    });

    it('correctly matches escaped phase in constructed regex', () => {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const phase = 'Phase (special)';
      const escaped = escapeRegex(phase);
      const regex = new RegExp(`## ${escaped}\\n`, 'i');

      expect(regex.test('## Phase (special)\ncontent')).toBe(true);
      expect(regex.test('## Phase normal\ncontent')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // appendIteration
  // ---------------------------------------------------------------------------

  describe('appendIteration', () => {
    it('creates log file if it does not exist', async () => {
      expect(fs.existsSync(logPath)).toBe(false);

      await logger.appendIteration(makeEntry());

      expect(fs.existsSync(logPath)).toBe(true);
      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Iteration History');
    });

    it('writes entry with correct phase header', async () => {
      await logger.appendIteration(makeEntry({ phase: 'Phase 42' }));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('## Phase 42');
      expect(content).toContain('### Iteration 1 - success');
    });

    it('writes failure entry with error message', async () => {
      await logger.appendIteration(makeEntry({
        success: false,
        errorMessage: 'Pipeline crashed',
      }));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('### Iteration 1 - failure');
      expect(content).toContain('Pipeline crashed');
    });

    it('writes metrics in human-readable format', async () => {
      await logger.appendIteration(makeEntry());

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Processing Time: 15.0s');
      expect(content).toContain('Segments: 5');
      expect(content).toContain('Diagrams: 3');
      expect(content).toContain('Success Rate: 100.0%');
      expect(content).toContain('Memory Usage: 100.00MB');
    });

    it('writes improvements and next steps', async () => {
      await logger.appendIteration(makeEntry());

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('Improved accuracy');
      expect(content).toContain('Optimize layout engine');
    });

    it('appends to existing phase section', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Phase 1' }));
      await logger.appendIteration(makeEntry({ iteration: 2, phase: 'Phase 1' }));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('### Iteration 1 - success');
      expect(content).toContain('### Iteration 2 - success');
    });

    it('creates new section for different phase', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Phase 1' }));
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Phase 2' }));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('## Phase 1');
      expect(content).toContain('## Phase 2');
    });

    it('updates Last Updated timestamp', async () => {
      await logger.appendIteration(makeEntry());

      const content1 = fs.readFileSync(logPath, 'utf-8');
      const timestamp1 = content1.match(/Last Updated: (.*)/)?.[1];

      await new Promise(resolve => setTimeout(resolve, 50));
      await logger.appendIteration(makeEntry({ iteration: 2 }));

      const content2 = fs.readFileSync(logPath, 'utf-8');
      const timestamp2 = content2.match(/Last Updated: (.*)/)?.[1];

      expect(timestamp1).toBeDefined();
      expect(timestamp2).toBeDefined();
      expect(timestamp2).not.toBe(timestamp1);
    });

    it('handles phase names with regex special characters', async () => {
      await logger.appendIteration(makeEntry({ phase: 'Phase (test)' }));

      const content = fs.readFileSync(logPath, 'utf-8');
      expect(content).toContain('## Phase (test)');

      // Second entry should append to same section, not create duplicate
      await logger.appendIteration(makeEntry({ iteration: 2, phase: 'Phase (test)' }));
      const content2 = fs.readFileSync(logPath, 'utf-8');
      const matches = content2.match(/## Phase \(test\)/g);
      expect(matches).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // readHistory (fixed parser)
  // ---------------------------------------------------------------------------

  describe('readHistory', () => {
    it('returns empty array for new log with no iterations', async () => {
      const history = await logger.readHistory();
      expect(history).toEqual([]);
    });

    it('parses iteration number and success status', async () => {
      await logger.appendIteration(makeEntry({ iteration: 5, success: true }));
      await logger.appendIteration(makeEntry({ iteration: 6, success: false }));

      const history = await logger.readHistory();

      expect(history).toHaveLength(2);
      // Newer entries are prepended, so iteration 6 appears first
      const iter5 = history.find(e => e.iteration === 5);
      const iter6 = history.find(e => e.iteration === 6);
      expect(iter5).toBeDefined();
      expect(iter5!.success).toBe(true);
      expect(iter6).toBeDefined();
      expect(iter6!.success).toBe(false);
    });

    it('parses phase name correctly (not "Unknown")', async () => {
      await logger.appendIteration(makeEntry({ phase: 'Phase 99' }));

      const history = await logger.readHistory();

      expect(history).toHaveLength(1);
      expect(history[0].phase).toBe('Phase 99');
    });

    it('parses metrics correctly (not all zeros)', async () => {
      await logger.appendIteration(makeEntry({
        metrics: {
          totalProcessingTime: 30000,
          transcriptionTime: 10000,
          analysisTime: 8000,
          layoutTime: 6000,
          renderTime: 6000,
          segmentCount: 10,
          diagramCount: 7,
          successRate: 0.95,
        },
      }));

      const history = await logger.readHistory();

      expect(history).toHaveLength(1);
      const m = history[0].metrics;
      expect(m.totalProcessingTime).toBe(30000);
      expect(m.transcriptionTime).toBe(10000);
      expect(m.segmentCount).toBe(10);
      expect(m.diagramCount).toBe(7);
      expect(m.successRate).toBeCloseTo(0.95, 2);
    });

    it('parses timestamp from log entry', async () => {
      const ts = new Date('2024-06-15T12:30:00.000Z').toISOString();
      await logger.appendIteration(makeEntry({ timestamp: ts }));

      const history = await logger.readHistory();

      expect(history).toHaveLength(1);
      expect(history[0].timestamp).toBe(ts);
    });

    it('handles multiple phases in the same log', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Alpha' }));
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Beta' }));
      await logger.appendIteration(makeEntry({ iteration: 2, phase: 'Alpha' }));

      const history = await logger.readHistory();

      expect(history).toHaveLength(3);
      const alphaEntries = history.filter(e => e.phase === 'Alpha');
      const betaEntries = history.filter(e => e.phase === 'Beta');
      expect(alphaEntries).toHaveLength(2);
      expect(betaEntries).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateImprovementTrends
  // ---------------------------------------------------------------------------

  describe('calculateImprovementTrends', () => {
    it('returns stable with no history', async () => {
      const trends = await logger.calculateImprovementTrends();

      expect(trends.averageProcessingTime).toBe(0);
      expect(trends.successRate).toBe(0);
      expect(trends.trendDirection).toBe('stable');
      expect(trends.recommendations).toContain('No historical data available');
    });

    it('calculates average processing time from parsed entries', async () => {
      await logger.appendIteration(makeEntry({
        metrics: { ...makeEntry().metrics, totalProcessingTime: 20000 },
      }));
      await logger.appendIteration(makeEntry({
        iteration: 2,
        metrics: { ...makeEntry().metrics, totalProcessingTime: 40000 },
      }));

      const trends = await logger.calculateImprovementTrends();

      expect(trends.averageProcessingTime).toBeGreaterThan(0);
    });

    it('calculates success rate correctly', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, success: true }));
      await logger.appendIteration(makeEntry({ iteration: 2, success: true }));
      await logger.appendIteration(makeEntry({ iteration: 3, success: false }));

      const trends = await logger.calculateImprovementTrends();

      expect(trends.successRate).toBeCloseTo(2 / 3, 1);
    });

    it('recommends action when success rate below 80%', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, success: true }));
      await logger.appendIteration(makeEntry({ iteration: 2, success: false, errorMessage: 'err1' }));
      await logger.appendIteration(makeEntry({ iteration: 3, success: false, errorMessage: 'err2' }));

      const trends = await logger.calculateImprovementTrends();

      expect(trends.successRate).toBeLessThan(0.8);
      expect(trends.recommendations.some(r => r.includes('Success rate below 80%'))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // generatePhaseSummary
  // ---------------------------------------------------------------------------

  describe('generatePhaseSummary', () => {
    it('returns not-found message for unknown phase', async () => {
      const summary = await logger.generatePhaseSummary('Nonexistent');
      expect(summary).toContain('No iterations logged for phase: Nonexistent');
    });

    it('generates summary with correct counts', async () => {
      await logger.appendIteration(makeEntry({ iteration: 1, phase: 'Test Phase', success: true }));
      await logger.appendIteration(makeEntry({ iteration: 2, phase: 'Test Phase', success: true }));
      await logger.appendIteration(makeEntry({ iteration: 3, phase: 'Test Phase', success: false, errorMessage: 'fail' }));

      const summary = await logger.generatePhaseSummary('Test Phase');

      expect(summary).toContain('Total Iterations**: 3');
      expect(summary).toContain('Successful**: 2');
      expect(summary).toContain('Failed**: 1');
      expect(summary).toContain('66.7%');
    });
  });

  // ---------------------------------------------------------------------------
  // MAX_LOG_ENTRIES enforcement
  // ---------------------------------------------------------------------------

  describe('MAX_LOG_ENTRIES enforcement', () => {
    it('trims oldest entries when exceeding limit', async () => {
      const smallLogger = new IterationLogger(logPath);
      Object.defineProperty(smallLogger, 'MAX_LOG_ENTRIES', { value: 5, writable: true });

      for (let i = 1; i <= 8; i++) {
        await smallLogger.appendIteration(makeEntry({
          iteration: i,
          phase: 'Bulk Phase',
        }));
      }

      const history = await smallLogger.readHistory();

      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('does not throw when appendIteration fails', async () => {
      const badLogger = new IterationLogger('/dev/null/impossible/path/log.md');

      await expect(badLogger.appendIteration(makeEntry())).resolves.not.toThrow();
    });

    it('returns empty array when readHistory fails', async () => {
      const badLogger = new IterationLogger('/dev/null/impossible/path/log.md');

      const history = await badLogger.readHistory();
      expect(history).toEqual([]);
    });

    it('returns empty trends when calculateImprovementTrends fails', async () => {
      const badLogger = new IterationLogger('/dev/null/impossible/path/log.md');

      const trends = await badLogger.calculateImprovementTrends();
      expect(trends.recommendations).toContain('No historical data available');
    });
  });
});
