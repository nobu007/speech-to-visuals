# finite-safe-aggregation 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-08-15
**分析実施**: step4 既存情報ベースの差分分析と自動統合（設計フェーズ）
**前提**: requirements.md / interview-record.md（要件フェーズ）の分析を引き継ぎ、
設計未決事項（EDGE-001 の除外 vs 0 置換、API 形状、移行粒度）を確定した。

## 分析目的

要件定義の残課題（interview-record.md「残課題」参照）である
(a) 「除外」と「0 置換」の統一仕様、(b) helper API の形状、(c) 125 サイトの
移行粒度と検証構成、の 3 点を実装調査に基づいて決定し、
architecture.md / dataflow.md の根拠として残す。

## 分析項目と判断

### A1: 除外 vs 0 置換の統一仕様（EDGE-001 決定）

**分析日時**: 2026-08-15
**カテゴリ**: データモデル
**背景**: 要件フェーズでは「除外」を既定としたが、既存の要素 0 置換サイト
（`llm-cache.ts:226`、`scene-segmenter.ts` 一部）との関係が未整理。

**判断**: **除外を集計の正規形とし、0 置換（`sanitizeFinite`）はスカラー防御の
正規形として共存**。helper は `sanitizeFinite` に要素委譲しない。
0 置換入りサイト移行時は `behavior change:` + 数値デルタ明記。

**根拠**:
- `streaming-quality-monitor.ts:210-211` の `.filter(c=>Number.isFinite(c))` が
  配列集計の既存正規形（🔴 ではなく実装上の先例）
- 0 置換は mean を歪める（応答時間 100/200/NaN → 0 置換: 100、除外: 150）。
  観測欠損のセマンティクスは「サンプル落ち」が正しい
- `sanitizeFinite` を要素適用すると「欠損 = 0ms 応答」の虚偽になる

**信頼性への影響**:

- EDGE-001 が 🔴/🟡 → 🔵 に確定。architecture.md D2 として反映

---

### A2: helper API 形状（selector 引数の要否）

**分析日時**: 2026-08-15
**カテゴリ**: 技術選択
**背景**: 実サイトの旧式は `reduce((sum, x) => sum + f(x), 0)` の selector 内包形が
多数（`intelligent-cache.ts:653`（match count 加算）、`693-695`（内積・ノルム）、
`production-exporter.ts:780`（時間差））。

**判断**: helper は `readonly number[]` のみを受け、**selector 引数
（`safeSumBy`）は設けない**。selector 内包サイトは `arr.map(f)` で先に
`number[]` 化してから渡す（D4 形式 A/B）。

**根拠**:
- API 表面 2 倍化を避け、等価オラクルの「旧式複製 vs helper」対応を 1:1 に保つ
- 中間配列 1 本のコストは NFR（単一パス O(n)）と矛盾しない

**信頼性への影響**:

- 新規設計項目 D4 を追加（🔵）

---

### A3: mean の分母と bitwise 等価の成立条件

**分析日時**: 2026-08-15
**カテゴリ**: データモデル
**背景**: REQ-004（有限入力で旧実装と数値デルタ 0）は、helper 実装の順序・
分母の設計次第で崩れる。

**判断**:
- mean の分母は**有限要素数**（元配列長ではない）
- 実装は「`Number.isFinite` を満たす要素を先頭順に加算する単一ループ」。
  有限のみの入力ではフィルタが恒等写像となり旧 `reduce` と同一演算列 →
  bitwise 等価（`-0` 保持も一致）
- `Math.max(...spread)` 系は比較順序が同じため通常サイズで値等価。
  巨大配列の RangeError は別 assertion（EDGE-102）

**根拠**: IEEE-754 加算の順序依存性 + 各サイト旧式の実読み

**信頼性への影響**:

- REQ-004/005 の検証設計（D3/D6）を 🔵 で確定

---

### A4: 移行粒度 — 125 サイトの Tier 分類

**分析日時**: 2026-08-15
**カテゴリ**: 優先順位
**背景**: 全サイト機械移行は diff 肥大化と誤検出（`.length` 系、REQ-402）を招く。

**判断**: T1（外部起因・未ガード → 移行）/ T2（内部生成で有限構造保証
あり得る → sweep 判定）/ T3（端数系 → 部分移行）の 3 Tier に分類し、
7 ウェーブのコミット構成に落とす。要件一次リストのうち
`intelligent-cache.ts:630`（`.length` 派生 factor の sum）・`653`（match count）は
**有限構造保証の見込みが高く移行対象外候補**と設計側で再分類した。

**根拠**: 各行の実読み（`factors` は `.length` 演算結果、`score` は
`includes() ? 1 : 0` の加算で非有限になり得ない）

**信頼性への影響**:

- REQ-402 の判定基準に実装根拠を追加（🟡 → 実質 🔵）
- ただし最終判定は実装フェーズの sweep に委ねる（行ずれリスクは残る）

---

### A5: registry family の検出方式

**分析日時**: 2026-08-15
**カテゴリ**: アーキテクチャ
**背景**: `reduce((a,b)=>a+b` は 125 サイトあり、全数禁止は false-positive だらけになる。

**判断**: 検出は**ファイルリスト scoped**（外部起因値を扱う移行済みモジュール
`src/analysis/`, `src/quality/`, `src/export/` に限定）+ sweep pin。
`frozen-literal-rules.ts`（412 行）への約 15 行追加、分割しない。

**根拠**: r4-r17 の例外リスト運用形式。`readFileSync` は `import.meta.url` 基準

**信頼性への影響**:

- D7 は パターン実効性が実装前のため 🟡。他は 🔵 のまま

---

## 分析結果サマリー

### 確認できた事項

- 除外 vs 0 置換は「配列集計 = 除外 / スカラー = 0 置換」の責務分離で両立可能
- selector 引数なしの `number[]` 受け API で全移行形状をカバー可能（map 前置）
- 有限入力の bitwise 等価は「同一順序の単一ループ + 有限数分母」で構造的に保証可能
- 要件一次リスト中 `intelligent-cache.ts` の 2 サイトは有限構造保証見込み

### 設計方針の決定事項

- D1 API 仕様（4 関数・fallback=0・readonly number[]）
- D2 除外を正規形、`sanitizeFinite` との共存ルール
- D3 bitwise 等価の保証構造、spread 系の別 assertion
- D4 selector 移行パターン（map 前置 2 形式）
- D5 Tier 分類 + 7 ウェーブコミット構成
- D6 テスト 4 層（仕様 / デルタ / fuzz / spread 破綻回帰）
- D7 registry family（ファイル scoped、単一ファイル維持）

### 残課題（実装フェーズへ）

- sweep による Tier 最終確定（要件一次リストの行ずれリスク）
- registry パターンの false-positive 実測（D7 の 🟡 解消）
- `intelligent-cache.ts:693-695`（cosine similarity）の生成元（`keywordVector` 構築）確認

### 信頼性レベル分布

**設計前（要件フェーズ終了時）**:

- 🔵 青信号: 12 件 / 🟡 黄信号: 2 件 / 🔴 赤信号: 0 件
- 未決: EDGE-001（除外 vs 0 置換）、API 形状、移行粒度

**設計後（architecture.md + dataflow.md 全項目）**:

- 🔵 青信号: 14 件 (93%)
- 🟡 黄信号: 1 件 (7%)（D7 registry 実効性）
- 🔴 赤信号: 0 件 (0%)

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義**: [requirements.md](requirements.md)
- **要件フェーズ分析記録**: [interview-record.md](interview-record.md)
