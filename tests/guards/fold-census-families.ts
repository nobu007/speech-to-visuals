/**
 * fold-census-families.ts — the fold-series convergence census (round 51,
 * specs/guard-harness-fold-census REQ-005 / 201-202 / 404).
 *
 * Rounds 41-50 folded 10 re-inlined expression families into canonicals.
 * The interview census (A2, 2026-08-18) counted what REMAINS inline and
 * classified it: 0 value-neutral candidates (same concept, ≥2 files,
 * bit-equal delegation) — the fold series is CONVERGED for value-neutral
 * work (REQ-201). What is left needs either a behavior change (C1: the
 * bare clamp form passes NaN through, clampFinite sanitizes NaN→min — a
 * documented contract difference) or a design decision (C2: identical
 * 1920/1080 literals live in unrelated config defaults), or is a different
 * concept / below the 2-file threshold (C3-C5).
 *
 * This file turns that census into DATA + a measuring engine:
 *   - CENSUS_FAMILIES: one row per family — line-based patterns, reasoned
 *     excludes (file-level AND line-level), the pinned measurement, and
 *     the classification;
 *   - buildCensusSnapshot(): the single-pass measurement (walkProductionFiles
 *     semantics = REQ-404: production src/ only, .ts/.tsx, __tests__ and
 *     *.test.* excluded, comment-only lines excluded);
 *   - FOLD_SERIES_STATUS: the convergence ratchet (converged=true and
 *     valueNeutralCandidates=[] are PINNED — a new value-neutral candidate
 *     must flip this explicitly, never silently).
 *
 * The guard (fold-census-guard.test.ts) ties three artifacts together:
 * engine measurement == data pin == the `<!-- census-pin:C1:sites=…:files=… -->`
 * marker in the requirements census table (doc-pin, architecture D9). A
 * site count that moves in EITHER direction flips the ratchet RED and the
 * requirements table must be re-baselined in the same change (REQ-202).
 */

import { readSource, isCommentLine, walkProductionFiles } from '@tests/guards/freeze-guard';

// ---------------------------------------------------------------------------
// Types (specs/guard-harness-fold-census/interfaces.ts §3).
// ---------------------------------------------------------------------------

/** 残存 site の分類（requirements.md census 表と 1:1）。 */
export type CensusClassification =
  | 'behavior-change-required'
  | 'design-decision-required'
  | 'different-concept'
  | 'below-threshold';

/** census family 定義 1 行（行ベース計測・REQ-404）。 */
export interface CensusFamily {
  id: string;
  label: string;
  classification: CensusClassification;
  patterns: readonly RegExp[];
  /** file rel → 除外理由（正典の定義本体など）。 */
  exclude?: Readonly<Record<string, string>>;
  /** pattern source → 除外理由（行単位の別概念 — 適用は file 集計より前）。 */
  excludeLinePatterns?: Readonly<Record<string, string>>;
  pin: { sites: number; files: number };
  note?: string;
}

/** census 計測 1 family 分の実測。 */
export interface CensusMeasurement {
  sites: number;
  files: number;
  matchedFiles: readonly string[];
}

/** 全 family の実測 snapshot。buildCensusSnapshot() の戻り値。 */
export interface CensusSnapshot {
  family: Readonly<Record<string, CensusMeasurement>>;
  sweptFiles: number;
}

/** fold 系列の収束状態（ratchet pin）。 */
export interface FoldSeriesStatus {
  converged: boolean;
  valueNeutralCandidates: readonly string[];
  lastRound: number;
  lastVerified: string;
}

// ---------------------------------------------------------------------------
// The census families (re-baselined 2026-08-18 by buildCensusSnapshot —
// REQ-404 code-line semantics; the interview A2 numbers were naive grep
// counts that included comment lines and missed the refined C2 shape).
// ---------------------------------------------------------------------------

export const CENSUS_FAMILIES: readonly CensusFamily[] = [
  {
    id: 'C1',
    label: '汎用 clamp Math.max(…Math.min(…)) / Math.min(…Math.max(…)) 系',
    classification: 'behavior-change-required',
    patterns: [/Math\.max\([^()]*Math\.min\(/, /Math\.min\([^()]*Math\.max\(/],
    exclude: {
      'src/utils/guards.ts': '正典 clampFinite/clamp01 の定義本体',
    },
    excludeLinePatterns: {
      clamp01: 'clamp01 内部の正典実装行',
    },
    pin: { sites: 30, files: 17 },
    note: 'bare inline 形は NaN を透過し、clampFinite は NaN→min に sanitize する契約差（guards.ts doc comment 明記）。移行は実挙動変更 = value-neutral ではない（per-site 判断が必要）。',
  },
  {
    id: 'C2',
    label: 'layout 既定 1920/1080 直書き（config object 既定値）',
    classification: 'design-decision-required',
    patterns: [/(?:width|height)\s*:\s*(?:1920|1080)\b/],
    excludeLinePatterns: {
      "'1080p'": "resolution preset ラベル行（VideoPreview.tsx / renderer.ts）— canvas 既定とは別概念の解像度テーブル",
    },
    pin: { sites: 16, files: 8 },
    note: '同一値が別々の config object 既定として存在（pipeline-orchestrator / production-exporter / simple-pipeline / main-pipeline / production-config / layout-engine / complex-layout-engine / advanced-layouts）。canvas 正典の 1920 と「たまたま同じ値の config 既定」をこれ以上正規表現で分離できず、config 出所の統一という設計判断が必要。',
  },
  {
    id: 'C3',
    label: '半径方向 push Math.cos/sin(angle)·separation',
    classification: 'different-concept',
    patterns: [/Math\.(?:cos|sin)\(/],
    exclude: {
      'src/visualization/layout-utils.ts': 'pointOnCircle 正典（中心+絶対位置の別概念）',
    },
    pin: { sites: 4, files: 1 },
    note: 'strategies/OverlapResolver.ts の ±cos/sin(angle)·separation は delta push であり、round 48 正典 pointOnCircle（中心+絶対位置）とは別概念。',
  },
  {
    id: 'C4',
    label: '文字幅見積 text.length * 8 + 40',
    classification: 'below-threshold',
    patterns: [/text\.length \* 8/],
    pin: { sites: 1, files: 1 },
    note: 'advanced-layouts.ts の単独 site。DEFAULT_CHAR_WIDTH=8 正典はあるが 2 file 未満 = fold 閾値未満。',
  },
  {
    id: 'C5',
    label: '反二乗反発 (k·w)/dist²',
    classification: 'different-concept',
    patterns: [/dist \* dist/],
    exclude: {
      'src/visualization/force-directed-params.ts': '正典本体（regime 型 STRONG/MODERATE の自前公式）',
    },
    pin: { sites: 3, files: 3 },
    note: 'engine 全走査が A2 のファイル限定 grep が見逃した 2 site を発見（complex-layout-engine.ts:742・network-strategy.ts:118 — edge-crossing-minimizer.ts:336 と合わせ 3 file）。正典は regime 型の別公式で、共通 helper 抽出は定数・名前が異なる設計変更 = value-neutral ではない。',
  },
];

/**
 * The convergence ratchet (REQ-201). valueNeutralCandidates=[] is the
 * PINNED terminal state — reopening the fold series for a value-neutral
 * family requires editing this pin deliberately, in the open.
 */
export const FOLD_SERIES_STATUS: FoldSeriesStatus = {
  converged: true,
  valueNeutralCandidates: [],
  lastRound: 50,
  lastVerified: '2026-08-18',
};

/** The requirements census table this guard doc-pins against (D9). */
export const CENSUS_DOC = 'specs/guard-harness-fold-census/requirements.md';

/** Extract `familyId -> {sites, files}` from the census-pin markers in a doc. */
export function parseCensusPinMarkers(doc: string): Map<string, { sites: number; files: number }> {
  const markers = new Map<string, { sites: number; files: number }>();
  const re = /<!-- census-pin:([A-Za-z0-9-]+):sites=(\d+):files=(\d+) -->/g;
  for (const m of doc.matchAll(re)) {
    markers.set(m[1], { sites: Number(m[2]), files: Number(m[3]) });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// The engine: one walk, every family measured on code lines (REQ-404).
// ---------------------------------------------------------------------------

export function buildCensusSnapshot(): CensusSnapshot {
  const files = walkProductionFiles('src');
  const family: Record<string, CensusMeasurement> = {};
  for (const fam of CENSUS_FAMILIES) {
    const excludeLine =
      fam.excludeLinePatterns === undefined
        ? []
        : Object.keys(fam.excludeLinePatterns).map((source) => new RegExp(source));
    let sites = 0;
    const matched = new Set<string>();
    for (const rel of files) {
      if (fam.exclude !== undefined && fam.exclude[rel] !== undefined) continue;
      const lines = readSource(rel).split('\n').filter((line) => !isCommentLine(line));
      for (const line of lines) {
        if (excludeLine.some((re) => re.test(line))) continue;
        if (fam.patterns.some((re) => re.test(line))) {
          sites++;
          matched.add(rel);
        }
      }
    }
    family[fam.id] = { sites, files: matched.size, matchedFiles: [...matched].sort() };
  }
  return { family, sweptFiles: files.length };
}
