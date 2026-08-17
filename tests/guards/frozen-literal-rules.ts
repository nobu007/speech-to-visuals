/**
 * Registry of frozen-literal single-source rules (round 8 extraction; round 35
 * per-family split).
 *
 * Each entry replaces the hand-rolled discovery sweep of one per-family guard
 * test. Adding a new frozen-constant family = one file in
 * tests/guards/frozen-literal-families/ + one import + one spread element
 * here, in round order; the registry test (frozen-literal-registry.test.ts)
 * sweeps every entry with the shared walk in freeze-guard.ts. Value pins,
 * consumer-import pins, and behavioral pins stay in the per-family test
 * files — this registry is ONLY the "no site re-freezes the literal"
 * discovery sweep.
 *
 * Round 35 policy decision (1200-line trigger, 89 lines out at round 34):
 * SPLIT, via static per-family modules. The round-27 review had kept the
 * single file on the assumption that a split meant a readFileSync-based
 * dynamic loader (walk-engine change + re-verification cost). A static split
 * changes no engine: this file still exports the SAME
 * 'FROZEN_LITERAL_RULES' array, element-for-element — the round-35 commit
 * proves it with a before/after fingerprint diff (id sequence + pattern
 * shapes + roots/files/excludes) and a RED probe (an injected banned literal
 * still fails the sweep). One family = one file keeps every file small
 * forever; the aggregator only grows by two lines per family.
 *
 * Keep every exclusion reason inline — the registry test fails an exclusion
 * that lost its reason.
 *
 * Round 51 — the complete "add one fold family" checklist (NFR-201 of
 * specs/guard-harness-fold-census; the mechanical layers are data rows now,
 * so the list is short):
 *   1. registry family module — 1 file in frozen-literal-families/ (the
 *      discovery sweep: patterns + reasoned excludes);
 *   2. registry aggregator — 2 lines here (import + spread, round order);
 *   3. harness data rows — oracleRow/anchorRow rows in the family's
 *      *-single-source.test.ts via describeSingleSource(..., { fingerprint })
 *      (Layer 1 verbatim oracle + Layer 3 source anchors; the fingerprint
 *      literal is STATIC — never `${corpus.length}`, which self-tracks a
 *      shrink — and the row enumeration must be copied into
 *      harness-fingerprint.test.ts, whose adopter sweep fails until it is);
 *   4. Layer 2 pins — family-specific LIVE/semantic witnesses stay
 *      handwritten in the same test file;
 *   5. fold-census — if the family was a census row (C1-C5), re-baseline
 *      fold-census-families.ts pin + the requirements.md census-pin marker
 *      in the same change (the 3-way guard fails otherwise).
 */

import type { FrozenLiteralRule } from './freeze-guard';
import { RULES as remotionFps } from './frozen-literal-families/remotion-fps';
import { RULES as layoutQualityThreshold } from './frozen-literal-families/layout-quality-threshold';
import { RULES as sceneDuration } from './frozen-literal-families/scene-duration';
import { RULES as canvasAspectRatio } from './frozen-literal-families/canvas-aspect-ratio';
import { RULES as nodeDimensions } from './frozen-literal-families/node-dimensions';
import { RULES as errorRateThresholds } from './frozen-literal-families/error-rate-thresholds';
import { THRESHOLD_DEFAULTS as qualityGateThresholdsThresholdDefaults } from './frozen-literal-families/quality-gate-thresholds';
import { RULES as analysisRetryDefaults } from './frozen-literal-families/analysis-retry-defaults';
import { RULES as labelWidthConstants } from './frozen-literal-families/label-width-constants';
import { RULES as layoutSpacingDefaults } from './frozen-literal-families/layout-spacing-defaults';
import { RULES as uuidValidation } from './frozen-literal-families/uuid-validation';
import { RULES as diagramTypeTitles } from './frozen-literal-families/diagram-type-titles';
import { RULES as meanDenominators } from './frozen-literal-families/mean-denominators';
import { RULES as forceDirectedParams } from './frozen-literal-families/force-directed-params';
import { RULES as layoutJitterRng } from './frozen-literal-families/layout-jitter-rng';
import { RULES as finiteSafeAggregation } from './frozen-literal-families/finite-safe-aggregation';
import { RULES as sentenceBoundaries } from './frozen-literal-families/sentence-boundaries';
import { RULES as transcriptionLanguage } from './frozen-literal-families/transcription-language';
import { RULES as unicodeScriptRanges } from './frozen-literal-families/unicode-script-ranges';
import { RULES as developmentPhases } from './frozen-literal-families/development-phases';
import { THRESHOLD_BARS as qualityGateThresholdsThresholdBars } from './frozen-literal-families/quality-gate-thresholds';
import { RULES as jwtSecret } from './frozen-literal-families/jwt-secret';
import { RULES as qualityDisplayTiers } from './frozen-literal-families/quality-display-tiers';
import { RULES as exportBlockGate } from './frozen-literal-families/export-block-gate';
import { RULES as emptyLayoutResult } from './frozen-literal-families/empty-layout-result';
import { RULES as dagrePipeline } from './frozen-literal-families/dagre-pipeline';
import { RULES as strategySharedMembers } from './frozen-literal-families/strategy-shared-members';
import { RULES as strategyEdgeBuilders } from './frozen-literal-families/strategy-edge-builders';
import { RULES as strategyEdgeRepointing } from './frozen-literal-families/strategy-edge-repointing';
import { RULES as strategyNodeClone } from './frozen-literal-families/strategy-node-clone';
import { RULES as dagreNodeExtraction } from './frozen-literal-families/dagre-node-extraction';
import { RULES as explicitDimensionSizing } from './frozen-literal-families/explicit-dimension-sizing';
import { RULES as overlapPairScan } from './frozen-literal-families/overlap-pair-scan';
import { RULES as forceDirectedStep } from './frozen-literal-families/force-directed-step';
import { RULES as nodeExtentScan } from './frozen-literal-families/node-extent-scan';
import { RULES as strategyGraphPreamble } from './frozen-literal-families/strategy-graph-preamble';
import { RULES as edgeCrossingScan } from './frozen-literal-families/edge-crossing-scan';
import { RULES as nodeCanvasClamp } from './frozen-literal-families/node-canvas-clamp';
import { RULES as edgeAnchorGeometry } from './frozen-literal-families/edge-anchor-geometry';
import { RULES as nodeBoxCenter } from './frozen-literal-families/node-box-center';
import { RULES as ringPlacement } from './frozen-literal-families/ring-placement';
import { RULES as defaultNodeExtent } from './frozen-literal-families/default-node-extent';
import { RULES as gridPacking } from './frozen-literal-families/grid-packing';

/**
 * The ordered registry: families in the round order that closed them, entries
 * within a family in their round order. Order is documentation only (rules
 * are independent data), but keep it stable — the round-35 split preserved
 * the pre-split sequence element-for-element.
 */
export const FROZEN_LITERAL_RULES: FrozenLiteralRule[] = [
  ...remotionFps,
  ...layoutQualityThreshold,
  ...sceneDuration,
  ...canvasAspectRatio,
  ...nodeDimensions,
  ...errorRateThresholds,
  ...qualityGateThresholdsThresholdDefaults,
  ...analysisRetryDefaults,
  ...labelWidthConstants,
  ...layoutSpacingDefaults,
  ...uuidValidation,
  ...diagramTypeTitles,
  ...meanDenominators,
  ...forceDirectedParams,
  ...layoutJitterRng,
  ...finiteSafeAggregation,
  ...sentenceBoundaries,
  ...transcriptionLanguage,
  ...unicodeScriptRanges,
  ...developmentPhases,
  ...qualityGateThresholdsThresholdBars,
  ...jwtSecret,
  ...qualityDisplayTiers,
  ...exportBlockGate,
  ...emptyLayoutResult,
  ...dagrePipeline,
  ...strategySharedMembers,
  ...strategyEdgeBuilders,
  ...strategyEdgeRepointing,
  ...strategyNodeClone,
  ...dagreNodeExtraction,
  ...explicitDimensionSizing,
  ...overlapPairScan,
  ...forceDirectedStep,
  ...nodeExtentScan,
  ...strategyGraphPreamble,
  ...edgeCrossingScan,
  ...nodeCanvasClamp,
  ...edgeAnchorGeometry,
  ...nodeBoxCenter,
  ...ringPlacement,
  ...gridPacking,
  ...defaultNodeExtent,
];
