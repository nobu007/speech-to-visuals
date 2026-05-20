/**
 * Edge-case tests for token-usage-tracker.ts
 *
 * Covers paths not exercised by token-usage-cost-monitoring.test.ts:
 *  1. maxRecords trimming (oldest evicted)
 *  2. Summary aggregation with mixed models and stages
 *  3. Custom requestId
 *  4. Auto-generated requestId format
 *  5. Reset clears both records and warnings
 *  6. getRecords returns a copy (defensive clone)
 *  7. Token warnings: no warning when at limit exactly
 *  8. Token warnings: multiple warnings accumulated
 *  9. Empty tracker summary structure
 *  10. Summary byModel breakdown accuracy
 *  11. Summary byStage breakdown accuracy
 */

import { TokenUsageTracker } from '@/analysis/token-usage-tracker';

// ---------------------------------------------------------------------------
// maxRecords trimming
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: maxRecords trimming', () => {
  it('trims oldest records when exceeding maxRecords', () => {
    const tracker = new TokenUsageTracker({ maxRecords: 3 });

    const r1 = tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 10, stage: 'analysis' });
    const r2 = tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 200, outputTokens: 20, stage: 'analysis' });
    const r3 = tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 300, outputTokens: 30, stage: 'analysis' });

    // At capacity
    expect(tracker.getRecords()).toHaveLength(3);

    // Adding 4th should trim the first
    const r4 = tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 400, outputTokens: 40, stage: 'analysis' });
    const records = tracker.getRecords();

    expect(records).toHaveLength(3);
    expect(records[0].inputTokens).toBe(200); // r1 evicted
    expect(records[1].inputTokens).toBe(300);
    expect(records[2].inputTokens).toBe(400);
  });

  it('keeps exactly maxRecords after many insertions', () => {
    const tracker = new TokenUsageTracker({ maxRecords: 5 });

    for (let i = 0; i < 20; i++) {
      tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: i, outputTokens: i, stage: 'analysis' });
    }

    expect(tracker.getRecords()).toHaveLength(5);
    // Should keep last 5: i=15..19
    const records = tracker.getRecords();
    expect(records[0].inputTokens).toBe(15);
    expect(records[4].inputTokens).toBe(19);
  });

  it('summary reflects only retained records after trimming', () => {
    const tracker = new TokenUsageTracker({ maxRecords: 2 });

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 1000, outputTokens: 1000, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 2000, outputTokens: 2000, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 3000, outputTokens: 3000, stage: 'analysis' });

    const summary = tracker.getSummary();
    // Only last 2 records kept: 2000+3000 input = 5000, 2000+3000 output = 5000
    expect(summary.totalInputTokens).toBe(5000);
    expect(summary.totalOutputTokens).toBe(5000);
    expect(summary.recordCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Custom and auto-generated requestId
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: requestId handling', () => {
  it('uses provided custom requestId', () => {
    const tracker = new TokenUsageTracker();
    const record = tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 50,
      stage: 'analysis',
      requestId: 'custom-req-123',
    });

    expect(record.requestId).toBe('custom-req-123');
  });

  it('auto-generates requestId when not provided', () => {
    const tracker = new TokenUsageTracker();
    const record = tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 50,
      stage: 'analysis',
    });

    expect(record.requestId).toMatch(/^tu_\d+_\d+$/);
  });

  it('generates unique requestIds for sequential calls', () => {
    const tracker = new TokenUsageTracker();
    const ids = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const record = tracker.recordTokenUsage({
        model: 'gemini-2.5-flash',
        inputTokens: 100,
        outputTokens: 50,
        stage: 'analysis',
      });
      ids.add(record.requestId);
    }

    expect(ids.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Reset behavior
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: reset', () => {
  it('clears records and warnings on reset', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 200 });

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 200, outputTokens: 200, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'fallback' });

    expect(tracker.getRecords()).toHaveLength(2);
    // Only first record (400 tokens) exceeds 200 limit; second (150) does not
    expect(tracker.getTokenWarnings()).toHaveLength(1);

    tracker.reset();

    expect(tracker.getRecords()).toHaveLength(0);
    expect(tracker.getTokenWarnings()).toHaveLength(0);
    const summary = tracker.getSummary();
    expect(summary.recordCount).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });

  it('allows recording after reset', () => {
    const tracker = new TokenUsageTracker();

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
    tracker.reset();

    const record = tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 200, outputTokens: 100, stage: 'fallback' });
    expect(tracker.getRecords()).toHaveLength(1);
    expect(record.model).toBe('gemini-2.5-pro');
    expect(record.inputTokens).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Defensive cloning
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: defensive cloning', () => {
  it('getRecords returns a copy, not internal reference', () => {
    const tracker = new TokenUsageTracker();
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });

    const records1 = tracker.getRecords();
    const records2 = tracker.getRecords();

    expect(records1).not.toBe(records2); // Different array references
    expect(records1).toEqual(records2);  // Same content
  });

  it('modifying getRecords result does not affect tracker', () => {
    const tracker = new TokenUsageTracker();
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });

    const records = tracker.getRecords();
    records.pop();

    expect(tracker.getRecords()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Token warnings
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: token warnings', () => {
  it('does not warn when totalTokens equals maxTokensPerRequest', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 100 });

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 60, outputTokens: 40, stage: 'analysis' });

    expect(tracker.getTokenWarnings()).toHaveLength(0);
  });

  it('warns when totalTokens exceeds maxTokensPerRequest by 1', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 100 });

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 60, outputTokens: 41, stage: 'analysis' });

    const warnings = tracker.getTokenWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].totalTokens).toBe(101);
    expect(warnings[0].maxTokens).toBe(100);
  });

  it('accumulates multiple warnings', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 50 });

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 0, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 0, outputTokens: 100, stage: 'fallback' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 10, outputTokens: 10, stage: 'cache-warmup' });

    expect(tracker.getTokenWarnings()).toHaveLength(2);
  });

  it('warning includes correct requestId', () => {
    const tracker = new TokenUsageTracker({ maxTokensPerRequest: 10 });

    tracker.recordTokenUsage({
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 0,
      stage: 'analysis',
      requestId: 'warn-test-001',
    });

    const warnings = tracker.getTokenWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0].requestId).toBe('warn-test-001');
  });

  it('no warnings when maxTokensPerRequest is Infinity (default)', () => {
    const tracker = new TokenUsageTracker();

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 999_999, outputTokens: 999_999, stage: 'analysis' });

    expect(tracker.getTokenWarnings()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Summary aggregation
// ---------------------------------------------------------------------------
describe('TokenUsageTracker: summary aggregation', () => {
  it('returns well-formed empty summary for new tracker', () => {
    const tracker = new TokenUsageTracker();
    const summary = tracker.getSummary();

    expect(summary.recordCount).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.totalTokens).toBe(0);

    // All stages should be zero
    expect(summary.byStage.analysis.totalTokens).toBe(0);
    expect(summary.byStage.fallback.totalTokens).toBe(0);
    expect(summary.byStage['cache-warmup'].totalTokens).toBe(0);

    // All models should be zero
    expect(summary.byModel['gemini-2.5-flash'].totalTokens).toBe(0);
    expect(summary.byModel['gemini-2.5-pro'].totalTokens).toBe(0);
  });

  it('correctly aggregates byModel for mixed Flash/Pro usage', () => {
    const tracker = new TokenUsageTracker();

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 50, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 200, outputTokens: 100, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 300, outputTokens: 150, stage: 'fallback' });

    const summary = tracker.getSummary();

    // Flash: 100+200=300 input, 50+100=150 output, total=450
    expect(summary.byModel['gemini-2.5-flash'].inputTokens).toBe(300);
    expect(summary.byModel['gemini-2.5-flash'].outputTokens).toBe(150);
    expect(summary.byModel['gemini-2.5-flash'].totalTokens).toBe(450);

    // Pro: 300 input, 150 output, total=450
    expect(summary.byModel['gemini-2.5-pro'].inputTokens).toBe(300);
    expect(summary.byModel['gemini-2.5-pro'].outputTokens).toBe(150);
    expect(summary.byModel['gemini-2.5-pro'].totalTokens).toBe(450);

    // Total across both models: 600 input, 300 output, 900 total
    expect(summary.totalInputTokens).toBe(600);
    expect(summary.totalOutputTokens).toBe(300);
    expect(summary.totalTokens).toBe(900);
    expect(summary.recordCount).toBe(3);
  });

  it('correctly aggregates byStage for all three stages', () => {
    const tracker = new TokenUsageTracker();

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 100, outputTokens: 10, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 200, outputTokens: 20, stage: 'fallback' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 300, outputTokens: 30, stage: 'cache-warmup' });

    const summary = tracker.getSummary();

    expect(summary.byStage.analysis).toEqual({ inputTokens: 100, outputTokens: 10, totalTokens: 110 });
    expect(summary.byStage.fallback).toEqual({ inputTokens: 200, outputTokens: 20, totalTokens: 220 });
    expect(summary.byStage['cache-warmup']).toEqual({ inputTokens: 300, outputTokens: 30, totalTokens: 330 });
  });

  it('accumulates within the same stage from multiple records', () => {
    const tracker = new TokenUsageTracker();

    tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 50, outputTokens: 10, stage: 'analysis' });
    tracker.recordTokenUsage({ model: 'gemini-2.5-pro', inputTokens: 150, outputTokens: 30, stage: 'analysis' });

    const summary = tracker.getSummary();

    expect(summary.byStage.analysis.inputTokens).toBe(200);
    expect(summary.byStage.analysis.outputTokens).toBe(40);
    expect(summary.byStage.analysis.totalTokens).toBe(240);
  });

  it('record.totalTokens equals inputTokens + outputTokens', () => {
    const tracker = new TokenUsageTracker();
    const record = tracker.recordTokenUsage({ model: 'gemini-2.5-flash', inputTokens: 1234, outputTokens: 567, stage: 'analysis' });

    expect(record.totalTokens).toBe(1234 + 567);
  });
});
