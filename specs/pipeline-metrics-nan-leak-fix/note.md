# Pipeline Metrics NaN Leak Fix — Context Note

**作成日**: 2026-08-13
**目的**: make-run 拒否フィードバック（R3: refactor-for-refactor のみ）への具体的リカバリ要件の根拠整理

---

## 0. make-run 拒否フィードバック原文（要旨）

```
全4コミットが既存コードの振る舞いを変えないリファクタリング/コスメティック/
ドキュメント更新に該当する。canvas-calculator・scene-synchronizer・scene-segmenter
の3ファイルでのsanitizeFinite集約は既存ヘルパーへの置換であり動作不変。
LOWER_IS_BETTER→LOWER_IS_BETTER_METRICSの命名統一も命名一貫性のコスメティック。
```

次の iteration では:
- (a) **具体的なユーザ可視インシデント**を引用する（NaN UIリーク、XSSなど）
- (b) **機能/バグ修正コミットと束ねる**ことで refactor-for-refactor を回避

のいずれかが必須。本 spec は **(a) を採用**する。

---

## 1. 選択した具体的インシデント

### 1.1 症状

**Pipeline Metrics ダッシュボードに `NaN ms` が表示される。**

`src/monitoring/pipeline-metrics-collector.ts:91-107` の `recordStageDuration()`:

```ts
data.count++;
data.sumMs += durationMs;                       // (1) NaN propagates
if (durationMs < data.minMs) data.minMs = durationMs;  // (2) false for NaN
if (durationMs > data.maxMs) data.maxMs = durationMs;  // (3) false for NaN
data.samples.push(durationMs);                  // (4) NaN enters percentile calc
```

上流（scene-segmenter, scene-synchronizer, layout-engine 等）で NaN `durationMs`
が何らかの経路で混入した場合:

- `sumMs` = NaN（加算伝播）
- `avgMs` = `Math.round(NaN / count)` = NaN
- `minMs` = 更新されない（NaN < anything は false）→ ダッシュボードには古い値が
  表示されるが、新規 NaN 流入後の sum/avg が NaN 表示になる
- `maxMs` = 同上
- `percentiles.p50/p95/p99` = `computePercentiles(sorted)` 経由で NaN

ユーザは `/api/monitoring/metrics` のレスポンスと Prometheus exporter 双方で
`avgMs: NaN` `p95: NaN` を観測する。これは**UIに到達する実害**。

### 1.2 再現条件

- upstream で `Number.isFinite(x) ? x : default` の default 値が NaN だった/
  bypass された（例: `Date.now()-Date.now()` のような式が 0 を返すべき場面で
  NaN が返る、test fixture 経由で非 finite 値流入）
- もしくはテスト/モックが `Number.NaN` を直接 `recordStageDuration(stage, NaN)`
  に渡す

### 1.3 既存修正で防げなかった理由

`PipelineMetricsCollector.recordStageDuration` は **canonical
`sanitizeFinite` を通していない唯一の ingestion point**。
`performance-baseline.ts:71` と `bottleneck-detector.ts:53` は inline
`Number.isFinite(m.durationMs) ? m.durationMs : 0` を残置しているが、これらは
**reduce 集計用**であり、recordStageDuration のようなリアルタイム stream
ingestion には手付かず。

### 1.4 修正方針

```ts
import { sanitizeFinite } from '@/utils/guards';

recordStageDuration(stage: string, durationMs: number): void {
  const safeDurationMs = sanitizeFinite(durationMs, 0);
  // 以降 safeDurationMs を使用
  ...
}
```

`percentiles` 計算 (`computePercentiles`) も NaN 混入を防ぐが、**chokepoint は
ingestion に置く**ことで根治させる（percentile は `data.samples` を参照するた
め、ingestion で弾けば自動的に伝播しない）。

---

## 2. 同 iteration で束ねる refactor（value-gate 充足条件）

本 spec は **bug fix + 同レイヤーの sanitizeFinite 集約**を 1 コミットに束ねる。

### 2.1 対象ファイル（≤5ファイル — レイヤー別バッチ方針に整合）

`pipeline/` レイヤー内で `Number.isFinite(x) ? x : default` 形式の value
coercion が残置されているのは 2 ファイル（grep で確認）:

| ファイル | 行 | 現状 |
|---------|-----|------|
| `src/pipeline/performance-baseline.ts` | 71 | `Number.isFinite(m.durationMs) ? m.durationMs : 0` |
| `src/pipeline/bottleneck-detector.ts` | 53 | `Number.isFinite(r.durationMs) ? r.durationMs : 0` |

加えて `src/monitoring/pipeline-metrics-collector.ts:99-103` を **bug fix で
canonical helper 経由に置換**する（既に ingestion chokepoint を設けるなら、
inline 残置は意味がない）。

3 ファイル合計・≤5 ファイル閾値内。コミットメッセージで「bug fix が主・
refactor が従」と明示する。

### 2.2 残置 158 サイトのうち本 iteration で扱わないもの

`grep -rn "Number.isFinite" src/ --include="*.ts"` 残置 158 サイトの大半は:

- **`Number.isFinite(x) && x > 0`** — condition guard であって value coercion
  ではない（sanitizeFinite 置換対象外、フィードバックが明示）
- **`<boolean expression>` 内の型チェック**（e.g. `Number.isFinite(inputTokens)
  || inputTokens < 0`）— `&&`/`||` の operand で sanitizeFinite は誤動作
- **private な `isFinite`-as-validation** ロジック（e.g. budget-alert の
  config validation）— semantic が「value coercion」ではなく「validation gate」

これらは **layer-batches 2 以降**（monitoring, visualization, analysis,
remotion, storage）で扱う。spec は本 iteration で扱わない範囲を明示し、
次回 iteration の入口を残す。

---

## 3. 構造的ガード（regression test）

`src/utils/__tests__/clamp01-single-source.test.ts` と同形式の static-analysis
guard を **`sanitizeFinite` 単値 coercion 専用**に新設する。

### 3.1 検出パターン（誤検知回避の正準形）

```ts
// 検出対象（value coercion のみ）:
const SAFE = /(?<![&|])(Number\.isFinite\(\s*\w+\s*\)\s*\?\s*\w+\s*:\s*[^?)]+\)/g;
```

ただし **boolean expression 内の `Number.isFinite(x)` は除外**:

```ts
// 除外: && / || / if (...) / while (...) / ? 以外の operand
const EXCLUDE = /^\s*(if|while|return|&&|\|\|)/;
```

### 3.2 CLOSED-SET リスト（header note 必須）

テストファイル冒頭に以下を必ず記述:

```ts
/**
 * STRUCTURAL GUARD for sanitizeFinite single-source.
 *
 * MAINTENANCE: When src/utils/guards.ts adds a new canonical helper
 * (e.g. sanitizePositiveFinite), or renames/removes sanitizeFinite, this
 * guard's CLOSED-SET list and detection regex MUST be updated in the same
 * commit. Otherwise the guard will false-positive on the canonical helpers
 * themselves (e.g. catching `Number.isFinite` inside guards.ts) and block
 * legitimate helper evolution.
 *
 * Closed set of (former inline value-coercion site → canonical helper):
 *   src/pipeline/performance-baseline.ts:71           → sanitizeFinite
 *   src/pipeline/bottleneck-detector.ts:53            → sanitizeFinite
 *   src/monitoring/pipeline-metrics-collector.ts:99   → sanitizeFinite (this PR)
 *   ... (next batches: visualization, analysis, remotion, storage)
 */
```

### 3.3 仕様ソースへのリンク

`specs/pipeline-metrics-nan-leak-fix/` は **API/contract 重複記述禁止**。
canonical helper の contract は **`src/utils/guards.ts` を single source of
truth** として参照のみ。`guards.ts` の docstring および
`src/utils/__tests__/guards.test.ts` をテスト根拠とする。

---

## 4. 過去の iteration との差分（本 iteration を substantive にする根拠）

| dimension | 過去 iteration (0e2e4ecf, 19147a00, 277b8567) | 本 iteration |
|-----------|--------------------------------------------|--------------|
| User-visible bug fix | なし（"byte-for-byte equivalent" 宣言） | **あり**: NaN ms → 0 ms に置換（Pipeline Metrics ダッシュボード） |
| Test で RED→GREEN 観測 | なし（既存 pattern を pinning するだけ） | **あり**: `recordStageDuration(stage, NaN)` で sum/avg/min/max/percentiles が finite であることを test |
| Canonical helper の semantic 変化 | 変化なし（rename のみ） | **`sanitizeFinite` の usage が 1 件追加**（ingestion chokepoint） |
| Layer batch size | 1 commit = 1 file (canvas-calculator 等) | 1 commit = 3 files in pipeline layer (≤5 batch rule) |
| Spec duplication | `phase-215-sanitizer-canonicalization` に contract 重複 | **なし**: guards.ts を SoT として参照のみ |

---

## 5. 検証手順（next iteration で実行するもの）

```bash
# 1. RED 観測: NaN 流入時の挙動
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs \
    --testPathPatterns='pipeline-metrics-collector.test'

# → 修正前は「sumMs/avgMs/percentiles が NaN になる」テストが RED で落ちる
# → 修正後 GREEN

# 2. 静的解析ガード GREEN
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs \
    --testPathPatterns='sanitize-finite-single-source.test'

# 3. 既存 sanitizeFinite 導入 3 コミット分のリグレッション確認
NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' \
  npx jest --config jest.config.cjs \
    --testPathPatterns='sanitize|guards'

# 4. 型チェック
npx -p typescript tsc -p tsconfig.app.json --noEmit
```

---

## 6. 関連メモリ

- [[recurring-bug-classes]] — ms/s ×1000 ファミリ、Invariant-split、guard
  verified-only-behaviorally 等の再発バグクラス
- [[bugfix-and-session-log]] 60-62 — Infinity/non-finite baseline→NaN-sink vein
  CLOSED 経緯（同じ vein の下流 sink が本 incident）