/**
 * Round 24 single-source guard: the 段階的開発フロー (development-phase plan).
 *
 * Before round 24 the SAME phase plan — the custom-instructions "段階的開発
 * フロー" table (phase, maxIterations, successCriteria, failureRecovery,
 * commitTrigger) — was declared in FOUR sites with THREE shapes, already
 * drifted:
 *
 *   1. src/framework/iteration-manager.ts `DEVELOPMENT_CYCLES` — the
 *      canonical 5-phase record (MVP構築/内容分析/図解生成/E2E統合/品質向上),
 *      content-validated by iteration-manager-extended.
 *   2. src/framework/recursive-custom-instructions.ts inline array — only 3
 *      phases, and 内容分析's successCriteria had DRIFTED (dropped
 *      主要エンティティ抽出率90% + 関係性の正確性85%, added an alien
 *      図解タイプ判定70% that the canonical plan does not carry). Because
 *      `evaluateIteration` looks phases up with `.find(...)`, any phase
 *      missing from the copy (E2E統合, 品質向上, グローバル展開) fell through
 *      to the "max iterations reached" branch and committed with partial
 *      success ON ITERATION 1 — the iterate-on-failure path was unreachable.
 *   3. src/pipeline/main-pipeline.ts `getNextPhase()` local order — 5 phases
 *      but with a PHANTOM グローバル展開 (defined nowhere else in the repo:
 *      no criteria, no cycle, no UI) while canonical E2E統合 was missing.
 *   4. src/components/FrameworkDashboard.tsx hand-copied UI table — 3 phases,
 *      stale against the canonical 5.
 *
 * This file pins (a) canonical content + the derived phase order, (b) the
 * recursive framework's BEHAVIORAL delegation (a canonical-only phase
 * iterates instead of prematurely committing), and (c) source anchors that
 * the other three sites derive from the canonical record instead of
 * re-declaring it. The "no src file re-freezes the plan" discovery sweep
 * lives in the shared registry — tests/guards/frozen-literal-rules.ts, rule
 * 'development phase plan single-sourced in iteration-manager'.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import {
  DEVELOPMENT_CYCLES,
  DEVELOPMENT_PHASE_ORDER,
} from '@/framework/iteration-manager';
import { RecursiveCustomInstructionsFramework } from '@/framework/recursive-custom-instructions';

/** Failing metrics: every threshold miss so the iterate branch is the only
 *  path that can keep the phase alive. */
function badMetrics() {
  return {
    transcriptionAccuracy: 0,
    sceneSegmentationF1: 0,
    layoutOverlap: 1,
    renderTime: Number.MAX_SAFE_INTEGER,
    memoryUsage: Number.MAX_SAFE_INTEGER,
    timestamp: new Date(),
  };
}

describe('development-phase plan single source (round 24)', () => {
  describe('canonical record (iteration-manager DEVELOPMENT_CYCLES)', () => {
    it('keeps the five-phase plan with the canonical order', () => {
      expect(DEVELOPMENT_PHASE_ORDER).toEqual([
        'MVP構築',
        '内容分析',
        '図解生成',
        'E2E統合',
        '品質向上',
      ]);
      // The derived order must BE the record's key sequence, not a second list.
      expect([...DEVELOPMENT_PHASE_ORDER]).toEqual(Object.keys(DEVELOPMENT_CYCLES));
    });

    it('carries the full 内容分析 criteria set (the drifted copy dropped two bars)', () => {
      expect(DEVELOPMENT_CYCLES['内容分析'].successCriteria).toEqual([
        'シーン分割精度80%',
        '主要エンティティ抽出率90%',
        '関係性の正確性85%',
      ]);
    });

    it('never carries the alien criterion the drifted copy invented', () => {
      expect(JSON.stringify(DEVELOPMENT_CYCLES)).not.toContain('図解タイプ判定70%');
    });
  });

  describe('recursive framework delegates behaviorally', () => {
    it('iterates a canonical-only phase (品質向上) instead of prematurely committing', async () => {
      const framework = new RecursiveCustomInstructionsFramework({});
      await framework.startCycle('品質向上', 1);

      const result = await framework.evaluateIteration(badMetrics(), {});

      // Before round 24: 品質向上 was absent from the inline copy, so the
      // `.find()` missed and iteration 1 fell through to "partial success".
      expect(result.shouldIterate).toBe(true);
      expect(result.shouldAdvancePhase).toBe(false);
      expect(result.shouldCommit).toBe(false);
    });

    it('iterates E2E統合 (the other phase the copy lacked)', async () => {
      const framework = new RecursiveCustomInstructionsFramework({});
      await framework.startCycle('E2E統合', 1);

      const result = await framework.evaluateIteration(badMetrics(), {});

      expect(result.shouldIterate).toBe(true);
      expect(result.shouldCommit).toBe(false);
    });

    it('still honors the canonical per-phase iteration budget (内容分析 = 5)', async () => {
      const framework = new RecursiveCustomInstructionsFramework({});
      await framework.startCycle('内容分析', 4);
      expect((await framework.evaluateIteration(badMetrics(), {})).shouldIterate).toBe(true);

      await framework.startCycle('内容分析', 5);
      const atBudget = await framework.evaluateIteration(badMetrics(), {});
      expect(atBudget.shouldIterate).toBe(false);
      // Budget exhausted → recovery commit, not a silent pass.
      expect(atBudget.shouldCommit).toBe(true);
      expect(atBudget.passed).toBe(false);
    });
  });

  describe('sibling sites derive from the canonical record (source anchors)', () => {
    it('recursive-custom-instructions imports DEVELOPMENT_CYCLES, not a re-declared array', () => {
      const src = readSource('src/framework/recursive-custom-instructions.ts');
      expect(src).toMatch(/import\s*\{[^}]*DEVELOPMENT_CYCLES[^}]*\}\s*from\s*['"]\.\/iteration-manager['"]/);
      expect(src).not.toMatch(/phase:\s*["']MVP構築["']/);
      expect(src).not.toMatch(/successCriteria:\s*\[\s*["']シーン分割精度80%["']\s*,\s*["']図解タイプ判定70%["']/);
    });

    it('main-pipeline orders phases via DEVELOPMENT_PHASE_ORDER and drops the phantom グローバル展開', () => {
      const src = readSource('src/pipeline/main-pipeline.ts');
      expect(src).toMatch(/DEVELOPMENT_PHASE_ORDER/);
      expect(src).not.toContain('グローバル展開');
    });

    it('FrameworkDashboard renders the derived table, not a hand-copied one', () => {
      const src = readSource('src/components/FrameworkDashboard.tsx');
      expect(src).toMatch(/DEVELOPMENT_CYCLES/);
      expect(src).not.toMatch(/name:\s*['"]MVP構築['"]/);
    });
  });
});
