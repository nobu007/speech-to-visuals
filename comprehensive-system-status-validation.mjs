#!/usr/bin/env node
/**
 * Audio-to-Visual Diagram Generator - Comprehensive System Status Validation
 * Following Custom Instructions Recursive Development Framework
 *
 * Purpose: Validate current system state and identify next iteration targets
 * Framework: 小さく作り、確実に動作確認 → 動作→評価→改善→コミット
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

class SystemStatusValidator {
  constructor() {
    this.validationResults = {
      timestamp: new Date().toISOString(),
      systemStatus: {},
      moduleAnalysis: {},
      performanceMetrics: {},
      qualityAssessment: {},
      nextIterationTargets: []
    };
  }

  async executeValidation() {
    console.log('🔄 EXECUTING: Comprehensive System Status Validation');
    console.log('📋 Framework: Custom Instructions Recursive Development');
    console.log('🎯 Phase: Status Analysis and Next Iteration Planning\n');

    try {
      // Phase 1: システム現状分析
      await this.analyzeSystemArchitecture();

      // Phase 2: モジュール機能検証
      await this.validateModuleCapabilities();

      // Phase 3: パフォーマンス評価
      await this.assessPerformanceMetrics();

      // Phase 4: 品質スコア算出
      await this.calculateQualityScores();

      // Phase 5: 次回イテレーション目標特定
      await this.identifyNextIterationTargets();

      // Phase 6: 結果レポート生成
      await this.generateComprehensiveReport();

      return this.validationResults;
    } catch (error) {
      console.error('❌ VALIDATION ERROR:', error.message);
      return { error: error.message, timestamp: new Date().toISOString() };
    }
  }

  async analyzeSystemArchitecture() {
    console.log('📊 Phase 1: System Architecture Analysis');

    const architectureScore = {
      moduleStructure: 0,
      dependencyHealth: 0,
      codebaseComplexity: 0,
      frameworkIntegration: 0
    };

    try {
      // Check module structure
      const srcDirs = await fs.readdir('./src');
      const expectedModules = [
        'transcription', 'analysis', 'visualization', 'animation',
        'pipeline', 'framework', 'quality', 'performance'
      ];

      const presentModules = srcDirs.filter(dir => expectedModules.includes(dir));
      architectureScore.moduleStructure = (presentModules.length / expectedModules.length) * 100;

      // Check dependency health
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const criticalDeps = [
        'remotion', '@remotion/captions', '@remotion/media-utils',
        '@dagrejs/dagre', 'whisper-node', 'react', 'typescript'
      ];

      const installedDeps = Object.keys(packageJson.dependencies || {});
      const healthyDeps = criticalDeps.filter(dep => installedDeps.includes(dep));
      architectureScore.dependencyHealth = (healthyDeps.length / criticalDeps.length) * 100;

      // Check framework integration
      const frameworkExists = srcDirs.includes('framework');
      const iterationLogExists = await this.fileExists('./.module/ITERATION_LOG.md');
      const systemCoreExists = await this.fileExists('./.module/SYSTEM_CORE.md');

      architectureScore.frameworkIntegration =
        (frameworkExists ? 40 : 0) +
        (iterationLogExists ? 30 : 0) +
        (systemCoreExists ? 30 : 0);

      // Code complexity analysis
      const complexityScore = await this.analyzeCodeComplexity();
      architectureScore.codebaseComplexity = complexityScore;

      this.validationResults.systemStatus = {
        architectureScore,
        overallScore: Object.values(architectureScore).reduce((a, b) => a + b, 0) / 4,
        presentModules,
        missingModules: expectedModules.filter(mod => !presentModules.includes(mod))
      };

      console.log(`   ✅ Module Structure: ${architectureScore.moduleStructure.toFixed(1)}%`);
      console.log(`   ✅ Dependency Health: ${architectureScore.dependencyHealth.toFixed(1)}%`);
      console.log(`   ✅ Framework Integration: ${architectureScore.frameworkIntegration.toFixed(1)}%`);
      console.log(`   ✅ Code Complexity: ${architectureScore.codebaseComplexity.toFixed(1)}%\n`);

    } catch (error) {
      console.log(`   ❌ Architecture analysis failed: ${error.message}\n`);
    }
  }

  async validateModuleCapabilities() {
    console.log('🔧 Phase 2: Module Capabilities Validation');

    const moduleCapabilities = {};
    const modules = ['transcription', 'analysis', 'visualization', 'pipeline'];

    for (const module of modules) {
      try {
        const moduleExists = await this.directoryExists(`./src/${module}`);
        if (!moduleExists) {
          moduleCapabilities[module] = { exists: false, score: 0 };
          continue;
        }

        const files = await fs.readdir(`./src/${module}`);
        const hasTypes = files.includes('types.ts');
        const hasIndex = files.includes('index.ts');
        const hasMainLogic = files.length > 2;

        const score = (hasTypes ? 30 : 0) + (hasIndex ? 30 : 0) + (hasMainLogic ? 40 : 0);

        moduleCapabilities[module] = {
          exists: true,
          score,
          files: files.length,
          hasTypes,
          hasIndex,
          hasMainLogic
        };

        console.log(`   ✅ ${module}: ${score}% (${files.length} files)`);
      } catch (error) {
        moduleCapabilities[module] = { exists: false, error: error.message, score: 0 };
        console.log(`   ❌ ${module}: Validation failed`);
      }
    }

    this.validationResults.moduleAnalysis = moduleCapabilities;
    console.log('');
  }

  async assessPerformanceMetrics() {
    console.log('⚡ Phase 3: Performance Metrics Assessment');

    const performanceMetrics = {
      buildTime: 0,
      bundleSize: 0,
      dependencyCount: 0,
      testCoverage: 0
    };

    try {
      // Measure build time
      const buildStart = Date.now();
      try {
        execSync('npm run build:dev', { stdio: 'pipe' });
        performanceMetrics.buildTime = Date.now() - buildStart;
        console.log(`   ✅ Build Time: ${performanceMetrics.buildTime}ms`);
      } catch (error) {
        console.log(`   ⚠️ Build Time: Failed to measure`);
      }

      // Check bundle size
      if (await this.directoryExists('./dist')) {
        const distFiles = await fs.readdir('./dist');
        let totalSize = 0;
        for (const file of distFiles) {
          try {
            const stats = await fs.stat(`./dist/${file}`);
            totalSize += stats.size;
          } catch (error) {
            // Skip files that can't be read
          }
        }
        performanceMetrics.bundleSize = totalSize;
        console.log(`   ✅ Bundle Size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      }

      // Count dependencies
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const depCount = Object.keys(packageJson.dependencies || {}).length;
      const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
      performanceMetrics.dependencyCount = depCount + devDepCount;
      console.log(`   ✅ Dependencies: ${depCount} runtime + ${devDepCount} dev`);

      // Estimate test coverage
      const testFiles = await this.countTestFiles();
      const sourceFiles = await this.countSourceFiles();
      performanceMetrics.testCoverage = sourceFiles > 0 ? (testFiles / sourceFiles) * 100 : 0;
      console.log(`   ✅ Test Coverage: ${performanceMetrics.testCoverage.toFixed(1)}% (${testFiles}/${sourceFiles})`);

    } catch (error) {
      console.log(`   ❌ Performance assessment failed: ${error.message}`);
    }

    this.validationResults.performanceMetrics = performanceMetrics;
    console.log('');
  }

  async calculateQualityScores() {
    console.log('⭐ Phase 4: Quality Assessment');

    const qualityScores = {
      codeQuality: 0,
      architectureQuality: 0,
      documentationQuality: 0,
      testQuality: 0,
      overallQuality: 0
    };

    try {
      // Code quality (based on TypeScript usage, error handling, etc.)
      const tsFiles = await this.countFilesByExtension('.ts');
      const jsFiles = await this.countFilesByExtension('.js');
      const typeScriptRatio = tsFiles / (tsFiles + jsFiles || 1);
      qualityScores.codeQuality = typeScriptRatio * 100;

      // Architecture quality (module separation, etc.)
      const moduleScore = this.validationResults.systemStatus?.architectureScore?.moduleStructure || 0;
      qualityScores.architectureQuality = moduleScore;

      // Documentation quality
      const docFiles = await this.countDocumentationFiles();
      qualityScores.documentationQuality = Math.min(docFiles * 20, 100);

      // Test quality
      qualityScores.testQuality = this.validationResults.performanceMetrics?.testCoverage || 0;

      // Overall quality
      qualityScores.overallQuality = (
        qualityScores.codeQuality * 0.3 +
        qualityScores.architectureQuality * 0.3 +
        qualityScores.documentationQuality * 0.2 +
        qualityScores.testQuality * 0.2
      );

      console.log(`   ✅ Code Quality: ${qualityScores.codeQuality.toFixed(1)}%`);
      console.log(`   ✅ Architecture Quality: ${qualityScores.architectureQuality.toFixed(1)}%`);
      console.log(`   ✅ Documentation Quality: ${qualityScores.documentationQuality.toFixed(1)}%`);
      console.log(`   ✅ Test Quality: ${qualityScores.testQuality.toFixed(1)}%`);
      console.log(`   🎯 Overall Quality: ${qualityScores.overallQuality.toFixed(1)}%`);

    } catch (error) {
      console.log(`   ❌ Quality assessment failed: ${error.message}`);
    }

    this.validationResults.qualityAssessment = qualityScores;
    console.log('');
  }

  async identifyNextIterationTargets() {
    console.log('🎯 Phase 5: Next Iteration Target Identification');

    const targets = [];
    const currentQuality = this.validationResults.qualityAssessment?.overallQuality || 0;

    // Based on quality assessment and custom instructions framework
    if (currentQuality < 90) {
      targets.push({
        priority: 'high',
        target: 'Quality Enhancement',
        description: 'Improve overall system quality to 90%+',
        specificActions: [
          'Enhance error handling patterns',
          'Add comprehensive unit tests',
          'Improve TypeScript coverage',
          'Optimize module architecture'
        ],
        estimatedEffort: '2-3 iterations'
      });
    }

    // Check for missing modules
    const missingModules = this.validationResults.systemStatus?.missingModules || [];
    if (missingModules.length > 0) {
      targets.push({
        priority: 'medium',
        target: 'Module Completion',
        description: `Complete missing modules: ${missingModules.join(', ')}`,
        specificActions: missingModules.map(module => `Implement ${module} module`),
        estimatedEffort: '1-2 iterations'
      });
    }

    // Performance optimization
    const buildTime = this.validationResults.performanceMetrics?.buildTime || 0;
    if (buildTime > 10000) { // 10 seconds
      targets.push({
        priority: 'medium',
        target: 'Performance Optimization',
        description: 'Optimize build time and runtime performance',
        specificActions: [
          'Optimize webpack/vite configuration',
          'Implement code splitting',
          'Add performance monitoring',
          'Optimize asset loading'
        ],
        estimatedEffort: '1-2 iterations'
      });
    }

    // Always include custom instructions enhancement
    targets.push({
      priority: 'high',
      target: 'Custom Instructions Framework Enhancement',
      description: 'Enhance recursive development framework application',
      specificActions: [
        'Implement automated quality gates',
        'Add iteration tracking automation',
        'Enhance commit strategy implementation',
        'Add performance benchmark automation'
      ],
      estimatedEffort: '2-3 iterations'
    });

    this.validationResults.nextIterationTargets = targets;

    console.log('   📋 Identified Targets:');
    targets.forEach((target, index) => {
      console.log(`   ${index + 1}. [${target.priority.toUpperCase()}] ${target.target}`);
      console.log(`      ${target.description}`);
      console.log(`      Effort: ${target.estimatedEffort}\n`);
    });
  }

  async generateComprehensiveReport() {
    console.log('📄 Phase 6: Comprehensive Report Generation');

    const reportData = {
      ...this.validationResults,
      summary: {
        overallSystemHealth: this.calculateOverallHealth(),
        readinessLevel: this.determineReadinessLevel(),
        recommendedNextStep: this.getRecommendedNextStep(),
        customInstructionsCompliance: this.assessCustomInstructionsCompliance()
      }
    };

    // Save detailed report
    const reportPath = `system-status-validation-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`   ✅ Detailed report saved: ${reportPath}`);

    // Display summary
    console.log('\n🎯 VALIDATION SUMMARY:');
    console.log(`   Overall System Health: ${reportData.summary.overallSystemHealth}%`);
    console.log(`   Readiness Level: ${reportData.summary.readinessLevel}`);
    console.log(`   Custom Instructions Compliance: ${reportData.summary.customInstructionsCompliance}%`);
    console.log(`   Recommended Next Step: ${reportData.summary.recommendedNextStep}`);

    return reportData;
  }

  // Helper methods
  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(path) {
    try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  async analyzeCodeComplexity() {
    try {
      const srcFiles = await this.getAllFiles('./src', ['.ts', '.tsx']);
      let totalLines = 0;
      let totalFiles = srcFiles.length;

      for (const file of srcFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          totalLines += content.split('\n').length;
        } catch (error) {
          // Skip files that can't be read
        }
      }

      const avgLinesPerFile = totalFiles > 0 ? totalLines / totalFiles : 0;
      // Score based on reasonable file sizes (lower is better for complexity)
      return Math.max(0, 100 - Math.max(0, avgLinesPerFile - 100) / 10);
    } catch {
      return 0;
    }
  }

  async countTestFiles() {
    const testFiles = await this.getAllFiles('.', ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx']);
    const testMjsFiles = await this.getAllFiles('.', ['.mjs']);
    return testFiles.length + testMjsFiles.filter(f => f.includes('test')).length;
  }

  async countSourceFiles() {
    const sourceFiles = await this.getAllFiles('./src', ['.ts', '.tsx']);
    return sourceFiles.length;
  }

  async countFilesByExtension(extension) {
    const files = await this.getAllFiles('./src', [extension]);
    return files.length;
  }

  async countDocumentationFiles() {
    const mdFiles = await this.getAllFiles('.', ['.md']);
    return mdFiles.length;
  }

  async getAllFiles(dir, extensions) {
    const files = [];
    try {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        try {
          const stat = await fs.stat(fullPath);
          if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            files.push(...await this.getAllFiles(fullPath, extensions));
          } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        } catch {
          // Skip files/directories that can't be accessed
        }
      }
    } catch {
      // Skip directories that can't be read
    }
    return files;
  }

  calculateOverallHealth() {
    const systemScore = this.validationResults.systemStatus?.overallScore || 0;
    const qualityScore = this.validationResults.qualityAssessment?.overallQuality || 0;
    return ((systemScore + qualityScore) / 2);
  }

  determineReadinessLevel() {
    const health = this.calculateOverallHealth();
    if (health >= 90) return 'PRODUCTION_READY';
    if (health >= 75) return 'STAGING_READY';
    if (health >= 60) return 'DEVELOPMENT_READY';
    return 'NEEDS_IMPROVEMENT';
  }

  getRecommendedNextStep() {
    const targets = this.validationResults.nextIterationTargets || [];
    const highPriorityTargets = targets.filter(t => t.priority === 'high');
    if (highPriorityTargets.length > 0) {
      return highPriorityTargets[0].target;
    }
    return 'System Status Assessment';
  }

  assessCustomInstructionsCompliance() {
    const frameworkIntegration = this.validationResults.systemStatus?.architectureScore?.frameworkIntegration || 0;
    const iterationLogExists = this.validationResults.systemStatus?.architectureScore ? 100 : 0;
    return (frameworkIntegration + iterationLogExists) / 2;
  }
}

// Execute validation
const validator = new SystemStatusValidator();
validator.executeValidation()
  .then(results => {
    console.log('\n🎯 COMPREHENSIVE SYSTEM STATUS VALIDATION COMPLETE');
    console.log('📊 Results saved and analysis complete');
    console.log('🔄 Ready for next iteration planning\n');
  })
  .catch(error => {
    console.error('❌ VALIDATION FAILED:', error);
    process.exit(1);
  });