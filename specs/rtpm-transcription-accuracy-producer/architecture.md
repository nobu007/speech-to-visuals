# rtpm-transcription-accuracy-producer アーキテクチャ設計


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07（kairo-design・Phase 302 [fix/A]）
**要件出典**: [requirements.md REQ-431](../speech-to-visuals/requirements.md)（Phase 302・RTPM `quality.transcriptionAccuracy` 実測 producer 接続・REQ-430 後段）・[TC-424-01〜04](../speech-to-visuals/acceptance-criteria.md)
**分析記録**: [design-interview.md](design-interview.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・既存設計文書・既存実装を参考にした確実な設計
- 🟡 **黄信号**: 要件定義書・既存設計文書・既存実装から妥当な推測による設計
- 🔴 **赤信号**: 参照資料にない自動推定による設計

---

## システム概要 🔵

**信頼性**: 🔵 *REQ-431（Phase 302 要件化・fd4ac8b3）・real-time-performance-monitor.ts:718（`transcriptionAccuracy: null` 無条件）・:163-168（REQ-368 除外根拠 field doc）・b8660230（REQ-430 実装）の実測より*

pipeline 3 経路（MainPipeline / SimplePipeline / FrameworkIntegratedPipeline）は REQ-430（b8660230）以降、`recordPipelineQuality` と同一の定義点で減点後 transcriptionAccuracy を計算済みである — MainPipeline.buildQualityMetrics（main-pipeline.ts:405-412）・SimplePipeline 成功経路（simple-pipeline.ts:615-619）・FrameworkIntegratedPipeline.extractQualityMetrics 経由の private 委譲（framework-integrated-pipeline.ts:288 + 347-353）。しかし monitor（`RealTimePerformanceMonitor`）への報告は scenes/overlap の 2 値のみ（real-time-performance-monitor.ts:597-604）で、減点後 accuracy は**破棄されている**: `getSnapshot().quality.transcriptionAccuracy` は :718 で無条件 `null` のまま（REQ-364 finite-or-null 契約の producer-less 状態）。

結果として operator 面（real-time monitor + adaptive gates）では:

1. adaptive Transcription Accuracy gate（gte 0.85・blocker・adaptable）は **METRIC UNAVAILABLE が恒久**続き、実値評価が一度もない（adaptive-quality-gates.ts:279-292 の null 分岐）。
2. `updateAdaptiveThresholds` は null round skip（REQ-360 poisoning 防止・:421-427）のまま、実 round を一度も学習していない。
3. monitor field doc（:163-168）が掲げる REQ-368 の除外根拠「estimator proxy の 0.90 は 0.85 blocker threshold を常に上回る」は、REQ-430 が減点（`DISCLOSED_PLACEHOLDER_TRANSCRIPTION_ACCURACY = 0.5`・quality-estimators.ts:52）を導入した時点で消滅 — 信号は ASR 生存 run（実推論成功 0.90）と ASR 全滅 run（placeholder 終端 0.5・失敗 0）を区別する。

本設計は REQ-372（layoutOverlapRate producer・Phase 173）が確立した報告構造への**同型の第 2 field 拡張**として、品質集計に採用したのと同一の減点後値を monitor へ報告する producer を 3 経路に接続する。`avgSceneQuality` は正典 formula（label readability・overflow・dangling の重み付け）が未裁決のため引き続き producer なし fail-closed（REQ-368/372 設計決定の維持・REQ-431 (e)）。

## アーキテクチャパターン 🔵

**信頼性**: 🔵 *REQ-372/373 の実装構造（real-time-performance-monitor.ts:585-604・:736-746・3 site の REQ-373 コメント）と REQ-431 (b)(f) の文言より*

- **パターン**: 既存 producer 構造への互換拡張（optional 引数 + report object + private derivation）。`recordPipelineQuality(measuredScenes, layoutOverlapCount)` に optional 第 3 引数 `transcriptionAccuracy?: number | null` を追加し、`PipelineQualityReport` に同 optional field を持たせる。新規 method・新規 module・新規依存はゼロ。
- **選択理由**: REQ-431 (b) が報告点を「3 経路の `recordPipelineQuality` 呼び出し site」と明示し、(f) が「既存呼び出しと `PipelineQualityReport` 既存 2 field と互換な拡張（破壊的 signature 変更禁止）」を要求するため。report object に載せることで「scenes / overlap / accuracy が同一 run 由来」という報告の原子性も既存の last-report-wins 構造がそのまま担保する。

## コンポーネント構成

### RealTimePerformanceMonitor（変更・src 1 file）🔵

**信頼性**: 🔵 *real-time-performance-monitor.ts:211-216（PipelineQualityReport）・:597-604（ingestion chokepoint）・:710-720（snapshot quality 組立）・:743-746（REQ-372 derivation の同型）・:909（reset で report clear）の現行実装より*

```
PipelineQualityReport（interface・互換拡張）
├── measuredScenes: number                                # 既存・不変
├── layoutOverlapCount: number                            # 既存・不変
└── transcriptionAccuracy?: number | null                 # 新規・optional（省略 = null）

recordPipelineQuality(measuredScenes, layoutOverlapCount, transcriptionAccuracy?)
  └── ingestion chokepoint: 第 3 値は finite-or-null 変換（SD2）して report object へ

getSnapshot().quality
├── transcriptionAccuracy: measuredTranscriptionAccuracy()   # :718 の無条件 null を置換（SD3）
├── layoutOverlapRate: measuredLayoutOverlapCount()          # 既存・不変
└── avgSceneQuality: null                                    # 不変（scope 外・REQ-431 (e)）

reset(): pipelineQualityReport = null（既存 :909）→ 第 3 field も同時に消去
```

- **SD1（拡張形式）**: 第 3 引数は optional。既存の 2 引数呼び出し（test pin を含む外部呼び出し）はそのまま compile・動作し、省略時の report は accuracy `null`（= その run は accuracy を測定しなかったという正直な読み）。
- **SD2（ingestion coercion）**: 第 3 値は `typeof value === 'number' && Number.isFinite(value)` のときのみその値、それ以外（`undefined` / `null` / NaN / ±Infinity）は明示 `null`。`sanitizeFinite`（fail-loud fallback 0）は不採用 — 0 は estimator の実測 fail 値（失敗 run → 0・quality-estimators.ts:86）と区別がつかず、「非有限ゴミの 0 落ち」と「測定された実失敗 0」を混同する。memory-backend.ts:51 の `finiteOrNull` と同型の契約（REQ-431 (c)「非有限 ingestion は明示 null」）。
- **SD3（derivation gate）**: 新設 private `measuredTranscriptionAccuracy(): number | null` は最新 report の第 3 field が finite number ならその値、report なし / field なしなら `null`。REQ-372 の `measuredScenes > 0` gate は**適用しない** — あの gate の根拠は「0-scene run は layout scan を走らせていない」（測定基盤 = scene layouts）だが、accuracy の測定基盤は transcription recovery chain の終端状態と run 成功形であり scene 数に依存しない。0-scene 成功 run の 0.50 は実測 reading であり gte 0.85 gate を loud fail させる（vacuous pass ではない）。
- **field doc の更新**: :163-168 の REQ-368 除外根拠は transcriptionAccuracy について陳腐化しているため、REQ-430/431 の弁別根拠（0.90 / 0.5 / 0 が gate 閾値の両側に分布）に書き換える。`avgSceneQuality` の producer-less 継続根拠は残す。:710-717 の snapshot 組立コメントも「the other two stay null」→「avgSceneQuality stays null」へ同期する。

### 3 つの pipeline 報告 site（変更・各数行）🔵

**信頼性**: 🔵 *main-pipeline.ts:388-419・simple-pipeline.ts:593-626・framework-integrated-pipeline.ts:284-333 の現行実装と REQ-430 wiring の実測より*

- **MainPipeline.buildQualityMetrics**: 現状は report（:398）が accuracy 計算（:405-412・返却 object 内）より前。**集計で採用する値と同一の local** を hoist して report に渡す: `const transcriptionAccuracy = sanitizeFinite(estimateTranscriptionAccuracy(result, {endedAtDisclosedPlaceholder(...)}), 0)` を report 前に計算し、`recordPipelineQuality(result.scenes?.length ?? 0, layoutOverlap, transcriptionAccuracy)` と返却 object の両方で使う（finite 値に対する `sanitizeFinite(x, 0)` は恒等なので報告値 = 集計値）。
- **SimplePipeline 成功経路**: `estimateTranscriptionAccuracy(qualitySignals, {...})` を report（:608）より前に hoist し、report と `qualityMonitor.recordMetrics`（:615-619）の両方で使う。ここは集計が raw 値を渡すため報告も raw 値。
- **FrameworkIntegratedPipeline.extractQualityMetrics**: `transcriptionAccuracy` local（:288）が report（:299）より前に既に存在するため、`recordPipelineQuality(result.scenes?.length ?? 0, layoutOverlap, transcriptionAccuracy)` への引数追加のみ。

いずれも monitor call site での再計算・`??`/fallback default 注入・文字列照合などの第二推定経路を作らない（REQ-431 (a)・duplicate-formula class）。report は引き続き成功経路の品質集計 site のみで行われ、transcription 段を伴わない failure path は現行どおり report しない（vacuous 値禁止・REQ-431 (c)）。

### adaptive-quality-gates（変更なし・実値化の受益側）🔵

**信頼性**: 🔵 *adaptive-quality-gates.ts:345-371（METRIC_EXTRACTORS が `transcriptionAccuracy: s => s.quality.transcriptionAccuracy` を既に map）・:415-427（updateAdaptiveThresholds の null round skip）の現行実装より*

src 変更ゼロ。extractor map も null skip も REQ-364/360 で実装済みで、producer が実値を流せば (d) の挙動（実値評価・実 round 学習）は構造的に成立する。TC-424-03 はこの連結を test で固定することが実装作業の本体。

### 除外: avgSceneQuality の正典 formula 裁決 🔵

**信頼性**: 🔵 *REQ-431 (e)・REQ-368/372 設計決定・A160 実装検証 (e)（`estimateLabelReadability`・`countNodeOverflow`・`countDanglingLayoutEdges` は実測できるが重み付け構成は未裁決）より*

`quality.avgSceneQuality` には触れない。`estimateTranscriptionAccuracy` と違って単一の正典 estimator が存在せず、重み付けの裁決なしに producer を繋げば「構成が未裁決の合成値で gate を緑化する」REQ-368 が排除した事故の再燃になる。将来の計装 TASK による別 REQ で扱う。

## システム構成図

```mermaid
graph TB
    subgraph pipelines（REQ-430 wiring 済み・計算点はそのまま）
        MP[MainPipeline.buildQualityMetrics]
        SP[SimplePipeline 成功経路]
        FIP[FrameworkIntegratedPipeline.extractQualityMetrics]
    end

    EST[estimateTranscriptionAccuracy result, endedAtDisclosedPlaceholder<br/>0.90 / 0.5 (REQ-430 penalty) / 0]
    MP & SP & FIP -->|"既に計算済みの同一 local（再計算なし）"| EST

    MON[RealTimePerformanceMonitor.recordPipelineQuality<br/>measuredScenes, layoutOverlapCount, transcriptionAccuracy?]
    MP & SP & FIP -->|"3 経路すべてが報告"| MON
    MON -->|"finite-or-null ingestion（SD2）"| REP[(pipelineQualityReport<br/>last report wins)]
    REP -->|"measuredTranscriptionAccuracy（SD3）"| SNAP[getSnapshot quality.transcriptionAccuracy]
    SNAP --> GATE[adaptive Transcription Accuracy gate<br/>gte 0.85 blocker]
    SNAP --> ADAPT[updateAdaptiveThresholds<br/>null skip 維持 + 実 round 学習]
    SNAP -.->|"avgSceneQuality は null のまま"| OUT[scope 外・REQ-431 (e)]
```

**信頼性**: 🔵 *現行呼び出し関係（3 site → realTimeMonitor singleton → getSnapshot → AdaptiveQualityGatesSystem）と本設計の拡張点より*

## ディレクトリ構造 🔵

**信頼性**: 🔵 *既存プロジェクト構造より（src 変更 4 file・新規 src file なし）*

```
src/monitoring/real-time-performance-monitor.ts   # 変更: report 第 3 field・ingestion・derivation・doc
src/pipeline/main-pipeline.ts                     # 変更: accuracy local の hoist + 第 3 引数
src/pipeline/simple-pipeline.ts                   # 変更: 同上
src/pipeline/framework-integrated-pipeline.ts     # 変更: 既存 local を第 3 引数に渡すのみ
src/quality/adaptive-quality-gates.ts             # 変更なし
tests/unit/monitoring/real-time-performance-monitor-null-propagation.test.ts  # REQ-431 leg 追加
tests/unit/pipeline/{main,simple,framework-integrated}-pipeline.test.ts       # TC-424-01 leg 追加
src/quality/__tests__/adaptive-quality-gates.test.ts                           # TC-424-03 連結 leg 追加
```

## 非機能要件の実現方法

### パフォーマンス 🔵

**信頼性**: 🔵 *本拡張が「既に計算済みの値の受け渡し」であり新規計算を含まないことより*

追加の計算・IO・event はゼロ。report object への field 1 件追加と snapshot 組立の derivation 1 件のみで、両者とも既存の hot path（run 完了時・snapshot 取得時）に乗る。

### セキュリティ・堅牢性 🔵

**信頼性**: 🔵 *REQ-431 (c)(d)・REQ-364/360/372 の既存契約より*

- **finite-or-null**: 報告前 `null`・非有限 ingestion `null`・last report wins・`reset()` で消去。捏造定数の再注入（`0.90` 等）は TC-424-04 の mutation witness で検出する。
- **fail-closed 方向の維持**: 減点 0.5 と実失敗 0 は gte 0.85 gate を実値 fail させ、METRIC UNAVAILABLE（評価不能）と実値 fail（評価して不合格）を区別する。適応学習は実 round のみ（REQ-360 poisoning は捏造定数でのみ発生し、実 round 学習は適応の本来的動作 — REQ-431 (d)）。

### スケーラビリティ 🔵

**信頼性**: 🔵 *報告値の単一ソースが estimator にある構造より*

将来 WER 実測（REQ-422/423・D-4）が `estimateTranscriptionAccuracy` を実測値に置き換えても、monitor 側は無変更でその値を拾う — 報告経路が estimator の出力のみに束ねられているため。`avgSceneQuality` も同様に正典 formula の裁決という単一点だけが blocker である。

## 技術的制約

### 契約互換制約 🔵

**信頼性**: 🔵 *REQ-431 (f)・REQ-373 pin（main-pipeline.test.ts:753-790・simple-pipeline.test.ts:707-740・framework-integrated-pipeline.test.ts:534-575）の実測より*

- `recordPipelineQuality` の既存 2 引数呼び出しは compile・挙動とも互換（optional 第 3 引数）。`PipelineQualityReport` の既存 2 field は型・意味とも不変。
- **REQ-373 の exact-arg pin（`toHaveBeenCalledWith(1, 1)` 等）は第 3 引数の追加で RED になる**。これらは本変更の witness として同一 commit で第三引数付きに拡張する（pin の「互換」は 2 引数呼び出しの compile/挙動互換を指し、site の報告内容 pin は拡張対象 — A4 で裁決）。
- `PerformanceSnapshot.quality.transcriptionAccuracy` は `number | null` 型のまま。simple-pipeline.test.ts:532 の spy 型 `MockInstance<void, [number, number]>` は第 3 引数の tuple 型へ更新する（tests/ は tsconfig.test.json で型検査対象）。

### 単一ソース制約 🔵

**信頼性**: 🔵 *REQ-431 (a)・REQ-430 (a)（duplicate-formula class）・D-5 A5 設計決定の系譜より*

monitor への報告値は集計 site で計算済みの local そのもの。monitor call site での再計算・`??`/fallback default 注入・segment 固定文の文字列照合を禁止する。実装時の新設 comment は stale-comment census 語彙（legacy/deprecated/obsolete 等）を使わない表現で書く。

### 規模制約 🔵

**信頼性**: 🔵 *SYSTEM_CONSTITUTION AX-4（320 files / 90,000 行・CI-fatal）より*

src 変更は 4 file（新規 file なし・見立て +40 行程度: monitor +25・Main +6・Simple +6・FIP +1・大半は doc comment）。test 追加 ~150 行。`npm run audit:code-size` green を維持する。

## 関連文書

- **データフロー**: [dataflow.md](dataflow.md)
- **分析記録**: [design-interview.md](design-interview.md)
- **要件定義**: [requirements.md REQ-431](../speech-to-visuals/requirements.md)（Phase 302）
- **受け入れ基準**: [acceptance-criteria.md TC-424-01〜04](../speech-to-visuals/acceptance-criteria.md)

## Acceptance criteria

**信頼性**: 🔵 *REQ-431 (a)〜(g) と TC-424-01〜04 の対応関係より（全項目作成時点で未達・実装時に RED→GREEN）*

- [ ] **AC-RTPM-1**（REQ-431 (a)・単一ソース報告）: monitor への報告値が品質集計 site で `estimateTranscriptionAccuracy(result, {endedAtDisclosedPlaceholder(...)})` から計算済みの local そのものであること — monitor call site での再計算・`??`/fallback default 注入・第二推定経路が存在しないこと。検証（履行時）: 3 site の報告引数が集計値と一致することを pin する test（TC-424-01 に対応）
- [ ] **AC-RTPM-2**（REQ-431 (b)・3 経路）: MainPipeline / SimplePipeline / FrameworkIntegratedPipeline の `recordPipelineQuality` site がすべて第 3 引数を報告すること。検証（履行時）: 減点 context を注入した各経路の pipeline test が `getSnapshot().quality.transcriptionAccuracy` の減点値 0.5 を assert して RED→GREEN（TC-424-01）
- [ ] **AC-RTPM-3**（REQ-431 (c)・finite-or-null 契約）: 報告前 `null`・非有限 ingestion は明示 `null`（sanitizeFinite の 0 fallback ではなく）・last report wins・`reset()` で `null` に戻る・`PerformanceSnapshot.quality.transcriptionAccuracy` は `number | null` のままであること。検証（履行時）: REQ-372 の 7-leg と同構造の monitor 契約 test が RED→GREEN + 既存 monitor suite 全 green（TC-424-02）
- [ ] **AC-RTPM-4**（REQ-431 (f)・外部契約互換）: 2 引数 `recordPipelineQuality` 呼び出しと `PipelineQualityReport` 既存 2 field が compile・挙動とも互換であること（optional 第 3 引数・optional 第 3 field）。REQ-373 の exact-arg pin は第三引数付きに拡張して green。検証（履行時）: 型検査 green + 拡張済み REQ-373 pin green（TC-424-02）
- [ ] **AC-RTPM-5**（REQ-431 (d)・gate 実値評価と適応学習）: 実測報告後、adaptive Transcription Accuracy gate が実値で評価され disclosed-placeholder 終端 run（0.5）が METRIC UNAVAILABLE ではなく実値 fail として検出されること・`updateAdaptiveThresholds` が null round skip を維持したまま実 round のみ学習すること。検証（履行時）: adaptive-gates × monitor 連結 test が RED→GREEN（TC-424-03）
- [ ] **AC-RTPM-6**（REQ-431 (e)・scope 外維持）: `quality.avgSceneQuality` が報告後も `null` fail-closed のままであること。検証（履行時）: 連結 test が avgSceneQuality の null を assert（TC-424-03）
- [ ] **AC-RTPM-7**（REQ-431 (g)・mutation witness）: producer 報告の除去・3 経路いずれかの報告忘れ・monitor 側への捏造定数再注入（`transcriptionAccuracy: 0.90` 等）が isolated RED になることの実測（revert GREEN）。検証（履行時）: mutation → RED → revert → GREEN（TC-424-04）

## 信頼性レベルサマリー

- 🔵 青信号: 16件 (100%)
- 🟡 黄信号: 0件 (0%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質（全設計判断が REQ-431 文言・REQ-372 の同型実装・行番号実測済みの現行コードに束ねられており、参照資料にない新規推定はゼロ。実装の自由度は第 3 引数の coercion と derivation gate の 2 点に絞られ、いずれも既存契約（finiteOrNull・REQ-372 分離）の写像）
