# finite-safe-aggregation 要件定義書（軽量版）

**作成日**: 2026-08-15
**feature_id**: finite-safe-aggregation
**作業規模**: 軽量開発（機能追加が限定的・参照文書は実コードと steering のみ）

## 概要

数値配列から代表値を算出する集計（sum / mean / max / min）が要素単位の
非有限値ガードなしに各モジュールへ inline 実装されており（`src/` 内
`reduce((a,b)=>a+b,0)` 系 125 サイト、うち要素ガード付きは 2 系のみ）、
LLM 出力・応答時間・segment 信頼度など外部起因の値に NaN / ±Infinity が
混入すると代表値ごと NaN 化して dashboard・gate・adaptive timeout へ漏れる。
先行 feature `pipeline-metrics-nan-leak-fix` は ingestion chokepoint 1 点 +
pipeline 層 2 サイトのみを対象としており、**集計演算の横展開は未達**。
本要件は finite-safe 集計 helper を `src/lib/metrics-utils.ts` に単一ソース化し、
リスクあるサイトを移行、数値デルタ + fuzz 等価オラクルと registry ガードを
セットで残す。

**【信頼性レベル凡例】**:
- 🔵 青信号: 実装・既存スペック・steering を参考にした確実な要件
- 🟡 黄信号: 実装・steering から妥当な推測による要件
- 🔴 赤信号: 参照資料にない自動推定による要件

## 関連文書

- **分析記録**: [💬 interview-record.md](interview-record.md)
- **コンテキストノート**: [📝 note.md](note.md)
- **先行（直交）feature**: [../pipeline-metrics-nan-leak-fix/requirements.md](../pipeline-metrics-nan-leak-fix/requirements.md)

## 主要機能要件

### 必須機能（Must Have）

- **REQ-001**: システムは数値配列の sum / mean / max / min を算出する
  finite-safe helper（非有限要素を既定動作として除外）を
  `src/lib/metrics-utils.ts` に単一ソースとして提供しなければならない 🔵
  *`sanitizeFinite`（`src/utils/guards.ts:28`）が既に同ファイル群の正本である実装構成より*

- **REQ-002**: helper は空配列および全要素非有限の配列に対し fail-safe な
  既定値（0）を返し、決して NaN / ±Infinity を返してはならない 🔵
  *`loadBaseline` / `percentChange` sink 修正（session 60-62）と同一の fail-value 原則より*

- **REQ-003**: 未ガードで外部起因値を集計しているサイトは helper へ委譲して
  置換しなければならない。移行対象の一次リスト（実装フェーズで sweep により
  増減確認）: 🔵 *file:line は 2026-08-15 の実調査*
  - `src/analysis/llm-service.ts:724-732,795-796`（LLM 応答時間 mean）
  - `src/analysis/diagram-detector.ts:1344`（testResults score mean）
  - `src/analysis/scene-segmenter.ts:792`（segment duration mean）
  - `src/analysis/diagram-detector.ts:436`、`src/quality/enhanced-error-recovery.ts:1452,1899-1900`
    （`Math.max(...)` spread — NaN 伝播）
  - `src/performance/intelligent-cache.ts`（5 サイト）、
    `src/visualization/complex-layout-engine.ts`（3 サイト）、
    `src/export/production-exporter.ts`（3 サイト）ほか
    note.md 記載の 20 ファイル分布

- **REQ-004**: helper の数値仕様は旧 inline 実装と、有限値のみの入力に対して
  bitwise 等価（数値デルタ 0）でなければならない 🔵
  *steering「旧式との数値デルタ+ファズ等価オラクルの2点セット」指示*

- **REQ-005**: helper の等価性検証には seed 固定の fuzz オラクル
  （`createLayoutRng` / mulberry32 流用、`Math.random` 不使用）を
  伴うテストを含めなければならない 🔵
  *steering 指示 + registry の `Math.random` 禁止（layout-rng.ts 例外のみ）*

### 条件付き要件

- **REQ-101**: 配列要素に NaN または ±Infinity が混入した場合、システムは
  当該要素を除外した上で代表値を算出しなければならない 🔵
  *`streaming-quality-monitor.ts:210-211` の `.filter(c=>Number.isFinite(c))` が既存正規形*

- **REQ-102**: 移行により旧実装から出力が変化するサイト（NaN→有限値 等）に
  対し、commit message に `behavior change:` を明記しなければならない 🔵
  *steering「挙動デルタがある変更は 'behavior change:' を明記」指示*

### 制約要件

- **REQ-401**: 新たな family の検出ルールは
  `tests/guards/frozen-literal-rules.ts`（単一ファイル方針）に約 15 行の
  エントリとして追加し、registry の分割は行ってはならない 🔵
  *`docs/architecture.md` の registry 単一ファイル方針（423 行 < 800 行上限）より*

- **REQ-402**: 移行対象は非有限になり得る値（外部起因の score / confidence /
  時間 / hit 数）に限定し、文字列長・個数（`.length` 系）の集計は
  移行対象外としなければならない 🟡
  *スコープ抑制の設計判断（`part.length`, `keyphrases.length` は NaN になり得ない）*

- **REQ-403**: ガードテストの `readFileSync` は `import.meta.url` 基準とし、
  cwd 相対にしてはならない 🔵
  *TC-302/313: `--maxWorkers>1` での flake 教訓*

## 簡易ユーザーストーリー

### ストーリー1: パイプライン開発者として壊れた代表値を見たい

**私は** パイプライン開発者 **として**
**LLM 応答時間などに NaN が混入しても dashboard と adaptive timeout が
有限値を示すようにしたい**、
**そうすることで** メトリクスの欠損や NaN 表示によるデバッグ不能状態を
回避できる。

**関連要件**: REQ-001, REQ-002, REQ-003, REQ-101

## 基本的な受け入れ基準

### REQ-001/002: helper 仕様

**Given（前提条件）**: `src/lib/metrics-utils.ts` に finite-safe helper がある
**When（実行条件）**: 空配列 / 全要素非有限 / NaN 混入 / 有限のみ、の 4 系入力を与える
**Then（期待結果）**: いずれも finite number を返す（空・全非有限は 0）

**テストケース**:

- [x] 正常系: 有限値のみ配列で既存 inline 実装と数値デルタ 0 🔵 — wave-1 fuzz 300 ケース ×4 関数、`Object.is` bitwise（-0 含む）。6fa7d591
- [x] 主要な異常系: NaN / +Infinity / -Infinity 混入で要素除外 🔵 — spec matrix + fuzz 非有限混入 300 ケース ×4（helper = legacy over finite subset）
- [x] 境界値: 空配列・全要素非有限 → 0 🔵 — spec matrix 5 系 ×4 + fallback 指定ケース

### REQ-003/004/005: 移行と等価性

**Given**: fuzz オラクルが mulberry32 seed 固定で配列を生成する
**When**: 旧 inline 実装と helper の出力を比較する
**Then**: 有限値入力では全 case 等価、非有限混入では helper のみ有限を返す

**テストケース**:

- [x] 正常系: 各移行サイトの数値デルタ比較 🔵 — llm-service（getStats 経由）/ diagram-detector / scene-segmenter / error-recovery / production-exporter 各 200 seeded ケース + source anchor（cef513cd/d2fff302/a37db62d/4a3c2da3/fe4af157）
- [x] 主要な異常系: fuzz による非有限混入ケース 🔵 — 各サイトオラクルに非有限混入 case + wave-1 汎用 fuzz

**検証コマンド**:

```sh
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs tests/guards/finite-safe-aggregation
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs tests/guards/frozen-literal-registry
npx -p typescript tsc -p tsconfig.app.json --noEmit
```

## 最小限の非機能要件

- **パフォーマンス**: helper は単一パス O(n) 実装とし、`Math.max(...spread)` の
  stack 展開を伴ってはならない 🟡 *巨大配列での spread overflow 予防*
- **セキュリティ**: なし（信頼境界を跨ぐ新経路は無い。LLM 出力系は既存
  `parseJsonFromLLMText` chokepoint の下流）🔵

## Edgeケース

- **EDGE-001**: 要素ガード付き既存サイト（`llm-cache.ts:226` 等）の移行時、
  旧実装は「非有限→0 置換」、新 helper は「除外」で mean が変化し得る。
  移行時はデルタを明記し `behavior change:` ラベルを付ける 🔵
  *両実装の差分分析より*

- **EDGE-102**: `Math.max(...arr)` 系は NaN 伝播に加え巨大配列で
  stack overflow する。helper 移行で両方が同時に解消されることを
  テストで明示する 🔵
