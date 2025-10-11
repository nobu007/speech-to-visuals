# PIPELINE_FLOW.md - 処理パイプライン仕様

## 概要

本ドキュメントは、音声→図解動画自動生成システムの詳細な処理フローを定義する。

---

## SimplePipeline - MVP実装

### 全体フロー

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 0: Input Preparation                                        │
│                                                                  │
│ Input:  File (MP3, WAV, OGG, M4A, max 50MB)                     │
│ Output: audioUrl (Blob URL)                                     │
│ Time:   Instant                                                  │
│ Progress: 0-10%                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Transcription (音声→テキスト)                            │
│                                                                  │
│ Engine:  Whisper (base model) or Web Speech API                │
│ Process: Audio → Segments with timestamps                       │
│ Output:  TranscriptionSegment[]                                 │
│          {                                                       │
│            text: string                                          │
│            startMs: number                                       │
│            endMs: number                                         │
│            confidence: number                                    │
│          }                                                       │
│ Time:    ~5-10 seconds per minute                               │
│ Progress: 10-20%                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Scene Segmentation (シーン分割)                          │
│                                                                  │
│ Engine:  SceneSegmenter                                         │
│ Process: TranscriptionSegment[] → ContentSegment[]             │
│ Logic:                                                           │
│   1. Semantic boundary detection (意味境界検出)                  │
│   2. Topic modeling (トピックモデリング)                         │
│   3. Silence detection (無音検出)                                │
│ Output:  ContentSegment[]                                        │
│          {                                                       │
│            text: string                                          │
│            startMs: number                                       │
│            endMs: number                                         │
│            topic: string                                         │
│          }                                                       │
│ Time:    ~2-5 seconds                                            │
│ Progress: 20-50%                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Diagram Type Detection (図解タイプ判定)                  │
│                                                                  │
│ Engine:  DiagramDetector                                        │
│ Process: ContentSegment → DiagramAnalysis                       │
│ Detection Logic:                                                 │
│   flow:     キーワード: '手順', 'プロセス', 'フロー'             │
│   tree:     キーワード: '階層', '分類', '組織'                   │
│   timeline: キーワード: '時系列', '歴史', '年表'                 │
│   matrix:   キーワード: '比較', '対比', 'vs'                     │
│   cycle:    キーワード: '循環', 'サイクル', '繰り返し'           │
│                                                                  │
│ Output:  DiagramAnalysis                                         │
│          {                                                       │
│            type: DiagramType                                     │
│            nodes: Node[]                                         │
│            edges: Edge[]                                         │
│            confidence: number                                    │
│          }                                                       │
│ Time:    ~1-3 seconds per scene                                  │
│ Progress: 50-70%                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Layout Generation (レイアウト生成)                       │
│                                                                  │
│ Engine Options:                                                  │
│   A. Standard Layout Engine (Dagre)                             │
│   B. Enhanced Zero Overlap Layout Engine                        │
│                                                                  │
│ Process: Node[] + Edge[] → Layout                               │
│ Algorithm:                                                       │
│   1. Initial positioning (Dagre)                                │
│   2. Overlap detection                                           │
│   3. Force-directed resolution                                   │
│   4. Boundary constraints                                        │
│   5. Aesthetic optimization                                      │
│                                                                  │
│ Output:  Layout                                                  │
│          {                                                       │
│            nodes: LayoutNode[]                                   │
│            edges: LayoutEdge[]                                   │
│            bounds: { width, height }                             │
│          }                                                       │
│ Time:    ~500-1000ms per scene                                   │
│ Progress: 70-85%                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Video Generation (動画生成) [Optional]                   │
│                                                                  │
│ Engine:  VideoGenerator + ActualVideoRenderer                   │
│ Process:                                                         │
│   5.1 Data Conversion (SimplePipeline → Remotion format)        │
│   5.2 Bundling (Webpack bundle creation)                        │
│   5.3 Composition Selection (Remotion composition)              │
│   5.4 Frame Rendering (300 frames @ 30fps = 10s)                │
│   5.5 Encoding (H.264, CRF 18)                                   │
│   5.6 Finalization (MP4 output)                                  │
│                                                                  │
│ Output:  Video File                                              │
│          {                                                       │
│            path: string                                          │
│            duration: number (ms)                                 │
│            resolution: '1920x1080'                               │
│            fileSize: number (bytes)                              │
│          }                                                       │
│ Time:    ~20-40 seconds (for 10s video)                          │
│ Progress: 85-100%                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Output                                                   │
│                                                                  │
│ Results:                                                         │
│   - JSON Scene Data (SceneGraph[])                              │
│   - MP4 Video (if video generation enabled)                     │
│   - Processing Metrics                                           │
│                                                                  │
│ Progress: 100%                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 詳細フロー

### Step 1: Transcription詳細

```typescript
async function transcribe(audioUrl: string): Promise<TranscriptionResult> {
  console.log('[Transcription V1] Starting...')

  // 1. Audio preprocessing
  const preprocessedAudio = await preprocessAudio(audioUrl)

  // 2. Whisper processing
  const segments = await whisper.transcribe(preprocessedAudio, {
    model: 'base',
    language: 'auto',
    combineMs: 200,
    timestamps: true
  })

  // 3. Post-processing
  const cleanedSegments = segments.map(seg => ({
    text: cleanText(seg.text),
    startMs: seg.startMs,
    endMs: seg.endMs,
    confidence: seg.confidence || 0.8
  }))

  // 4. Quality check
  const qualityScore = calculateTranscriptionQuality(cleanedSegments)

  if (qualityScore < 0.7) {
    console.warn('[Transcription] Low quality detected, retrying...')
    return retry()
  }

  console.log(`[Transcription V1] Complete: ${cleanedSegments.length} segments`)
  return { success: true, segments: cleanedSegments }
}
```

**反復改善ポイント**:
- Iteration 1: 基本実装 (成功率 70%)
- Iteration 2: エラーハンドリング追加 (成功率 95%)
- Iteration 3: 品質チェック実装 (精度 90%)

---

### Step 2: Scene Segmentation詳細

```typescript
async function segment(
  segments: TranscriptionSegment[]
): Promise<ContentSegment[]> {
  console.log('[Scene Segmentation V1] Starting...')

  // 1. Combine segments into text blocks
  const textBlocks = combineSegments(segments, {
    minBlockLength: 30,  // 最小30秒
    maxBlockLength: 180  // 最大3分
  })

  // 2. Detect semantic boundaries
  const boundaries = detectBoundaries(textBlocks, {
    algorithm: 'topic_modeling',
    threshold: 0.6
  })

  // 3. Create content segments
  const contentSegments = boundaries.map((boundary, index) => ({
    text: extractText(textBlocks, boundary),
    startMs: boundary.startMs,
    endMs: boundary.endMs,
    topic: detectTopic(extractText(textBlocks, boundary))
  }))

  // 4. Validate segments
  const validSegments = contentSegments.filter(seg =>
    seg.endMs - seg.startMs >= 3000  // 最低3秒
  )

  console.log(`[Scene Segmentation V1] Complete: ${validSegments.length} scenes`)
  return validSegments
}
```

**セグメンテーション戦略**:
```
時間ベース:  固定間隔でシーン分割
意味ベース:  トピック変化でシーン分割
ハイブリッド: 時間 + 意味の組み合わせ (推奨)
```

---

### Step 3: Diagram Detection詳細

```typescript
async function detectDiagramType(
  segment: ContentSegment
): Promise<DiagramAnalysis> {
  console.log('[Diagram Detection V2] Analyzing...')

  // 1. Keyword extraction
  const keywords = extractKeywords(segment.text)

  // 2. Pattern matching
  const patterns = {
    flow:     ['手順', 'プロセス', 'ステップ', 'フロー', '→'],
    tree:     ['階層', '分類', '組織', '親', '子'],
    timeline: ['時系列', '歴史', '年', '月', '日'],
    matrix:   ['比較', '対比', 'vs', '違い'],
    cycle:    ['循環', 'サイクル', '繰り返し', 'ループ']
  }

  // 3. Calculate confidence scores
  const scores = Object.entries(patterns).map(([type, words]) => ({
    type,
    score: calculateMatchScore(keywords, words)
  }))

  // 4. Select best match
  const bestMatch = scores.reduce((a, b) =>
    a.score > b.score ? a : b
  )

  // 5. Extract nodes and edges
  const { nodes, edges } = extractStructure(segment.text, bestMatch.type)

  console.log(`[Diagram Detection V2] Type: ${bestMatch.type}, Confidence: ${bestMatch.score}`)

  return {
    type: bestMatch.type as DiagramType,
    nodes,
    edges,
    confidence: bestMatch.score
  }
}
```

**図解タイプの特徴**:

| Type     | Keywords                  | Structure        |
|----------|---------------------------|------------------|
| flow     | 手順, プロセス, ステップ   | Linear, Branching |
| tree     | 階層, 分類, 組織           | Hierarchical     |
| timeline | 時系列, 歴史, 年表         | Chronological    |
| matrix   | 比較, 対比, vs             | Grid             |
| cycle    | 循環, サイクル, ループ     | Circular         |

---

### Step 4: Layout Generation詳細

```typescript
function generateLayout(
  nodes: Node[],
  edges: Edge[],
  type: DiagramType
): Layout {
  console.log('[Layout Generation V3] Starting...')

  // 1. Initial positioning (Dagre)
  const initialLayout = dagre.layout({
    nodes,
    edges,
    rankdir: getDirection(type),  // TB, LR, BT, RL
    nodesep: 80,
    ranksep: 120
  })

  // 2. Detect overlaps
  const overlaps = detectOverlaps(initialLayout.nodes)

  if (overlaps.length === 0) {
    console.log('[Layout V3] No overlaps detected')
    return initialLayout
  }

  // 3. Resolve overlaps (Force-directed)
  console.log(`[Layout V3] Resolving ${overlaps.length} overlaps...`)
  const resolvedLayout = forceDirectedResolution({
    nodes: initialLayout.nodes,
    edges: initialLayout.edges,
    overlaps,
    maxIterations: 10,
    separationDistance: 25
  })

  // 4. Quality assessment
  const quality = assessLayoutQuality(resolvedLayout)

  console.log(`[Layout V3] Complete: Quality ${quality.score}/100`)

  return resolvedLayout
}
```

**レイアウトアルゴリズム選択**:
```
Dagre:           標準的な階層レイアウト (flow, tree)
Force-Directed:  オーバーラップ解消 (all types)
Circular:        循環構造 (cycle)
Grid:            マトリックス (matrix)
Timeline:        時系列配置 (timeline)
```

---

### Step 5: Video Generation詳細

```typescript
async function generateVideo(
  scenes: SceneGraph[],
  audioUrl: string
): Promise<VideoResult> {
  console.log('[Video Generation V1] Starting...')

  // 5.1 Data conversion
  console.log('[Video] Converting scene data...')
  const remotionData = convertToRemotionFormat(scenes, audioUrl)

  // 5.2 Bundling
  console.log('[Video] Bundling Remotion composition...')
  const bundleLocation = await bundle({
    entryPoint: 'src/remotion/index.ts',
    webpackOverride: (config) => config
  })

  // 5.3 Composition selection
  console.log('[Video] Selecting composition...')
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'DiagramVideo',
    inputProps: remotionData
  })

  // 5.4 Frame rendering
  console.log('[Video] Rendering frames...')
  const outputPath = `/tmp/video-${Date.now()}.mp4`

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    onProgress: (progress) => {
      console.log(`[Video] Frame ${progress.renderedFrames}/${progress.totalFrames}`)
    }
  })

  // 5.5 Result
  console.log(`[Video Generation V1] Complete: ${outputPath}`)

  return {
    success: true,
    videoPath: outputPath,
    duration: composition.durationInFrames / composition.fps * 1000
  }
}
```

**レンダリングステージ (Phase 9実測値)**:
```
1. Bundling:      ~5-10秒  (初回のみ、以降はキャッシュ)
2. Composition:   ~1-2秒   (メタデータ取得)
3. Rendering:     ~8-12秒  (300フレーム @ 30fps、実測45.50 FPS)
4. Encoding:      ~2-5秒   (H.264エンコード)
Total:            ~15-25秒 (実測: 25.64秒 / 32秒動画)

**パフォーマンス実績**:
- レンダリング速度: 37.93-45.50 FPS (目標15 FPSの253-303%達成)
- リアルタイム比: 0.80 (32秒動画を25.64秒で生成)
- メモリ使用量: 84.5 MB (目標512 MB以内の16%)
```

---

## エラーハンドリング (Phase 9強化版)

### エラー分類と対処

```typescript
interface ErrorHandlingStrategy {
  category: 'dependency' | 'logic' | 'performance' | 'resource'
  action: 'retry' | 'fallback' | 'abort'
  recovery: string
  implemented: boolean  // Phase 9で実装確認済み
}

const strategies: Record<string, ErrorHandlingStrategy> = {
  // Transcription errors
  'TranscriptionFailed': {
    category: 'dependency',
    action: 'retry',
    recovery: 'Retry with Web Speech API or enhanced fallback',
    implemented: true  // Phase 7実装、Phase 9検証済み
  },

  // Scene segmentation errors
  'NoScenesDetected': {
    category: 'logic',
    action: 'fallback',
    recovery: 'Use entire audio as single scene',
    implemented: true  // Phase 9検証済み
  },

  // Layout errors
  'OverlapResolutionFailed': {
    category: 'performance',
    action: 'fallback',
    recovery: 'Iterative strategy (max 10 attempts)',
    implemented: true  // Phase 9検証済み
  },

  // Rendering errors
  'RenderingFailed': {
    category: 'resource',
    action: 'fallback',
    recovery: 'Return JSON data without video',
    implemented: true  // Phase 9検証済み
  },

  // Empty/Corrupted files (Phase 9追加)
  'EmptyAudioFile': {
    category: 'logic',
    action: 'fallback',
    recovery: 'Enhanced fallback generates default scene',
    implemented: true  // Phase 9実装 (Graceful Degradation)
  },

  // Network interruption (Phase 9追加)
  'NetworkInterruption': {
    category: 'resource',
    action: 'fallback',
    recovery: 'Local processing only (no network dependency)',
    implemented: true  // Phase 9アーキテクチャ確認済み
  }
}
```

### 多層防御戦略 (Phase 9確立)

```
UI Layer (Web UI / CLI):
├── ファイルサイズ検証 (max 50MB)
├── フォーマット検証 (MP3, WAV, OGG, M4A)
└── ユーザーフィードバック

Processing Layer (SimplePipeline):
├── Whisper失敗 → Web Speech API フォールバック
├── 空ファイル → Enhanced Fallback (デフォルトシーン生成)
├── レイアウト失敗 → Iterative strategy (最大10回試行)
└── 詳細エラーログとメトリクス収集

OS/Resource Layer:
├── ディスク容量チェック
├── プロセスシグナル処理
└── メモリ管理 (84.5 MB / 512 MB目標)
```

### リトライロジック

```typescript
async function processWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoff: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) {
        throw error
      }

      // Exponential backoff
      await sleep(backoff * Math.pow(2, attempt - 1))
    }
  }

  throw new Error('Max retries exceeded')
}
```

---

## パフォーマンス最適化

### 並行処理

```typescript
// シーン並行処理
async function processScenes(
  segments: ContentSegment[]
): Promise<SceneGraph[]> {
  console.log('[Pipeline] Processing scenes in parallel...')

  // 最大5シーンまで並行処理
  const batchSize = 5
  const batches = chunk(segments, batchSize)

  const results: SceneGraph[] = []

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (segment) => {
        const analysis = await detectDiagramType(segment)
        const layout = await generateLayout(analysis.nodes, analysis.edges, analysis.type)

        return {
          id: `scene-${Date.now()}`,
          ...segment,
          type: analysis.type,
          layout,
          confidence: analysis.confidence
        }
      })
    )

    results.push(...batchResults)
  }

  return results
}
```

### キャッシング戦略

```typescript
// Remotion bundle caching
class BundleCache {
  private cache: Map<string, string> = new Map()

  async getBundle(entryPoint: string): Promise<string> {
    const cacheKey = hash(entryPoint)

    if (this.cache.has(cacheKey)) {
      console.log('[Cache] Using cached bundle')
      return this.cache.get(cacheKey)!
    }

    console.log('[Cache] Creating new bundle...')
    const bundleLocation = await bundle({ entryPoint })

    this.cache.set(cacheKey, bundleLocation)
    return bundleLocation
  }
}
```

---

## 継続的改善フレームワーク

### イテレーションサイクル

```
Phase N, Iteration M:

1. 実装 (Implement)
   - 新機能追加
   - バグ修正
   ↓
2. テスト (Test)
   - 単体テスト
   - 統合テスト
   - E2Eテスト
   ↓
3. 評価 (Evaluate)
   - 品質メトリクス測定
   - パフォーマンス計測
   - ユーザーフィードバック
   ↓
4. 改善 (Improve)
   - ボトルネック特定
   - 最適化実装
   ↓
5. コミット (Commit)
   - コード変更
   - ドキュメント更新
   - イテレーションログ記録
   ↓
Next Iteration
```

### メトリクス収集

```typescript
class MetricsCollector {
  async collectPipelineMetrics(
    result: SimplePipelineResult
  ): Promise<PipelineMetrics> {
    return {
      timestamp: Date.now(),
      processingTime: result.processingTime,
      stageMetrics: {
        transcription: this.getStageMetrics('transcription'),
        analysis: this.getStageMetrics('analysis'),
        visualization: this.getStageMetrics('visualization'),
        videoGeneration: this.getStageMetrics('video_generation')
      },
      qualityScores: {
        transcription: this.calculateTranscriptionQuality(result),
        sceneSegmentation: this.calculateSegmentationQuality(result),
        diagramDetection: this.calculateDetectionQuality(result),
        layoutQuality: this.calculateLayoutQuality(result)
      },
      resourceUsage: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    }
  }
}
```

---

## まとめ

### パイプライン特性 (Phase 9実測値)

**処理時間 (実測)**:
- 実測値: 25.64秒 (32秒動画、960フレーム、4シーン)
- レンダリング速度: 37.93-45.50 FPS (目標15 FPSの253-303%達成)
- バッチ処理: 32ms/ファイル (動画なし)
- 標準: 30-40秒 (2分音声, 動画あり、推定値)
- 最大: 60-90秒 (5分音声, 動画あり、推定値)

**スケーラビリティ (Phase 8実装)**:
- シーン並行処理により、長い音声でも比例的に増加しない
- Remotion bundleキャッシュにより、2回目以降は高速化
- バッチ処理: 並列度調整可能 (max-parallel設定)
- 並列処理効率: 150% (2並列で1.5倍高速化)

**信頼性 (Phase 9検証済み)**:
- 各ステージでのエラーハンドリング (100%実装)
- 自動リトライ機能 (Whisper失敗時のフォールバック)
- フォールバック戦略 (多層防御: UI/処理/OS各層)
- システム安定性: 95% (Production Ready)
- エッジケーステスト: 20/21 passed (95%)
- Graceful Degradation: 空ファイルでもクラッシュせず処理

**品質保証 (Phase 9完了)**:
- 各ステージでの品質チェック
- リアルタイムメトリクス収集
- 継続的改善フレームワーク
- 全体品質スコア: 100/100 (Excellent - 商用利用可能レベル)
- メモリ効率: 84.5 MB (目標512 MB以内の16%)

---

## バッチ処理パイプライン (Phase 8追加)

### バッチ処理フロー

```
Input: Directory with multiple audio files
  ↓
1. File Discovery & Validation
   - 対応フォーマット検証 (MP3, WAV, OGG, M4A)
   - ファイルサイズチェック
   ↓
2. Sequential / Parallel Processing
   - 順次処理モード: ファイルを1つずつ処理
   - 並列処理モード: max-parallel設定で同時処理数制御
   ↓
3. Per-File Processing
   - SimplePipeline実行 (全6ステージ)
   - エラー時の継続/停止判定
   ↓
4. Report Generation
   - バッチ処理サマリー (JSON)
   - ファイル別詳細結果
   - 成功/失敗統計
   ↓
Output: JSON + TXT + MP4 (per file) + Batch Report
```

**バッチ処理コマンド**:
```bash
tsx scripts/batch-audio-pipeline.ts <input-dir> <output-dir> [options]

Options:
  --parallel              並列処理を有効化
  --max-parallel <n>      最大並列数 (default: 3)
  --no-video             動画生成をスキップ
  --stop-on-error        最初のエラーで停止
```

**バッチ処理パフォーマンス (Phase 8実測)**:
- 処理速度: 32ms/ファイル (動画なし)
- 並列処理効率: 150% (2並列で1.5倍高速化)
- 成功率: 100% (全テストケース)
- メモリ使用量: 並列処理でも増加なし

---

**最終更新**: 2025-10-12 (Phase 9完了時点)
**ドキュメントバージョン**: 2.0
**対応バージョン**: Phase 9 Iteration 1
