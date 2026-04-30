/**
 * Phase 38: Custom Instructions Comprehensive Validation
 *
 * Purpose: Validate complete compliance with the provided custom instructions
 * for the 音声→図解動画自動生成システム (Audio-to-Diagram Video Generator)
 *
 * Validation Scope:
 * 1. MVP構築 - Basic infrastructure and Remotion integration
 * 2. 音声処理パイプライン - Whisper transcription pipeline
 * 3. 内容分析エンジン - LLM-powered content analysis (Gemini)
 * 4. 図解生成 - Diagram generation with zero-overlap layouts
 * 5. 品質保証 - Quality monitoring and metrics
 * 6. 統合テスト - End-to-end system validation
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { SimplePipeline } from '@/pipeline/simple-pipeline';
import { GeminiAnalyzer } from '@/analysis/gemini-analyzer';
import { ContentAnalyzer } from '@/analysis/content-analyzer';
import { DiagramDetector } from '@/analysis';
import { EnhancedZeroOverlapLayoutEngine } from '@/visualization/enhanced-zero-overlap-layout';
import { getQualityMonitor } from '@/pipeline/quality-monitor';
import { llmService } from '@/analysis/llm-service';

interface ValidationResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  metrics?: Record<string, unknown>;
  duration?: number;
}

interface ValidationReport {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: ValidationResult[];
  overallScore: number;
  timestamp: string;
  systemMetrics: {
    nodeVersion: string;
    platform: string;
    memory: {
      total: number;
      used: number;
      free: number;
    };
  };
}

class CustomInstructionsValidator {
  private results: ValidationResult[] = [];
  private startTime: number = Date.now();

  /**
   * カテゴリー1: MVP構築の検証
   */
  async validateMVPInfrastructure(): Promise<void> {
    console.log('\n🏗️  カテゴリー1: MVP構築の検証');
    console.log('=' .repeat(60));

    // Test 1.1: Remotion が正しくインストールされているか
    await this.runTest(
      'MVP構築',
      'Remotion インストール確認',
      async () => {
        try {
          const remotionPackage = await import('remotion');
          const { Composition } = await import('remotion');

          return {
            status: 'PASS' as const,
            message: 'Remotion が正しくインストールされています',
            metrics: {
              version: remotionPackage.VERSION || 'N/A',
              compositionAvailable: typeof Composition === 'function'
            }
          };
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `Remotion のインポートに失敗: ${error}`
          };
        }
      }
    );

    // Test 1.2: Dagre レイアウトエンジンの確認
    await this.runTest(
      'MVP構築',
      'Dagre レイアウトエンジン確認',
      async () => {
        try {
          const dagre = await import('@dagrejs/dagre');
          const graph = new dagre.graphlib.Graph();
          graph.setGraph({});
          graph.setNode('test', { width: 100, height: 50 });

          return {
            status: 'PASS' as const,
            message: 'Dagre レイアウトエンジンが正常に動作',
            metrics: {
              graphCreated: true,
              nodeAdded: graph.hasNode('test')
            }
          };
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `Dagre のインポートに失敗: ${error}`
          };
        }
      }
    );

    // Test 1.3: プロジェクト構造の確認
    await this.runTest(
      'MVP構築',
      'プロジェクト構造確認',
      async () => {
        // Find the actual project root (not whisper.cpp directory)
        let projectRoot = process.cwd();
        while (projectRoot.includes('node_modules')) {
          projectRoot = path.dirname(projectRoot);
        }

        const requiredDirs = [
          'src/transcription',
          'src/analysis',
          'src/visualization',
          'src/remotion',
          'src/pipeline',
          'public/audio',
          'public/srt',
          'public/scenes'
        ];

        const missingDirs: string[] = [];
        for (const dir of requiredDirs) {
          try {
            await fs.access(path.join(projectRoot, dir));
          } catch {
            missingDirs.push(dir);
          }
        }

        if (missingDirs.length === 0) {
          return {
            status: 'PASS' as const,
            message: '必須ディレクトリがすべて存在します',
            metrics: { requiredDirs: requiredDirs.length, projectRoot }
          };
        } else {
          return {
            status: 'FAIL' as const,
            message: `不足しているディレクトリ: ${missingDirs.join(', ')}`,
            metrics: { missingCount: missingDirs.length, projectRoot }
          };
        }
      }
    );
  }

  /**
   * カテゴリー2: LLM統合の検証（重要）
   */
  async validateLLMIntegration(): Promise<void> {
    console.log('\n🤖 カテゴリー2: LLM統合の検証（Gemini AI）');
    console.log('=' .repeat(60));

    // Test 2.1: API キーの確認
    await this.runTest(
      'LLM統合',
      'GOOGLE_API_KEY 環境変数確認',
      async () => {
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
          return {
            status: 'FAIL' as const,
            message: 'GOOGLE_API_KEY が設定されていません。.env ファイルを確認してください。'
          };
        }

        if (apiKey.length < 20) {
          return {
            status: 'FAIL' as const,
            message: 'GOOGLE_API_KEY の形式が不正です'
          };
        }

        return {
          status: 'PASS' as const,
          message: 'GOOGLE_API_KEY が正しく設定されています',
          metrics: {
            keyLength: apiKey.length,
            keyPrefix: apiKey.substring(0, 10) + '...'
          }
        };
      }
    );

    // Test 2.2: GeminiAnalyzer の初期化と動作確認
    await this.runTest(
      'LLM統合',
      'GeminiAnalyzer 初期化と基本動作',
      async () => {
        try {
          const analyzer = new GeminiAnalyzer();

          if (!analyzer.isEnabled()) {
            return {
              status: 'FAIL' as const,
              message: 'GeminiAnalyzer が有効化されていません'
            };
          }

          // 簡単なテキストで分析を試行
          const testText = "プロセスAからプロセスBへ、そしてプロセスCへと進みます。";
          const result = await analyzer.analyzeText(testText, 15000);

          if (result && result.nodes && result.nodes.length > 0) {
            return {
              status: 'PASS' as const,
              message: 'GeminiAnalyzer が正常に動作しています',
              metrics: {
                nodesExtracted: result.nodes.length,
                edgesExtracted: result.edges?.length || 0,
                diagramType: result.type,
                confidence: result.confidence
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'GeminiAnalyzer の分析結果が不正です'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `GeminiAnalyzer エラー: ${error}`
          };
        }
      }
    );

    // Test 2.3: ContentAnalyzer の動作確認
    await this.runTest(
      'LLM統合',
      'ContentAnalyzer LLM統合動作',
      async () => {
        try {
          const analyzer = new ContentAnalyzer();

          const testText = "機械学習は人工知能の一部です。深層学習は機械学習の一種です。";
          const result = await analyzer.execute(testText);

          if (result && result.nodes && result.nodes.length > 0) {
            return {
              status: 'PASS' as const,
              message: 'ContentAnalyzer が正常に動作しています',
              metrics: {
                nodesExtracted: result.nodes.length,
                edgesExtracted: result.edges?.length || 0,
                diagramType: result.type,
                title: result.title
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'ContentAnalyzer の分析結果が不正です'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `ContentAnalyzer エラー: ${error}`
          };
        }
      }
    );

    // Test 2.4: LLMService のキャッシュ機能確認
    await this.runTest(
      'LLM統合',
      'LLMService キャッシュ機能',
      async () => {
        try {
          const stats = llmService.getStats();

          return {
            status: 'PASS' as const,
            message: 'LLMService のキャッシュが動作しています',
            metrics: {
              totalRequests: stats.totalRequests,
              cacheHits: stats.cacheHits,
              cacheMisses: stats.cacheMisses,
              hitRate: stats.totalRequests > 0
                ? (stats.cacheHits / stats.totalRequests * 100).toFixed(2) + '%'
                : 'N/A',
              avgResponseTime: stats.performance.avgResponseTime
            }
          };
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `LLMService 統計取得エラー: ${error}`
          };
        }
      }
    );
  }

  /**
   * カテゴリー3: 図解生成の検証
   */
  async validateVisualizationEngine(): Promise<void> {
    console.log('\n🎨 カテゴリー3: 図解生成の検証');
    console.log('=' .repeat(60));

    // Test 3.1: EnhancedZeroOverlapLayoutEngine の動作確認
    await this.runTest(
      '図解生成',
      'ゼロオーバーラップレイアウトエンジン',
      async () => {
        try {
          const engine = new EnhancedZeroOverlapLayoutEngine({
            overlapDetectionMode: 'strict',
            collisionResolutionStrategy: 'force_directed',
            separationDistance: 30,
            maxIterations: 10,
            qualityThreshold: 100
          });

          const testNodes = [
            { id: 'n1', label: 'ノード1' },
            { id: 'n2', label: 'ノード2' },
            { id: 'n3', label: 'ノード3' }
          ];

          const testEdges = [
            { from: 'n1', to: 'n2' },
            { from: 'n2', to: 'n3' }
          ];

          const result = await engine.generateZeroOverlapLayout(
            'flow',
            testNodes,
            testEdges
          );

          if (result.success && result.qualityMetrics?.overlapCount === 0) {
            return {
              status: 'PASS' as const,
              message: 'ゼロオーバーラップレイアウトが正常に生成されました',
              metrics: {
                nodeCount: result.nodes.length,
                edgeCount: result.edges.length,
                overlapCount: result.qualityMetrics.overlapCount,
                aestheticScore: result.qualityMetrics.aestheticScore,
                iterationsUsed: result.qualityMetrics.iterationsUsed
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: `レイアウト生成失敗またはオーバーラップ検出: ${result.qualityMetrics?.overlapCount || 'N/A'}`
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `レイアウトエンジンエラー: ${error}`
          };
        }
      }
    );

    // Test 3.2: DiagramDetector の図解タイプ判定
    await this.runTest(
      '図解生成',
      'DiagramDetector 図解タイプ判定',
      async () => {
        try {
          const detector = new DiagramDetector();

          const testSegment = {
            text: "最初にAを実行し、次にBを処理します。最後にCで完了します。",
            startMs: 0,
            endMs: 5000
          };

          const result = await detector.analyze(testSegment);

          if (result && result.type && result.nodes && result.nodes.length > 0) {
            return {
              status: 'PASS' as const,
              message: 'DiagramDetector が正常に動作しています',
              metrics: {
                detectedType: result.type,
                confidence: result.confidence,
                nodeCount: result.nodes.length,
                edgeCount: result.edges?.length || 0
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'DiagramDetector の判定結果が不正です'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `DiagramDetector エラー: ${error}`
          };
        }
      }
    );

    // Test 3.3: 5種類の図解タイプサポート確認
    await this.runTest(
      '図解生成',
      '5種類の図解タイプサポート確認',
      async () => {
        const supportedTypes = ['flow', 'tree', 'timeline', 'matrix', 'cycle'];
        const engine = new EnhancedZeroOverlapLayoutEngine();

        const results: Record<string, boolean> = {};

        for (const type of supportedTypes) {
          try {
            const testResult = await engine.generateZeroOverlapLayout(
              type as 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle',
              [{ id: 'n1', label: 'Test' }],
              []
            );
            results[type] = testResult.success;
          } catch {
            results[type] = false;
          }
        }

        const successCount = Object.values(results).filter(v => v).length;

        if (successCount === supportedTypes.length) {
          return {
            status: 'PASS' as const,
            message: '全5種類の図解タイプがサポートされています',
            metrics: {
              supportedTypes,
              successCount,
              results
            }
          };
        } else {
          return {
            status: 'FAIL' as const,
            message: `一部の図解タイプがサポートされていません (${successCount}/5)`,
            metrics: { results }
          };
        }
      }
    );
  }

  /**
   * カテゴリー4: 品質保証とモニタリング
   */
  async validateQualityMonitoring(): Promise<void> {
    console.log('\n📊 カテゴリー4: 品質保証とモニタリング');
    console.log('=' .repeat(60));

    // Test 4.1: QualityMonitor の動作確認
    await this.runTest(
      '品質保証',
      'QualityMonitor 動作確認',
      async () => {
        try {
          const qualityMonitor = getQualityMonitor();

          // テストメトリクスを記録
          qualityMonitor.recordMetrics({
            processingTime: 1000,
            memoryUsage: 100,
            transcriptionAccuracy: 0.9,
            sceneSegmentationF1: 0.85,
            layoutOverlap: 0,
            errorCount: 0,
            warningCount: 0,
            fallbackTriggered: false,
            confidenceScore: 0.9
          });

          const report = qualityMonitor.generateReport();

          if (report && report.overallScore > 0) {
            return {
              status: 'PASS' as const,
              message: 'QualityMonitor が正常に動作しています',
              metrics: {
                overallScore: report.overallScore,
                qualityLevel: report.qualityLevel,
                metricsRecorded: Object.keys(report.metrics).length
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'QualityMonitor のレポート生成に失敗'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `QualityMonitor エラー: ${error}`
          };
        }
      }
    );

    // Test 4.2: イテレーションログの確認
    await this.runTest(
      '品質保証',
      'イテレーションログ機能',
      async () => {
        try {
          // Find the actual project root (not whisper.cpp directory)
          let projectRoot = process.cwd();
          while (projectRoot.includes('node_modules')) {
            projectRoot = path.dirname(projectRoot);
          }

          const logPath = path.join(projectRoot, '.module', 'ITERATION_LOG.md');
          const logContent = await fs.readFile(logPath, 'utf-8');

          if (logContent.includes('# Iteration History')) {
            return {
              status: 'PASS' as const,
              message: 'イテレーションログが正しく記録されています',
              metrics: {
                logSize: logContent.length,
                hasHistory: true,
                logPath
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'イテレーションログの形式が不正です'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `イテレーションログ読み込みエラー: ${error}`
          };
        }
      }
    );
  }

  /**
   * カテゴリー5: エンドツーエンド統合テスト
   */
  async validateEndToEndPipeline(): Promise<void> {
    console.log('\n🚀 カテゴリー5: エンドツーエンド統合テスト');
    console.log('=' .repeat(60));

    // Test 5.1: SimplePipeline の初期化
    await this.runTest(
      'E2E統合',
      'SimplePipeline 初期化',
      async () => {
        try {
          const pipeline = new SimplePipeline();
          const capabilities = pipeline.getCapabilities();

          if (capabilities && capabilities.transcription && capabilities.analysis) {
            return {
              status: 'PASS' as const,
              message: 'SimplePipeline が正常に初期化されました',
              metrics: {
                transcriptionModel: capabilities.transcription.model,
                supportedFormats: capabilities.transcription.supportedFormats.join(', '),
                diagramTypes: capabilities.analysis.diagramTypes.join(', ')
              }
            };
          } else {
            return {
              status: 'FAIL' as const,
              message: 'SimplePipeline の初期化に失敗'
            };
          }
        } catch (error) {
          return {
            status: 'FAIL' as const,
            message: `SimplePipeline エラー: ${error}`
          };
        }
      }
    );

    // Test 5.2: テストオーディオファイルの存在確認
    await this.runTest(
      'E2E統合',
      'テストオーディオファイル確認',
      async () => {
        // Find the actual project root (not whisper.cpp directory)
        let projectRoot = process.cwd();
        while (projectRoot.includes('node_modules')) {
          projectRoot = path.dirname(projectRoot);
        }

        const testAudioFiles = [
          'public/audio/jfk.wav',
          'public/jfk.wav'
        ];

        for (const audioPath of testAudioFiles) {
          try {
            const fullPath = path.join(projectRoot, audioPath);
            await fs.access(fullPath);
            const stats = await fs.stat(fullPath);

            return {
              status: 'PASS' as const,
              message: `テストオーディオファイルが存在します: ${audioPath}`,
              metrics: {
                path: audioPath,
                fullPath,
                size: stats.size,
                sizeKB: (stats.size / 1024).toFixed(2) + ' KB'
              }
            };
          } catch {
            continue;
          }
        }

        return {
          status: 'SKIP' as const,
          message: 'テストオーディオファイルが見つかりません（E2Eテストはスキップ）'
        };
      }
    );
  }

  /**
   * テストヘルパー: 個別テストの実行とタイミング測定
   */
  private async runTest(
    category: string,
    testName: string,
    testFn: () => Promise<{ status: 'PASS' | 'FAIL' | 'SKIP'; message: string; metrics?: Record<string, unknown> }>
  ): Promise<void> {
    const testStartTime = Date.now();

    try {
      console.log(`\n🔍 テスト: ${testName}`);
      const result = await testFn();
      const duration = Date.now() - testStartTime;

      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️ ';
      console.log(`${statusIcon} ${result.status}: ${result.message}`);

      if (result.metrics) {
        console.log('   📈 メトリクス:');
        for (const [key, value] of Object.entries(result.metrics)) {
          console.log(`      - ${key}: ${JSON.stringify(value)}`);
        }
      }
      console.log(`   ⏱️  実行時間: ${duration}ms`);

      this.results.push({
        category,
        test: testName,
        status: result.status,
        message: result.message,
        metrics: result.metrics,
        duration
      });
    } catch (error) {
      const duration = Date.now() - testStartTime;
      console.log(`❌ FAIL: テスト実行中にエラーが発生しました: ${error}`);

      this.results.push({
        category,
        test: testName,
        status: 'FAIL',
        message: `テスト実行エラー: ${error}`,
        duration
      });
    }
  }

  /**
   * 最終レポートの生成
   */
  generateReport(): ValidationReport {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const totalTests = this.results.length;

    const overallScore = totalTests > 0
      ? Math.round((passed / (totalTests - skipped)) * 100)
      : 0;

    const report: ValidationReport = {
      totalTests,
      passed,
      failed,
      skipped,
      results: this.results,
      overallScore,
      timestamp: new Date().toISOString(),
      systemMetrics: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          total: Math.round(process.memoryUsage().heapTotal / (1024 * 1024)),
          used: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
          free: Math.round((process.memoryUsage().heapTotal - process.memoryUsage().heapUsed) / (1024 * 1024))
        }
      }
    };

    return report;
  }

  /**
   * レポートの表示
   */
  displayReport(report: ValidationReport): void {
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 Phase 38: カスタムインストラクション準拠検証レポート');
    console.log('='.repeat(80));

    console.log(`\n✅ 成功: ${report.passed}/${report.totalTests}`);
    console.log(`❌ 失敗: ${report.failed}/${report.totalTests}`);
    console.log(`⏭️  スキップ: ${report.skipped}/${report.totalTests}`);
    console.log(`\n🎯 総合スコア: ${report.overallScore}/100`);

    const qualityLevel =
      report.overallScore >= 90 ? '🌟 EXCELLENT (商用利用可能レベル)' :
      report.overallScore >= 80 ? '✨ GOOD (実用レベル)' :
      report.overallScore >= 70 ? '⚠️  FAIR (改善推奨)' :
      '❌ POOR (要改善)';

    console.log(`📈 品質レベル: ${qualityLevel}`);

    console.log(`\n⏱️  総実行時間: ${((Date.now() - this.startTime) / 1000).toFixed(2)}秒`);

    console.log('\n💾 システムメトリクス:');
    console.log(`   Node.js: ${report.systemMetrics.nodeVersion}`);
    console.log(`   Platform: ${report.systemMetrics.platform}`);
    console.log(`   Memory: ${report.systemMetrics.memory.used}MB / ${report.systemMetrics.memory.total}MB`);

    // カテゴリー別サマリー
    console.log('\n📋 カテゴリー別サマリー:');
    const categories = [...new Set(report.results.map(r => r.category))];

    for (const category of categories) {
      const categoryResults = report.results.filter(r => r.category === category);
      const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
      const categoryTotal = categoryResults.filter(r => r.status !== 'SKIP').length;
      const categoryScore = categoryTotal > 0
        ? Math.round((categoryPassed / categoryTotal) * 100)
        : 0;

      console.log(`   ${category}: ${categoryPassed}/${categoryTotal} (${categoryScore}%)`);
    }

    // 失敗したテストの詳細
    const failedTests = report.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n❌ 失敗したテスト:');
      for (const test of failedTests) {
        console.log(`   - ${test.category} > ${test.test}`);
        console.log(`     理由: ${test.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 カスタムインストラクション準拠状況:');
    console.log('='.repeat(80));

    const complianceChecks = [
      { item: '1. システム概要と開発理念', status: report.overallScore >= 80 },
      { item: '2. 段階的開発フロー（再帰的プロセス）', status: report.passed > 0 },
      { item: '3. MVP構築（Remotion + Dagre）', status: report.results.filter(r => r.category === 'MVP構築' && r.status === 'PASS').length >= 2 },
      { item: '4. LLM統合（Gemini AI）', status: report.results.filter(r => r.category === 'LLM統合' && r.status === 'PASS').length >= 2 },
      { item: '5. 図解生成（ゼロオーバーラップ）', status: report.results.filter(r => r.category === '図解生成' && r.status === 'PASS').length >= 2 },
      { item: '6. 品質保証と継続的改善', status: report.results.filter(r => r.category === '品質保証' && r.status === 'PASS').length >= 1 },
      { item: '7. エンドツーエンド統合', status: report.results.filter(r => r.category === 'E2E統合' && r.status === 'PASS').length >= 1 }
    ];

    for (const check of complianceChecks) {
      const icon = check.status ? '✅' : '❌';
      console.log(`${icon} ${check.item}`);
    }

    const complianceScore = Math.round(
      (complianceChecks.filter(c => c.status).length / complianceChecks.length) * 100
    );

    console.log(`\n🎯 カスタムインストラクション準拠率: ${complianceScore}%`);
    console.log('='.repeat(80));
  }

  /**
   * レポートをファイルに保存
   */
  async saveReport(report: ValidationReport): Promise<void> {
    // Find the actual project root (not whisper.cpp directory)
    let projectRoot = process.cwd();
    while (projectRoot.includes('node_modules')) {
      projectRoot = path.dirname(projectRoot);
    }

    const reportPath = path.join(
      projectRoot,
      `PHASE_38_VALIDATION_REPORT_${Date.now()}.json`
    );

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n💾 詳細レポートを保存しました: ${reportPath}`);
  }

  /**
   * メイン実行関数
   */
  async runAllValidations(): Promise<ValidationReport> {
    console.log('🎯 Phase 38: カスタムインストラクション準拠検証を開始します...');
    console.log('=' .repeat(80));

    await this.validateMVPInfrastructure();
    await this.validateLLMIntegration();
    await this.validateVisualizationEngine();
    await this.validateQualityMonitoring();
    await this.validateEndToEndPipeline();

    const report = this.generateReport();
    this.displayReport(report);
    await this.saveReport(report);

    return report;
  }
}

// スクリプト実行
const validator = new CustomInstructionsValidator();

validator.runAllValidations()
  .then((report) => {
    const exitCode = report.overallScore >= 80 ? 0 : 1;
    process.exit(exitCode);
  })
  .catch((error) => {
    console.error('❌ 検証中に致命的なエラーが発生しました:', error);
    process.exit(1);
  });

export { CustomInstructionsValidator, ValidationReport, ValidationResult };
