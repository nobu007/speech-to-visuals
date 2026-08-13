# Pipeline Metrics NaN Leak Fix 要件定義書（軽量版）

## 概要

`PipelineMetricsCollector.recordStageDuration()` が `durationMs` をサニタイズ
せず直接集計するため、上流から NaN が流入するとダッシュボードに `NaN ms` が
表示される。同 fix は `sanitizeFinite` chokepoint を ingestion に設けると
同時に、`pipeline/` レイヤー内の残置 inline `Number.isFinite(x) ? x : default`
value-coercion（2 ファイル: `performance-baseline.ts:71`,
`bottleneck-detector.ts:53`）も canonical helper へ集約する。本 iteration は
**bug fix が主・refactor が従**の構成で make-run value gate を満たす。

**信頼性レベル凡例**:
- 🔵: 既存コード・実装・テストから確実
- 🟡: 既存コードからの妥当な推測
- 🔴: 推測のみ

## 関連文書

- **分析記録**: [interview-record.md](interview-record.md)
- **コンテキストノート**: [note.md](note.md)

## 主要機能要件

### 通常要件（bug fix）

- **REQ-001**: `PipelineMetricsCollector.recordStageDuration()` は
  `durationMs` が NaN / ±Infinity / 非 number のいずれかの場合、duration を
  `0` として集計しなければならない 🔵 *`src/monitoring/pipeline-metrics-collector.ts:91-107` 直接実装*

- **REQ-002**: NaN `durationMs` 流入後、`getSnapshot()` が返す
  `StageDurationAggregate` の `sumMs` / `avgMs` / `minMs` / `maxMs` /
  `percentiles.{p50,p95,p99}` は全て finite number でなければならない 🔵
  *同 138-142 行の aggregate 計算が finite を前提*

- **REQ-003**: `samples` 配列に NaN 値が混入してはならない（ingestion で
  弾く）🔵 *`computePercentiles` 入力 precondition*

### 通常要件（bundled refactor — value-gate 充足条件）

- **REQ-101**: `aggregateBenchmark()` 内の `totalDurationMs = stages.reduce((s,
  m) => s + (Number.isFinite(m.durationMs) ? m.durationMs : 0), 0)` は
  `sanitizeFinite(m.durationMs, 0)` へ置換しなければならない 🔵
  *`src/pipeline/performance-baseline.ts:71`*

- **REQ-102**: `BottleneckDetector` 内の同形 reduce も `sanitizeFinite` へ
  置換しなければならない 🔵 *`src/pipeline/bottleneck-detector.ts:53`*

- **REQ-103**: 同一 commit 内では bug fix (REQ-001〜003) を主、REQ-101/102 を
  refactor 従とし、commit message に両者の関係を明示しなければならない 🟡
  *make-run feedback (b) bundle 方針*

### 構造的ガード要件

- **REQ-201**: `sanitizeFinite` の value-coercion inline 残置を検出する
  static-analysis guard test を新設しなければならない 🔵 *`clamp01-single-source.test.ts` と同形式*

- **REQ-202**: guard test 冒頭には「guards.ts の helper 追加・改名・削除に
  合わせて CLOSED-SET と regex を更新せよ」旨の maintenance note を
  記載しなければならない 🔵 *make-run feedback (d) maintenance pairing 要件*

- **REQ-203**: guard の CLOSED-SET には本 iteration で migrate した 3 ファイル
  (`performance-baseline.ts`, `bottleneck-detector.ts`,
  `pipeline-metrics-collector.ts`) を含めなければならない 🔵 *溯及防止*

- **REQ-204**: guard の regex は `&&` / `||` / `if` / `while` /
  `return` を operand に持つ **condition guard** の `Number.isFinite(x)` を
  検出対象外としなければならない 🔵 *make-run feedback「`Number.isFinite(x) &&
  x > 0` は対象外」を尊重*

### 状態要件

- **REQ-301**: `PipelineMetricsCollector` は既存 singleton
  (`pipelineMetricsCollector`) の interface・export 名を変更してはならない 🔵
  *Prometheus exporter 等の consumer が import するため*

- **REQ-302**: `recordStageDuration` の呼び出し元（`pipeline-metrics-collector.ts`
  を import する全モジュール）は引数 `durationMs: number` の型契約を維持し
  なければならない 🔵 *既存型 contract 維持*

### 制約要件

- **REQ-401**: 本 iteration で扱うファイル数は **5 以下** とし、レイヤー
  (`pipeline/`, `monitoring/`) 単位で batch を切らなければならない 🔵
  *make-run feedback「5ファイル以内のバッチでコミット」*

- **REQ-402**: 本 iteration で扱う `Number.isFinite(x) ? x : default` 形式
  は **value coercion のみ** に限定し、`Number.isFinite(x) && x > 0` 形の
  condition guard は対象外とする 🟡 *make-run feedback「条件分岐ガードは
  対象外とする方針は正しい」*

- **REQ-403**: spec は `src/utils/guards.ts` および
  `src/utils/__tests__/guards.test.ts` の **contract 重複記述**をしては
  ならない。これらを single source of truth として参照のみとする 🔵
  *make-run feedback「specs が numberGuard.ts の contract を restate する
  のは trim せよ」*

## 簡易ユーザーストーリー

### ストーリー 1: パイプライン監視者が健全なメトリクスを観測できる 🔵

**私は** 本番パイプライン監視者 **として**
**NaN / Infinity が上流から混入しても、Prometheus exporter と
`/api/monitoring/metrics` のレスポンスが finite な ms 値を返すようにしたい**
**そうすることで** ダッシュボードが `NaN ms` を表示する incident に
巻き込まれず、p95 latency の増分を正確に検知できる

**関連要件**: REQ-001, REQ-002, REQ-003

## 基本的な受け入れ基準

### REQ-001: NaN `durationMs` 注入時に sum/avg/min/max/percentiles が finite

**Given**: 新規 `PipelineMetricsCollector` インスタンスに
`recordStageDuration('transcribe', 100)` を 3 回実行後、
`recordStageDuration('transcribe', NaN)` を 1 回実行

**When**: `getSnapshot()` を呼び出す

**Then**: 返却された `StageDurationAggregate` の:
- `count === 4`
- `sumMs === 300` (NaN が 0 として扱われる)
- `avgMs === 75` (`Math.round(300/4)`)
- `minMs === 100`
- `maxMs === 100`
- `percentiles.{p50,p95,p99}` が全て finite number

**テストケース**:
- [ ] 正常系: 全て finite な durationMs を渡した場合の集計が正しい 🔵
- [ ] 主要な異常系: NaN 混入時に sum/avg/min/max/percentiles が finite 🔵
- [ ] 境界値: `+Infinity` を渡すと 0 として扱われる 🔵

### REQ-101/REQ-102: inline → canonical 置換

**Given**: `src/pipeline/performance-baseline.ts:71` および
`src/pipeline/bottleneck-detector.ts:53`

**When**: grep で `Number.isFinite(` を実行

**Then**: 上記 3 行（pipeline-metrics-collector:99, performance-baseline:71,
bottleneck-detector:53）以外の `Number.isFinite` が value coercion 形式で
残っていないこと（condition guard は対象外）

**テストケース**:
- [ ] 静的解析 guard test: `tests/regression/sanitize-finite-single-source.test.ts`
  が GREEN 🔵

### REQ-201〜204: guard test の構造

**Given**: 新設 `tests/regression/sanitize-finite-single-source.test.ts`

**When**: ファイル冒頭のコメントを読む

**Then**: 「guards.ts 更新時に CLOSED-SET と regex を同時更新せよ」旨の
maintenance note が含まれる

## 最小限の非機能要件

- **パフォーマンス**: `recordStageDuration` の overhead は 1% 未満
  (`sanitizeFinite` は `typeof` + `Number.isFinite` 2 操作のみ) 🟡
- **保守性**: ingest chokepoint は recordStageDuration 1 箇所に集約され、
  aggregate 側 (`getSnapshot`) は no-op 🔵
- **観測性**: 修正前後で Prometheus exporter の shape は不変（既存の
  scrape target が破壊されない）🔵

## 対象外（本 iteration で扱わない）

- `monitoring/`, `visualization/`, `analysis/`, `remotion/`, `storage/`
  レイヤーの残置 158 site の canonical 化 → 次回以降の iteration
- `budget-alert.ts` 等の config validation gate → 別 spec
- `monitor ↔ health-check threshold drift` (L3 OPEN candidate) → 別 spec
- spec 重複の trim 対象拡大 (`phase-215-sanitizer-canonicalization/`
  自体は本 repo に未存在のため追加不要、ただし将来このディレクトリを
  作る場合は REQ-403 厳守)