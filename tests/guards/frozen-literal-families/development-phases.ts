import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 24 (development-phase plan single-source): the 段階的開発フロー
   * plan — phase names, their order, criteria, budgets — is defined ONLY by
   * src/framework/iteration-manager.ts (DEVELOPMENT_CYCLES + derived
   * DEVELOPMENT_PHASE_ORDER). Before round 24 the same plan lived in four
   * sites with three shapes, already drifted: the recursive framework's
   * inline 3-phase array (内容分析 criteria mutated, E2E統合/品質向上 missing →
   * premature "partial success" commits on iteration 1), main-pipeline's
   * local phase order (a phantom global-expansion phase, canonical E2E統合
   * dropped), and FrameworkDashboard's hand-copied 3-phase UI table. Banned
   * shapes: plan-record entries (`phase: '<canonical phase>'`), local
   * phase-order arrays, hand-copied UI rows (`name: 'MVP構築'`), the phantom
   * phase name, the alien criterion the drifted copy invented, and the
   * canonical-only criterion strings.
   *
   * NOT banned (legitimate other-concept uses, verified round 24): bare
   * phase names as initial values (`currentPhase: 'MVP構築'`, switch labels
   * in continuous-learner's own taxonomy, simple-pipeline's
   * customInstructionsPhase telemetry) and `レイアウト破綻0` prose in
   * quality-estimators / enhanced-zero-overlap-layout (documenting the
   * criterion concept, not re-declaring the plan).
   */
  {
    id: 'development phase plan single-sourced in iteration-manager',
    roots: ['src'],
    exclude: {
      'src/framework/iteration-manager.ts': 'the canonical source itself',
    },
    patterns: [
      // Plan-record entry shape (the recursive framework's old inline array).
      /phase:\s*['"](MVP構築|内容分析|図解生成|E2E統合|品質向上)['"]/,
      // Local phase-ORDER array shape (main-pipeline's old getNextPhase).
      /\[\s*['"](MVP構築|内容分析|図解生成|E2E統合|品質向上)['"]\s*,/,
      // Hand-copied UI table row shape (FrameworkDashboard's old state).
      /name:\s*['"]MVP構築['"]/,
      // The phantom phase name (defined nowhere; must never come back).
      /グローバル展開/,
      // The alien criterion the drifted 内容分析 copy invented.
      /図解タイプ判定70%/,
      // Canonical-only criterion strings — re-freezing any of them outside
      // the record is a partial plan copy.
      /主要エンティティ抽出率90%/,
      /関係性の正確性85%/,
      /ゼロクリティカルバグ/,
    ],
    minSweptFiles: 200,
  },
];
