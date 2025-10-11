/**
 * Batch Audio Pipeline - 複数音声ファイルのバッチ処理スクリプト
 *
 * Phase 8: 高度な機能拡張
 * - 複数音声ファイルの連続処理
 * - 並列処理オプション
 * - 詳細なレポート生成
 * - エラーリカバリー機能
 */

import * as fs from 'fs';
import * as path from 'path';
import { simplePipeline } from '../src/pipeline/simple-pipeline';

interface BatchConfig {
  inputDir: string;
  outputDir: string;
  parallel?: boolean;
  maxParallel?: number;
  includeVideo?: boolean;
  continueOnError?: boolean;
}

interface ProcessingResult {
  fileName: string;
  success: boolean;
  processingTime: number;
  sceneCount: number;
  transcriptLength: number;
  videoGenerated: boolean;
  error?: string;
}

interface BatchReport {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  results: ProcessingResult[];
  startTime: string;
  endTime: string;
}

class BatchAudioPipeline {
  private config: BatchConfig;
  private results: ProcessingResult[] = [];

  constructor(config: BatchConfig) {
    this.config = {
      parallel: false,
      maxParallel: 3,
      includeVideo: true,
      continueOnError: true,
      ...config
    };
  }

  /**
   * バッチ処理実行
   */
  async execute(): Promise<BatchReport> {
    console.log('🚀 Starting batch audio pipeline...');
    console.log(`📁 Input directory: ${this.config.inputDir}`);
    console.log(`📂 Output directory: ${this.config.outputDir}`);
    console.log(`⚙️  Parallel: ${this.config.parallel}, Max: ${this.config.maxParallel}`);
    console.log(`🎬 Include video: ${this.config.includeVideo}`);

    const startTime = new Date();

    // 音声ファイル検出
    const audioFiles = this.findAudioFiles(this.config.inputDir);
    console.log(`\n🔍 Found ${audioFiles.length} audio files`);

    if (audioFiles.length === 0) {
      throw new Error('No audio files found in input directory');
    }

    // 出力ディレクトリ作成
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // 処理実行
    if (this.config.parallel) {
      await this.processParallel(audioFiles);
    } else {
      await this.processSequential(audioFiles);
    }

    const endTime = new Date();

    // レポート生成
    const report = this.generateReport(startTime, endTime);
    this.saveReport(report);

    return report;
  }

  /**
   * 音声ファイル検出
   */
  private findAudioFiles(dir: string): string[] {
    const supportedExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];
    const files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files.sort();
  }

  /**
   * 順次処理
   */
  private async processSequential(audioFiles: string[]): Promise<void> {
    console.log('\n📝 Processing files sequentially...\n');

    for (let i = 0; i < audioFiles.length; i++) {
      const filePath = audioFiles[i];
      console.log(`\n[${i + 1}/${audioFiles.length}] Processing: ${path.basename(filePath)}`);

      try {
        const result = await this.processFile(filePath);
        this.results.push(result);

        if (result.success) {
          console.log(`✅ Success: ${result.sceneCount} scenes, ${(result.processingTime / 1000).toFixed(1)}s`);
        } else {
          console.log(`❌ Failed: ${result.error}`);
          if (!this.config.continueOnError) {
            throw new Error(`Processing stopped due to error: ${result.error}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
        if (!this.config.continueOnError) {
          throw error;
        }
      }
    }
  }

  /**
   * 並列処理
   */
  private async processParallel(audioFiles: string[]): Promise<void> {
    console.log(`\n⚡ Processing files in parallel (max ${this.config.maxParallel})...\n`);

    const chunks: string[][] = [];
    for (let i = 0; i < audioFiles.length; i += this.config.maxParallel!) {
      chunks.push(audioFiles.slice(i, i + this.config.maxParallel!));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`\n🔄 Batch ${chunkIndex + 1}/${chunks.length}: Processing ${chunk.length} files...`);

      const promises = chunk.map((filePath, i) => {
        const globalIndex = chunkIndex * this.config.maxParallel! + i + 1;
        console.log(`  [${globalIndex}/${audioFiles.length}] Starting: ${path.basename(filePath)}`);
        return this.processFile(filePath);
      });

      const results = await Promise.allSettled(promises);

      results.forEach((result, i) => {
        const filePath = chunk[i];
        if (result.status === 'fulfilled') {
          this.results.push(result.value);
          if (result.value.success) {
            console.log(`  ✅ ${path.basename(filePath)}: ${result.value.sceneCount} scenes`);
          } else {
            console.log(`  ❌ ${path.basename(filePath)}: ${result.value.error}`);
          }
        } else {
          console.error(`  ❌ ${path.basename(filePath)}: ${result.reason}`);
          this.results.push({
            fileName: path.basename(filePath),
            success: false,
            processingTime: 0,
            sceneCount: 0,
            transcriptLength: 0,
            videoGenerated: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }
  }

  /**
   * 単一ファイル処理
   */
  private async processFile(filePath: string): Promise<ProcessingResult> {
    const fileName = path.basename(filePath);
    const startTime = Date.now();

    try {
      // File objectを作成
      const fileBuffer = fs.readFileSync(filePath);
      const file = new File([fileBuffer], fileName, {
        type: this.getMimeType(filePath)
      });

      // SimplePipeline処理
      const result = await simplePipeline.processWithRetry(
        {
          audioFile: file,
          options: {
            includeVideoGeneration: this.config.includeVideo
          }
        },
        (step, progress) => {
          // Progress logging (optional)
          // console.log(`    ${step}: ${progress}%`);
        },
        2 // max retries
      );

      const processingTime = Date.now() - startTime;

      // 結果を保存
      await this.saveResults(fileName, result, processingTime);

      return {
        fileName,
        success: result.success,
        processingTime,
        sceneCount: result.scenes?.length || 0,
        transcriptLength: result.transcript?.length || 0,
        videoGenerated: !!result.videoUrl,
        error: result.error
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        fileName,
        success: false,
        processingTime,
        sceneCount: 0,
        transcriptLength: 0,
        videoGenerated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 結果を保存
   */
  private async saveResults(fileName: string, result: any, processingTime: number): Promise<void> {
    const baseName = path.basename(fileName, path.extname(fileName));
    const outputBase = path.join(this.config.outputDir, baseName);

    // JSON結果保存
    const jsonData = {
      fileName,
      processingTime,
      timestamp: new Date().toISOString(),
      ...result
    };

    fs.writeFileSync(
      `${outputBase}-result.json`,
      JSON.stringify(jsonData, null, 2)
    );

    // テキスト文字起こし保存
    if (result.transcript) {
      fs.writeFileSync(`${outputBase}-transcript.txt`, result.transcript);
    }

    // シーンデータ保存
    if (result.scenes) {
      fs.writeFileSync(
        `${outputBase}-scenes.json`,
        JSON.stringify(result.scenes, null, 2)
      );
    }

    console.log(`    💾 Saved results to: ${outputBase}-*.json`);
  }

  /**
   * レポート生成
   */
  private generateReport(startTime: Date, endTime: Date): BatchReport {
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.length - successCount;
    const totalProcessingTime = this.results.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = this.results.length > 0 ? totalProcessingTime / this.results.length : 0;

    return {
      totalFiles: this.results.length,
      successCount,
      failureCount,
      totalProcessingTime,
      averageProcessingTime,
      results: this.results,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
  }

  /**
   * レポート保存
   */
  private saveReport(report: BatchReport): void {
    const reportPath = path.join(this.config.outputDir, 'batch-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // コンソールレポート
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH PROCESSING REPORT');
    console.log('='.repeat(60));
    console.log(`Total Files: ${report.totalFiles}`);
    console.log(`✅ Success: ${report.successCount}`);
    console.log(`❌ Failure: ${report.failureCount}`);
    console.log(`⏱️  Total Time: ${(report.totalProcessingTime / 1000).toFixed(1)}s`);
    console.log(`📈 Average Time: ${(report.averageProcessingTime / 1000).toFixed(1)}s per file`);
    console.log(`🕐 Started: ${report.startTime}`);
    console.log(`🕑 Ended: ${report.endTime}`);
    console.log(`📁 Report saved: ${reportPath}`);
    console.log('='.repeat(60));

    if (report.failureCount > 0) {
      console.log('\n❌ Failed files:');
      report.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.fileName}: ${r.error}`));
    }
  }

  /**
   * MIMEタイプ取得
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/m4a'
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }
}

/**
 * CLI実行
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: tsx scripts/batch-audio-pipeline.ts <input-dir> <output-dir> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --parallel              Enable parallel processing');
    console.log('  --max-parallel <n>      Max parallel jobs (default: 3)');
    console.log('  --no-video              Skip video generation');
    console.log('  --stop-on-error         Stop on first error');
    console.log('');
    console.log('Examples:');
    console.log('  tsx scripts/batch-audio-pipeline.ts ./audio-samples ./output');
    console.log('  tsx scripts/batch-audio-pipeline.ts ./audio ./output --parallel --max-parallel 5');
    console.log('  tsx scripts/batch-audio-pipeline.ts ./audio ./output --no-video');
    process.exit(1);
  }

  const inputDir = args[0];
  const outputDir = args[1];

  const config: BatchConfig = {
    inputDir,
    outputDir,
    parallel: args.includes('--parallel'),
    maxParallel: 3,
    includeVideo: !args.includes('--no-video'),
    continueOnError: !args.includes('--stop-on-error')
  };

  // --max-parallelオプション処理
  const maxParallelIndex = args.indexOf('--max-parallel');
  if (maxParallelIndex !== -1 && args[maxParallelIndex + 1]) {
    config.maxParallel = parseInt(args[maxParallelIndex + 1], 10);
  }

  console.log('🎯 Batch Audio Pipeline Configuration:');
  console.log(JSON.stringify(config, null, 2));
  console.log('');

  try {
    const pipeline = new BatchAudioPipeline(config);
    const report = await pipeline.execute();

    console.log('\n✅ Batch processing completed successfully!');
    process.exit(report.failureCount > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Batch processing failed:', error);
    process.exit(1);
  }
}

// CLI実行
// ESモジュール対応: import.meta.urlを使用
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}

export { BatchAudioPipeline, BatchConfig, ProcessingResult, BatchReport };
