#!/usr/bin/env node

/**
 * 🎯 カスタムインストラクション準拠検証テスト
 * Custom Instructions Compliance Validation Test
 *
 * This test validates that the system adheres to the comprehensive
 * audio-to-visual diagram generation custom instructions.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CustomInstructionsValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      overallScore: 0,
      categories: {},
      recommendations: [],
      complianceLevel: 'UNKNOWN'
    };
  }

  async runValidation() {
    console.log('🎯 Starting Custom Instructions Compliance Validation...\n');

    // 1. システム概要と開発理念の検証
    await this.validateSystemOverview();

    // 2. モジュール構成と依存関係の検証
    await this.validateModularArchitecture();

    // 3. 段階的開発フローの検証
    await this.validateDevelopmentFlow();

    // 4. フェーズ別実装の検証
    await this.validatePhaseImplementation();

    // 5. 品質保証システムの検証
    await this.validateQualityAssurance();

    // 6. 再帰的改善プロセスの検証
    await this.validateRecursiveImprovement();

    // 7. 全体評価とレポート生成
    await this.generateComplianceReport();

    return this.results;
  }

  async validateSystemOverview() {
    console.log('📋 1. システム概要と開発理念の検証...');

    const criteria = {
      projectDefinition: await this.checkProjectDefinition(),
      developmentPhilosophy: await this.checkDevelopmentPhilosophy(),
      targetDirectory: await this.checkTargetDirectory(),
      coreLibraries: await this.checkCoreLibraries()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.systemOverview = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  async validateModularArchitecture() {
    console.log('🏗️ 2. モジュール構成と依存関係の検証...');

    const criteria = {
      moduleStructure: await this.checkModuleStructure(),
      dependencyManagement: await this.checkDependencyManagement(),
      separationOfConcerns: await this.checkSeparationOfConcerns(),
      interfaceDefinitions: await this.checkInterfaceDefinitions()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.modularArchitecture = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  async validateDevelopmentFlow() {
    console.log('🔄 3. 段階的開発フロー（再帰的プロセス）の検証...');

    const criteria = {
      iterativeCycles: await this.checkIterativeCycles(),
      successCriteria: await this.checkSuccessCriteria(),
      failureRecovery: await this.checkFailureRecovery(),
      commitStrategy: await this.checkCommitStrategy()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.developmentFlow = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  async validatePhaseImplementation() {
    console.log('⚙️ 4. フェーズ別実装の検証...');

    const criteria = {
      transcriptionPipeline: await this.checkTranscriptionPipeline(),
      contentAnalysis: await this.checkContentAnalysis(),
      visualizationEngine: await this.checkVisualizationEngine(),
      remotionIntegration: await this.checkRemotionIntegration()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.phaseImplementation = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  async validateQualityAssurance() {
    console.log('🔍 5. 品質保証システムの検証...');

    const criteria = {
      automaticQualityCheck: await this.checkAutomaticQualityCheck(),
      iterationLogging: await this.checkIterationLogging(),
      performanceMetrics: await this.checkPerformanceMetrics(),
      troubleshootingProtocol: await this.checkTroubleshootingProtocol()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.qualityAssurance = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  async validateRecursiveImprovement() {
    console.log('♻️ 6. 再帰的改善プロセスの検証...');

    const criteria = {
      continuousImprovement: await this.checkContinuousImprovement(),
      learningFromIterations: await this.checkLearningFromIterations(),
      adaptiveOptimization: await this.checkAdaptiveOptimization(),
      autonomousEvolution: await this.checkAutonomousEvolution()
    };

    const score = Object.values(criteria).reduce((sum, val) => sum + val, 0) / Object.keys(criteria).length;
    this.results.categories.recursiveImprovement = { score, criteria };

    console.log(`   ✅ スコア: ${(score * 100).toFixed(1)}%\n`);
  }

  // Individual validation methods
  async checkProjectDefinition() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const hasRemotionDeps = packageJson.dependencies['remotion'] &&
                             packageJson.dependencies['@remotion/captions'];
      const hasRequiredDeps = packageJson.dependencies['@dagrejs/dagre'] &&
                             packageJson.dependencies['kuromoji'];
      return hasRemotionDeps && hasRequiredDeps ? 1.0 : 0.7;
    } catch {
      return 0.0;
    }
  }

  async checkDevelopmentPhilosophy() {
    try {
      const iterationLog = await fs.readFile('.module/ITERATION_LOG.md', 'utf8');
      const hasIncrementalApproach = iterationLog.includes('incremental') || iterationLog.includes('段階的');
      const hasRecursiveProcess = iterationLog.includes('recursive') || iterationLog.includes('再帰');
      const hasModularDesign = iterationLog.includes('modular') || iterationLog.includes('モジュール');

      const score = [hasIncrementalApproach, hasRecursiveProcess, hasModularDesign]
        .filter(Boolean).length / 3;
      return score;
    } catch {
      return 0.0;
    }
  }

  async checkTargetDirectory() {
    const currentDir = process.cwd();
    return currentDir.includes('speech-to-visuals') ? 1.0 : 0.0;
  }

  async checkCoreLibraries() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const requiredLibs = [
        'remotion',
        '@remotion/captions',
        '@remotion/media-utils',
        '@dagrejs/dagre',
        'kuromoji',
        'whisper-node'
      ];

      const presentLibs = requiredLibs.filter(lib =>
        packageJson.dependencies[lib] || packageJson.devDependencies[lib]
      );

      return presentLibs.length / requiredLibs.length;
    } catch {
      return 0.0;
    }
  }

  async checkModuleStructure() {
    const requiredModules = [
      'src/transcription',
      'src/analysis',
      'src/visualization',
      'src/remotion',
      'src/pipeline'
    ];

    let existingModules = 0;
    for (const module of requiredModules) {
      try {
        await fs.access(module);
        existingModules++;
      } catch {}
    }

    return existingModules / requiredModules.length;
  }

  async checkDependencyManagement() {
    try {
      const stats = await fs.stat('node_modules');
      return stats.isDirectory() ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkSeparationOfConcerns() {
    try {
      const transcriptionExists = await this.fileExists('src/transcription');
      const analysisExists = await this.fileExists('src/analysis');
      const visualizationExists = await this.fileExists('src/visualization');
      const pipelineExists = await this.fileExists('src/pipeline');

      return [transcriptionExists, analysisExists, visualizationExists, pipelineExists]
        .filter(Boolean).length / 4;
    } catch {
      return 0.0;
    }
  }

  async checkInterfaceDefinitions() {
    try {
      const typesFiles = [
        'src/pipeline/types.ts',
        'src/types/diagram.ts',
        'src/analysis/types.ts',
        'src/visualization/types.ts'
      ];

      let existingTypes = 0;
      for (const typeFile of typesFiles) {
        try {
          await fs.access(typeFile);
          existingTypes++;
        } catch {}
      }

      return existingTypes / typesFiles.length;
    } catch {
      return 0.0;
    }
  }

  async checkIterativeCycles() {
    try {
      const iterationLog = await fs.readFile('.module/ITERATION_LOG.md', 'utf8');
      const iterationCount = (iterationLog.match(/## Iteration|ITERATION/gi) || []).length;
      return Math.min(iterationCount / 10, 1.0); // 10+ iterations = perfect score
    } catch {
      return 0.0;
    }
  }

  async checkSuccessCriteria() {
    try {
      const qualityExists = await this.fileExists('src/quality');
      const testExists = await this.fileExists('src/test');
      return (qualityExists ? 0.5 : 0) + (testExists ? 0.5 : 0);
    } catch {
      return 0.0;
    }
  }

  async checkFailureRecovery() {
    try {
      const troubleshootingExists = await this.fileExists('src/pipeline/troubleshooting-protocol.ts');
      return troubleshootingExists ? 1.0 : 0.5; // Basic git recovery assumed
    } catch {
      return 0.0;
    }
  }

  async checkCommitStrategy() {
    try {
      // Check git history for commit patterns
      const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
      const hasFeatCommits = gitLog.includes('feat:') || gitLog.includes('feat(');
      const hasFixCommits = gitLog.includes('fix:') || gitLog.includes('fix(');
      const hasIterationCommits = gitLog.includes('iteration') || gitLog.includes('Iteration');

      return [hasFeatCommits, hasFixCommits, hasIterationCommits]
        .filter(Boolean).length / 3;
    } catch {
      return 0.5; // Assume basic git usage
    }
  }

  async checkTranscriptionPipeline() {
    try {
      const transcriptionFiles = await fs.readdir('src/transcription');
      const hasCore = transcriptionFiles.some(f => f.includes('transcription') || f.includes('whisper'));
      const hasTypes = transcriptionFiles.some(f => f.includes('types'));
      return (hasCore ? 0.7 : 0) + (hasTypes ? 0.3 : 0);
    } catch {
      return 0.0;
    }
  }

  async checkContentAnalysis() {
    try {
      const analysisFiles = await fs.readdir('src/analysis');
      const hasDiagramDetection = analysisFiles.some(f => f.includes('diagram') || f.includes('detector'));
      const hasTypes = analysisFiles.some(f => f.includes('types'));
      return (hasDiagramDetection ? 0.7 : 0) + (hasTypes ? 0.3 : 0);
    } catch {
      return 0.0;
    }
  }

  async checkVisualizationEngine() {
    try {
      const visualizationFiles = await fs.readdir('src/visualization');
      const hasLayout = visualizationFiles.some(f => f.includes('layout') || f.includes('dagre'));
      const hasTypes = visualizationFiles.some(f => f.includes('types'));
      return (hasLayout ? 0.7 : 0) + (hasTypes ? 0.3 : 0);
    } catch {
      return 0.0;
    }
  }

  async checkRemotionIntegration() {
    try {
      const remotionFiles = await fs.readdir('src/remotion');
      const hasComposition = remotionFiles.some(f => f.includes('Root') || f.includes('Video'));
      const hasRenderer = remotionFiles.some(f => f.includes('Renderer') || f.includes('Scene'));
      return (hasComposition ? 0.5 : 0) + (hasRenderer ? 0.5 : 0);
    } catch {
      return 0.0;
    }
  }

  async checkAutomaticQualityCheck() {
    try {
      const qualityExists = await this.fileExists('src/quality');
      return qualityExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkIterationLogging() {
    try {
      const logExists = await this.fileExists('.module/ITERATION_LOG.md');
      return logExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkPerformanceMetrics() {
    try {
      const performanceExists = await this.fileExists('src/performance') ||
                               await this.fileExists('src/optimization');
      return performanceExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkTroubleshootingProtocol() {
    try {
      const troubleshootingExists = await this.fileExists('src/pipeline/troubleshooting-protocol.ts');
      return troubleshootingExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkContinuousImprovement() {
    try {
      const optimizationExists = await this.fileExists('src/optimization');
      return optimizationExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkLearningFromIterations() {
    try {
      const iterationLog = await fs.readFile('.module/ITERATION_LOG.md', 'utf8');
      const hasLearningEntries = iterationLog.includes('学習') ||
                                iterationLog.includes('learning') ||
                                iterationLog.includes('改善') ||
                                iterationLog.includes('improvement');
      return hasLearningEntries ? 1.0 : 0.5;
    } catch {
      return 0.0;
    }
  }

  async checkAdaptiveOptimization() {
    try {
      const adaptiveExists = await this.fileExists('src/optimization/smart-optimizer.ts') ||
                            await this.fileExists('src/optimization/adaptive') ||
                            await this.fileExists('src/optimization/intelligent');
      return adaptiveExists ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async checkAutonomousEvolution() {
    try {
      const autonomousFiles = await fs.readdir('src/optimization');
      const hasAutonomous = autonomousFiles.some(f =>
        f.includes('autonomous') ||
        f.includes('self') ||
        f.includes('adaptive') ||
        f.includes('intelligent')
      );
      return hasAutonomous ? 1.0 : 0.0;
    } catch {
      return 0.0;
    }
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async generateComplianceReport() {
    // Calculate overall score
    const categoryScores = Object.values(this.results.categories).map(cat => cat.score);
    this.results.overallScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;

    // Determine compliance level
    if (this.results.overallScore >= 0.9) {
      this.results.complianceLevel = 'EXCELLENT';
    } else if (this.results.overallScore >= 0.8) {
      this.results.complianceLevel = 'VERY_GOOD';
    } else if (this.results.overallScore >= 0.7) {
      this.results.complianceLevel = 'GOOD';
    } else if (this.results.overallScore >= 0.6) {
      this.results.complianceLevel = 'ACCEPTABLE';
    } else {
      this.results.complianceLevel = 'NEEDS_IMPROVEMENT';
    }

    // Generate recommendations
    this.generateRecommendations();

    console.log('📊 最終評価レポート / Final Compliance Report');
    console.log('=' .repeat(60));
    console.log(`🎯 総合スコア / Overall Score: ${(this.results.overallScore * 100).toFixed(1)}%`);
    console.log(`📈 準拠レベル / Compliance Level: ${this.results.complianceLevel}`);
    console.log('');

    console.log('📋 カテゴリ別スコア / Category Scores:');
    for (const [category, result] of Object.entries(this.results.categories)) {
      console.log(`   ${category}: ${(result.score * 100).toFixed(1)}%`);
    }

    if (this.results.recommendations.length > 0) {
      console.log('\n💡 改善提案 / Recommendations:');
      this.results.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // Save detailed report
    const reportPath = `custom-instructions-compliance-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 詳細レポート保存 / Detailed report saved: ${reportPath}\n`);
  }

  generateRecommendations() {
    const categories = this.results.categories;

    if (categories.systemOverview?.score < 0.8) {
      this.results.recommendations.push(
        'システム概要の文書化を改善し、開発理念をより明確に定義してください'
      );
    }

    if (categories.modularArchitecture?.score < 0.8) {
      this.results.recommendations.push(
        'モジュール間の依存関係を整理し、インターフェース定義を強化してください'
      );
    }

    if (categories.developmentFlow?.score < 0.8) {
      this.results.recommendations.push(
        '段階的開発フローの自動化を強化し、失敗回復プロトコルを改善してください'
      );
    }

    if (categories.qualityAssurance?.score < 0.8) {
      this.results.recommendations.push(
        '品質保証システムの自動化を進め、メトリクス収集を強化してください'
      );
    }

    if (categories.recursiveImprovement?.score < 0.8) {
      this.results.recommendations.push(
        '再帰的改善プロセスを自動化し、学習機能を強化してください'
      );
    }
  }
}

// Main execution
async function main() {
  const validator = new CustomInstructionsValidator();

  try {
    const results = await validator.runValidation();

    if (results.overallScore >= 0.9) {
      console.log('🎉 素晴らしい！カスタムインストラクションへの準拠度が非常に高いです！');
      console.log('🚀 System shows excellent compliance with custom instructions!');
      process.exit(0);
    } else if (results.overallScore >= 0.7) {
      console.log('✅ 良好！いくつかの改善点がありますが、基本的な準拠は達成されています。');
      console.log('👍 Good compliance with some areas for improvement.');
      process.exit(0);
    } else {
      console.log('⚠️ 改善が必要です。カスタムインストラクションへの準拠度を上げる必要があります。');
      console.log('📝 Improvement needed to meet custom instructions requirements.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 検証プロセスでエラーが発生しました:', error.message);
    console.error('❌ Error during validation process:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CustomInstructionsValidator };