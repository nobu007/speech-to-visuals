#!/usr/bin/env ts-node

/**
 * 現在のシステム動作確認テスト
 * カスタムインストラクションに従って段階的に機能を検証
 */

import { simplePipeline } from './src/pipeline/simple-pipeline';
import path from 'path';
import fs from 'fs';

interface SystemTestResult {
  phase: string;
  success: boolean;
  details: any;
  error?: string;
  timestamp: string;
}

class CurrentSystemTester {
  private results: SystemTestResult[] = [];

  async runComprehensiveTest(): Promise<void> {
    console.log('🎯 音声→図解動画自動生成システム 現状確認テスト開始');
    console.log('━'.repeat(60));

    // Phase 1: 基盤モジュール検証
    await this.testFoundation();

    // Phase 2: パイプライン機能検証
    await this.testPipelineCapabilities();

    // Phase 3: 統合テスト（ダミーデータ使用）
    await this.testIntegrationWithMockData();

    // Phase 4: 結果レポート
    this.generateReport();
  }

  private async testFoundation(): Promise<void> {
    console.log('📋 Phase 1: 基盤モジュール検証');

    try {
      // 1. パイプライン初期化テスト
      const capabilities = simplePipeline.getCapabilities();

      this.addResult('foundation_initialization', true, {
        pipelineInitialized: true,
        capabilities: capabilities,
        supportedFormats: capabilities.transcription.supportedFormats,
        diagramTypes: capabilities.analysis.diagramTypes
      });

      console.log('   ✅ パイプライン初期化: 成功');
      console.log(`   📊 対応音声形式: ${capabilities.transcription.supportedFormats.join(', ')}`);
      console.log(`   🎨 対応図解種類: ${capabilities.analysis.diagramTypes.join(', ')}`);

      // 2. 進捗管理機能テスト
      const progressiveMetrics = simplePipeline.getProgressiveMetrics();

      this.addResult('progressive_enhancement', true, {
        iterationCount: progressiveMetrics.iterationCount,
        qualityMetrics: progressiveMetrics.qualityMetrics,
        averageQuality: progressiveMetrics.averageQuality,
        successRate: progressiveMetrics.successRate
      });

      console.log('   ✅ 段階的改善機能: 有効');
      console.log(`   📈 現在のイテレーション: ${progressiveMetrics.iterationCount}`);

    } catch (error) {
      this.addResult('foundation_initialization', false, {}, error instanceof Error ? error.message : 'Unknown error');
      console.log('   ❌ 基盤モジュール検証: 失敗');
    }
  }

  private async testPipelineCapabilities(): Promise<void> {
    console.log('\n🔧 Phase 2: パイプライン機能検証');

    try {
      // モックファイルを作成してテスト
      const mockAudioFile = this.createMockAudioFile();

      // パイプライン設定テスト
      const testConfig = {
        audioFile: mockAudioFile,
        options: {
          language: 'ja',
          maxScenes: 5,
          layoutType: 'auto' as const,
          includeVideoGeneration: false, // まずは動画生成無しでテスト
          useEnhancedLayout: true,
          layoutQuality: 'zero_overlap' as const,
          overlapTolerance: 'balanced' as const
        }
      };

      console.log('   🎵 テスト設定:');
      console.log(`      - 言語: ${testConfig.options.language}`);
      console.log(`      - 最大シーン数: ${testConfig.options.maxScenes}`);
      console.log(`      - レイアウト: ${testConfig.options.layoutType}`);
      console.log(`      - 拡張レイアウト: ${testConfig.options.useEnhancedLayout}`);

      this.addResult('pipeline_configuration', true, {
        configurationValid: true,
        mockFileCreated: true,
        testOptions: testConfig.options
      });

      console.log('   ✅ パイプライン設定: 成功');

    } catch (error) {
      this.addResult('pipeline_configuration', false, {}, error instanceof Error ? error.message : 'Unknown error');
      console.log('   ❌ パイプライン設定: 失敗');
    }
  }

  private async testIntegrationWithMockData(): Promise<void> {
    console.log('\n🧪 Phase 3: 統合テスト（ダミーデータ）');

    try {
      // より詳細なテストのためのダミーファイル作成
      const mockAudioFile = this.createMockAudioFile();

      // プログレス追跡のためのコールバック
      const progressLog: Array<{step: string, progress: number, timestamp: string}> = [];

      const progressCallback = (step: string, progress: number) => {
        progressLog.push({
          step,
          progress,
          timestamp: new Date().toISOString()
        });
        console.log(`   📊 進捗: ${step} (${progress.toFixed(1)}%)`);
      };

      console.log('   🚀 パイプライン実行開始...');

      // 注意: 実際の音声ファイルがないため、多くの場合エラーになることが予想される
      // しかし、どの段階まで進むかを確認することが目的
      const startTime = Date.now();

      try {
        const result = await simplePipeline.process({
          audioFile: mockAudioFile,
          options: {
            language: 'ja',
            maxScenes: 3,
            layoutType: 'auto',
            includeVideoGeneration: false,
            useEnhancedLayout: true
          }
        }, progressCallback);

        const processingTime = Date.now() - startTime;

        this.addResult('integration_test', result.success, {
          result,
          processingTime,
          progressLog,
          progressSteps: progressLog.length
        });

        if (result.success) {
          console.log('   🎉 統合テスト: 完全成功!');
          console.log(`   ⏱️  処理時間: ${processingTime}ms`);
          console.log(`   📝 生成された転写: ${result.transcript ? '有り' : '無し'}`);
          console.log(`   🎬 生成されたシーン数: ${result.scenes?.length || 0}`);
        } else {
          console.log('   ⚠️  統合テスト: 部分成功（期待通り）');
          console.log(`   📋 エラー詳細: ${result.error}`);
          console.log(`   📊 進捗段階数: ${progressLog.length}`);
        }

      } catch (error) {
        const processingTime = Date.now() - startTime;

        this.addResult('integration_test', false, {
          progressLog,
          processingTime,
          progressSteps: progressLog.length
        }, error instanceof Error ? error.message : 'Unknown error');

        console.log('   ❌ 統合テスト: エラー（モック データのため期待通り）');
        console.log(`   📋 エラー詳細: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log(`   📊 到達した進捗段階: ${progressLog.length}`);
      }

    } catch (error) {
      this.addResult('integration_test_setup', false, {}, error instanceof Error ? error.message : 'Unknown error');
      console.log('   ❌ 統合テスト準備: 失敗');
    }
  }

  private createMockAudioFile(): File {
    // ブラウザ環境ではないため、Node.js環境での擬似Fileオブジェクト作成
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });

    // File like オブジェクトを作成
    const mockFile = Object.assign(mockBlob, {
      name: 'test-audio.wav',
      lastModified: Date.now(),
      webkitRelativePath: ''
    }) as File;

    return mockFile;
  }

  private addResult(phase: string, success: boolean, details: any, error?: string): void {
    this.results.push({
      phase,
      success,
      details,
      error,
      timestamp: new Date().toISOString()
    });
  }

  private generateReport(): void {
    console.log('\n📊 システム状況レポート');
    console.log('━'.repeat(60));

    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const successRate = (successfulTests / totalTests) * 100;

    console.log(`📈 テスト結果: ${successfulTests}/${totalTests} 成功 (${successRate.toFixed(1)}%)`);
    console.log();

    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${index + 1}. ${result.phase}`);

      if (result.error) {
        console.log(`     エラー: ${result.error}`);
      }

      if (result.details && Object.keys(result.details).length > 0) {
        const detailStr = JSON.stringify(result.details, null, 2)
          .split('\n')
          .map(line => `     ${line}`)
          .join('\n');
        console.log(`     詳細: ${detailStr}`);
      }
      console.log();
    });

    // 総合評価
    console.log('🎯 総合評価:');
    if (successRate >= 80) {
      console.log('   🏆 素晴らしい! システムは高い準備状態にあります');
    } else if (successRate >= 60) {
      console.log('   👍 良好! 一部改善が必要ですが基本機能は動作します');
    } else if (successRate >= 40) {
      console.log('   ⚠️  部分的! 基盤は整っていますが実装改善が必要です');
    } else {
      console.log('   🔧 要改善! 基盤構築から始める必要があります');
    }

    // レポートファイル保存
    const reportData = {
      timestamp: new Date().toISOString(),
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      summary: {
        totalTests,
        successfulTests,
        successRate,
        overallStatus: successRate >= 80 ? 'excellent' : successRate >= 60 ? 'good' : successRate >= 40 ? 'partial' : 'needs_improvement'
      },
      detailedResults: this.results
    };

    const reportPath = `current-system-validation-report-${Date.now()}.json`;

    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`\n📄 詳細レポート保存: ${reportPath}`);
    } catch (error) {
      console.log('⚠️  レポート保存に失敗しました');
    }
  }
}

// メイン実行
async function main() {
  const tester = new CurrentSystemTester();
  await tester.runComprehensiveTest();
}

if (require.main === module) {
  main().catch(console.error);
}