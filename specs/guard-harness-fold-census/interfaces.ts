/**
 * guard-harness-fold-census 型定義（設計正本）
 *
 * 作成日: 2026-08-18
 * 関連設計: architecture.md / dataflow.md
 *
 * 本ファイルは specs/ 配下の設計文書であり、実装は tests/guards/
 * single-source-harness.ts / fold-census-families.ts にこの型形状で
 * 落とす（REQ-101: 実装も tests/ 配下のみ・production src/ は不変）。
 *
 * 信頼性レベル:
 * - 🔵 青信号: 要件定義書・既存実装（round 46〜50 test・freeze-guard.ts）
 *       を参考にした確実な型定義
 * - 🟡 黄信号: 要件定義書・既存実装から妥当な推測による型定義
 * - 🔴 赤信号: 参照資料にない自動推定による型定義
 */

// ========================================
// 1. table-driven harness（REQ-001〜003）
// ========================================

/**
 * 等価判定モード。🔵 REQ-002・round 48（object-is）と round 50
 * （delta bound + witness）の実績比較方式を型化。
 */
export type EquivalenceMode =
  | { kind: 'object-is' }
  | { kind: 'delta'; maxDelta: number }; // 🔵 maxDelta 未指定は factory が throw（EDGE-001）

/**
 * Layer 1 verbatim oracle 行。🔵 REQ-001/002。
 *
 * - canonical: 正典関数（例: squareGridColumns）
 * - retired: 移行前の verbatim 式（per-family test 内に残置 — D4）
 * - corpus: 引数タプルの固定配列（縮小は fingerprint で RED — TC-004-E01）
 * - delta mode は witness が強制（deltaCount > 0 を必ず 1 expectation
 *   消費 — EDGE-101。vacuous bound は存在しない）
 */
export interface OracleRow<Args extends unknown[] = unknown[]> {
  id: string; // 🔵 row 単位 id（fingerprint pin の key）
  canonical: (...args: Args) => unknown; // 🔵 正典
  retired: (...args: Args) => unknown; // 🔵 凍結退役式
  corpus: readonly Args[]; // 🔵 空配列は factory が throw
  mode: EquivalenceMode; // 🔵
}

/**
 * Layer 1 行の factory 兼検証関数の型。🔵 EDGE-001（宣言時 fail-loud）。
 * 不正 row は throw（戻り値 never にならないのは呼び出し側利便性のため）。
 */
export function oracleRow<Args extends unknown[]>(row: OracleRow<Args>): OracleRow<Args>; // 🔵

/**
 * Layer 3 anchor 行の走査 scope。🔵 D3。
 *
 * - 'code': コメント行を除外して計数（既定。委譲コメント自爆の回避）
 * - 'source': 生テキスト全体（移行時のみ元 test の scope を保存する用途）
 */
export type AnchorScope = 'code' | 'source'; // 🔵

/**
 * Layer 3 source anchor 行。🔵 REQ-003・D3。
 * occurs 系は行ベース計数（REQ-402。`\n` 入り pattern は factory が throw）。
 */
export type AnchorRow =
  | {
      kind: 'occurs'; // 🔵 一致行数 === exactly
      file: string; // 🔵 repo-root 相対（例: 'src/visualization/layout-utils.ts'）
      pattern: RegExp; // 🔵 行ベース（global flag 不要）
      exactly: number; // 🔵 0 ≤ n。負値は factory が throw
      scope?: AnchorScope; // 🔵 既定 'code'
    }
  | {
      kind: 'occurs-at-least'; // 🔵 一致行数 ≥ atLeast（漸進移行 family 用の緩い pin）
      file: string; // 🔵
      pattern: RegExp; // 🔵
      atLeast: number; // 🔵 1 ≤ n
      scope?: AnchorScope; // 🔵
    }
  | {
      kind: 'ban'; // 🔵 一致行数 === 0（re-inline 禁止）
      file: string; // 🔵
      pattern: RegExp; // 🔵
      scope?: AnchorScope; // 🔵 既定 'code'
    };

/** anchorRow factory 兼検証関数の型。🔵 EDGE-001。 */
export function anchorRow(row: AnchorRow): AnchorRow; // 🔵

/** harness が扱う行の和集合。🔵 D1（Layer 2 semantic pin は対象外）。 */
export type SingleSourceRow<Args extends unknown[] = unknown[]> =
  | OracleRow<Args>
  | AnchorRow; // 🔵

/**
 * describeSingleSource — 行列から describe/it を生成する入口。🔵 REQ-001。
 *
 * 生成物:
 *   describe(`${family} — harness layer 1/3`, ...)
 *     ├ oracleRow → it(`${row.id}`): corpus ループ + delta witness
 *     └ anchorRow → it(`${row.id}`): readSource 計数
 * 再検証を冒頭で実施（factory 検証の二重防御 — D5）。
 */
export function describeSingleSource<Args extends unknown[]>(
  family: string,
  rows: readonly SingleSourceRow<Args>[],
): void; // 🔵

/**
 * 指定期望数（fingerprint 用純関数）。🔵 D6。
 *   oracle(object-is) = corpus.length
 *   oracle(delta)     = corpus.length + 1  // witness 分
 *   anchor(any)       = 1
 */
export function countExpectations(row: SingleSourceRow): number; // 🔵

/** コメント行を除外したコード行の共有ヘルパー（重複 codeLines の一本化）。🔵 D4 備考。 */
export function codeLines(rel: string): string[]; // 🔵 freeze-guard readSource 再利用

// ========================================
// 2. fingerprint（REQ-004）
// ========================================

/** fingerprint 1 entry。🔵 D6。 */
export interface FingerprintEntry {
  family: string; // 🔵 'grid-packing' | 'default-node-extent' | ...
  rowId: string; // 🔵 row.id
  kind: 'oracle-object-is' | 'oracle-delta' | 'anchor-occurs' | 'anchor-occurs-at-least' | 'anchor-ban'; // 🔵
  expectations: number; // 🔵 countExpectations の値
}

/**
 * 移行 2 family の fingerprint（family:rowId:expectations の列挙）。
 * harness-fingerprint.test.ts がこの列挙を文字列 pin する。
 * 🔵 D6・TC-004-01。it.each 折りたたみなど「理由記載付き差分」は
 * コメントで本型の使用側に残す。
 */
export type FamilyFingerprint = readonly FingerprintEntry[]; // 🔵

// ========================================
// 3. fold 収束 census（REQ-005 / 103 / 201-202 / 404）
// ========================================

/**
 * census family の残存 site 分類。🔵 requirements.md census 表 C1〜C5 に対応。
 */
export type CensusClassification =
  | 'value-neutral-candidate' // 🔵 value-neutral で fold 可能（REQ-201 では現在 0 family）
  | 'behavior-change-required' // 🔵 C1 clamp — NaN 契約差など実挙動変更を伴う
  | 'design-decision-required' // 🔵 C2 1920/1080 直書き — 設計判断が必要
  | 'different-concept' // 🔵 C3/C5 — 同一概念でないため fold 対象外
  | 'below-threshold'; // 🔵 C4 — 1 file 1 site など閾値未満

/**
 * census family 定義 1 行。🔵 REQ-005・D7/D11。
 *
 * - patterns: 行ベース正規表現（`\n` 入りは factory で throw — REQ-402）
 * - exclude: file 単位除外（正典モジュール等）— 理由必須
 * - excludeLinePatterns: 行単位除外（'1080p' ラベル・RESOLUTION_PRESETS
 *   参照行等、C2 の偽陽性源）— 理由必須 🟡 D11（実測で判明した精密化要件）
 * - pin: ratchet 基点。増減どちらも RED（D8）
 */
export interface CensusFamily {
  id: string; // 🔵 'C1'〜'C5' + 将来 family
  label: string; // 🔵 'bare clamp Math.max(...Math.min(...))' 等
  classification: CensusClassification; // 🔵
  patterns: readonly RegExp[]; // 🔵 行ベース
  exclude?: Readonly<Record<string, string>>; // 🔵 file rel → 理由
  excludeLinePatterns?: Readonly<Record<string, string>>; // 🟡 patternSource → 理由（C2 のみ現状必要）
  pin: { sites: number; files: number }; // 🔵 再ベースライン後の engine 実測値
  note?: string; // 🔵 契約差・scope-out の根拠
}

/** census 計測 1 family 分の実測。🔵 D7。 */
export interface CensusMeasurement {
  sites: number; // 🔵 コード行一致数
  files: number; // 🔵 一致ファイル数
  matchedFiles: readonly string[]; // 🔵 デバッグ用（pin 比較対象外）
}

/** 全 family の実測 snapshot。buildCensusSnapshot() の戻り値。🔵 D7。 */
export interface CensusSnapshot {
  family: Readonly<Record<string, CensusMeasurement>>; // 🔵 family id → 実測
  sweptFiles: number; // 🔵 walk した src file 総数（minSweptFiles 相当の健全性 pin 用）
}

/**
 * fold 系列の収束状態。🔵 REQ-201/202・D8。
 * valueNeutralCandidates を `[]` で pin することが収束宣言。
 * 配列への追記 = fold 再開要求（RED で強制）。
 */
export interface FoldSeriesStatus {
  converged: boolean; // 🔵 true pin — 収束宣言
  valueNeutralCandidates: readonly string[]; // 🔵 family id 配列。現状 `[]` pin
  lastRound: number; // 🔵 50（grid-packing）
  lastVerified: string; // 🔵 '2026-08-18'（要件作成時の census 実施日）
}

/**
 * requirements.md に埋め込む doc-pin マーカー。🟡 D9。
 * 形式: `<!-- census-pin:{familyId}:sites={n}:files={n} -->`
 * fold-census-guard.test.ts が marker 値 = data pin = engine 実測の
 * 3 者一致を検証（REQ-404）。
 */
export type CensusPinMarker = `<!-- census-pin:${string}:sites=${number}:files=${number} -->`; // 🟡（形式は設計判断・実装時に確定）

// ========================================
// 4. 検証規則（factory throw 条件の一覧）
// ========================================

/**
 * fail-loud 条件（EDGE-001・REQ-402）。🔵
 *
 * oracleRow:
 *   - id 空 / corpus 空 / mode が delta で maxDelta 未指定・非有限・≤0
 * anchorRow:
 *   - exactly < 0 / atLeast < 1 / pattern.source に `\n` を含む
 * census family:
 *   - patterns 空 / exclude の理由空 / excludeLinePatterns の理由空
 *     / pin 負値 / `\n` 入り pattern
 * describeSingleSource:
 *   - rows 空 / 上記全条件の再検証
 */

// ========================================
// 信頼性レベルサマリー
// ========================================
/**
 * - 🔵 青信号: 29 件 (94%)
 * - 🟡 黄信号: 2 件 (6%)  // excludeLinePatterns・CensusPinMarker
 * - 🔴 赤信号: 0 件 (0%)
 *
 * 品質評価: 高品質 — 全型が round 46〜50 の既存 test 実形状と
 * freeze-guard.ts の既存 API に対応。🟡 2 件は新規機構（C2 精密化・
 * doc マーカー形式）で、実装 Phase 2 で engine 実測とともに確定。
 */
