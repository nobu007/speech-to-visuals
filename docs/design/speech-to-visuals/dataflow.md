# speech-to-visuals データフロー図

**作成日**: 2026-04-27
**関連アーキテクチャ**: [architecture.md](architecture.md)
**関連要件定義**: [requirements.md](../../spec/speech-to-visuals/requirements.md)

**【信頼性レベル凡例】**:

- 🔵 **青信号**: 要件定義書・既存設計文書・既存実装を参考にした確実なフロー
- 🟡 **黄信号**: 要件定義書・既存設計文書・既存実装から妥当な推測によるフロー
- 🔴 **赤信号**: 参照資料にない自動推定によるフロー

---

## システム全体のデータフロー 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md・SYSTEM_CORE.md §3・要件定義書より*

```mermaid
flowchart TD
    A[ユーザー] -->|音声ファイル or マイク入力| B[フロントエンド]
    B -->|ファイルアップロード| C[Pipeline Orchestrator]
    C -->|Stage 1| D[Whisper 文字起こし]
    C -->|Stage 1-Alt| D2[Web Speech API リアルタイム]
    D -->|SRT + テキスト| E[Scene Segmenter]
    D2 -->|テキスト| E
    E -->|3-15秒セグメント| F[Language Detector]
    F -->|EN/JA/auto| G[Complexity Detector]
    G -->|スコア < 20%| H1[Flash Model]
    G -->|スコア ≥ 20%| H2[Pro Model]
    H1 --> I[Semantic Cache]
    H2 --> I
    I -->|ヒット| J[DiagramData]
    I -->|ミス| K[Gemini LLM 分析]
    K -->|失敗| K2[Fallback LLM]
    K2 -->|失敗| K3[ルールベース V1]
    K --> J
    K2 --> J
    K3 --> J
    J -->|DiagramData| L[Layout Engine]
    L -->|ゼロオーバーラップ レイアウト| M[Remotion Animation]
    M -->|アニメーション コンポーネント| N[Video Renderer]
    N -->|1080p 30fps MP4| O[出力: 動画 + JSON]
    O -->|ダウンロード/プレビュー| A
```

## 主要機能のデータフロー

### 機能1: 音声ファイル文字起こし 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md Stage 1・ユーザーストーリー1.1・受け入れ基準TC-001より*

**関連要件**: REQ-001, REQ-003, REQ-004

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant FE as フロントエンド
    participant P as Pipeline
    participant W as Whisper
    participant LD as Language Detector

    U->>FE: 音声ファイルをD&Dアップロード
    FE->>FE: ファイル検証（形式/サイズ/50MB以下）
    FE->>P: 音声ファイル + オプション
    P->>W: 音声ファイル → Whisper モデル
    W->>W: 音声デコード + 前処理
    W->>LD: 音声セグメント → 言語検出
    LD-->>W: ja/en/auto
    W->>W: 文字起こし実行（精度~85%）
    W-->>P: タイムスタンプ付きテキスト
    P->>P: SRT キャプション生成
    P-->>FE: {transcript, srt, language, segments}
    FE-->>U: 文字起こし結果 + 進捗表示
```

**詳細ステップ**:

1. ユーザーが MP3/WAV/OGG/M4A（最大50MB）をドラッグ＆ドロップ
2. フロントエンドでファイル形式・サイズを検証
3. Whisper モデル（base/small/medium）で自動言語検出付き文字起こし
4. タイムスタンプ精度 ±50ms でセグメント分割
5. SRT キャプションファイルとプレーンテキストを出力
6. 処理進捗をリアルタイムで UI に表示

### 機能2: LLM 内容分析とフォールバック 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md Stage 2・SYSTEM_CORE.md §4.1-4.2・ユーザーストーリー2.1-2.2より*

**関連要件**: REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant SS as Scene Segmenter
    participant CD as Complexity Detector
    participant SC as Semantic Cache
    participant LLM as Gemini LLM
    participant FB as Fallback LLM
    participant RB as ルールベース V1

    P->>SS: 文字起こしテキスト
    SS->>SS: 3-15秒セグメントに分割
    SS->>CD: セグメント + 言語情報
    CD->>CD: 複雑さスコアリング
    CD->>SC: キャッシュ検索（類似度 > 0.9）
    alt キャッシュヒット
        SC-->>P: キャッシュされた DiagramData
    else キャッシュミス
        CD->>LLM: 分析リクエスト（Flash or Pro）
        alt Primary LLM 成功
            LLM-->>SC: 結果をキャッシュ保存
            SC-->>P: DiagramData
        else Primary LLM 失敗
            LLM->>LLM: リトライ（最大3回、指数バックオフ）
            alt リトライ成功
                LLM-->>P: DiagramData
            else 全リトライ失敗
                LLM->>FB: Fallback LLM へ
                alt Fallback 成功
                    FB-->>P: DiagramData
                else Fallback も失敗
                    FB->>RB: ルールベース V1
                    RB-->>P: DiagramData（シーケンシャル図解）
                end
            end
        end
    end
```

**詳細ステップ**:

1. 文字起こしテキストを意味単位（3-15秒）のセグメントに分割
2. 言語検出（EN/JA）→ 複雑さスコアリング
3. セマンティックキャッシュ検索（類似度閾値0.9）
4. キャッシュミス時: Flash/Pro 自動選択で LLM 分析
5. エンティティ抽出・関係性抽出・図解タイプ検出（flow/tree/timeline/matrix/cycle）
6. 失敗時は3層フォールバックで必ず結果を生成

### 機能3: ゼロオーバーラップレイアウト生成 🔵

**信頼性**: 🔵 *SYSTEM_CORE.md §4.3・ZERO_OVERLAP_DESIGN.md・ユーザーストーリー3.1より*

**関連要件**: NFR-302

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant DD as Diagram Detector
    participant LE as Layout Engine
    participant OR as Overlap Resolver
    participant CC as Canvas Calculator

    P->>DD: DiagramData
    DD->>DD: 図解タイプ判定（92%精度）
    DD->>LE: タイプ別レイアウト戦略選択
    LE->>LE: ノード配置計算
    LE->>LE: エッジパス計算
    LE->>OR: 全ノードペアのオーバーラップ検出
    alt オーバーラップ検出
        OR->>OR: フォースダイレクト法（最大100回反復）
        OR->>OR: 空間ハッシュで効率的検出
        OR-->>LE: 解消済みノード位置
    end
    LE->>CC: キャンバスサイズ計算 + センタリング
    CC-->>P: 位置付きノード + エッジ + キャンバス
```

**図解タイプ別レイアウト戦略**:

| タイプ | 主戦略 | フォールバック | 特記事項 |
|--------|--------|---------------|---------|
| flow | Progress Force | Grid-Snap | フロー方向を強調 |
| tree | 階層レイアウト | Grid-Snap | 親子関係を維持 |
| timeline | Force（X制約） | Grid-Snap | Y軸固定で時系列 |
| matrix | Grid-Snap | N/A | 厳格グリッド配置 |
| cycle | 円形レイアウト | Force | 円形構造を維持 |

### 機能4: アニメーション動画生成 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md Stage 4-5・ユーザーストーリー3.2より*

**関連要件**: REQ-301

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant Sync as Scene Synchronizer
    participant Anim as Animation Engine
    participant Rem as Remotion Renderer
    participant Out as 出力

    P->>Sync: レイアウトデータ + SRTキャプション
    Sync->>Sync: シーン同期（精度±50ms）
    Sync->>Anim: 同期済みシーンデータ
    Anim->>Anim: ノードフェードイン（0.3秒）
    Anim->>Anim: エッジ描画アニメーション（0.5秒）
    Anim->>Rem: React コンポーネント生成
    Rem->>Rem: 1080p 30fps レンダリング
    Rem->>Rem: 音声トラック統合
    Rem-->>Out: MP4 動画（5-10MB/分）
```

## データ処理パターン

### 同期処理 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md・src/pipeline/ より*

- 文字起こし → シーン分割 → 言語検出: パイプライン内の直列処理
- レイアウト計算 → オーバーラップ解消: 同期的な反復処理
- 各ステージの完了を待って次ステージに進む品質ゲート方式

### 非同期処理 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §4.2・src/analysis/llm-service.ts より*

- LLM API 呼び出し: 非同期 + タイムアウト管理
- キャッシュ検索: 非同期 I/O
- バッチジョブ: 非同期キューイング（最大3並列）

### バッチ処理 🔵

**信頼性**: 🔵 *src/api/batch-processing-api.ts・README.md より*

- 複数音声ファイルの一括処理（最大3並列）
- ジョブID ベースの進捗追跡（進捗率・ETA・品質スコア）
- ジョブキャンセル機能

## エラーハンドリングフロー 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §7・SYSTEM_CORE.md §4.2・src/quality/ より*

```mermaid
flowchart TD
    A[エラー発生] --> B{エラー種別}
    B -->|ファイル形式エラー| C[400: 対応外形式]
    B -->|ファイルサイズ超過| D[400: 50MB超過]
    B -->|空ファイル| E[400: 空ファイル中止]
    B -->|破損ファイル| F[400: 破損検出]
    B -->|LLM レートリミット| G[429: バックオフリトライ]
    B -->|LLM タイムアウト| H[フォールバック LLM]
    B -->|全LLM失敗| I[ルールベース V1]
    B -->|レンダリング失敗| J[低品質設定で再試行]

    C --> K[ユーザーにエラー通知]
    D --> K
    E --> K
    F --> K
    G --> |最大3回| L{リトライ成功?}
    L -->|Yes| M[結果返却]
    L -->|No| H
    H --> N{フォールバック成功?}
    N -->|Yes| M
    N -->|No| I
    I --> M
    J --> O{再試行成功?}
    O -->|Yes| M
    O -->|No| K
```

## 状態管理フロー

### フロントエンド状態管理 🔵

**信頼性**: 🔵 *note.md・src/components/SimplePipelineInterface.tsx より*

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> uploading: ファイルD&D
    uploading --> transcribing: アップロード完了
    transcribing --> analyzing: 文字起こし完了
    analyzing --> generating: 分析完了
    generating --> complete: 動画生成完了
    uploading --> error: アップロード失敗
    transcribing --> error: 文字起こし失敗
    analyzing --> error: 分析失敗（フォールバックも不可時）
    generating --> error: レンダリング失敗
    error --> idle: リトライ
    complete --> idle: 新規処理
```

### パイプライン内部状態 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §6・src/pipeline/quality-monitor.ts より*

各ステージの品質ゲート管理:
- Stage 1: 音声長 ≥ 1秒、文字起こし精度チェック
- Stage 2: エンティティ/関係性抽出の完全性チェック
- Stage 3: オーバーラップ数 = 0 の保証
- Stage 4-5: キャプション同期精度 ±50ms

## データ整合性の保証 🔵

**信頼性**: 🔵 *PIPELINE_FLOW.md §7・supabase/migrations/・SYSTEM_CORE.md §4.3 より*

- **トランザクション管理**: Supabase（PostgreSQL）の標準トランザクション
- **データ整合性**: RLS によるアクセス制御 + 外部キー制約
- **キャッシュ整合性**: TTL 120分による自動失効 + 類似度ベースの整合判定
- **レイアウト整合性**: オーバーラップ検出 → フォースダイレクト解消 → 最終確認の3段階保証

## 関連文書

- **アーキテクチャ**: [architecture.md](architecture.md)
- **型定義**: [interfaces.ts](interfaces.ts)
- **DBスキーマ**: [database-schema.sql](database-schema.sql)
- **API仕様**: [api-endpoints.md](api-endpoints.md)
- **旧パイプライン仕様（統合元）**: [../../architecture/PIPELINE_FLOW.md](../../architecture/PIPELINE_FLOW.md)

## 信頼性レベルサマリー

- 🔵 青信号: 16件 (94%)
- 🟡 黄信号: 1件 (6%)
- 🔴 赤信号: 0件 (0%)

**品質評価**: 高品質 - パイプラインフローが詳細に文書化された既存設計に基づいている
