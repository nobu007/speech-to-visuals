# unreachable-ui-wire-or-retire データフロー設計


<!-- spine:anchor:begin -->
> **Spine anchor**: [speech-to-visuals アーキテクチャ設計](../speech-to-visuals/architecture.md)
>
> - parent: `speech-to-visuals/architecture.md`
> - role: `detailed`
> - status: `canonical_child`
<!-- spine:anchor:end -->

**作成日**: 2026-09-07
**関連要件定義**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-425 / REQ-426（Phase 196・提案ベース `- [ ]`）
**関連受け入れ基準**: [speech-to-visuals 受け入れ基準](../speech-to-visuals/acceptance-criteria.md) TC-409-01〜02 / TC-410-01〜02（未実施）
**親設計**: [architecture.md](architecture.md)

**【信頼性レベル凡例】**: 🔵 青信号（既存実装・文書に基づく確実なフロー）/ 🟡 黄信号（妥当な推測）/ 🔴 赤信号（参照資料にない自動推定）

---

## WIRE 経路のデータフロー（complete state の結果消費）🔵

**信頼性**: 🔵 *Index.tsx:25-126 の handleUpload 実装・Index.tsx:227-239 の complete state 実装・VideoPreview.tsx:74-228 の props/Player 実装より*

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant IDX as pages/Index.tsx (legacy 経路)
    participant SUP as Supabase (storage / functions)
    participant DP as DiagramPreview
    participant VP as VideoPreview (WIRE)
    participant STV as SpeechToVisualsVideo (src/remotion/Video.tsx)

    U->>IDX: 音声 file upload
    IDX->>SUP: storage.upload / transcribe-audio / generate-scenes
    SUP-->>IDX: transcript / scenes（parseUntrustedJson で無毒化済 :71/:99）
    IDX->>IDX: result set・status='complete' (:110-117)
    IDX->>DP: scenes（静的 scene 一覧 — 従来通り）
    IDX->>VP: scenes + audioUrl（新規 mount・既存 state の pass-through）
    VP->>STV: Player component として同一 composition を消費 (:8/:213-228)
    STV-->>VP: animation frame を render
    VP-->>U: 再生/一時停止・seekbar・frame step・速度/解像度切替
```

**詳細ステップ**:

1. upload → complete state までの流れは全て既存（本 Phase は complete state の表示構成のみ変更）。
2. `result.scenes` / `result.audioUrl` は DiagramPreview・VideoRenderer が既に消費している同一 data を VideoPreview へ渡すのみ — 新規の取得・変換・store は存在しない。
3. VideoPreview 内部は自律完結（player event 購読 :115-144・seek/speed/resolution の local state）で、親へ callback を上げない。

## 到達性 guard のデータフロー（静的 import graph 走査）🔵

**信頼性**: 🔵 *REQ-425 (e)・本設計 architecture.md「到達性 guard 設計」節・tests/guards の既存 census 形式（readFileSync + 純関数 + ALLOWED roster）より*

```mermaid
flowchart TD
    A["files: specs 以外の src 実ファイル読み込み<br/>(Map<relPath, content>)"] --> B["純関数 walker<br/>import 辺抽出: from '…' / import('…')<br/>@/ → src/・相対解決 (.tsx/.ts/index)"]
    E["entry set<br/>src/main.tsx + src/remotion/Root.tsx"] --> C["BFS で reachable set を構築"]
    B --> C
    C --> D{"src/components/**/*.tsx<br/>(__tests__ 除外) の全 file が<br/>reachable set に含まれるか"}
    D -->|全て reachable| G["GREEN (ALLOWED roster 空)"]
    D -->|1 件でも未到達| F["RED: 未到達 file と<br/>到達経路欠落を列挙"]
    H["mutation witness<br/>(a) in-memory fixture に孤立 component<br/>(b) 実 tree で VideoPreview 辺を一時除去"] -.->|孤立を検出| D
```

**設計要点**:

1. walker は fs 非依存の純関数（合成 fixture で単体検証可能・REQ-388 precedent と同じ「実 tree が clean でも detector の歯が残る」構造）。
2. entry set が 2 file なのは、app mount（main.tsx）と Remotion composition 登録（Root.tsx）が**共に正規の生産入口**だから（A157 が React.lazy / barrel 不在を確認済み — 静的走査で漏れない）。
3. 外部 package（react・@remotion/player・@stv/core 等）は辺を持たず、解決は repo 内 `src/` に限る。

## RETIRE 経路のクリーンアップフロー 🔵

**信頼性**: 🔵 *REQ-425 (a)・architecture.md「RETIRE 設計」roster 表より*

```mermaid
flowchart TD
    A["5 file 削除<br/>(PipelineProgress / StageIndicator /<br/>EnhancedFileUploader /<br/>PerformanceMetricsVisualization /<br/>InteractiveResultViewer)"] --> B["src comment 引用の reword<br/>(AdminAnalyticsDashboard:84・sonner.tsx:20・<br/>AudioUploader:47・useFrameworkPipeline:116)"]
    A --> C["test 整理<br/>(StageIndicator.test.ts 削除・<br/>mobile-responsive の block 削除・<br/>witness leg の live site re-point)"]
    A --> D["guard roster / witness 整理<br/>(optional-metric-producer / fallback-default /<br/>quality-display-tiers / round-then-decompose /<br/>canvas-aspect-ratio / react-anti-patterns /<br/>default-fps-coupling)"]
    B --> E["grep witness: 削除 file 名の<br/>live code/test hit = 0"]
    C --> E
    D --> F["guards full run + tsc 両 config + lint<br/>(comment 移動に伴う guard 連鎖の新行番号確認)"]
    E --> F
    F --> G["全 green で retire 完了<br/>(歴史記録 specs/tasks/*.md は不変)"]
```

**注意（既知の連鎖クラス）**: src 変更で comment が動くと stale-comment / dead-idiom / three-way spec 句の guard が連鎖 RED する既知パターンのため、実装 commit では guards full run を回して新行番号・新句を確認する（本設計の roster は 2026-09-07 時点の行番号）。

## 状態管理フロー（VideoPreview 内部）🔵

**信頼性**: 🔵 *VideoPreview.tsx:98-194 の実装より*

```mermaid
stateDiagram-v2
    [*] --> 停止: mount (complete state)
    停止 --> 再生中: Play button / player.play()
    再生中 --> 停止: Pause / ended
    停止 --> 停止: seekbar / frame step (seekTo)
    再生中 --> 再生中: frameupdate で currentFrame 更新
```

- 全 state は VideoPreview の local state（isPlaying / currentFrame / resolution / playbackSpeed / loop）で、Index の state と結合しない。
- unmount（complete state からの離脱）時は player event listener を全解除（:137-143）— listener-leak class の既知対策を踏襲。

## データ整合性の保証 🔵

**信頼性**: 🔵 *Index.tsx:66-101 の chokepoint 実装より*

- **トランザクション性は非対象**（単一 client の表示 tree 変更のみ・永続化なし）。
- **整合性チェック**: VideoPreview が受け取る scenes は `parseUntrustedJson`（Infinity/`__proto__` 無毒化 chokepoint）通過済みの同一 data を既存 2 component が消費している経路と同じ — 検証二重化は行わず単一 chokepoint を維持する（export-security 2 paths class の教訓：検証経路の重複を作らない）。
- **空データ**: `scenes` が空配列の場合は VideoPreview.tsx:197-207 の empty fallback（`data-testid="video-preview-empty"`）が既存実装のまま機能する。

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **分析記録**: [design-interview.md](design-interview.md)
- **要件定義（正本）**: [speech-to-visuals 要件定義書](../speech-to-visuals/requirements.md) REQ-425 / REQ-426
- **受け入れ基準（正本）**: [speech-to-visuals 受け入れ基準](../speech-to-visuals/acceptance-criteria.md) TC-409-01〜02 / TC-410-01〜02

## 信頼性レベルサマリー

- 🔵 青信号: 5件（WIRE 経路 / guard データフロー / RETIRE クリーンアップ / 状態管理 / データ整合性）
- 🟡 黄信号: 0件
- 🔴 赤信号: 0件

**品質評価**: 高品質（全フローが既存実装の行番号に接地し、新規に作るのは到達性 guard の walker 1 点のみ）
