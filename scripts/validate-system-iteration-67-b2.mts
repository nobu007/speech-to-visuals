#!/usr/bin/env node
/**
 * Iteration 67 Phase B2: System Validation Script
 * カスタムインストラクション準拠 - 段階的検証アプローチ
 *
 * 目的: 現在のシステム状態を検証し、次のイテレーションに進む準備ができているか確認
 */

interface ValidationResult {
  category: string;
  check: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  metrics?: Record<string, any>;
}

interface SystemValidation {
  timestamp: string;
  iteration: string;
  phase: string;
  results: ValidationResult[];
  overallStatus: 'ready' | 'needs_improvement' | 'critical';
  nextSteps: string[];
}

/**
 * Iteration 1: 最小限の検証（ファイル存在チェック）
 */
async function validateIteration1(): Promise<ValidationResult[]> {
  console.log('[Iteration 67.B2.1] 基本ファイル構造の検証中...\n');

  const results: ValidationResult[] = [];

  // 必須ファイルのチェック
  const requiredFiles = [
    'src/api/server.ts',
    'src/api/index.ts',
    'src/api/websocket.ts',
    'src/services/workspace-manager.ts',
    'src/types/workspace.ts',
    'package.json'
  ];

  const fs = await import('fs/promises');

  for (const file of requiredFiles) {
    try {
      await fs.access(file);
      results.push({
        category: 'File Structure',
        check: `File exists: ${file}`,
        status: 'pass',
        message: `✓ ${file} found`
      });
    } catch {
      results.push({
        category: 'File Structure',
        check: `File exists: ${file}`,
        status: 'fail',
        message: `✗ ${file} missing`
      });
    }
  }

  return results;
}

/**
 * Iteration 2: TypeScript コンパイルチェック
 */
async function validateIteration2(): Promise<ValidationResult[]> {
  console.log('[Iteration 67.B2.2] TypeScript型整合性の検証中...\n');

  const results: ValidationResult[] = [];

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const startTime = Date.now();
    await execAsync('npx tsc --noEmit --skipLibCheck');
    const duration = Date.now() - startTime;

    results.push({
      category: 'TypeScript',
      check: 'Type checking',
      status: 'pass',
      message: `✓ TypeScript compilation successful`,
      metrics: { duration_ms: duration }
    });
  } catch (error: any) {
    results.push({
      category: 'TypeScript',
      check: 'Type checking',
      status: 'fail',
      message: `✗ TypeScript errors detected`,
      metrics: { error: error.message }
    });
  }

  return results;
}

/**
 * Iteration 3: 依存関係整合性チェック
 */
async function validateIteration3(): Promise<ValidationResult[]> {
  console.log('[Iteration 67.B2.3] 依存関係の検証中...\n');

  const results: ValidationResult[] = [];

  try {
    const fs = await import('fs/promises');
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));

    const requiredDeps = [
      'express',
      'socket.io',
      'cors',
      'helmet',
      'dotenv',
      'jsonwebtoken',
      'zod',
      'uuid'
    ];

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    let missingCount = 0;
    for (const dep of requiredDeps) {
      if (allDeps[dep]) {
        results.push({
          category: 'Dependencies',
          check: `Dependency: ${dep}`,
          status: 'pass',
          message: `✓ ${dep}@${allDeps[dep]}`
        });
      } else {
        missingCount++;
        results.push({
          category: 'Dependencies',
          check: `Dependency: ${dep}`,
          status: 'fail',
          message: `✗ ${dep} not installed`
        });
      }
    }

    if (missingCount === 0) {
      results.push({
        category: 'Dependencies',
        check: 'Overall dependency health',
        status: 'pass',
        message: `✓ All ${requiredDeps.length} required dependencies installed`
      });
    }

  } catch (error: any) {
    results.push({
      category: 'Dependencies',
      check: 'Package.json parsing',
      status: 'fail',
      message: `✗ Failed to parse package.json: ${error.message}`
    });
  }

  return results;
}

/**
 * メイン検証プロセス
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 Iteration 67 Phase B2: System Validation');
  console.log('   カスタムインストラクション準拠 - 再帰的検証プロセス');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allResults: ValidationResult[] = [];

  // Iteration 1: ファイル構造
  const iter1Results = await validateIteration1();
  allResults.push(...iter1Results);
  console.log(`✅ Iteration 1 完了: ${iter1Results.length} checks\n`);

  // Iteration 1が成功した場合のみIteration 2へ
  const iter1Failed = iter1Results.some(r => r.status === 'fail');
  if (iter1Failed) {
    console.log('⚠️ Iteration 1で問題が検出されました。修正してから再実行してください。\n');
  } else {
    // Iteration 2: TypeScript
    const iter2Results = await validateIteration2();
    allResults.push(...iter2Results);
    console.log(`✅ Iteration 2 完了: ${iter2Results.length} checks\n`);

    // Iteration 3: 依存関係
    const iter3Results = await validateIteration3();
    allResults.push(...iter3Results);
    console.log(`✅ Iteration 3 完了: ${iter3Results.length} checks\n`);
  }

  // 結果の集計
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Validation Results Summary');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const warned = allResults.filter(r => r.status === 'warn').length;
  const total = allResults.length;

  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  console.log(`⚠️  Warned: ${warned}/${total}`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // 失敗項目の詳細
  if (failed > 0) {
    console.log('❌ Failed Checks:');
    allResults
      .filter(r => r.status === 'fail')
      .forEach(r => {
        console.log(`  - [${r.category}] ${r.message}`);
      });
    console.log();
  }

  // 全体ステータス判定
  let overallStatus: 'ready' | 'needs_improvement' | 'critical';
  if (failed === 0) {
    overallStatus = 'ready';
    console.log('🎉 システムは次のフェーズへ進む準備ができています！\n');
  } else if (failed <= 2) {
    overallStatus = 'needs_improvement';
    console.log('⚠️ 一部改善が必要ですが、開発を続行できます。\n');
  } else {
    overallStatus = 'critical';
    console.log('🚨 重大な問題があります。修正後に再検証してください。\n');
  }

  // 次のステップ提案
  console.log('📋 Next Steps:');
  if (overallStatus === 'ready') {
    console.log('  1. APIサーバーの起動テスト (npm run api:dev)');
    console.log('  2. Phase B2実装開始 (メンバー招待機能拡張)');
    console.log('  3. 品質監視システムの強化');
  } else {
    console.log('  1. 上記の失敗項目を修正');
    console.log('  2. このスクリプトを再実行');
    console.log('  3. 全チェック合格後に次フェーズへ進む');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');

  // レポート保存
  const validation: SystemValidation = {
    timestamp: new Date().toISOString(),
    iteration: '67.B2',
    phase: 'System Validation',
    results: allResults,
    overallStatus,
    nextSteps: overallStatus === 'ready'
      ? ['Start API server', 'Implement Phase B2', 'Enhance quality monitoring']
      : ['Fix failed checks', 'Re-run validation', 'Proceed when all pass']
  };

  const fs = await import('fs/promises');
  const reportPath = `iteration-67-b2-validation-${Date.now()}.json`;
  await fs.writeFile(reportPath, JSON.stringify(validation, null, 2));
  console.log(`\n💾 Validation report saved: ${reportPath}\n`);

  // 終了コード
  process.exit(failed > 0 ? 1 : 0);
}

// 実行
main().catch(error => {
  console.error('❌ Validation script error:', error);
  process.exit(1);
});
