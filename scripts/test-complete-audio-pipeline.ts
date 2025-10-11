#!/usr/bin/env tsx
/**
 * Phase 7: Complete Audio-to-Video Pipeline Test
 * 実際の音声ファイルでエンドツーエンド完全テスト
 *
 * カスタムインストラクション準拠:
 * - 段階的実装と検証
 * - 品質メトリクスの測定
 * - 失敗からの回復
 * - 処理過程の可視化
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface Stage {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success?: boolean;
  error?: string;
  metrics?: Record<string, any>;
}

interface TestResult {
  success: boolean;
  totalDuration: number;
  stages: Stage[];
  outputs: {
    transcriptFile?: string;
    sceneDataFile?: string;
    videoFile?: string;
  };
  metrics: {
    audioFileSizeKB: number;
    transcriptLength?: number;
    sceneCount?: number;
    videoSizeMB?: number;
    renderingFps?: number;
    qualityScore?: number;
  };
}

class CompleteAudioPipelineTest {
  private audioFilePath: string;
  private outputDir: string;
  private stages: Stage[] = [];

  constructor(audioPath: string, outputDir: string) {
    this.audioFilePath = audioPath;
    this.outputDir = outputDir;
  }

  private startStage(name: string): Stage {
    const stage: Stage = {
      name,
      startTime: performance.now()
    };
    this.stages.push(stage);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 ${name}`);
    console.log('='.repeat(70));
    return stage;
  }

  private endStage(stage: Stage, success: boolean, error?: string, metrics?: Record<string, any>) {
    stage.endTime = performance.now();
    stage.duration = stage.endTime - stage.startTime;
    stage.success = success;
    stage.error = error;
    stage.metrics = metrics;

    const statusIcon = success ? '✅' : '❌';
    const durationStr = (stage.duration / 1000).toFixed(2);

    console.log(`\n${statusIcon} ${stage.name} ${success ? '成功' : '失敗'}`);
    console.log(`⏱️  処理時間: ${durationStr}秒`);

    if (metrics) {
      console.log('\n📊 メトリクス:');
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    if (error) {
      console.log(`\n⚠️  エラー: ${error}`);
    }
  }

  async run(): Promise<TestResult> {
    const testStartTime = performance.now();

    console.log('\n' + '🚀'.repeat(35));
    console.log('🎯 Phase 7: Complete Audio-to-Video Pipeline Test');
    console.log('🚀'.repeat(35) + '\n');

    const result: TestResult = {
      success: false,
      totalDuration: 0,
      stages: [],
      outputs: {},
      metrics: {
        audioFileSizeKB: 0
      }
    };

    try {
      // Stage 1: Verify audio file
      const stage1 = this.startStage('Stage 1: Audio File Verification');
      try {
        if (!fs.existsSync(this.audioFilePath)) {
          throw new Error(`Audio file not found: ${this.audioFilePath}`);
        }

        const stats = fs.statSync(this.audioFilePath);
        result.metrics.audioFileSizeKB = Math.round(stats.size / 1024);

        this.endStage(stage1, true, undefined, {
          'ファイルパス': this.audioFilePath,
          'ファイルサイズ': `${result.metrics.audioFileSizeKB} KB`,
          '検証結果': '正常'
        });
      } catch (error) {
        this.endStage(stage1, false, error instanceof Error ? error.message : String(error));
        throw error;
      }

      // Stage 2: Setup test environment
      const stage2 = this.startStage('Stage 2: Test Environment Setup');
      try {
        if (!fs.existsSync(this.outputDir)) {
          fs.mkdirSync(this.outputDir, { recursive: true });
        }

        this.endStage(stage2, true, undefined, {
          '出力ディレクトリ': this.outputDir,
          'ディレクトリ状態': 'Ready'
        });
      } catch (error) {
        this.endStage(stage2, false, error instanceof Error ? error.message : String(error));
        throw error;
      }

      // Stage 3: Create File object for SimplePipeline
      const stage3 = this.startStage('Stage 3: Audio File Processing Preparation');
      let audioFile: File;
      try {
        const audioBuffer = fs.readFileSync(this.audioFilePath);
        const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
        const fileName = path.basename(this.audioFilePath);

        // Create File object compatible with browser API
        audioFile = new File([audioBlob], fileName, {
          type: 'audio/wav',
          lastModified: Date.now()
        });

        this.endStage(stage3, true, undefined, {
          'ファイル名': fileName,
          'MIME Type': audioFile.type,
          'サイズ': `${Math.round(audioFile.size / 1024)} KB`
        });
      } catch (error) {
        this.endStage(stage3, false, error instanceof Error ? error.message : String(error));
        throw error;
      }

      // Stage 4: Run SimplePipeline (without video)
      const stage4 = this.startStage('Stage 4: SimplePipeline Processing (Analysis Only)');
      let pipelineResult: any;
      try {
        // Dynamic import to avoid module issues
        const { simplePipeline } = await import('../src/pipeline/simple-pipeline');

        let lastProgress = 0;
        pipelineResult = await simplePipeline.process(
          {
            audioFile,
            options: {
              includeVideoGeneration: false,
              useEnhancedLayout: true,
              layoutQuality: 'zero_overlap'
            }
          },
          (step, progress) => {
            const progressInt = Math.floor(progress);
            if (progressInt > lastProgress && progressInt % 10 === 0) {
              process.stdout.write(`\r   📊 ${step}: ${progressInt}%`);
              lastProgress = progressInt;
            }
          }
        );

        console.log('\n');

        if (!pipelineResult.success) {
          throw new Error(pipelineResult.error || 'Pipeline processing failed');
        }

        result.metrics.transcriptLength = pipelineResult.transcript?.length || 0;
        result.metrics.sceneCount = pipelineResult.scenes?.length || 0;

        // Save transcript
        if (pipelineResult.transcript) {
          const transcriptPath = path.join(this.outputDir, 'transcript.txt');
          fs.writeFileSync(transcriptPath, pipelineResult.transcript);
          result.outputs.transcriptFile = transcriptPath;
        }

        // Save scene data
        if (pipelineResult.scenes) {
          const sceneDataPath = path.join(this.outputDir, 'scene-data.json');
          fs.writeFileSync(
            sceneDataPath,
            JSON.stringify({
              scenes: pipelineResult.scenes,
              metadata: {
                timestamp: new Date().toISOString(),
                audioFile: path.basename(this.audioFilePath),
                transcriptLength: pipelineResult.transcript?.length,
                processingTime: pipelineResult.processingTime
              }
            }, null, 2)
          );
          result.outputs.sceneDataFile = sceneDataPath;
        }

        this.endStage(stage4, true, undefined, {
          '文字起こし長': `${result.metrics.transcriptLength} 文字`,
          'シーン数': result.metrics.sceneCount,
          '処理時間': `${(pipelineResult.processingTime / 1000).toFixed(2)}秒`,
          '成功率': '100%'
        });
      } catch (error) {
        this.endStage(stage4, false, error instanceof Error ? error.message : String(error));
        throw error;
      }

      // Stage 5: Video Generation (if scenes exist)
      if (pipelineResult.scenes && pipelineResult.scenes.length > 0) {
        const stage5 = this.startStage('Stage 5: Video Generation (Remotion)');
        try {
          const { actualVideoRenderer } = await import('../src/lib/actualVideoRenderer');

          const videoOutputPath = path.join(this.outputDir, 'output-video.mp4');

          let lastFrameLogged = 0;
          const renderStartTime = performance.now();

          await actualVideoRenderer.renderVideo(
            {
              scenes: pipelineResult.scenes,
              outputPath: videoOutputPath,
              quality: 'medium'
            },
            (progress) => {
              if (progress.currentFrame > lastFrameLogged + 30) {
                process.stdout.write(
                  `\r   🎬 レンダリング中... Frame ${progress.currentFrame}/${progress.totalFrames} ` +
                  `(${((progress.currentFrame / progress.totalFrames) * 100).toFixed(1)}%)`
                );
                lastFrameLogged = progress.currentFrame;
              }
            }
          );

          console.log('\n');

          const renderDuration = (performance.now() - renderStartTime) / 1000;

          // Check video file
          if (fs.existsSync(videoOutputPath)) {
            const videoStats = fs.statSync(videoOutputPath);
            result.metrics.videoSizeMB = parseFloat((videoStats.size / 1024 / 1024).toFixed(2));
            result.outputs.videoFile = videoOutputPath;

            // Calculate rendering FPS
            const totalFrames = pipelineResult.scenes.reduce((sum: number, scene: any) => {
              const duration = scene.endTime - scene.startTime;
              return sum + (duration * 30); // 30fps
            }, 0);

            result.metrics.renderingFps = parseFloat((totalFrames / renderDuration).toFixed(2));

            this.endStage(stage5, true, undefined, {
              '動画ファイル': videoOutputPath,
              '動画サイズ': `${result.metrics.videoSizeMB} MB`,
              'レンダリング時間': `${renderDuration.toFixed(2)}秒`,
              'レンダリング速度': `${result.metrics.renderingFps} FPS`,
              '品質': 'Medium (1080p, 30fps)'
            });
          } else {
            throw new Error('Video file was not created');
          }
        } catch (error) {
          this.endStage(stage5, false, error instanceof Error ? error.message : String(error));
          console.warn('\n⚠️  Video generation failed, but pipeline test can continue');
          // Don't throw - video generation failure is not critical for phase 7
        }
      }

      // Stage 6: Quality Assessment
      const stage6 = this.startStage('Stage 6: Quality Assessment');
      try {
        // Calculate overall quality score
        let qualityScore = 0;

        // Transcription quality (25%)
        if (result.metrics.transcriptLength && result.metrics.transcriptLength > 50) {
          qualityScore += 25;
        } else if (result.metrics.transcriptLength && result.metrics.transcriptLength > 20) {
          qualityScore += 15;
        }

        // Scene detection quality (25%)
        if (result.metrics.sceneCount && result.metrics.sceneCount > 0) {
          qualityScore += 25;
        }

        // Video generation quality (25%)
        if (result.outputs.videoFile && result.metrics.videoSizeMB && result.metrics.videoSizeMB > 0) {
          qualityScore += 25;
        }

        // Performance quality (25%)
        if (result.metrics.renderingFps && result.metrics.renderingFps > 15) {
          qualityScore += 25;
        } else if (result.metrics.renderingFps && result.metrics.renderingFps > 10) {
          qualityScore += 15;
        }

        result.metrics.qualityScore = qualityScore;

        const qualityLevel =
          qualityScore >= 90 ? 'Excellent (商用利用可能)' :
          qualityScore >= 80 ? 'Good (品質良好)' :
          qualityScore >= 70 ? 'Fair (改善推奨)' :
          'Poor (要改善)';

        this.endStage(stage6, true, undefined, {
          '全体品質スコア': `${qualityScore}/100`,
          '品質レベル': qualityLevel,
          '文字起こし': result.metrics.transcriptLength ? '✅' : '❌',
          'シーン分割': result.metrics.sceneCount ? '✅' : '❌',
          '動画生成': result.outputs.videoFile ? '✅' : '⏭️',
          'パフォーマンス': result.metrics.renderingFps ? `${result.metrics.renderingFps} FPS` : 'N/A'
        });

        result.success = qualityScore >= 70; // Minimum acceptable quality
      } catch (error) {
        this.endStage(stage6, false, error instanceof Error ? error.message : String(error));
        throw error;
      }

    } catch (error) {
      console.error('\n\n❌ Pipeline test failed:', error);
      result.success = false;
    }

    result.totalDuration = (performance.now() - testStartTime) / 1000;
    result.stages = this.stages;

    this.printFinalReport(result);

    return result;
  }

  private printFinalReport(result: TestResult) {
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 FINAL REPORT - Phase 7: Complete Pipeline Test');
    console.log('='.repeat(70) + '\n');

    // Overall status
    console.log(`結果: ${result.success ? '✅ SUCCESS' : '❌ FAILURE'}\n`);

    // Timing breakdown
    console.log('⏱️  処理時間内訳:');
    console.log('-'.repeat(70));
    result.stages.forEach((stage, i) => {
      const status = stage.success ? '✅' : '❌';
      const duration = stage.duration ? (stage.duration / 1000).toFixed(2) : 'N/A';
      console.log(`${i + 1}. ${status} ${stage.name}: ${duration}秒`);
    });
    console.log(`\n   📊 総処理時間: ${result.totalDuration.toFixed(2)}秒\n`);

    // Output files
    console.log('📁 出力ファイル:');
    console.log('-'.repeat(70));
    if (result.outputs.transcriptFile) {
      console.log(`   文字起こし: ${result.outputs.transcriptFile}`);
    }
    if (result.outputs.sceneDataFile) {
      console.log(`   シーンデータ: ${result.outputs.sceneDataFile}`);
    }
    if (result.outputs.videoFile) {
      console.log(`   動画: ${result.outputs.videoFile}`);
    }
    if (Object.keys(result.outputs).length === 0) {
      console.log('   (出力ファイルなし)');
    }
    console.log('');

    // Quality metrics
    console.log('📊 品質メトリクス:');
    console.log('-'.repeat(70));
    console.log(`   音声ファイル: ${result.metrics.audioFileSizeKB} KB`);
    if (result.metrics.transcriptLength) {
      console.log(`   文字起こし: ${result.metrics.transcriptLength} 文字`);
    }
    if (result.metrics.sceneCount) {
      console.log(`   シーン数: ${result.metrics.sceneCount}`);
    }
    if (result.metrics.videoSizeMB) {
      console.log(`   動画サイズ: ${result.metrics.videoSizeMB} MB`);
    }
    if (result.metrics.renderingFps) {
      console.log(`   レンダリング速度: ${result.metrics.renderingFps} FPS`);
    }
    if (result.metrics.qualityScore !== undefined) {
      console.log(`   全体品質スコア: ${result.metrics.qualityScore}/100`);
    }
    console.log('');

    // Recommendations
    console.log('💡 次のステップ:');
    console.log('-'.repeat(70));
    if (result.success) {
      console.log('   ✅ Phase 7完了！プロダクション環境対応準備OK');
      console.log('   📝 次のアクション:');
      console.log('      1. Web UIからの完全フロー確認');
      console.log('      2. 複数の音声ファイルでテスト');
      console.log('      3. エッジケースのテスト');
      console.log('      4. ドキュメント更新');
      console.log('      5. Phase 7をコミット');
    } else {
      console.log('   ⚠️  改善が必要な項目を確認してください');
      console.log('   📝 推奨アクション:');
      console.log('      1. エラーログの詳細確認');
      console.log('      2. 各ステージの個別デバッグ');
      console.log('      3. 依存関係の確認');
    }
    console.log('');

    console.log('='.repeat(70) + '\n');
  }
}

// Main execution
async function main() {
  const audioPath = path.join(process.cwd(), 'public', 'jfk.wav');
  const outputDir = path.join(process.cwd(), 'test-output-phase7');

  const test = new CompleteAudioPipelineTest(audioPath, outputDir);
  const result = await test.run();

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
