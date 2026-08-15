# finite-safe-aggregation アーキテクチャ設計

**作成日**: 2026-08-15
**関連要件定義**: [requirements.md](requirements.md)
**分析記録**: [design-interview.md](design-interview.md)
**作業規模**: 軽量設計（architecture.md / dataflow.md / design-interview.md のみ。interfaces.ts・database-schema.sql・api-endpoints.md は対象外 — ライブラリ内部変更で新規 API/DB 無し）

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・既存実装を参考にした確実な設計
- 🟡 **黄信号**: 要件定義書・既存実装から妥当な推測による設計
- 🔴 **赤信号**: 参照資料にない自動推定による設計

---

## システム概要 🔵

**信頼性**: 🔵 *requirements.md 概要・src/lib/metrics-utils.ts ヘッダコメントより*

数値配列から代表値（sum / mean / max / min）を算出する finite-safe helper を
`src/lib/metrics-utils.ts` に追加し、未ガード集計サイト（`reduce((a,b)=>a+b,0)` 系
125 サイト中、外部起因の非有限値が混入し得るリスクサイト）を移行する。
非有限要素は**除外**し、空配列・全要素非有限は fail-safe 値 **0** を返す。

percentile / percentChange / roundTo は同ファイルに既に単一ソース化済みであり、
本 feature は同じファイルの同じガバナンス構造（freeze-guard registry + 等価オラクル）
に 4 関数を追加する継続ラウンドである。

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *r4-r17 単一ソース化キャンペーン（quality-thresholds.ts / layout-spacing.ts 等）の同一パターン*

- **パターン**: 単一ソース化 + freeze-guard registry エントリ + 数値デルタ/fuzz 等価オラクルの 3 点セット
- **選択理由**: 機械的置換が主の移行だが「旧実装と bitwise 等価」(REQ-004) の保証が
  必要なため、オラクルによる検証を移行と不可分にする。既存キャンペーンの実績パターン。

## helper API 仕様（D1）🔵

**信頼性**: 🔵 *REQ-001/002/101・streaming-quality-monitor.ts:210-211 の既存正規形より*

```ts
// src/lib/metrics-utils.ts に追加（実装イメージ — 仕様の正本は本節）

/** 非有限要素を除外した sum。有限要素ゼロなら fallback（既定 0）。単一パス O(n)。 */
export function safeSum(values: readonly number[], fallback: number = 0): number;

/** 有限要素のみで算出した mean（分母 = 有限要素数）。有限要素ゼロなら fallback。 */
export function safeMean(values: readonly number[], fallback: number = 0): number;

/** 有限要素のみの max。有限要素ゼロなら fallback（-Infinity を返さない）。 */
export function safeMax(values: readonly number[], fallback: number = 0): number;

/** 有限要素のみの min。有限要素ゼロなら fallback（+Infinity を返さない）。 */
export function safeMin(values: readonly number[], fallback: number = 0): number;
```

仕様上の要点:

1. **要素判定は `Number.isFinite`**（`sanitizeFinite` を要素に適用しない — 後述 D2）
2. **mean の分母は有限要素数**（`filter` 後の `length`）。元配列長で割ると
   除外した要素の分だけ平均が不当に低下するため
3. **`readonly number[]` 受け**。selector（`arr.map(f)`）は呼び出し側で先に
   `number[]` へ写像してから渡す（D4）
4. **単一パス・ループ実装**。`Math.max(...spread)` を使わない（NFR:
   巨大配列での spread stack overflow 予防、EDGE-102）

## 設計方針

### D2: 「除外」を正規形とする（EDGE-001 の最終決定）🔵

**信頼性**: 🔵 *streaming-quality-monitor.ts:210-211（`.filter(c=>Number.isFinite(c))`）が既存正規形である実装構成より*

非有限要素の処理は**除外（exclusion）**に一本化する。0 置換（`sanitizeFinite` per
element）とは**意図的に共存**する:

| 方式 | 意味論 | 正本 | 使い分け |
|---|---|---|---|
| 0 置換 | スカラー 1 個の非有限 → 既定値 | `sanitizeFinite`（`src/utils/guards.ts:28`） | フィールド単位の防衛（設定値・単発値） |
| 除外 | 配列集計で当該要素を母集団から除く | `safeSum` 等（本 feature） | 代表値算出（観測値の欠損はサンプル落ち） |

0 置換を集計に使うと、mean が「欠損をゼロとみなした平均」に歪む（例:
応答時間 100/200/NaN で 0 置換は 100、除外は 150）。観測値の欠損は除外が正しい。

既存の要素 0 置換サイト（`llm-cache.ts:226`、`scene-segmenter.ts:609/671/702/808` の一部）を
移行する場合は mean の値が変わるため、**commit message に `behavior change:` を明記し、
数値デルタをテストコメントに残す**（REQ-102 / EDGE-001）。

### D3: bitwise 等価の保証構造（REQ-004）🔵

**信頼性**: 🔵 *IEEE-754 加算の順序依存性と実装構成からの帰結*

有限値のみの入力に対し、`safeSum` は旧 `reduce((a,b)=>a+b,0)` と
**同じ順序・同じ演算**で加算するため bitwise 等価になる:

- 実装は「`Number.isFinite` を満たす要素のみ先頭から順に accumulator へ加算」する
  単一ループ。有限値のみの配列ではフィルタが恒等写像となり、
  reduce と同一の演算列になる（`-0` も有限なので保持され、一致する）
- `safeMean` も同様に「有限和 / 有限要素数」。旧実装 `reduce(...)/length` と
  有限入力で同一の 2 演算
- **`Math.max(...arr)` 系の移行は例外**: 旧 spread は配列長で stack 展開するが
  比較演算の順序は同じため、overflow しない範囲では値として等価。
  等価オラクルは「通常サイズ配列で値等価」+「巨大配列で helper が有限値を返す
  （旧は RangeError/NaN）」の 2 点を別 assertion で検証する（EDGE-102）

### D4: selector 型サイトの移行パターン 🔵

**信頼性**: 🔵 *実サイトの形状調査（intelligent-cache.ts:653/693-695・production-exporter.ts:780 等）*

旧実装の多くは `reduce((sum, x) => sum + f(x), 0)` 形状（selector 内包）。
helper は `number[]` のみを受けるため、移行は次の 2 形式のいずれかで機械的に行う:

```ts
// 形式 A（基本）: map してから渡す
const total = safeSum(jobs.map(j => j.endTime! - j.startTime!));

// 形式 B（添字依存・内積系）: map でペアを畳んでから渡す
const dot = safeSum(vec1.map((v, i) => v * vec2[i]));
```

中間配列 1 本のコストは許容する（パフォーマンス NFR は「単一パス O(n)」で
あり「中間配列禁止」ではない）。helper に selector 引数
（`safeSumBy(arr, f)`）を追加する案は採らない — API 表面が 2 倍になり、
等価オラクルも旧式との対応が読みにくくなるため。

### D5: 移行対象の分類とウェーブ構成 🔵

**信頼性**: 🔵 *REQ-003 一次リスト + 2026-08-15 の行単位実調査。分類は 🟡 の要素を含む*

REQ-003 の一次リストをリスクで分類し、ウェーブ（=コミット）単位で移行する。
実装フェーズ冒頭に sweep（`grep -rn`）でリストを再確定してから着手（行ずれ対策、
interview-record 残課題）。

| Tier | 条件 | 代表サイト | 処理 |
|---|---|---|---|
| **T1 外部起因・未ガード** | LLM/応答時間/score/confidence 系で要素ガードなし | `llm-service.ts:724-732,795-796`、`diagram-detector.ts:1344`、`scene-segmenter.ts:792`、`diagram-detector.ts:436`、`enhanced-error-recovery.ts:1452,1899-1900` | **移行**（ウェーブ 1-2） |
| **T2 内部生成値・未ガード** | 生成元が自前コードで有限が構造保証されやすい | `complex-layout-engine.ts:968/969`（`x \|\| 0` 済み）・`988`、`intelligent-cache.ts:630`（`.length` 派生）・`653`（match count） | sweep で生成元確認の上、**有限構造保証が確認できたものは移行対象外**（REQ-402 の精神）。保証できないものは移行 |
| **T2b 内部でも参照透過でない経路** | `intelligent-cache.ts:693-695`（cosine similarity — 引数は fingerprint 由来） | — | 生成元（`keywordVector` 構築）確認後、T1/T2 判定 |
| **T3 端数系** | `production-exporter.ts:437/687/780/782`（frameCount / durationMs / 時間差） | `durationMs` は Date 系フィールド（09f 教訓: Date 系は Date.now 由来で有限、ただし `endTime!` の non-null assertion は別リスク） | 687/780 を移行、437/782 は sweep 判定 |

ウェーブ構成（各コミット RED-verified オラクル付き、`behavior change:` ラベル要否は
サイトごとに D2 基準で判定）:

1. `feat(lib): finite-safe aggregation helpers` — helper 4 関数 + 仕様テスト + fuzz オラクル（移行なし・挙動変化ゼロ）
2. `fix(analysis): llm-service response-time means delegate to safeMean` **behavior change:**（NaN 混入時のみ変化）
3. `fix(analysis): diagram-detector score mean + pattern max migrate`（同上）
4. `fix(analysis): scene-segmenter duration mean migrate`（同上）
5. `fix(quality): error-recovery timestamp min/max migrate`（spread 除去を含む）
6. `fix(export/performance/visualization): T2/T3 確定分 migrate`（sweep 確定後）
7. `test(guards): frozen-literal registry family for unguarded aggregation` — registry エントリ（ウェーブ 2-6 の過程で増分を足す方が自然なら各ウェーブに分散可）

### D6: 等価オラクルとテスト構成 🔵

**信頼性**: 🔵 *REQ-004/005・steering 指示・layout-rng.ts の既存資産より*

`tests/guards/finite-safe-aggregation.test.ts`（+ サイト別 equivalence テスト）:

1. **仕様テスト**: 有限のみ / NaN 混入 / ±Infinity 混入 / 空配列 / 全要素非有限 の
   5 系 × 4 関数。いずれも戻り値は finite、空・全非有限は 0（REQ-001/002/101）
2. **数値デルタオラクル**: 各移行サイトについて「旧 inline 式（テスト内に複製）と
   helper の出力が有限入力で `Object.is` 等価（bitwise、-0 含む）」。移行コミットごとに
   対象サイト分を追加
3. **fuzz オラクル**: `createLayoutRng`（`src/visualization/layout-rng.ts:43`、mulberry32 +
   FNV-1a）を seed 固定で使用。生成した乱数配列に非有限を確率的に混入し、
   (a) 有限入力では旧式と bitwise 等価、(b) 非有限混入では helper のみ有限を返す、を
   数百ケース反復。`Math.random` は不使用（registry 禁止・REQ-005）
4. **spread 破綻回帰**: 要素数 1e5+ の配列で `safeMax` が有限値を返す
   （旧 `Math.max(...arr)` は RangeError）ことを明示（EDGE-102）

### D7: registry エントリ（REQ-401）🟡

**信頼性**: 🟡 *frozen-literal-rules.ts（412 行）の既存 family 形式の踏襲。検出パターンの実効性は実装で検証*

`tests/guards/frozen-literal-rules.ts` に約 15 行の family を追加:

- **対象**: T1 移行済みファイルに残る `reduce((a, b) => a + b` / `reduce((sum,`
  集計形状と、`Math.max(...`/`Math.min(...` spread 集計
- **方式**: r4-r17 と同じ「ファイルリスト scoped 検出 + sweep pin（新規ファイルを
  catch）」。125 サイト全件を禁じるのではなく、外部起因値を扱う移行済みモジュール
  （`src/analysis/`, `src/quality/`, `src/export/`）に限定 — `.length` 系や
  match-count 系（REQ-402 対象外）の誤検出を避ける
- **readFileSync は `import.meta.url` 基準**（REQ-403、TC-302/313 教訓）

## ディレクトリ構造 🔵

**信頼性**: 🔵 *現状構造 + 本 feature の変更点*

```
src/lib/metrics-utils.ts               # safeSum/safeMean/safeMax/safeMin 追加
src/analysis/llm-service.ts            # mean ×3 サイト移行
src/analysis/diagram-detector.ts       # mean + Math.max spread 移行
src/analysis/scene-segmenter.ts        # duration mean 移行
src/quality/enhanced-error-recovery.ts # Math.max/min spread 移行
src/export/production-exporter.ts      # sweep 確定分
src/performance/intelligent-cache.ts   # sweep 確定分
src/visualization/complex-layout-engine.ts # sweep 確定分
tests/guards/finite-safe-aggregation.test.ts # 新設（仕様+デルタ+fuzz+spread）
tests/guards/frozen-literal-rules.ts   # family エントリ追加（分割せず）
```

## 非機能要件の実現方法

### パフォーマンス 🔵

**信頼性**: 🔵 *NFR 要件より*

- helper は単一パス O(n) ループ。`Math.max(...spread)` の stack 展開を除去し、
  巨大配列での RangeError リスクを同時に解消（EDGE-102）
- selector 移行（D4 形式 A/B）の中間配列 1 本は許容

### セキュリティ 🔵

**信頼性**: 🔵 *requirements.md NFR より*

- 新規の信頼境界なし。LLM 出力系は既存 `parseJsonFromLLMText` chokepoint の下流で、
  本 feature はその下流の堅牢化

## 技術的制約 🔵

**信頼性**: 🔵 *REQ-401/402/403・docs/architecture.md registry 方針より*

- registry は単一ファイル方針を維持（412 行 < 800 行上限。分割しない）
- `.length` 系・個数集計は移行対象外（REQ-402）
- ガードテストの cwd 依存禁止（REQ-403）

## Acceptance criteria（設計完了条件）

- [ ] architecture.md / dataflow.md / design-interview.md が要件の全 Must-req（REQ-001〜005）の実装方針を空欄なく決定している（EDGE-001 の「除外 vs 0 置換」を含む）
- [ ] helper API 仕様（4 関数のシグネチャ・fallback・mean 分母）が一意に定まっている
- [ ] 移行ウェーブ構成と各ウェーブの検証方法（デルタ + fuzz）がコミット単位で記述されている
- [ ] registry family の追加方式が単一ファイル方針と整合している

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **設計自動分析記録**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md](requirements.md)
- **先行（直交）feature**: [../pipeline-metrics-nan-leak-fix/requirements.md](../pipeline-metrics-nan-leak-fix/requirements.md)

## 信頼性レベルサマリー

- 🔵 青信号: 9 件 (90%)
- 🟡 黄信号: 1 件 (10%)（D7 registry パターンの実効性）
- 🔴 赤信号: 0 件 (0%)

**品質評価**: 高品質（全設計判断が実装調査・既存正規形・steering に直結。🔴 なし）
