# 統合開発ロードマップ - カスタムインストラクション準拠モード

**作成日時**: 2025-10-10 19:44 JST
**対象システム**: 音声→図解動画自動生成システム (speech-to-visuals)
**現在の状態**: Iteration 66 Complete (98.4% Quality Score)
**戦略**: ハイブリッド・フォワードモード

---

## 🎯 戦略概要

### 基本方針: "成熟システム + MVP原則の融合"

```yaml
既存資産:
  - 66イテレーション分の実装完了
  - Production Ready (98.4%品質スコア)
  - 15モジュール × 5カテゴリ = 75+ファイル

カスタムインストラクション:
  - "小さく作り、確実に動作確認"
  - "動作→評価→改善→コミットの繰り返し"
  - "疎結合なモジュール設計"

統合アプローチ:
  ✅ 既存システム = ベースライン維持
  🔄 新規開発 = MVP原則適用
  📚 ドキュメント = 統一された知識ベース
  🤖 自動化 = 継続的改善フレームワーク
```

---

## 📅 段階的実装計画

### Phase 0: 現状整理・基盤準備 (1週間)

#### 🎯 目標: カスタムインストラクション準拠の環境構築

#### Day 1-2: ドキュメント統合

**アクション**:
```bash
# 1. .module/ 構造をカスタムインストラクション準拠に再編
mkdir -p .module/{core,phases,iterations,quality}

# 2. コアドキュメント作成
cat > .module/core/SYSTEM_CORE.md << 'EOF'
# システムコアアーキテクチャ定義
## モジュール構成
## 依存関係マップ
## 技術スタック
EOF

cat > .module/core/PIPELINE_FLOW.md << 'EOF'
# 処理パイプライン仕様
## 音声入力 → 動画出力のフロー
## 各ステージの入出力定義
## エラーハンドリング戦略
EOF

cat > .module/core/QUALITY_METRICS.md << 'EOF'
# 品質評価基準
## 各フェーズの成功基準
## パフォーマンス目標
## 継続的改善指標
EOF

# 3. 既存ドキュメントの整理
mkdir -p .module/archive/iteration-reports
mv ITERATION_*_COMPLETE.md .module/archive/iteration-reports/
mv *_ACHIEVEMENT_*.md .module/archive/iteration-reports/
mv *_COMPLETION_REPORT.md .module/archive/iteration-reports/

# 4. イテレーションログの統合
cat > .module/iterations/ITERATION_LOG.md << 'EOF'
# 開発履歴と学習事項

## Iteration 1-10: 基礎構築
## Iteration 11-30: 機能拡張
## Iteration 31-50: 最適化・統合
## Iteration 51-66: Production Ready達成
## Iteration 67+: カスタムインストラクション準拠モード
EOF
```

**成功基準**:
```yaml
ドキュメント構造:
  ✅ .module/core/ 配下に3つのコアドキュメント
  ✅ .module/iterations/ 配下に統合ログ
  ✅ .module/archive/ 配下に既存レポート整理
  ✅ README.md の更新 (新構造への案内)

可読性:
  ✅ 各ドキュメントがマークダウン形式
  ✅ 図表・コードブロック・YAML記法の活用
  ✅ クロスリファレンスの整備
```

---

#### Day 3-4: コードベース整理

**アクション**:
```bash
# 1. MVP版の明確な識別
cat > src/pipeline/README.md << 'EOF'
# Pipeline Modules

## MVP版 (カスタムインストラクション準拠)
- `simple-pipeline.ts` - 最小限の機能実装
- `mvp-pipeline.ts` - MVP要件完全実装

## Enterprise版 (Production Ready)
- `audio-diagram-pipeline.ts` - フル機能統合
- `iteration-*-pipeline.ts` - 各イテレーション特化版
- `framework-integrated-pipeline.ts` - AI統合版

## 選択ガイド
- 学習目的・軽量実装: simple-pipeline.ts
- 本番環境・高度機能: audio-diagram-pipeline.ts
EOF

# 2. 依存関係の可視化
npm install --save-dev madge

# 依存関係グラフ生成
npx madge --image dependency-graph.svg src/

# 循環依存チェック
npx madge --circular src/

# 3. 未使用コードの検出
npm install --save-dev ts-prune
npx ts-prune > unused-exports.txt

# 4. 型定義の統一
mkdir -p src/types/core
cat > src/types/core/pipeline.ts << 'EOF'
/**
 * Core Pipeline Types
 * カスタムインストラクション準拠の型定義
 */

export interface PipelineInput {
  audioFile: File;
  options?: PipelineOptions;
}

export interface PipelineResult {
  success: boolean;
  audioUrl?: string;
  transcript?: string;
  scenes?: SceneGraph[];
  videoUrl?: string;
  error?: string;
  metrics?: QualityMetrics;
}

export interface QualityMetrics {
  processingTime: number;
  qualityScore: number;
  iterationNumber: number;
  successCriteria: Record<string, boolean>;
}
EOF
```

**成功基準**:
```yaml
コード品質:
  ✅ 循環依存: 0件
  ✅ 未使用エクスポート: <5%
  ✅ 型定義カバレッジ: >95%
  ✅ ESLint警告: 0件

ドキュメント:
  ✅ 各ディレクトリにREADME.md
  ✅ 依存関係グラフの自動生成
  ✅ 型定義の統一・整理
```

---

#### Day 5-7: テスト整備

**アクション**:
```bash
# 1. テストフレームワーク導入
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8

# vitest.config.ts 作成
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/',
        'tests/'
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
EOF

# 2. ユニットテスト作成 (MVP版を優先)
mkdir -p tests/unit/{transcription,analysis,visualization,pipeline}

cat > tests/unit/transcription/transcriber.test.ts << 'EOF'
import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptionPipeline } from '@/transcription/transcriber';

describe('TranscriptionPipeline - MVP', () => {
  let pipeline: TranscriptionPipeline;

  beforeEach(() => {
    pipeline = new TranscriptionPipeline();
  });

  it('should initialize with default config', () => {
    expect(pipeline).toBeDefined();
  });

  it('should transcribe audio file successfully', async () => {
    // Mock audio file
    const mockAudioPath = 'blob:http://localhost:5173/test-audio';

    const result = await pipeline.transcribe(mockAudioPath);

    // カスタムインストラクション成功基準
    expect(result.success).toBe(true);
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.processingTime).toBeLessThan(60000); // <60秒
  });

  it('should handle errors gracefully', async () => {
    const invalidPath = 'invalid://path';

    const result = await pipeline.transcribe(invalidPath);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should track iterations correctly', () => {
    expect(pipeline['iteration']).toBe(1);

    pipeline.nextIteration();
    expect(pipeline['iteration']).toBe(2);
  });
});
EOF

# 3. 統合テスト作成
mkdir -p tests/integration

cat > tests/integration/simple-pipeline.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { SimplePipeline } from '@/pipeline/simple-pipeline';

describe('SimplePipeline - E2E Integration', () => {
  it('should complete full pipeline successfully', async () => {
    const pipeline = new SimplePipeline();

    // Mock audio file
    const mockFile = new File(['mock audio data'], 'test.mp3', {
      type: 'audio/mp3'
    });

    const result = await pipeline.process({
      audioFile: mockFile,
      options: {
        includeVideoGeneration: false // 高速化のため無効
      }
    });

    // カスタムインストラクション MVP成功基準
    expect(result.success).toBe(true);
    expect(result.transcript).toBeDefined();
    expect(result.scenes).toBeDefined();
    expect(result.scenes!.length).toBeGreaterThan(0);
    expect(result.processingTime).toBeLessThan(180000); // <3分
  });

  it('should calculate quality score correctly', () => {
    const pipeline = new SimplePipeline();
    const metrics = pipeline.getProgressiveMetrics();

    expect(metrics.iterationCount).toBe(0); // 初期状態
  });
});
EOF

# 4. テスト実行スクリプト追加
npm set-script test "vitest"
npm set-script test:ui "vitest --ui"
npm set-script test:coverage "vitest --coverage"

# 5. テスト実行
npm run test:coverage
```

**成功基準**:
```yaml
テストカバレッジ:
  ✅ ユニットテスト: >80%
  ✅ 統合テスト: >70%
  ✅ E2Eテスト: >60%

テスト実行:
  ✅ すべてのテストがパス
  ✅ 実行時間 <2分
  ✅ CI/CD対応準備完了

ドキュメント:
  ✅ tests/README.md 作成
  ✅ テスト戦略の明文化
  ✅ カバレッジレポートの自動生成
```

---

### Phase 1: MVP版の再定義と抽出 (3日間)

#### 🎯 目標: カスタムインストラクション完全準拠のMVP版構築

#### Iteration 67.1: MVP Core Pipeline

**実装範囲** (カスタムインストラクション Phase 1-3準拠):
```typescript
// src/mvp/core-pipeline.ts
/**
 * MVP Core Pipeline
 * カスタムインストラクション完全準拠版
 *
 * 目標:
 * - 音声入力 → 字幕付き動画出力が動作
 * - 処理時間 <3分 (10分音声)
 * - メモリ使用量 <512MB
 * - 成功率 >80%
 */

export class MVPCorePipeline {
  // ✅ 最小限の依存関係
  private transcription: MinimalTranscriber;
  private segmenter: SimpleSegmenter;
  private detector: RuleBasedDetector;
  private layoutEngine: BasicLayoutEngine;
  private videoGenerator: RemotionBasicRenderer;

  // ✅ イテレーション管理
  private currentIteration: number = 1;
  private iterationLog: IterationLogEntry[] = [];

  constructor() {
    // 最小限の設定
    this.transcription = new MinimalTranscriber({
      model: 'base',
      maxRetries: 2
    });

    this.segmenter = new SimpleSegmenter({
      minSceneLength: 30
    });

    this.detector = new RuleBasedDetector();

    this.layoutEngine = new BasicLayoutEngine({
      width: 1920,
      height: 1080
    });

    this.videoGenerator = new RemotionBasicRenderer();
  }

  /**
   * MVP処理メソッド
   * カスタムインストラクション execution_protocol 準拠
   */
  async process(audioFile: File): Promise<MVPResult> {
    console.log(`[MVP V${this.currentIteration}] Processing started`);

    const startTime = performance.now();

    try {
      // Step 1: 音声→テキスト変換
      const transcriptResult = await this.transcription.transcribe(audioFile);
      this.evaluateStep('transcription', transcriptResult);

      // Step 2: シーン分割
      const scenes = await this.segmenter.segment(transcriptResult.segments);
      this.evaluateStep('segmentation', { scenes });

      // Step 3: 図解タイプ判定
      const diagramScenes = await this.detector.detectAll(scenes);
      this.evaluateStep('detection', { diagramScenes });

      // Step 4: レイアウト生成
      const layoutScenes = await this.layoutEngine.generateLayouts(diagramScenes);
      this.evaluateStep('layout', { layoutScenes });

      // Step 5: 動画生成
      const videoUrl = await this.videoGenerator.generate(layoutScenes);
      this.evaluateStep('video', { videoUrl });

      const processingTime = performance.now() - startTime;

      // 総合評価
      const qualityScore = this.calculateMVPQualityScore({
        transcriptLength: transcriptResult.segments.length,
        sceneCount: layoutScenes.length,
        processingTime
      });

      // イテレーションログ記録
      this.logIteration({
        iteration: this.currentIteration,
        timestamp: new Date().toISOString(),
        success: true,
        processingTime,
        qualityScore,
        notes: 'MVP processing completed successfully'
      });

      console.log(`[MVP V${this.currentIteration}] ✅ Success (${processingTime.toFixed(0)}ms)`);

      return {
        success: true,
        videoUrl,
        transcript: transcriptResult.text,
        scenes: layoutScenes,
        processingTime,
        qualityScore,
        iteration: this.currentIteration
      };

    } catch (error) {
      console.error(`[MVP V${this.currentIteration}] ❌ Error:`, error);

      // エラーログ記録
      this.logIteration({
        iteration: this.currentIteration,
        timestamp: new Date().toISOString(),
        success: false,
        processingTime: performance.now() - startTime,
        qualityScore: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        notes: 'Need improvement - review error logs'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        iteration: this.currentIteration
      };
    }
  }

  /**
   * 各ステップの評価
   * カスタムインストラクション evaluate フェーズ
   */
  private evaluateStep(stepName: string, result: any): void {
    console.log(`[MVP] ${stepName} completed:`, {
      success: !!result,
      details: Object.keys(result)
    });

    // 成功基準チェック
    const criteria = this.getSuccessCriteria(stepName);
    const passed = this.checkCriteria(result, criteria);

    if (!passed) {
      console.warn(`[MVP] ⚠️ ${stepName} did not meet all criteria`);
    }
  }

  /**
   * MVP品質スコア計算
   * シンプルかつ明確な指標
   */
  private calculateMVPQualityScore(metrics: {
    transcriptLength: number;
    sceneCount: number;
    processingTime: number;
  }): number {
    let score = 0;

    // 文字起こし品質 (40点)
    if (metrics.transcriptLength > 0) {
      score += 40;
    }

    // シーン検出品質 (30点)
    if (metrics.sceneCount > 0) {
      score += 30;
    }

    // パフォーマンス (30点)
    const targetTime = 180000; // 3分
    if (metrics.processingTime < targetTime) {
      const performanceScore = (1 - metrics.processingTime / targetTime) * 30;
      score += performanceScore;
    }

    return Math.min(score, 100);
  }

  /**
   * イテレーションログ記録
   * カスタムインストラクション commit フェーズ
   */
  private logIteration(entry: IterationLogEntry): void {
    this.iterationLog.push(entry);

    // .module/ITERATION_LOG.md に追記
    // (実装は省略 - ファイルシステムアクセス)
  }

  /**
   * 次のイテレーションへ移行
   */
  public nextIteration(): void {
    this.currentIteration++;
    console.log(`[MVP] 🔄 Moving to iteration ${this.currentIteration}`);
  }

  /**
   * MVP統計情報取得
   */
  public getStatistics() {
    return {
      currentIteration: this.currentIteration,
      totalRuns: this.iterationLog.length,
      successRate: this.iterationLog.filter(log => log.success).length / this.iterationLog.length * 100,
      averageProcessingTime: this.iterationLog.reduce((sum, log) => sum + log.processingTime, 0) / this.iterationLog.length,
      averageQualityScore: this.iterationLog.reduce((sum, log) => sum + log.qualityScore, 0) / this.iterationLog.length
    };
  }
}
```

**実装手順**:
```yaml
Day 1 (Morning):
  1. src/mvp/ ディレクトリ作成
  2. MinimalTranscriber 実装 (既存コードから抽出)
  3. SimpleSegmenter 実装 (最小限のロジック)

Day 1 (Afternoon):
  4. RuleBasedDetector 実装 (V1版)
  5. BasicLayoutEngine 実装 (Dagreのみ使用)
  6. ユニットテスト作成・実行

Day 2 (Morning):
  7. RemotionBasicRenderer 実装
  8. MVPCorePipeline 統合
  9. E2Eテスト実行

Day 2 (Afternoon):
  10. イテレーション1の評価
  11. 問題点の特定
  12. イテレーション2の計画策定

Day 3:
  13. イテレーション2の実装 (精度改善)
  14. イテレーション3の実装 (パフォーマンス最適化)
  15. MVP版の完成・ドキュメント作成
```

**成功基準** (カスタムインストラクション準拠):
```yaml
Iteration 1:
  ✅ 音声入力 → 動画出力が動作
  ✅ 処理成功率 >50%
  ✅ クラッシュなし

Iteration 2:
  ✅ 処理成功率 >70%
  ✅ 処理時間 <5分 (10分音声)
  ✅ 基本的なエラーハンドリング

Iteration 3:
  ✅ 処理成功率 >80%
  ✅ 処理時間 <3分 (10分音声)
  ✅ メモリ使用量 <512MB
  ✅ MVP完成
```

---

### Phase 2: Enterprise機能の段階的拡張 (2週間)

#### Iteration 67.2-67.5: API開発 (カスタムインストラクション原則適用)

**アプローチ**:
- **MVP First**: 最小限のAPIから開始
- **Iterative Enhancement**: 3-5イテレーションで段階的に機能追加
- **Continuous Evaluation**: 各イテレーション後に評価・改善

**Iteration 67.2: Basic REST API (2日間)**
```yaml
目標:
  - 単一エンドポイント: POST /api/process
  - 認証なし (開発環境)
  - シンプルなJSON応答

実装:
  Day 1:
    - Express.js セットアップ
    - 基本エンドポイント実装
    - MVPCorePipeline統合

  Day 2:
    - エラーハンドリング
    - APIテスト作成
    - 動作確認・評価

成功基準:
  ✅ API応答時間 <500ms
  ✅ 処理開始成功率 >90%
  ✅ エラー応答の明確性
```

**Iteration 67.3: Authentication & Rate Limiting (2日間)**
```yaml
目標:
  - JWT認証実装
  - レート制限 (10 req/min)
  - APIキー管理

実装:
  Day 1:
    - JWT生成・検証ロジック
    - ミドルウェア実装

  Day 2:
    - レート制限ミドルウェア
    - APIキー管理システム
    - セキュリティテスト

成功基準:
  ✅ 認証成功率 >99%
  ✅ レート制限精度 100%
  ✅ 脆弱性 0件
```

**Iteration 67.4: WebSocket Real-time (3日間)**
```yaml
目標:
  - リアルタイム進捗配信
  - 双方向通信
  - 接続安定性

実装:
  Day 1:
    - Socket.io セットアップ
    - 基本イベント実装

  Day 2:
    - 進捗配信システム
    - 再接続ロジック

  Day 3:
    - 統合テスト
    - パフォーマンス最適化
    - エラーリカバリ

成功基準:
  ✅ メッセージ遅延 <50ms
  ✅ 接続安定性 >99%
  ✅ 再接続成功率 100%
```

**Iteration 67.5: API Documentation (1日)**
```yaml
目標:
  - OpenAPI/Swagger仕様書
  - インタラクティブドキュメント
  - サンプルコード

実装:
  - Swagger UI統合
  - 型定義からの自動生成
  - 使用例の作成

成功基準:
  ✅ 全エンドポイントがドキュメント化
  ✅ Try it out 機能が動作
  ✅ サンプルコード >5例
```

---

### Phase 3: 継続的改善の自動化 (1週間)

#### Iteration 68.1: Recursive Development Framework Enhancement

**目標**: カスタムインストラクションの理念を完全自動化

**実装**:
```typescript
// src/framework/custom-instruction-engine.ts
/**
 * Custom Instruction Engine
 * カスタムインストラクションの自動実行・評価システム
 */

export class CustomInstructionEngine {
  private currentPhase: DevelopmentPhase;
  private maxIterations: Map<string, number>;
  private successCriteria: Map<string, string[]>;

  constructor() {
    // カスタムインストラクションから設定読み込み
    this.maxIterations = new Map([
      ['MVP構築', 3],
      ['内容分析', 5],
      ['図解生成', 4]
    ]);

    this.successCriteria = new Map([
      ['MVP構築', ['音声入力→字幕付き動画出力が動作']],
      ['内容分析', ['シーン分割精度80%', '図解タイプ判定70%']],
      ['図解生成', ['レイアウト破綻0', 'ラベル可読性100%']]
    ]);
  }

  /**
   * 開発サイクル自動実行
   */
  async executeDevelopmentCycle(
    phase: string,
    implementation: () => Promise<any>
  ): Promise<CycleResult> {
    const maxIter = this.maxIterations.get(phase) || 3;
    const criteria = this.successCriteria.get(phase) || [];

    for (let iteration = 1; iteration <= maxIter; iteration++) {
      console.log(`[Cycle] ${phase} - Iteration ${iteration}/${maxIter}`);

      // 1. implement
      const result = await implementation();

      // 2. test
      const testResults = await this.runTests(result);

      // 3. evaluate
      const evaluation = await this.evaluateAgainstCriteria(
        testResults,
        criteria
      );

      // 4. iterate or complete
      if (evaluation.allPassed) {
        console.log(`[Cycle] ${phase} - ✅ Success at iteration ${iteration}`);

        // 5. commit
        await this.commitChanges(phase, iteration, evaluation);

        return {
          success: true,
          phase,
          iteration,
          evaluation
        };
      }

      console.log(`[Cycle] ${phase} - ⚠️ Iteration ${iteration} incomplete`);
      console.log('   Issues:', evaluation.failedCriteria);

      // 改善提案生成
      const improvements = await this.generateImprovements(evaluation);
      console.log('   Suggested improvements:', improvements);
    }

    // maxIterations到達
    console.log(`[Cycle] ${phase} - ⚠️ Max iterations reached without full success`);

    return {
      success: false,
      phase,
      iteration: maxIter,
      message: 'Max iterations reached - review and adjust approach'
    };
  }

  /**
   * 成功基準の自動評価
   */
  private async evaluateAgainstCriteria(
    testResults: TestResults,
    criteria: string[]
  ): Promise<Evaluation> {
    const evaluation: Evaluation = {
      allPassed: true,
      passedCriteria: [],
      failedCriteria: [],
      metrics: {}
    };

    for (const criterion of criteria) {
      const passed = await this.checkCriterion(criterion, testResults);

      if (passed) {
        evaluation.passedCriteria.push(criterion);
      } else {
        evaluation.failedCriteria.push(criterion);
        evaluation.allPassed = false;
      }
    }

    return evaluation;
  }

  /**
   * 改善提案の自動生成
   */
  private async generateImprovements(
    evaluation: Evaluation
  ): Promise<string[]> {
    const improvements: string[] = [];

    for (const failed of evaluation.failedCriteria) {
      // AIによる改善提案 (簡易版はルールベース)
      if (failed.includes('精度')) {
        improvements.push('アルゴリズムの調整・パラメータチューニング');
      }

      if (failed.includes('処理時間')) {
        improvements.push('並列処理の導入・キャッシュの活用');
      }

      if (failed.includes('破綻')) {
        improvements.push('制約条件の強化・検証ロジックの追加');
      }
    }

    return improvements;
  }

  /**
   * 自動コミット
   */
  private async commitChanges(
    phase: string,
    iteration: number,
    evaluation: Evaluation
  ): Promise<void> {
    const message = `feat(${phase}): Complete iteration ${iteration}\n\n` +
      `✅ Success criteria met:\n` +
      evaluation.passedCriteria.map(c => `- ${c}`).join('\n') +
      `\n\n📊 Metrics:\n` +
      JSON.stringify(evaluation.metrics, null, 2) +
      `\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n` +
      `Co-Authored-By: Claude <noreply@anthropic.com>`;

    console.log('[Commit] Message:', message);

    // 実際のgit commitは手動承認が必要
    // await execCommand(`git add -A && git commit -m "${message}"`);
  }
}
```

---

## 📊 成功基準マトリックス

### 全体目標

```yaml
Phase 0 (1週間):
  ✅ ドキュメント構造: カスタムインストラクション準拠
  ✅ テストカバレッジ: >80%
  ✅ 依存関係: 循環依存0件

Phase 1 (3日):
  ✅ MVP版完成: 3イテレーション
  ✅ 処理成功率: >80%
  ✅ 処理時間: <3分 (10分音声)

Phase 2 (2週間):
  ✅ API完成度: 基本機能100%
  ✅ 認証・セキュリティ: 脆弱性0件
  ✅ WebSocket: メッセージ遅延<50ms

Phase 3 (1週間):
  ✅ 自動化フレームワーク: 稼働中
  ✅ 継続的改善: 自動実行
  ✅ ドキュメント: 常に最新

総合評価:
  システム成熟度: Production Ready維持
  MVP準拠度: 100%
  自動化レベル: 80%+
  品質スコア: 95%+
```

---

## 🎯 次のアクション

### 即時実行 (今すぐ)

```bash
# 1. Phase 0の開始
mkdir -p .module/{core,phases,iterations,quality,archive}

# 2. 基本ドキュメント作成
# (上記のDay 1-2アクションを実行)

# 3. システム動作確認
npm run dev                # Web UI
npm run remotion:studio    # Remotion
npm run test               # テスト実行
```

### 短期目標 (1週間以内)

1. Phase 0完了 (ドキュメント・テスト整備)
2. MVP版の完成 (Phase 1)
3. Iteration 67計画の最終調整

### 中長期目標 (1ヶ月以内)

1. API開発完了 (Phase 2)
2. 自動化フレームワーク稼働 (Phase 3)
3. システム全体のカスタムインストラクション完全準拠

---

## 📝 コミット戦略

### カスタムインストラクション準拠のコミットメッセージ

```bash
# 形式
<type>(<scope>): <subject> [iteration-N] [phase-X]

# 例
feat(mvp): Implement core pipeline MVP version [iteration-67.1] [phase-1]
fix(transcription): Improve error handling in fallback [iteration-67.1] [phase-1]
refactor(pipeline): Extract MVP version from enterprise code [phase-0]
docs(module): Add SYSTEM_CORE.md with architecture overview [phase-0]
test(integration): Add E2E test for MVP pipeline [iteration-67.1]
perf(layout): Optimize zero-overlap algorithm [iteration-67.3] [phase-2]
```

### コミットタイミング

```yaml
immediate:
  - 各イテレーション完了時
  - 破壊的変更の前
  - 動作確認成功時

checkpoint:
  - フェーズ完了時
  - 重要なマイルストーン達成時
  - 週次レビュー前

review:
  - 月次完了時
  - エンタープライズ機能追加時
  - 外部公開前
```

---

**ロードマップ作成者**: Claude Code AI Assistant
**準拠基準**: カスタムインストラクション完全準拠
**次回更新**: Phase 0完了時
**ステータス**: 実行準備完了 ✅
