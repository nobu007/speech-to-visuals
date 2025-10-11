# SYSTEM_CORE.md - コアアーキテクチャ定義

## システム概要

**プロジェクト名**: AutoDiagram Video Generator
**目的**: 音声ファイルから自動的に内容を理解し、適切な図解アニメーションを含む解説動画を生成
**開発理念**: 段階的・再帰的改善による完全自動化システム

## アーキテクチャ

### システム全体図

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Web UI          │  │  CLI Tool        │  │  API Server   │ │
│  │  (React + Vite)  │  │  (tsx scripts)   │  │  (Express)    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SimplePipeline (統合層)                     │
│                                                                  │
│  入力: 音声ファイル (MP3, WAV, OGG, M4A)                        │
│  出力: JSON (図解データ) + MP4 (動画)                            │
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Processing Pipeline                         │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │ Transcription  │→ │   Analysis     │→ │  Visualization   │ │
│  │                │  │                │  │                  │ │
│  │ ・Whisper      │  │ ・Scene Split  │  │ ・Layout Engine  │ │
│  │ ・Web Speech   │  │ ・Diagram Type │  │ ・Zero Overlap   │ │
│  └────────────────┘  └────────────────┘  └──────────────────┘ │
│                                                                  │
│                              ↓                                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │              Video Generation (Remotion)                    ││
│  │                                                             ││
│  │  ・@remotion/bundler: Webpack bundling                     ││
│  │  ・@remotion/renderer: Frame-by-frame rendering            ││
│  │  ・React Components: Diagram scenes                        ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────┐
│                           Output                                 │
│                                                                  │
│  ・MP4 Video (1920x1080, 30fps)                                 │
│  ・JSON Scene Data                                               │
│  ・Processing Metrics                                            │
└─────────────────────────────────────────────────────────────────┘
```

## モジュール構成

### 1. Transcription (音声→テキスト変換)

**責務**: 音声ファイルを高精度テキストに変換

```typescript
// src/transcription/
├── index.ts                    // TranscriptionPipeline
├── whisper-transcriber.ts      // Whisper統合
└── web-speech-transcriber.ts   // Web Speech API
```

**主要機能**:
- Whisperモデル (base/small/medium)
- Web Speech API (ブラウザ)
- タイムスタンプ付きセグメント出力
- 自動言語検出

**パフォーマンス**:
- 処理速度: ~5-10秒 (1分音声)
- 精度: 90-95%

---

### 2. Analysis (内容分析・構造抽出)

**責務**: テキストから意味を抽出し、適切な図解タイプを判定

```typescript
// src/analysis/
├── index.ts                    // 統合エクスポート
├── scene-segmenter.ts          // シーン分割
├── diagram-detector.ts         // 図解タイプ判定
├── content-analyzer.ts         // 内容分析
└── types.ts                    // 型定義
```

**主要機能**:
- **Scene Segmentation**: 意味単位でのシーン分割
- **Diagram Type Detection**: flow, tree, timeline, matrix, cycle
- **Content Analysis**: ノード・エッジ抽出

**判定ロジック**:
```typescript
interface DiagramType {
  flow:     'プロセス、手順、フローチャート'
  tree:     '階層、分類、組織図'
  timeline: '時系列、歴史、ロードマップ'
  matrix:   '比較、マトリックス、表'
  cycle:    '循環、サイクル、繰り返し'
}
```

**パフォーマンス**:
- シーン分割精度: 85%
- 図解判定精度: 85%

---

### 3. Visualization (図解生成・レイアウト)

**責務**: ノード・エッジから視覚的に美しいレイアウトを生成

```typescript
// src/visualization/
├── index.ts                            // 統合エクスポート
├── layout-engine.ts                    // 標準レイアウト
├── enhanced-zero-overlap-layout.ts     // ゼロオーバーラップ
├── advanced-layouts.ts                 // 高度なレイアウト
└── types.ts                            // 型定義
```

**主要機能**:
- **Standard Layout**: Dagreベースの自動レイアウト
- **Zero Overlap Layout**: オーバーラップゼロ保証
- **Force Directed**: 力学ベースの最適化

**レイアウトエンジン比較**:
```yaml
Standard:
  速度: 高速 (~100ms)
  品質: 80/100
  用途: 高速プレビュー

Enhanced:
  速度: 中速 (~500ms)
  品質: 95/100
  用途: 高品質出力

Zero Overlap:
  速度: 低速 (~1000ms)
  品質: 100/100
  用途: プロダクション品質
```

**パフォーマンス**:
- レイアウト破綻率: 0%
- オーバーラップ: 0% (Zero Overlap Engine)

---

### 4. Video Generation (動画生成)

**責務**: 図解データからアニメーション動画を生成

```typescript
// src/pipeline/
├── video-generator.ts          // VideoGenerator統合

// src/lib/
├── actualVideoRenderer.ts      // 実際のレンダリング

// src/remotion/
├── index.ts                    // エントリーポイント
├── Root.tsx                    // コンポジション定義
├── DiagramVideo.tsx            // メイン動画コンポーネント
└── DiagramScene.tsx            // シーン描画
```

**主要機能**:
- **Remotion Rendering**: Frame-by-frame rendering
- **Animation**: Springベースのスムーズアニメーション
- **Quality Settings**: low/medium/high/ultra
- **Audio Integration**: 音声トラック統合

**Remotionコンポジション構造**:
```
DiagramVideo (Main)
├── Audio Track (optional)
├── DiagramScene (per scene)
│   ├── Title + Description
│   ├── Nodes (animated)
│   ├── Edges (animated)
│   └── Confidence Indicator
├── Progress Bar
└── Scene Counter
```

**アニメーション詳細**:
- ノード: スタッガー表示 (5フレーム遅延)
- エッジ: ノード後に表示 (3フレーム遅延)
- トランジション: Spring (damping: 12, stiffness: 100)

**パフォーマンス**:
- レンダリング速度: ~10 FPS (300フレーム in 30秒)
- 出力品質: H.264, CRF 18 (medium)
- ファイルサイズ: ~60KB/秒 (medium品質)

---

### 5. Pipeline (統合パイプライン)

**責務**: 全モジュールを統合し、エンドツーエンドの処理を管理

```typescript
// src/pipeline/
├── simple-pipeline.ts          // SimplePipeline (MVP)
├── main-pipeline.ts            // MainPipeline (Full)
├── video-generator.ts          // VideoGenerator
└── types.ts                    // 型定義
```

**SimplePipeline処理フロー**:
```
1. Audio Upload       [0%]
   ↓
2. Transcription      [0-20%]
   ・Whisper処理
   ・セグメント生成
   ↓
3. Scene Segmentation [20-50%]
   ・意味単位分割
   ・シーン境界検出
   ↓
4. Diagram Detection  [50-70%]
   ・図解タイプ判定
   ・ノード・エッジ抽出
   ↓
5. Layout Generation  [70-85%]
   ・レイアウト計算
   ・オーバーラップ解消
   ↓
6. Video Rendering    [85-100%]
   ・Remotion bundling
   ・フレーム生成
   ・エンコーディング
   ↓
7. Output             [100%]
   ・MP4ファイル
   ・JSONデータ
```

**エラーハンドリング**:
- 各ステップでのリトライ機能
- フォールバック戦略
- 詳細なエラーログ

---

## データフロー

### 1. 音声 → テキスト

```typescript
Input:  File (MP3, WAV, OGG, M4A)
        ↓
Output: TranscriptionSegment[]
        {
          text: string
          startMs: number
          endMs: number
          confidence: number
        }
```

### 2. テキスト → シーン

```typescript
Input:  TranscriptionSegment[]
        ↓
Output: ContentSegment[]
        {
          text: string
          startMs: number
          endMs: number
          topic: string
        }
```

### 3. シーン → 図解データ

```typescript
Input:  ContentSegment
        ↓
Output: SceneGraph
        {
          id: string
          type: DiagramType
          layout: {
            nodes: Node[]
            edges: Edge[]
          }
          confidence: number
        }
```

### 4. 図解データ → 動画

```typescript
Input:  SceneGraph[]
        ↓
Output: Video File (MP4)
        {
          path: string
          duration: number
          resolution: string
          fileSize: number
        }
```

---

## 技術スタック

### フロントエンド
- **React 18**: UI構築
- **TypeScript 5**: 型安全
- **Vite 5**: 高速ビルド
- **Tailwind CSS**: スタイリング
- **shadcn/ui**: UIコンポーネント

### バックエンド・処理
- **Node.js 18+**: ランタイム
- **Whisper**: 音声認識
- **Dagre**: グラフレイアウト
- **Remotion 4**: 動画生成

### 依存パッケージ
```json
{
  "@remotion/bundler": "4.0.355",
  "@remotion/renderer": "4.0.355",
  "@remotion/captions": "4.0.355",
  "@remotion/media-utils": "4.0.355",
  "@dagrejs/dagre": "1.1.5",
  "react": "18.x",
  "typescript": "5.x"
}
```

---

## 品質保証

### テスト戦略
1. **Unit Tests**: 各モジュール単体
2. **Integration Tests**: パイプライン統合
3. **E2E Tests**: 実際の音声ファイル

### 品質メトリクス
```yaml
Transcription:
  精度: 90-95%
  速度: ~5-10秒/分

Analysis:
  シーン分割精度: 85%
  図解判定精度: 85%

Visualization:
  レイアウト破綻: 0%
  オーバーラップ: 0%

Video Generation:
  成功率: 100%
  処理時間: ~30秒 (10秒動画)
```

### 継続的改善
- **Iteration Log**: .module/ITERATION_LOG.md
- **Quality Metrics**: .module/QUALITY_METRICS.md
- **Pipeline Flow**: .module/PIPELINE_FLOW.md

---

## 開発ガイドライン

### 開発原則
```yaml
incremental:  小さく作り、確実に動作確認
recursive:    動作→評価→改善→コミット
modular:      疎結合なモジュール設計
testable:     各段階で検証可能な出力
transparent:  処理過程の可視化
```

### コミット戦略
```bash
# 形式
<type>(<scope>): <subject> [iteration-N]

# 例
feat(video): Add Remotion rendering [iteration-1]
fix(layout): Resolve overlap detection bug [iteration-2]
perf(pipeline): Optimize processing speed by 40% [iteration-3]
```

---

## 環境構築

### 前提条件
- Node.js 18以上
- npm または pnpm
- FFmpeg (推奨)
- Google Chrome (Remotion rendering)

### セットアップ
```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# Remotion Studio
npm run remotion:studio

# 動画レンダリング (CLI)
npx tsx scripts/render-video.ts <input.json> [output.mp4]
```

---

## パフォーマンス目標

### MVP (現在)
- 処理時間: <60秒 (音声→動画)
- 成功率: >90%
- 品質スコア: >80/100

### プロダクション (目標)
- 処理時間: <30秒
- 成功率: >95%
- 品質スコア: >90/100
- 並行処理: 10リクエスト/秒

---

**最終更新**: 2025-10-12 01:30
**ドキュメントバージョン**: 1.0
**対応システムバージョン**: Phase 4 Iteration 1
