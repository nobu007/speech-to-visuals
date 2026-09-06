# unreachable-ui-wire-or-retire 設計自動分析記録


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals 設計自動分析記録](../speech-to-visuals/design-interview.md)
>
> - parent: `speech-to-visuals/design-interview.md`
> - role: `system`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**関連要件定義**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-425 / REQ-426（Phase 196・提案ベース `- [ ]`）
**関連受け入れ基準**: [speech-to-visuals 受け入れ基準](../speech-to-visuals/acceptance-criteria.md) TC-409-01〜02 / TC-410-01〜02（未実施）
**親設計**: [architecture.md](architecture.md)

**【信頼性レベル凡例】**: 🔵 青信号（既存実装・文書に基づく確実な分析）/ 🟡 黄信号（妥当な推測）/ 🔴 赤信号（参照資料にない自動推定）

---

# 分析目的

A157（要件段階・2026-09-05）が「個別 verdict は設計段階（kairo-design）で確定する」と留保した 5 件の wire-or-retire 裁決と、mount point・到達性 test 設計を、main 2a38d191 時点（2026-09-07）の実コード全走査に基づいて確定する。

# 分析項目と判断

### A1: 到達可能性 census の設計時再検証

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: A157 の走査（2026-09-05）から design 実施までに参照関係が変化した可能性があるため、裁決の前提を現勢で再検証する必要があった。

**判断**: 到達不能 6 件 + transitively unreachable 1 件は 2026-09-07 時点でも正確。production（非 test・非 comment）import は 0 件 — `PipelineProgress` の src/pipeline/pipeline-orchestrator.ts での hit は同名 interface（:61）であり UI component ではない。`PerformanceMetricsVisualization` の AdminAnalyticsDashboard.tsx:84 は comment。`InteractiveResultViewer` の AudioUploader.tsx:47 / useFrameworkPipeline.ts:116 も comment。`EnhancedFileUploader` の ui/sonner.tsx:20 も comment。ui/ primitive 全 18 file を importer count で走査した結果、reachable tree から切れている primitive は `ui/slider.tsx` のみ（importer = VideoPreview.tsx:11 + InteractiveResultViewer.tsx:15 の 2 件のみ）。

**根拠**: `grep -rn` 全走査（src/ tests/ scripts/・単引用符/二重引用符両対応）・各 hit の文脈確認。

**信頼性への影響**:

- 裁決 roster 7 件（6 component + slider）の前提が 🔵 で確定。A157 予備判定（EnhancedFileUploader retire 濃厚・VideoPreview wire 確定）と合致。

---

### A2: VideoPreview の wire — mount point と VideoRenderer との役割分担

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: REQ-426 (a) が mount point の最終決定を設計段階に留保していた。

**判断**: mount point は **Index legacy 経路 complete state（Index.tsx:227-239）で DiagramPreview と VideoRenderer の間**。VideoRenderer は MP4 file render/download という別価値を持ち置換しない。`VideoRenderer.tsx:10` の未使用 `Player` import は**削除**で解消 — VideoRenderer 側で Player を使い始めると第二の player 消費実装が生まれ REQ-426 (d)（単一 composition ソース）の趣旨に反するため。

**根拠**: VideoPreviewProps は必須が `scenes` のみ（:74-85）で既存 `result` state の pass-through で足りる。composition 消費は VideoPreview.tsx:8 の `SpeechToVisualsVideo` import が既に正典（src/remotion/Video.tsx・Root.tsx 登録と同一実体）。ESM mock 環境で VideoPreview の既存 2 test file が存在し wire 後も witness として有効。

**信頼性への影響**:

- mount point・JSX 順序・props が実装不要判断のレベルまで固定（🔴→🔵）。AC-P196-1/2 に展開。

---

### A3: PipelineProgress / StageIndicator の retire 裁決

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: A157 はこの 2 件を「設計で裁決」と保留していた。

**判断**: 両方 **retire**。(1) PipelineProgress は orphan（非 test import 0 件）。(2) 同 component の WebSocket 統合は client 側で不活性 — `src/` 全域に `socket.io-client` import が 0 件で、eventEmitter props（:35-37）を構築する reachable code も 0 件。wire するには新規 WS client と server event 形式の結合を作らねばならず、憲法の許可範囲（WebSocket リアルタイム進捗通知）内ではあるが、**既に mounted 側が進捗表示を 3 経路で提供している**（Index legacy の ProcessingStatus :220-225・/simple の SimplePipelineInterface Progress・/pipeline ページ）状態で 4 経路目を追加する価値がなく、REQ-425 (c) 単一ソース化の方向は削減側。(3) StageIndicator は唯一の consumer が PipelineProgress（:23）で transitive に消える。server 側 WS（src/api/websocket-handler.ts）は独立 surface で影響しない。

**根拠**: grep 走査（socket.io-client 0 件・eventEmitter 構築 0 件）・ProcessingStatus / SimplePipelineInterface の進捗 UI 実装・websocket-handler.ts の server 側契約。

**信頼性への影響**:

- 2 件の verdict が 🔵 で確定。TC-310-01 witness の re-home 要件（A6 参照）を派生。

---

### A4: EnhancedFileUploader の retire 裁決と guard への波及

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: A157 予備判定は retire 濃厚（機能重複確定）だった。設計では重複の正確な形状と guard 波及を確定する必要があった。

**判断**: **retire**。drag-and-drop（handleDragOver :55 / handleDrop :96 / mount :142-144）と音声 file 検証（`validateAudioFile` :66 — EnhancedFileUploader :92 も同一 `@stv/core/utils/audio-validation` を消費）の両方が mounted 側 AudioUploader で提供済みで、単一ソース化は「mounted 側一本化の確認をしてから削除」の確認側が既に成立している。波及: (a) `toast-whitespace-pre-line-guard.test.ts` の pin 対象は `ui/sonner.tsx`（存続）なので guard 本体は無影響 — comment の "THE LIVE SITE" 説明（:19 前後）と sonner.tsx:20 の comment を reword する（pin されている classNames key には触れない）(b) `react-anti-patterns.regression.test.ts:104` の list entry を削除 (c) `frozen-literal-families/quality-display-tiers.ts:21` の roster comment から名を除去。

**根拠**: AudioUploader.tsx 実装行番号・当該 guard の pin 構造（readSource('src/components/ui/sonner.tsx')）・join('\n') site 全走査（src 内の toast への join('\n') 供給は EnhancedFileUploader :92/:101 のみ → 削除後に toast 複数行供給 site は消えるが、sonner 側 class の pin は toast text 一般の契約として有効）。

**信頼性への影響**:

- verdict 🔵 確定・guard 波及 3 件を roster 化。sonner.tsx comment reword に伴う guard 再実行を必須手順に明記（comment 移動の 3 guard 連鎖クラスへの予防）。

---

### A5: PerformanceMetricsVisualization の retire 裁決

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: A157 は「AdminAnalyticsDashboard が同等表示を inline」と記録済み。設計では `quality-display-tiers` 単一ソース不変量への影響を確認する必要があった。

**判断**: **retire**。orphan で、`/admin`（App.tsx:47）の AdminAnalyticsDashboard がメトリクス表示を inline 実装（:84 comment が関係を自認）。`quality-display-tiers` の src 内 consumer は FrameworkDashboard.tsx と当 component の 2 件で、FrameworkDashboard は FrameworkDashboardPage.tsx:9 経由で `/framework`（App.tsx:45）から reachable — 単一ソースの live consumer は retire 後も残る。波及: `quality-display-tiers-single-source.test.ts:123-124` の PMV delegation leg 削除・`optional-metric-producer-census.test.ts:186` の ALLOWED row 削除・AdminAnalyticsDashboard.tsx:84 と 2 test file の comment reword。

**根拠**: grep（quality-display-tiers consumer 一覧）・App.tsx route 実装・AdminAnalyticsDashboard.tsx の inline 実装。

**信頼性への影響**:

- verdict 🔵 確定。単一ソース不変量（表示 3 形態の委譲）は FrameworkDashboard が担う形で維持。

---

### A6: InteractiveResultViewer の retire 裁決 — 憲法隣接性の評価

**分析日時**: 2026-09-07
**カテゴリ**: アーキテクチャ
**背景**: 651 行と最大の retire 候補。zoom/pan・thumbnail・export 設定 UI を含み、機能の一部は有用に見えるため、wire しない理由を憲法との関係で明確化する必要があった。

**判断**: **retire**。(1) REQ-425 (b) の指摘する「guard test のみが import する test-only 存置」そのもの。(2) `onEdit` / `onShare` props（:43-45）と `Edit3` / `Share2` icon は、SYSTEM_CONSTITUTION 完全禁止カテゴリー（手動動画編集・SNS 共有）に隣接する UI を component 内に含む — **wire すると憲法自動リジェクト条件（手動編集やカスタマイズ機能）に向かう表面が生産 tree に載る**。単一目的（音声→図解動画の完全自動生成）に照らし、scene の手動操作 UI は不要。(3) 有用機能は全て mounted 側に存在: scene 一覧は DiagramPreview・動画再生は VideoPreview（本 Phase wire）・export は `src/export/enhanced-export-engine.ts` + API（engine の production consumer は当 component のみだが engine 自体は api/ 経由で live — component 削除は engine に影響しない）。波及 roster は architecture.md「RETIRE 設計」表の 6 行（fallback-default-census :239・canvas-aspect-ratio :14・target-aspect-ratio-single-source :23・default-fps-coupling・3 unmount witness test の live site re-point・2 src comment の引用除去）。

**根拠**: InteractiveResultViewer.tsx:43-45/:24 の props/import 実装・SYSTEM_CONSTITUTION.md 完全禁止カテゴリー・export engine の src/api 経由消費・witness test 群の実装。

**信頼性への影響**:

- verdict 🔵 確定（憲法整合の観点を明文化）。witness re-point は「pattern pin を live site（AudioUploader / VideoRenderer の mountedRef）へ移す」方針で固定 — REQ-425 (b)「guard test の witness 用途は wire 後の本番 mount で代替可能」の実践。

---

### A7: 到達性 guard の機構設計 — entry set と witness の形

**分析日時**: 2026-09-07
**カテゴリ**: テスト設計
**背景**: REQ-425 (e) は「import graph 走査で機械検証」を要求するが、機構（entry・解決規則・ALLOWED・witness）は設計決定だった。

**判断**: (1) **entry set = `src/main.tsx` + `src/remotion/Root.tsx`** — 前者は app mount 連鎖の唯一入口、後者は Remotion studio/render の正規入口（composition 登録）。React.lazy / barrel は不存在（A157 確認済み）で静的走査が漏れない。(2) walker は**純関数**（fs 非依存・`Map<relPath, content>` 入力）とし、合成 fixture で孤立検出を単体検証 — 実 tree が clean でも歯が残る（REQ-388 合成 liveness precedent）。(3) ALLOWED roster は reason 付き exclude map 形式（既存 census guard と同一規約・無 reason entry は fail）で、**本 Phase 完了時点で空**とする — 7 件裁決後に全域 reachable になるため。(4) mutation witness は TC-409-02 の 2 形（合成 fixture leg + 実 tree での VideoPreview 辺一時除去の isolated RED）とし、MW ledger に記録する手順とする。

**根拠**: tests/guards/freeze-guard.ts:135 walkProductionSurface（src 列挙の precedent）・census guard 群の ALLOWED 構造・mutation-witness-ledger.md の定型・A157 の barrel/lazy 不在確認。

**信頼性への影響**:

- guard 機構が 🔵 で確定し AC-P196-4 に展開。唯一の実装時判断は import 抽出正規表現の edge case（動的 import・再 export）の fixture 設計（🟡 として architecture.md に明記）。

---

### A8: 規模・歴史記録への影響と編集範囲の確定

**分析日時**: 2026-09-07
**カテゴリ**: プロジェクト管理
**背景**: retire に伴う参照「整理」の範囲を誤ると、append-only の歴史記録（要件・task 履歴）まで破壊する恐れがあった（adb6fbad / 319a55ab の spine 破壊 class の再発防止）。

**判断**: 編集範囲は **live code / live test / live guard のみ**。`specs/speech-to-visuals/tasks/TASK-*.md`（過去 Phase の実装記録）・interview-record.md / requirements.md / acceptance-criteria.md の過去記事・`docs/llm-wiki/**`（生成済み inventory）は歴史記録として編集しない — 実装時の chain 記録（TASK-0322〜）で本裁決を追加記録する。規模は 299 file / 87,419 行（2026-09-07 `npm run audit:code-size` 実測）から 5 file / 2,060 行の純減（294 file / 約 85,359 行）で、V2.8 上限（320 / 90,000）に対し余裕を拡大する。

**根拠**: audit:code-size 実測・wc -l（440+220+329+420+651=2,060）・git history の spine 破壊 incident（session 299 修復経緯）。

**信頼性への影響**:

- 編集範囲の明文化により、実装 agent が歴史記録を誤って書き換えるリスクを設計段階で排除。

---

# 分析結果サマリー

## 確認できた事項

- 到達不能 6 件 + slider 1 件の census は 2026-09-07 時点でも正確（production import 0 件・hit は全て interface 同名 or comment）
- ui/ primitive 18 file 中、reachable tree から切れているのは slider のみ
- `socket.io-client` は src 全域で 0 件（client WS 不活性の実証）
- `quality-display-tiers` 単一ソースの live consumer は FrameworkDashboard（/framework）が継続
- 規模 299 file / 87,419 行（実測）・retire で −5 file / −2,060 行

## 設計方針の決定事項

- 裁決: VideoPreview=wire・slider=wire 経由存続・他 5 件=retire（各根拠は A2〜A6）
- mount point: Index complete state の DiagramPreview と VideoRenderer の間・props は既存 state の pass-through
- `VideoRenderer.tsx:10` の Player import は削除で解消
- 到達性 guard: 純関数 walker + entry set {main.tsx, Root.tsx} + 空 ALLOWED + 合成/実 tree の 2 形 witness
- 編集範囲: live code/test/guard のみ（歴史記録は不変）

## 残課題

- import 抽出正規表現の edge case（動的 import・再 export・type-only import）の fixture 設計 — 実装時に合成 leg で検証（🟡）
- page test の DOM assertion は act 内 microtask flush を要する（既知の React test 挙動・実装時注意）
- Phase 300（REQ-427〜429・品質記録 §3 出典整合）の要件は main 未到達（cebe0cbc が local branch 滞留）— 本 Phase とは独立に requirements PR の回収が必要

## 信頼性レベル分布

**分析前**（A157 要件段階・裁決未確定）:

- 🔵 青信号: 2件（VideoPreview wire 確定・EnhancedFileUploader retire 濃厚）
- 🟡 黄信号: 4件（PipelineProgress / StageIndicator / PerformanceMetricsVisualization / InteractiveResultViewer の予備判定）
- 🔴 赤信号: 0件

**分析後**:

- 🔵 青信号: 7件（A1〜A6 の裁決 7 件 + A8 編集範囲）(+5)
- 🟡 黄信号: 1件（A7 の guard 正規表現 edge case）(-3)
- 🔴 赤信号: 0件 (±0)

# 関連文書

- **アーキテクチャ設計**: [architecture.md](architecture.md)
- **データフロー**: [dataflow.md](dataflow.md)
- **要件定義（正本）**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-425 / REQ-426
- **受け入れ基準（正本）**: [speech-to-visuals 受け入れ基準](../speech-to-visuals/acceptance-criteria.md) TC-409-01〜02 / TC-410-01〜02
- **要件段階分析**: [interview-record.md A157](../speech-to-visuals/interview-record.md)
