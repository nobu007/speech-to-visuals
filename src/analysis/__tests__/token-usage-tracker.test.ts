import { TokenUsageTracker } from '../token-usage-tracker';
import type { TokenUsageRecord } from '../token-usage-tracker';

describe('TokenUsageTracker', () => {
  describe('recordTokenUsage', () => {
    it('creates a record with correct fields', () => {
      const tracker = new TokenUsageTracker();
      const record = tracker.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 100,
        outputTokens: 50,
        stage: 'analysis',
      });

      expect(record.model).toBe('gemini-2.5-flash');
      expect(record.inputTokens).toBe(100);
      expect(record.outputTokens).toBe(50);
      expect(record.totalTokens).toBe(150);
      expect(record.stage).toBe('analysis');
      expect(record.requestId).toBeDefined();
      expect(record.timestamp).toBeGreaterThan(0);
    });

    it('uses provided requestId when given', () => {
      const tracker = new TokenUsageTracker();
      const record = tracker.recordTokenUsage({
        model: 'gemini-2.5-pro',
        inputTokens: 10,
        outputTokens: 5,
        stage: 'fallback',
        requestId: 'custom-req-123',
      });
      expect(record.requestId).toBe('custom-req-123');
    });

    it('generates unique requestIds', () => {
      const tracker = new TokenUsageTracker();
      const r1 = tracker.recordTokenUsage({
        model: 'gemini-2.5-flash', inputTokens: 1, outputTokens: 1, stage: 'analysis',
      });
      const r2 = tracker.recordTokenUsage({
        model: 'gemini-2.5-flash', inputTokens: 1, outputTokens: 1, stage: 'analysis',
      });
      expect(r1.requestId).not.toBe(r2.requestId);
    });
  });

  describe('getRecords', () => {
    it('returns empty array initially', () => {
      const tracker = new TokenUsageTracker();
      expect(tracker.getRecords()).toEqual([]);
    });

    it('returns all recorded entries', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 10, outputTokens: 5, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 20, outputTokens: 10, stage: 'fallback' });
      expect(tracker.getRecords()).toHaveLength(2);
    });

    it('returns a copy (not the internal array)', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 1, outputTokens: 1, stage: 'analysis' });
      const records1 = tracker.getRecords();
      records1.push({} as TokenUsageRecord);
      const records2 = tracker.getRecords();
      expect(records2).toHaveLength(1);
    });
  });

  describe('maxRecords trimming', () => {
    it('trims oldest records when exceeding maxRecords', () => {
      const tracker = new TokenUsageTracker({ maxRecords: 3 });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 1, outputTokens: 0, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 2, outputTokens: 0, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 3, outputTokens: 0, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 4, outputTokens: 0, stage: 'analysis' });

      const records = tracker.getRecords();
      expect(records).toHaveLength(3);
      // Oldest (inputTokens=1) should be trimmed
      expect(records[0].inputTokens).toBe(2);
      expect(records[2].inputTokens).toBe(4);
    });

    it('uses default maxRecords of 10000', () => {
      const tracker = new TokenUsageTracker();
      // Just verify it doesn't crash with a reasonable number of records
      for (let i = 0; i < 5; i++) {
        tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: i, outputTokens: 0, stage: 'analysis' });
      }
      expect(tracker.getRecords()).toHaveLength(5);
    });
  });

  describe('token warnings', () => {
    it('does not warn when under maxTokensPerRequest', () => {
      const tracker = new TokenUsageTracker({ maxTokensPerRequest: 1000 });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 400, outputTokens: 400, stage: 'analysis' });
      expect(tracker.getTokenWarnings()).toHaveLength(0);
    });

    it('warns when exceeding maxTokensPerRequest', () => {
      const tracker = new TokenUsageTracker({ maxTokensPerRequest: 100 });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 60, outputTokens: 50, stage: 'analysis' });
      const warnings = tracker.getTokenWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].totalTokens).toBe(110);
      expect(warnings[0].maxTokens).toBe(100);
    });

    it('does not warn by default (Infinity)', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 999999, outputTokens: 999999, stage: 'analysis' });
      expect(tracker.getTokenWarnings()).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('returns zero summary for empty tracker', () => {
      const tracker = new TokenUsageTracker();
      const summary = tracker.getSummary();
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.totalTokens).toBe(0);
      expect(summary.recordCount).toBe(0);
    });

    it('aggregates totals correctly', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 200, outputTokens: 100, stage: 'fallback' });
      const summary = tracker.getSummary();
      expect(summary.totalInputTokens).toBe(300);
      expect(summary.totalOutputTokens).toBe(150);
      expect(summary.totalTokens).toBe(450);
      expect(summary.recordCount).toBe(2);
    });

    it('groups by stage correctly', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 200, outputTokens: 100, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 300, outputTokens: 150, stage: 'fallback' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 50, outputTokens: 25, stage: 'cache-warmup' });

      const summary = tracker.getSummary();
      expect(summary.byStage.analysis.totalTokens).toBe(450);
      expect(summary.byStage.fallback.totalTokens).toBe(450);
      expect(summary.byStage['cache-warmup'].totalTokens).toBe(75);
    });

    it('groups by model correctly', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
      tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 200, outputTokens: 100, stage: 'fallback' });

      const summary = tracker.getSummary();
      expect(summary.byModel['gemini-2.5-flash'].totalTokens).toBe(150);
      expect(summary.byModel['gemini-2.5-pro'].totalTokens).toBe(300);
    });
  });

  describe('reset', () => {
    it('clears all records', () => {
      const tracker = new TokenUsageTracker();
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
      tracker.reset();
      expect(tracker.getRecords()).toEqual([]);
      expect(tracker.getSummary().recordCount).toBe(0);
    });

    it('clears all warnings', () => {
      const tracker = new TokenUsageTracker({ maxTokensPerRequest: 10 });
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
      expect(tracker.getTokenWarnings()).toHaveLength(1);
      tracker.reset();
      expect(tracker.getTokenWarnings()).toHaveLength(0);
    });
  });
});
