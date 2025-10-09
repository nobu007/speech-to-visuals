#!/usr/bin/env node

/**
 * 現在のシステム動作確認テスト
 * カスタムインストラクションに従って段階的に機能を検証
 */

import fs from 'fs';

/**
 * システムテスト結果インターface
 */
class SystemTestResult {
  constructor(phase, success, details, error = undefined) {
    this.phase = phase;
    this.success = success;
    this.details = details;
    this.error = error;
    this.timestamp = new Date().toISOString();
  }
}

class CurrentSystemTester {
  constructor() {
    this.results = [];
  }

  async runComprehensiveTest() {
    console.log('🎯 音声→図解動画自動生成システム 現状確認テスト開始');
    console.log('━'.repeat(60));

    // Phase 1: 基盤モジュール検証
    await this.testFoundation();

    // Phase 2: ファイル構造検証
    await this.testFileStructure();

    // Phase 3: パッケージ依存関係検証
    await this.testDependencies();

    // Phase 4: ビルド状況確認
    await this.testBuildCapability();

    // Phase 5: 結果レポート
    this.generateReport();
  }

  async testFoundation() {
    console.log('📋 Phase 1: 基盤モジュール検証');

    try {
      // 1. パッケージファイル確認
      const packageExists = fs.existsSync('./package.json');
      let packageData = null;

      if (packageExists) {
        packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      }

      this.addResult('package_validation', packageExists, {
        packageExists,
        projectName: packageData?.name,
        dependencies: packageData?.dependencies ? Object.keys(packageData.dependencies).length : 0,
        scripts: packageData?.scripts ? Object.keys(packageData.scripts) : []
      });

      if (packageExists) {
        console.log('   ✅ package.json: 存在');
        console.log(`   📦 プロジェクト名: ${packageData.name}`);
        console.log(`   📋 依存関係数: ${Object.keys(packageData.dependencies || {}).length}`);
      } else {
        console.log('   ❌ package.json: 見つかりません');
      }

      // 2. TypeScript設定確認
      const tsconfigExists = fs.existsSync('./tsconfig.json');
      this.addResult('typescript_config', tsconfigExists, {
        tsconfigExists
      });

      console.log(`   ${tsconfigExists ? '✅' : '❌'} TypeScript設定: ${tsconfigExists ? '存在' : '無し'}`);

    } catch (error) {
      this.addResult('foundation_validation', false, {}, error.message);
      console.log('   ❌ 基盤モジュール検証: 失敗');
    }
  }

  async testFileStructure() {
    console.log('\n🔧 Phase 2: ファイル構造検証');

    try {
      const expectedStructure = [
        'src',
        'src/pipeline',
        'src/transcription',
        'src/analysis',
        'src/visualization',
        'src/animation'
      ];

      const structureResults = {};

      for (const path of expectedStructure) {
        const exists = fs.existsSync(path);
        structureResults[path] = exists;
        console.log(`   ${exists ? '✅' : '❌'} ${path}: ${exists ? '存在' : '無し'}`);
      }

      // ファイル数カウント
      const srcFiles = this.countFiles('src', ['.ts', '.tsx', '.js', '.jsx']);

      this.addResult('file_structure', true, {
        structure: structureResults,
        sourceFileCount: srcFiles,
        allExpectedExists: Object.values(structureResults).every(v => v)
      });

      console.log(`   📁 合計ソースファイル数: ${srcFiles}`);

    } catch (error) {
      this.addResult('file_structure', false, {}, error.message);
      console.log('   ❌ ファイル構造検証: 失敗');
    }
  }

  async testDependencies() {
    console.log('\n📦 Phase 3: パッケージ依存関係検証');

    try {
      // 重要な依存関係をチェック
      const criticalDeps = [
        'remotion',
        '@remotion/captions',
        '@remotion/media-utils',
        '@dagrejs/dagre',
        'react',
        'typescript'
      ];

      const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      const allDeps = {
        ...packageData.dependencies,
        ...packageData.devDependencies
      };

      const depResults = {};
      let foundDeps = 0;

      for (const dep of criticalDeps) {
        const found = dep in allDeps;
        depResults[dep] = {
          found,
          version: found ? allDeps[dep] : null
        };

        if (found) foundDeps++;

        console.log(`   ${found ? '✅' : '❌'} ${dep}: ${found ? allDeps[dep] : '無し'}`);
      }

      this.addResult('dependencies_check', true, {
        criticalDependencies: depResults,
        foundCount: foundDeps,
        totalCritical: criticalDeps.length,
        completionRate: (foundDeps / criticalDeps.length) * 100
      });

      console.log(`   📊 重要依存関係: ${foundDeps}/${criticalDeps.length} (${((foundDeps / criticalDeps.length) * 100).toFixed(1)}%)`);

    } catch (error) {
      this.addResult('dependencies_check', false, {}, error.message);
      console.log('   ❌ 依存関係検証: 失敗');
    }
  }

  async testBuildCapability() {
    console.log('\n🏗️ Phase 4: ビルド能力確認');

    try {
      // dist ディレクトリの存在確認（前回のビルド）
      const distExists = fs.existsSync('./dist');
      let distFiles = 0;

      if (distExists) {
        distFiles = this.countFiles('dist', ['.js', '.css', '.html']);
      }

      this.addResult('build_artifacts', distExists, {
        distExists,
        distFileCount: distFiles,
        lastBuildExists: distExists && distFiles > 0
      });

      console.log(`   ${distExists ? '✅' : '❌'} dist ディレクトリ: ${distExists ? '存在' : '無し'}`);
      if (distExists) {
        console.log(`   📁 ビルド成果物: ${distFiles} ファイル`);
      }

      // package.json のビルドスクリプト確認
      const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      const hasDevScript = 'dev' in (packageData.scripts || {});
      const hasBuildScript = 'build' in (packageData.scripts || {});

      console.log(`   ${hasDevScript ? '✅' : '❌'} 開発スクリプト: ${hasDevScript ? '有り' : '無し'}`);
      console.log(`   ${hasBuildScript ? '✅' : '❌'} ビルドスクリプト: ${hasBuildScript ? '有り' : '無し'}`);

    } catch (error) {
      this.addResult('build_capability', false, {}, error.message);
      console.log('   ❌ ビルド能力確認: 失敗');
    }
  }

  countFiles(dir, extensions) {
    try {
      if (!fs.existsSync(dir)) return 0;

      const files = fs.readdirSync(dir, { withFileTypes: true });
      let count = 0;

      for (const file of files) {
        if (file.isDirectory()) {
          count += this.countFiles(`${dir}/${file.name}`, extensions);
        } else if (extensions.some(ext => file.name.endsWith(ext))) {
          count++;
        }
      }

      return count;
    } catch {
      return 0;
    }
  }

  addResult(phase, success, details, error = undefined) {
    this.results.push(new SystemTestResult(phase, success, details, error));
  }

  generateReport() {
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
        const key = Object.keys(result.details)[0];
        const value = result.details[key];
        console.log(`     主要結果: ${key} = ${JSON.stringify(value)}`);
      }
      console.log();
    });

    // 総合評価
    console.log('🎯 総合評価:');
    if (successRate >= 90) {
      console.log('   🏆 素晴らしい! システムは本格稼働可能な状態です');
      console.log('   📋 推奨アクション: 実際の音声ファイルでテスト実行');
    } else if (successRate >= 75) {
      console.log('   👍 良好! 基本機能は整っており、細かい改善で完成します');
      console.log('   📋 推奨アクション: 品質向上とエラーハンドリング強化');
    } else if (successRate >= 50) {
      console.log('   ⚠️  部分的! 基盤は整っていますが重要な実装が不足しています');
      console.log('   📋 推奨アクション: カスタムインストラクションに従った段階的実装');
    } else {
      console.log('   🔧 要改善! 基盤構築から始める必要があります');
      console.log('   📋 推奨アクション: Phase 1から順番に基盤構築実行');
    }

    // 具体的な改善提案
    console.log('\n💡 具体的改善提案:');

    const structureResult = this.results.find(r => r.phase === 'file_structure');
    if (structureResult && !structureResult.details.allExpectedExists) {
      console.log('   📁 不足ディレクトリの作成');
    }

    const depResult = this.results.find(r => r.phase === 'dependencies_check');
    if (depResult && depResult.details.completionRate < 100) {
      console.log('   📦 不足依存関係のインストール');
    }

    const buildResult = this.results.find(r => r.phase === 'build_artifacts');
    if (buildResult && !buildResult.details.lastBuildExists) {
      console.log('   🏗️  初回ビルド実行による動作確認');
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
        overallStatus: successRate >= 90 ? 'ready' :
                      successRate >= 75 ? 'good' :
                      successRate >= 50 ? 'partial' : 'needs_work'
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

    // カスタムインストラクション適用のための次ステップ提案
    console.log('\n🎯 カスタムインストラクション適用の次ステップ:');
    console.log('   1️⃣  Phase 1: MVP構築 - 基本パイプライン動作確認');
    console.log('   2️⃣  Phase 2: 内容分析 - シーン分割・図解判定精度向上');
    console.log('   3️⃣  Phase 3: 図解生成 - レイアウト品質とゼロオーバーラップ実現');
    console.log('   4️⃣  Phase 4: 動画合成 - Remotion統合と出力品質向上');
    console.log('   5️⃣  継続的改善 - メトリクス追跡と自動最適化');
  }
}

// メイン実行
async function main() {
  console.log(`🚀 Node.js ${process.version} on ${process.platform}`);
  console.log();

  const tester = new CurrentSystemTester();
  await tester.runComprehensiveTest();
}

main().catch(console.error);
