# finite-safe-aggregation 自動分析記録

**作成日**: 2026-08-15
**分析実施**: step4 既存情報ベースの差分分析と自動統合

## 分析目的

make-run steering（前イテレーション VALUABLE 評価の次イテレーション指示）と
実コードを突き合わせ、残存する重複フォールドの単一ソース化候補を確定し、
既存要件との重複・統合可否を判定する。

## 分析項目と判断

### A1: steering 指示 4 項目の現況確認（phantom 判定回避）

**分析日時**: 2026-08-15
**カテゴリ**: 既存設計確認
**背景**: steering は前回 judge 時点の情報であり、その後の session 116-117 で
対象が既に実装済みの可能性がある（過去の phantom-feedback trap）。

**判断**: 4 項目のうち 3 項目は実施済み or 対象不在:

1. **描画結果比較オラクル（convergence predicate 変更の影響検証）**:
   → **実装済み**。`tests/visualization/force-directed-layout-outcome-oracle.test.ts`
   が 4 トポロジー（flowchart chain / tree / network / cycle）×
   独立 `nodesOverlap` オラクル + 境界検査 + 決定性検証を提供。
2. **registry 分割 or 方針明記**: → **決定済み**。単一ファイル方針を
   `architecture.md` に明記（session 116、423 行 < 800 行上限）。
3. **spine リンク自動生成**: → **対象不在**。`specs/_doc_spine.yml` は
   branch HEAD に存在せず（session 96-99 で削除）、spine tests は skip 状態。
4. **残 dup fold への単一ソース化適用**: → **未達・実在**。A2 で調査。

**根拠**: 上記ファイルの直接実装・`ls specs/`・`test -f specs/_doc_spine.yml`

**信頼性への影響**:

- REQ-003〜005 の根拠は steering + 実装の両方に由来 → 🔵

---

### A2: 残存する数値集計 dup fold の実態調査

**分析日時**: 2026-08-15
**カテゴリ**: 追加要件
**背景**: steering が「sanitizeFinite 直呼びの合計/最大/パーセンタイル系」の
単一ソース化を指示。percentile は既に `percentileCeil`（`src/lib/metrics-utils.ts:67`）
へ全 6 consumer が委譲済みのため、残る sum / mean / max / min を定量調査した。

**判断**: 
- `reduce((a,b)=>a+b,0)` / `reduce((sum,` 系: **125 サイト**（src/、tests 除外）
- 要素ガード付きは 2 系のみ（`llm-cache.ts:226`、`scene-segmenter.ts` 一部）
- 未ガードで外部起因値を集計するリスクサイトは 20 ファイルに分布
  （`intelligent-cache.ts` ×5、`complex-layout-engine.ts` ×3、
  `production-exporter.ts` ×3 ほか）
- `Math.max(...arr)` spread 系に NaN 伝播サイト（`diagram-detector.ts:436`、
  `enhanced-error-recovery.ts:1452,1899-1900`）
- 一方 `scene-segmenter.ts:594` と `streaming-quality-monitor.ts:210-211` は
  既にガード済みで、これが「正規形」の実例

**根拠**: `grep -rn` による全数カウント + 個別行の目視

**信頼性への影響**:

- 新規要件 REQ-001〜003, REQ-101 を 🔵 で追加（実装調査直結）

---

### A3: 既存要件との重複判定（pipeline-metrics-nan-leak-fix）

**分析日時**: 2026-08-15
**カテゴリ**: 影響範囲
**背景**: 同一の「非有限値 → 代表値 NaN 漏れ」バグクラスの先行 spec がある。

**判断**: **重複なし・直交 → 新規 feature として作成**。
先行 spec は (a) `PipelineMetricsCollector` の ingestion chokepoint 化、
(b) pipeline 層 2 サイトの inline `Number.isFinite(x) ? x : 0` 集約が対象で、
その REQ-201 guard は value-coercion 検出であり配列集計 reduce は検出外。
本 feature は集計演算そのものの helper 化 + 横展開であり、統合（更新統合）
すると対象範囲が混在するため分割が適切。

**根拠**: `specs/pipeline-metrics-nan-leak-fix/requirements.md` 全文照合

**信頼性への影響**:

- 関連文書リンクで相互参照を設定。信頼性変化なし

---

### A4: スコープの自動推定（作業規模と対象絞り込み）

**分析日時**: 2026-08-15
**カテゴリ**: 優先順位
**背景**: 125 サイト全てを移行すると diff が巨大化し検証が困難。

**判断**: 
- **作業規模 = 軽量開発**（単一 helper + 移行 + ガードという限定的構成、
  PRD なし・参照は実装と steering のみ）
- 移行対象は「非有限になり得る外部起因値」に限定（`.length` 系は除外）し、
  実装フェーズの sweep で一次リスト（REQ-003）を確定させる
- fuzz は `createLayoutRng`（mulberry32 + FNV-1a）を流用 — `Math.random` は
  registry により src 内禁止

**根拠**: `src/visualization/layout-rng.ts`・`frozen-literal-rules.ts` の現行運用

**信頼性への影響**:

- REQ-402（`.length` 系除外）のみ設計判断を含むため 🟡

---

## 分析結果サマリー

### 確認できた事項

- steering 指示 4 項目中 3 項目は実装済み・決定済み・対象不在（stale）
- percentile は単一ソース化済み、sum / mean / max / min は未整備
- 未ガード集計 125 サイト中、外部起因値のリスクサイトは 20 ファイルに分布

### 追加/変更要件

- 追加: REQ-001〜005, REQ-101/102, REQ-401〜403, EDGE-001/102（新規 feature）

### 残課題

- REQ-003 の一次リストは行番号 pin のため、実装フェーズで sweep により
  再確定が必要（行ずれリスク）
- 「除外」と「0 置換」の統一仕様は design フェーズで最終決定（EDGE-001）

### 信頼性レベル分布

**分析後（本 feature 全要件）**:

- 🔵 青信号: 12 件 (86%)
- 🟡 黄信号: 2 件 (14%)（REQ-402、NFR パフォーマンス）
- 🔴 赤信号: 0 件 (0%)

## 関連文書

- **要件定義書**: [requirements.md](requirements.md)
- **コンテキストノート**: [note.md](note.md)
- **先行（直交）feature**: [../pipeline-metrics-nan-leak-fix/requirements.md](../pipeline-metrics-nan-leak-fix/requirements.md)
