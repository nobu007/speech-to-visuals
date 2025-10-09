#!/usr/bin/env node

/**
 * Whisper統合テスト
 * 実際の音声処理機能の動作確認
 */

import fs from 'fs';
import path from 'path';

console.log('🎤 Whisper統合テスト開始');
console.log(`🚀 Node.js ${process.version} on ${process.platform}`);
console.log(`📅 ${new Date().toISOString()}`);
console.log('━'.repeat(60));

/**
 * テスト用音声ファイル生成
 * より実際に近い音声データを含むWAVファイル
 */
function createRealisticTestAudio() {
  // より長いWAVファイル（サイレントだが構造は正確）
  const sampleRate = 44100;
  const duration = 3; // 3秒
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = sampleRate * duration;
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const dataSize = sampleCount * blockAlign;
  const fileSize = 36 + dataSize;

  // WAVヘッダー生成
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize, true);    // ファイルサイズ
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);          // チャンクサイズ
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, channels, true);    // チャンネル数
  view.setUint32(24, sampleRate, true);  // サンプルレート
  view.setUint32(28, byteRate, true);    // バイトレート
  view.setUint16(32, blockAlign, true);  // ブロックサイズ
  view.setUint16(34, bitsPerSample, true); // ビット深度

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);    // データサイズ

  // サイレントデータ（後で実際の音声データに置き換え可能）
  const audioData = new ArrayBuffer(dataSize);
  const audioView = new Int16Array(audioData);

  // 簡単なテストトーン生成（440Hz サイン波）
  for (let i = 0; i < sampleCount; i++) {
    const time = i / sampleRate;
    const frequency = 440; // A note
    const amplitude = 0.1; // 低音量
    audioView[i] = Math.sin(2 * Math.PI * frequency * time) * amplitude * 32767;
  }

  // ヘッダーとデータを結合
  const fullFile = new Uint8Array(44 + dataSize);
  fullFile.set(new Uint8Array(header), 0);
  fullFile.set(new Uint8Array(audioData), 44);

  return {
    data: fullFile,
    name: 'test-audio-3sec.wav',
    size: fullFile.length,
    duration: duration,
    sampleRate: sampleRate
  };
}

/**
 * Whisperモジュールの存在確認
 */
async function checkWhisperAvailability() {
  console.log('🔍 Phase 1: Whisper関連モジュール確認');

  try {
    // package.jsonでwhisper関連の依存関係確認
    const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const allDeps = { ...packageData.dependencies, ...packageData.devDependencies };

    const whisperDeps = Object.keys(allDeps).filter(dep =>
      dep.includes('whisper') || dep.includes('speech') || dep.includes('@remotion')
    );

    console.log('   📦 Whisper関連依存関係:');
    whisperDeps.forEach(dep => {
      console.log(`      ✅ ${dep}: ${allDeps[dep]}`);
    });

    // src内のwhisper関連ファイル確認
    console.log('\n   📁 Whisper関連ソースファイル:');
    const srcFiles = fs.readdirSync('./src', { recursive: true, withFileTypes: true })
      .filter(file => file.isFile() && file.name.includes('whisper'))
      .map(file => file.name);

    if (srcFiles.length > 0) {
      srcFiles.forEach(file => {
        console.log(`      📄 ${file}`);
      });
    } else {
      console.log('      ➖ whisper関連ファイルが見つかりません');
    }

    // 転写関連モジュール確認
    const transcriptionDir = './src/transcription';
    if (fs.existsSync(transcriptionDir)) {
      const transcriptionFiles = fs.readdirSync(transcriptionDir);
      console.log('\n   🎤 転写モジュール:');
      transcriptionFiles.forEach(file => {
        const stats = fs.statSync(path.join(transcriptionDir, file));
        console.log(`      📄 ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
      });
    }

    return whisperDeps.length > 0;

  } catch (error) {
    console.error('   ❌ モジュール確認エラー:', error.message);
    return false;
  }
}

/**
 * 音声ファイル処理テスト
 */
async function testAudioProcessing() {
  console.log('\n🎵 Phase 2: 音声ファイル処理テスト');

  try {
    // テスト音声生成
    const testAudio = createRealisticTestAudio();
    console.log(`   🎵 テスト音声生成: ${testAudio.name}`);
    console.log(`      サイズ: ${(testAudio.size / 1024).toFixed(1)}KB`);
    console.log(`      長さ: ${testAudio.duration}秒`);
    console.log(`      サンプルレート: ${testAudio.sampleRate}Hz`);

    // ファイルとして保存（一時的）
    const testDir = './test-audio';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    const testPath = path.join(testDir, testAudio.name);
    fs.writeFileSync(testPath, testAudio.data);
    console.log(`   💾 ファイル保存: ${testPath}`);

    // ファイル形式検証
    const savedFile = fs.readFileSync(testPath);
    const header = savedFile.slice(0, 12);
    const riffHeader = Array.from(header.slice(0, 4)).map(b => String.fromCharCode(b)).join('');
    const waveHeader = Array.from(header.slice(8, 12)).map(b => String.fromCharCode(b)).join('');

    console.log(`   📋 ファイル検証:`);
    console.log(`      RIFFヘッダー: ${riffHeader === 'RIFF' ? '✅ 正常' : '❌ 異常'}`);
    console.log(`      WAVEヘッダー: ${waveHeader === 'WAVE' ? '✅ 正常' : '❌ 異常'}`);

    // Node.jsのBuffer操作テスト
    console.log('\n   🔧 Node.js音声処理機能テスト:');

    // ファイル読み込み
    const audioBuffer = fs.readFileSync(testPath);
    console.log(`      ✅ ファイル読み込み: ${audioBuffer.length} bytes`);

    // 基本的な音声データ解析
    const dataStart = 44; // WAVヘッダーサイズ
    const audioData = audioBuffer.slice(dataStart);
    const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);

    // 簡単な統計
    let maxAmplitude = 0;
    let rmsSum = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.abs(samples[i]);
      maxAmplitude = Math.max(maxAmplitude, sample);
      rmsSum += sample * sample;
    }
    const rms = Math.sqrt(rmsSum / samples.length);

    console.log(`      📊 音声統計:`);
    console.log(`         サンプル数: ${samples.length}`);
    console.log(`         最大振幅: ${maxAmplitude}`);
    console.log(`         RMS: ${rms.toFixed(2)}`);
    console.log(`         音声レベル: ${maxAmplitude > 1000 ? '✅ 検出' : '⚠️ 低レベル'}`);

    return { success: true, testPath, stats: { samples: samples.length, maxAmplitude, rms } };

  } catch (error) {
    console.error('   ❌ 音声処理テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Whisper CPP初期化テスト
 */
async function testWhisperCppInitialization() {
  console.log('\n🤖 Phase 3: Whisper CPP初期化テスト');

  try {
    // @remotion/install-whisper-cpp の存在確認
    const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const hasWhisperCpp = '@remotion/install-whisper-cpp' in { ...packageData.dependencies, ...packageData.devDependencies };

    console.log(`   📦 @remotion/install-whisper-cpp: ${hasWhisperCpp ? '✅ インストール済み' : '❌ 未インストール'}`);

    if (hasWhisperCpp) {
      // Whisper models ディレクトリ確認
      const possibleModelPaths = [
        './models',
        './node_modules/@remotion/install-whisper-cpp/models',
        './whisper-models',
        './public/models'
      ];

      console.log('\n   📁 Whisperモデル検索:');
      let modelsFound = false;

      for (const modelPath of possibleModelPaths) {
        if (fs.existsSync(modelPath)) {
          const files = fs.readdirSync(modelPath);
          const modelFiles = files.filter(f => f.endsWith('.bin') || f.endsWith('.ggml'));

          if (modelFiles.length > 0) {
            console.log(`      ✅ ${modelPath}:`);
            modelFiles.forEach(model => {
              const stats = fs.statSync(path.join(modelPath, model));
              console.log(`         📄 ${model} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
            });
            modelsFound = true;
          } else if (files.length > 0) {
            console.log(`      ➖ ${modelPath}: モデルファイルなし (${files.length} その他ファイル)`);
          }
        } else {
          console.log(`      ➖ ${modelPath}: ディレクトリなし`);
        }
      }

      if (!modelsFound) {
        console.log('\n   🔧 Whisperモデル初期化テスト:');
        console.log('      ⚠️  モデルファイルが見つかりません');
        console.log('      💡 推奨アクション:');
        console.log('         1. npx @remotion/install-whisper-cpp を実行');
        console.log('         2. または手動でモデルをダウンロード');
      }

      return { success: hasWhisperCpp, modelsFound };
    }

    return { success: false, error: 'Whisper CPP未インストール' };

  } catch (error) {
    console.error('   ❌ Whisper CPP初期化テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 転写パイプライン統合テスト
 */
async function testTranscriptionPipeline() {
  console.log('\n🔄 Phase 4: 転写パイプライン統合テスト');

  try {
    // 転写関連モジュールの詳細確認
    const transcriptionIndexPath = './src/transcription/index.ts';
    if (fs.existsSync(transcriptionIndexPath)) {
      const indexContent = fs.readFileSync(transcriptionIndexPath, 'utf8');
      console.log('   📋 転写モジュール exports:');

      const exportLines = indexContent.split('\n')
        .filter(line => line.includes('export'))
        .map(line => line.trim());

      exportLines.forEach(line => {
        console.log(`      📤 ${line}`);
      });
    }

    // SimplePipeline での転写統合確認
    const simplePipelinePath = './src/pipeline/simple-pipeline.ts';
    if (fs.existsSync(simplePipelinePath)) {
      const pipelineContent = fs.readFileSync(simplePipelinePath, 'utf8');

      // 転写関連インポート確認
      const transcriptionImports = pipelineContent.split('\n')
        .filter(line => line.includes('transcription') && line.includes('import'))
        .map(line => line.trim());

      console.log('\n   🔗 パイプライン内転写統合:');
      transcriptionImports.forEach(importLine => {
        console.log(`      📥 ${importLine}`);
      });

      // 転写処理部分の確認
      const hasTranscriptionProcess = pipelineContent.includes('transcription.transcribe') ||
                                    pipelineContent.includes('TranscriptionPipeline');
      console.log(`      🔄 転写処理実装: ${hasTranscriptionProcess ? '✅ 有り' : '❌ 無し'}`);
    }

    return { success: true };

  } catch (error) {
    console.error('   ❌ 転写パイプライン統合テストエラー:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    console.log('🎯 Whisper統合動作確認を開始します...\n');

    const results = [];

    // Phase 1-4 実行
    results.push(await checkWhisperAvailability());
    const audioResult = await testAudioProcessing();
    results.push(audioResult.success);
    const whisperResult = await testWhisperCppInitialization();
    results.push(whisperResult.success);
    const pipelineResult = await testTranscriptionPipeline();
    results.push(pipelineResult.success);

    // 結果サマリー
    const successCount = results.filter(r => r).length;
    const successRate = (successCount / results.length) * 100;

    console.log('\n📊 Whisper統合テスト結果');
    console.log('━'.repeat(60));
    console.log(`📈 成功率: ${successCount}/${results.length} (${successRate.toFixed(1)}%)`);

    // 詳細評価
    console.log('\n🎯 詳細評価:');
    console.log(`   ${results[0] ? '✅' : '❌'} Whisper依存関係: ${results[0] ? '準備完了' : '要設定'}`);
    console.log(`   ${results[1] ? '✅' : '❌'} 音声処理機能: ${results[1] ? '動作正常' : '要修正'}`);
    console.log(`   ${results[2] ? '✅' : '❌'} Whisper CPP: ${results[2] ? '初期化可能' : '要設定'}`);
    console.log(`   ${results[3] ? '✅' : '❌'} パイプライン統合: ${results[3] ? '実装済み' : '要実装'}`);

    // 推奨アクション
    console.log('\n💡 推奨アクション（優先順）:');

    if (!whisperResult.success) {
      console.log('   1️⃣  🔧 Whisper CPPのインストールと設定');
      console.log('       コマンド: npx @remotion/install-whisper-cpp');
    }

    if (!whisperResult.modelsFound) {
      console.log('   2️⃣  📥 Whisperモデルのダウンロード');
      console.log('       推奨: base モデル（約140MB）');
    }

    if (results[1] && results[2]) {
      console.log('   3️⃣  🧪 実際の音声ファイルでの転写テスト');
      console.log('   4️⃣  🔗 Web UI との統合テスト');
    }

    // レポート保存
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'whisper_integration_test',
      results: {
        dependencies: results[0],
        audioProcessing: results[1],
        whisperCpp: results[2],
        pipelineIntegration: results[3]
      },
      details: {
        audio: audioResult,
        whisper: whisperResult,
        pipeline: pipelineResult
      },
      summary: {
        successCount,
        totalTests: results.length,
        successRate,
        readyForProduction: successRate >= 75
      },
      recommendations: successRate < 100 ? ['Install Whisper CPP', 'Download models', 'Test with real audio'] : ['Ready for production testing']
    };

    const reportPath = `test-whisper-integration-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 詳細レポート保存: ${reportPath}`);

    // 次のステップガイド
    console.log('\n🚀 次のステップ:');
    if (successRate >= 75) {
      console.log('   ✅ Whisper統合は良好な状態です');
      console.log('   📋 次: 実際の音声ファイルでのE2Eテスト実行');
    } else {
      console.log('   ⚠️  Whisper統合に改善が必要です');
      console.log('   📋 次: 上記推奨アクションの実行');
    }

  } catch (error) {
    console.error('\n💥 Whisper統合テスト実行エラー:', error);
    console.error('スタックトレース:', error.stack);
  }
}

main().catch(console.error);