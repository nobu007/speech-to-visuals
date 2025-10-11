#!/usr/bin/env tsx
/**
 * CLI Script: Render video from scene data
 * 使い方: tsx scripts/render-video.ts <input-json> [output-path]
 */

import { actualVideoRenderer } from '../src/lib/actualVideoRenderer';
import { SceneGraph } from '../src/types/diagram';
import fs from 'fs';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('使い方: tsx scripts/render-video.ts <input-json> [output-path]');
    console.log('');
    console.log('例:');
    console.log('  tsx scripts/render-video.ts scene-data.json');
    console.log('  tsx scripts/render-video.ts scene-data.json output.mp4');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputPath = args[1];

  // 入力ファイルを読み込み
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ エラー: ファイルが見つかりません: ${inputFile}`);
    process.exit(1);
  }

  const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  if (!inputData.scenes || !Array.isArray(inputData.scenes)) {
    console.error('❌ エラー: 有効なシーンデータがありません');
    process.exit(1);
  }

  const scenes: SceneGraph[] = inputData.scenes;
  const audioUrl = inputData.audioUrl;

  console.log('📊 入力データ:');
  console.log(`  シーン数: ${scenes.length}`);
  console.log(`  音声URL: ${audioUrl || 'なし'}`);
  console.log('');

  console.log('🎬 動画レンダリングを開始...');
  console.log('');

  try {
    const videoPath = await actualVideoRenderer.renderVideo(
      {
        scenes,
        audioUrl,
        outputPath,
        quality: 'medium',
      },
      (progress) => {
        // プログレスバー表示
        const bar = '█'.repeat(Math.floor(progress.progress / 2));
        const empty = '░'.repeat(50 - Math.floor(progress.progress / 2));
        const percentage = progress.progress.toFixed(1);

        process.stdout.write(`\r[${bar}${empty}] ${percentage}% - ${progress.message}`);

        if (progress.stage === 'complete') {
          process.stdout.write('\n');
        }
      }
    );

    console.log('');
    console.log('✅ 動画レンダリング完了!');
    console.log(`📁 出力先: ${videoPath}`);
    console.log('');

    // ファイルサイズを表示
    const stats = fs.statSync(videoPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📦 ファイルサイズ: ${fileSizeMB} MB`);

  } catch (error) {
    console.log('');
    console.error('❌ レンダリングエラー:', error);
    process.exit(1);
  }
}

main();
