#!/usr/bin/env tsx
/**
 * Performance Benchmark Script
 * パフォーマンスベースライン測定とボトルネック特定
 */

import { actualVideoRenderer } from '../src/lib/actualVideoRenderer';
import { SceneGraph } from '../src/types/diagram';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  stage: string;
  duration: number;
  fps?: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

interface BenchmarkReport {
  totalDuration: number;
  stages: BenchmarkResult[];
  renderingFps: number;
  bottlenecks: string[];
  recommendations: string[];
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];
  private startTime: number = 0;
  private stageStartTime: number = 0;
  private currentStage: string = '';

  startBenchmark() {
    this.startTime = performance.now();
    console.log('🔬 パフォーマンスベンチマーク開始\n');
  }

  startStage(stageName: string) {
    if (this.currentStage) {
      this.endStage();
    }
    this.currentStage = stageName;
    this.stageStartTime = performance.now();
    console.log(`📊 ${stageName}...`);
  }

  endStage() {
    if (!this.currentStage) return;

    const duration = performance.now() - this.stageStartTime;
    const memoryUsage = process.memoryUsage();

    this.results.push({
      stage: this.currentStage,
      duration,
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memoryUsage.heapTotal / 1024 / 1024,
        external: memoryUsage.external / 1024 / 1024,
      },
    });

    console.log(`   ✓ ${this.currentStage}: ${(duration / 1000).toFixed(2)}秒`);
    console.log(`   メモリ: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n`);

    this.currentStage = '';
  }

  generateReport(totalFrames: number, renderingDuration: number): BenchmarkReport {
    const totalDuration = performance.now() - this.startTime;
    const renderingFps = totalFrames / (renderingDuration / 1000);

    // ボトルネック特定
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // 各ステージの分析
    this.results.forEach((result) => {
      const percentage = (result.duration / totalDuration) * 100;

      if (percentage > 30) {
        bottlenecks.push(`${result.stage} が全体の ${percentage.toFixed(1)}% を占めています`);

        if (result.stage.includes('Bundling')) {
          recommendations.push('バンドルキャッシュの活用を検討');
        } else if (result.stage.includes('Rendering')) {
          recommendations.push('並列レンダリングまたはGPUアクセラレーションの検討');
        }
      }

      if (result.memoryUsage && result.memoryUsage.heapUsed > 500) {
        bottlenecks.push(`${result.stage} のメモリ使用量が ${result.memoryUsage.heapUsed.toFixed(0)} MB と高い`);
        recommendations.push('メモリ最適化: 不要なデータの早期解放を検討');
      }
    });

    // FPS分析
    if (renderingFps < 15) {
      bottlenecks.push(`レンダリング速度が ${renderingFps.toFixed(1)} FPS と目標値 (15 FPS) を下回っています`);
      recommendations.push('レンダリングエンジンの最適化が必要');
      recommendations.push('concurrency設定の調整を検討');
      recommendations.push('不要な再計算の削減');
    }

    return {
      totalDuration: totalDuration / 1000,
      stages: this.results,
      renderingFps,
      bottlenecks,
      recommendations,
    };
  }

  printReport(report: BenchmarkReport) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 パフォーマンスベンチマーク レポート');
    console.log('='.repeat(60) + '\n');

    console.log(`⏱️  総処理時間: ${report.totalDuration.toFixed(2)} 秒\n`);

    console.log('📈 ステージ別パフォーマンス:');
    console.log('-'.repeat(60));
    report.stages.forEach((stage) => {
      const percentage = (stage.duration / (report.totalDuration * 1000)) * 100;
      const bar = '█'.repeat(Math.floor(percentage / 2));

      console.log(`${stage.stage}:`);
      console.log(`  時間: ${(stage.duration / 1000).toFixed(2)}秒 (${percentage.toFixed(1)}%)`);
      console.log(`  [${bar}]`);
      if (stage.memoryUsage) {
        console.log(`  メモリ: ${stage.memoryUsage.heapUsed.toFixed(1)} MB`);
      }
      if (stage.fps) {
        console.log(`  FPS: ${stage.fps.toFixed(1)}`);
      }
      console.log('');
    });

    console.log(`🎬 レンダリング速度: ${report.renderingFps.toFixed(2)} FPS`);
    console.log(`   目標値: 15 FPS`);
    console.log(`   達成率: ${((report.renderingFps / 15) * 100).toFixed(1)}%\n`);

    if (report.bottlenecks.length > 0) {
      console.log('⚠️  検出されたボトルネック:');
      console.log('-'.repeat(60));
      report.bottlenecks.forEach((bottleneck, i) => {
        console.log(`${i + 1}. ${bottleneck}`);
      });
      console.log('');
    }

    if (report.recommendations.length > 0) {
      console.log('💡 最適化の推奨事項:');
      console.log('-'.repeat(60));
      report.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
      console.log('');
    }

    console.log('='.repeat(60) + '\n');
  }
}

async function main() {
  const benchmark = new PerformanceBenchmark();
  benchmark.startBenchmark();

  // テストデータの読み込み
  benchmark.startStage('テストデータ読み込み');
  const testDataPath = path.join(process.cwd(), 'test-scene-data.json');

  if (!fs.existsSync(testDataPath)) {
    console.error('❌ test-scene-data.json が見つかりません');
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
  const scenes: SceneGraph[] = inputData.scenes;
  benchmark.endStage();

  console.log(`📊 テストデータ:`);
  console.log(`   シーン数: ${scenes.length}`);
  console.log(`   総フレーム数: ${scenes.length * 3 * 30} フレーム (推定)\n`);

  // 動画レンダリング
  benchmark.startStage('動画レンダリング全体');

  let totalFrames = 0;
  let renderingStartTime = 0;
  let renderingEndTime = 0;

  try {
    const outputPath = path.join(process.cwd(), `benchmark-output-${Date.now()}.mp4`);

    const videoPath = await actualVideoRenderer.renderVideo(
      {
        scenes,
        quality: 'medium',
        outputPath,
      },
      (progress) => {
        if (progress.stage === 'rendering' && renderingStartTime === 0) {
          renderingStartTime = performance.now();
        }

        if (progress.stage === 'rendering') {
          totalFrames = progress.totalFrames;
        }

        if (progress.stage === 'complete' || progress.stage === 'encoding') {
          renderingEndTime = performance.now();
        }

        // 簡易プログレス表示
        if (progress.currentFrame % 30 === 0) {
          process.stdout.write(`\r   フレーム ${progress.currentFrame}/${progress.totalFrames}`);
        }
      }
    );

    console.log('\n');
    benchmark.endStage();

    // レンダリング時間の計算
    const renderingDuration = renderingEndTime - renderingStartTime;

    // レポート生成
    const report = benchmark.generateReport(totalFrames, renderingDuration);
    benchmark.printReport(report);

    // ファイル情報
    const stats = fs.statSync(videoPath);
    console.log('📁 出力ファイル情報:');
    console.log(`   パス: ${videoPath}`);
    console.log(`   サイズ: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

    // クリーンアップ
    console.log('🧹 テストファイルをクリーンアップ...');
    fs.unlinkSync(videoPath);
    console.log('✅ クリーンアップ完了\n');

  } catch (error) {
    console.error('\n❌ ベンチマークエラー:', error);
    benchmark.endStage();
    process.exit(1);
  }
}

main();
