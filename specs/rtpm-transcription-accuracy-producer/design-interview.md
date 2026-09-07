# rtpm-transcription-accuracy-producer 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**分析実施**: step4 既存情報ベースの差分分析と自動統合（kairo-design・Phase 302）

## 分析目的

REQ-431（Phase 302・RTPM `quality.transcriptionAccuracy` 実測 producer 接続・REQ-430 後段）を設計するにあたり、monitor・3 pipeline site・adaptive gates・既存 test pin の実測を行い、拡張形式と契約境界を確定した。

## 分析項目と判断

### A1: 拡張形式 — recordPipelineQuality 第 3 引数 vs 新規 method vs options object

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: producer の接続形式として (i) `recordPipelineQuality` への optional 第 3 引数 (ii) 新規 `recordTranscriptionAccuracy(value)` method (iii) 呼び出し側の options object 化、の 3 候補が存在する。

**判断**: (i) optional 第 3 引数 + `PipelineQualityReport` optional 第 3 field。
**根拠**: REQ-431 (b) が報告点を「3 経路の `recordPipelineQuality` 呼び出し site」と明示し、(f) が「`recordPipelineQuality` 既存呼び出し（test pin を含む）と `PipelineQualityReport` 既存 2 field と互換な拡張（破壊的 signature 変更禁止）」を要求する — 拡張対象は同 method 自体であることが要件から読み取れる。(ii) は報告点が REQ-430 の集計定義点と分離し「scenes/overlap/accuracy が同一 run 由来」という report object による原子性を失う（real-time-performance-monitor.ts:252-257 の last-report-wins が field 単位ではなく report 単位であることも、分離した場合に精度の乖離を許す）。(iii) は 2 引数 → object 化で既存呼び出しの positional 互換が崩れる。

**信頼性への影響**:

- 拡張形式（SD1）の信頼性レベルを 🔴 → 🔵 に向上（REQ 文言 + 実装構造の両方から確定）

---

### A2: ingestion の coercion — finite-or-null vs sanitizeFinite

**分析日時**: 2026-09-07
**カテゴリ**: データモデル／堅牢性
**背景**: 既存の 2 値は `sanitizeFinite`（fail-loud fallback 0・:601-602）で ingestion している。第 3 値も同じ chokepoint に乗せるべきか。

**判断**: 第 3 値のみ finite-or-null 変換（`typeof value === 'number' && Number.isFinite(value)` 以外は明示 `null`）。`sanitizeFinite` の 0 fallback は使わない。
**根拠**: REQ-431 (c) が「非有限（NaN）ingestion は明示 `null`」を要求する。加えて 0 は estimator の実測 fail 値（失敗 run → 0・quality-estimators.ts:86）と字面上区別がつかないため、NaN→0 変換は「測定された実失敗」と「非有限ゴミ」を混同する。monitor 内の同型契約として memory-backend.ts:51 の `finiteOrNull`（`number | undefined` → `number | null`）が先行する。既存 2 値の `sanitizeFinite` は「count は 0 が正直な下限」であるためそのまま維持する（count と score で正当な coercion が異なる）。

**信頼性への影響**:

- SD2 を 🔵 で追加。TC-424-02 の契約 test がこの差（NaN → null であって 0 ではない）を pin する

---

### A3: derivation gate — measuredScenes > 0 を accuracy に適用するか

**分析日時**: 2026-09-07
**カテゴリ**: データモデル
**背景**: REQ-372 の `measuredLayoutOverlapCount()` は「report の `measuredScenes > 0`」を出版条件にしている（:743-746）。accuracy の derivation も同条件にすべきか。

**判断**: 適用しない。accuracy の derivation 条件は「第 3 field が finite number」のみ。
**根拠**: あの gate の根拠は「0-scene run は layout scan を走らせていない = 測定基盤が scenes」である（field doc :171-180）。accuracy の測定基盤は transcription recovery chain の終端状態と run 成功形であり scene 数に依存しない — estimator は成功 + 0 scene の run に 0.50 という保守的実測値を返す（quality-estimators.ts:88）。0-scene report の 0.5 は gte 0.85 gate を loud fail させる実測 reading であり、vacuous pass ではない。gate を掛けると「transcription は完走したが layout が空の run」の実測まで null 化され、METRIC UNAVAILABLE と実値 fail の区別（REQ-431 (d) の目的）を自ら潰す。

**信頼性への影響**:

- SD3 を 🔵 で追加。REQ-372 の degenerate rule が overlap 専用の測定基盤理由であることを設計に明記

---

### A4: REQ-373 exact-arg pin への影響 — 「互換」の意味の確定

**分析日時**: 2026-09-07
**カテゴリ**: テスト
**背景**: 3 site の既存 pin は `expect(spy).toHaveBeenCalledWith(1, 1)` 形の exact 2 引数一致（main-pipeline.test.ts:753-790・simple-pipeline.test.ts:707-740・framework-integrated-pipeline.test.ts:534-575）。第 3 引数を渡すとこれらは RED になる。REQ-431 (f) の「test pin を含む互換」と矛盾しないか。

**判断**: 「互換」の対象は**呼び出し側の互換**（2 引数呼び出しが compile・挙動とも崩れない = optional 引数）と **`PipelineQualityReport` 既存 2 field の型・意味不変**であり、3 site の報告内容 pin は拡張対象である。RED になった pin は第三引数付きに拡張して同一 commit で green にする。
**根拠**: TC-424-01 が「3 経路の報告」を `getSnapshot().quality.transcriptionAccuracy` の減点値 assert で検証することを要求しており、報告引数を拡張しない限り検証不能。REQ-373 pin は報告内容の witness であり、内容が変われば witness も同期する（mechanism 移動に伴う census drift と同型）。simple-pipeline.test.ts:532 の spy 型 `MockInstance<void, [number, number]>` も tuple に第 3 要素を加えて更新する（tests/ は tsconfig.test.json の型検査対象）。

**信頼性への影響**:

- 契約互換制約（AC-RTPM-4）の検証内容を 🔵 で確定 — 「pin 無修正 green」ではなく「2 引数呼び出し互換 + pin 拡張後 green」と読み替えた根拠を記録

---

### A5: gate/learner 側の変更不要性の確認

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: REQ-431 (d) は gate 実値評価と適応学習を要求する。adaptive-quality-gates.ts の変更が必要か。

**判断**: 不要。src 変更は monitor と 3 pipeline site のみ。
**根拠**: `METRIC_EXTRACTORS` は既に `transcriptionAccuracy: s => s.quality.transcriptionAccuracy` を map（:368）しており、`evaluateGate` の null 分岐（:279-292・METRIC UNAVAILABLE）と実値比較（:294-315）は field の値で自動的に切り替わる。`updateAdaptiveThresholds` の null round skip（:421-427・REQ-360）も実装済みで、実 round は `historicalValues` に蓄積される（:429-449）。つまり (d) は producer が実値を流すだけで構造的に成立し、実装作業は連結 test（TC-424-03）で固定することが本体。`avgSceneQuality` の extractor（:370）も null のまま fail し続けるため (e) も無変更で成立する。

**信頼性への影響**:

- 「gate/learner 変更なし」（SD6 相当）を 🔵 で確定。実装の blast radius を src 4 file に確定

---

### A6: 既存 monitor 契約 test（REQ-364/372 leg）への影響

**分析日時**: 2026-09-07
**カテゴリ**: テスト
**背景**: tests/unit/monitoring/real-time-performance-monitor-null-propagation.test.ts は REQ-364 leg（:129-149・fresh monitor の quality trio null）と REQ-372 の 7-leg（:179-259）を持つ。第 3 引数追加で既存 leg が壊れないか。

**判断**: 壊れない。REQ-364 leg は「report なし」の fresh monitor を使うため accuracy は引き続き null。REQ-372 7-leg はすべて 2 引数呼び出しで、省略時第 3 field = `null` のため「`transcriptionAccuracy` は null のまま」を主張する leg 7（:251-258）も無修正 green。
**根拠**: 当該 test file の該当 describe 全体の読み込み。REQ-431 の新規 leg（TC-424-02・REQ-372 と同構造の 7-leg + 第 3 引数版）は同じ file に追加する。

**信頼性への影響**:

- 「既存 monitor suite 全 green」（TC-424-02 の後半）が 🟡 → 🔵 で確定

---

## 分析結果サマリー

### 確認できた事項

- monitor の `quality.transcriptionAccuracy` は :718 で無条件 `null`・report は scenes/overlap のみ（:597-604）(A1)
- 3 経路とも集計値の計算点が report site と同一関数内に既に存在（Main/Simple は hoist のみ・FIP は local 渡しのみ）(A1)
- `METRIC_EXTRACTORS`・null round skip は実装済みで gate/learner の src 変更は不要 (A5)
- REQ-364/372 の既存 monitor leg は 2 引数呼び出し互換により無修正 green (A6)

### 設計方針の決定事項

- 拡張形式 = `recordPipelineQuality` optional 第 3 引数 + `PipelineQualityReport` optional 第 3 field (A1)
- ingestion = finite-or-null（NaN は null・0 fallback 不採用）(A2)
- derivation = 第 3 field の finite 性のみ（`measuredScenes > 0` gate は overlap 専用として適用しない）(A3)
- REQ-373 exact-arg pin は第三引数付きに拡張（spy 型含む）(A4)
- 変更範囲 = src 4 file（monitor + 3 pipeline）・gate/learner 無変更 (A5)

### 残課題

- 実装（kairo-tasks → kairo-implement・TC-424-01〜04 RED→GREEN・mutation witness (A)(B) 実測）
- `avgSceneQuality` 正典 formula（label readability・overflow・dangling の重み付け）の設計裁決 — 将来 Phase（本 feature は明示 scope 外・REQ-431 (e)）
- monitor field doc（:159-168）の REQ-368 除外根拠書き換えに伴う、経緯記述の正確性維持（`avgSceneQuality` には根拠が残存することの明記）

### 信頼性レベル分布

**分析前**:

- 🔵 青信号: 0
- 🟡 黄信号: 0
- 🔴 赤信号: 3（拡張形式・coercion・derivation gate の未確定 — 対象 A1/A2/A3 に対応）

**分析後**（A1〜A6 の 6 項目）:

- 🔵 青信号: 6 (+6)
- 🟡 黄信号: 0
- 🔴 赤信号: 0 (−3)

## 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義**: [../speech-to-visuals/requirements.md](../speech-to-visuals/requirements.md)（Phase 302・REQ-431）
