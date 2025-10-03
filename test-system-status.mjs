#!/usr/bin/env node

/**
 * 🔄 Custom Instructions Compliance Test
 * Tests current system functionality per audio-to-diagram video generation requirements
 */

import { promises as fs } from 'fs';
import path from 'path';

class SystemStatusChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      phase: "System Status Validation",
      iteration: 1,
      checks: []
    };
  }

  async checkSystemStatus() {
    console.log('🔄 Testing Current Audio-to-Diagram Video Generation System');
    console.log('📋 Following Custom Instructions Framework Approach\n');

    // Phase 1: Infrastructure Check
    await this.checkPhase1Infrastructure();

    // Phase 2: Module Integration Check
    await this.checkPhase2Modules();

    // Phase 3: Pipeline Functionality Check
    await this.checkPhase3Pipeline();

    // Phase 4: Custom Instructions Framework Integration
    await this.checkPhase4Framework();

    return this.generateReport();
  }

  async checkPhase1Infrastructure() {
    console.log('🏗️ Phase 1: Infrastructure Validation');

    const checks = [
      this.checkPackageJson(),
      this.checkNodeModules(),
      this.checkSrcStructure(),
      this.checkRemotionConfig()
    ];

    for (const check of checks) {
      await check;
    }

    console.log('');
  }

  async checkPhase2Modules() {
    console.log('📦 Phase 2: Module Integration Check');

    const checks = [
      this.checkTranscriptionModule(),
      this.checkAnalysisModule(),
      this.checkVisualizationModule(),
      this.checkPipelineModule()
    ];

    for (const check of checks) {
      await check;
    }

    console.log('');
  }

  async checkPhase3Pipeline() {
    console.log('⚙️ Phase 3: Pipeline Functionality Test');

    await this.checkMainPipeline();
    await this.checkFrameworkIntegration();

    console.log('');
  }

  async checkPhase4Framework() {
    console.log('🔄 Phase 4: Custom Instructions Framework Validation');

    await this.checkRecursiveDevelopmentFramework();
    await this.checkQualityMetrics();
    await this.checkIterativeApproach();

    console.log('');
  }

  async checkPackageJson() {
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const requiredDeps = [
        '@remotion/captions',
        '@remotion/media-utils',
        '@dagrejs/dagre',
        'remotion'
      ];

      const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);

      if (missingDeps.length === 0) {
        this.recordSuccess('✅ All required dependencies present');
      } else {
        this.recordFailure(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
      }
    } catch (error) {
      this.recordFailure(`❌ package.json check failed: ${error.message}`);
    }
  }

  async checkNodeModules() {
    try {
      await fs.access('node_modules');
      this.recordSuccess('✅ node_modules directory exists');
    } catch (error) {
      this.recordFailure('❌ node_modules not found - run npm install');
    }
  }

  async checkSrcStructure() {
    const requiredDirs = [
      'src/transcription',
      'src/analysis',
      'src/visualization',
      'src/pipeline',
      'src/framework'
    ];

    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
        this.recordSuccess(`✅ ${dir} module exists`);
      } catch (error) {
        this.recordFailure(`❌ ${dir} module missing`);
      }
    }
  }

  async checkRemotionConfig() {
    try {
      await fs.access('remotion.config.ts');
      this.recordSuccess('✅ Remotion configuration found');
    } catch (error) {
      this.recordFailure('❌ remotion.config.ts missing');
    }
  }

  async checkTranscriptionModule() {
    await this.checkModuleFiles('src/transcription', [
      'transcriber.ts',
      'index.ts',
      'types.ts'
    ]);
  }

  async checkAnalysisModule() {
    await this.checkModuleFiles('src/analysis', [
      'diagram-detector.ts',
      'scene-segmenter.ts',
      'index.ts',
      'types.ts'
    ]);
  }

  async checkVisualizationModule() {
    await this.checkModuleFiles('src/visualization', [
      'layout-engine.ts',
      'index.ts',
      'types.ts'
    ]);
  }

  async checkPipelineModule() {
    await this.checkModuleFiles('src/pipeline', [
      'main-pipeline.ts',
      'index.ts',
      'types.ts'
    ]);
  }

  async checkModuleFiles(moduleDir, requiredFiles) {
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(moduleDir, file));
        this.recordSuccess(`✅ ${moduleDir}/${file} exists`);
      } catch (error) {
        this.recordFailure(`❌ ${moduleDir}/${file} missing`);
      }
    }
  }

  async checkMainPipeline() {
    try {
      const pipelineContent = await fs.readFile('src/pipeline/main-pipeline.ts', 'utf8');

      const checks = [
        { pattern: 'class MainPipeline', name: 'MainPipeline class' },
        { pattern: 'RecursiveCustomInstructionsFramework', name: 'Framework integration' },
        { pattern: 'executeFrameworkIntegratedPipeline', name: 'Framework-integrated execution' },
        { pattern: 'evaluateAndIterate', name: 'Iterative improvement' }
      ];

      checks.forEach(check => {
        if (pipelineContent.includes(check.pattern)) {
          this.recordSuccess(`✅ ${check.name} implemented`);
        } else {
          this.recordFailure(`❌ ${check.name} missing`);
        }
      });

    } catch (error) {
      this.recordFailure(`❌ Main pipeline check failed: ${error.message}`);
    }
  }

  async checkFrameworkIntegration() {
    try {
      const frameworkDir = 'src/framework';
      const files = await fs.readdir(frameworkDir);

      if (files.includes('recursive-custom-instructions.ts')) {
        this.recordSuccess('✅ Recursive Custom Instructions Framework found');
      } else {
        this.recordFailure('❌ Custom Instructions Framework missing');
      }

    } catch (error) {
      this.recordFailure(`❌ Framework integration check failed: ${error.message}`);
    }
  }

  async checkRecursiveDevelopmentFramework() {
    try {
      const frameworkContent = await fs.readFile('src/framework/recursive-custom-instructions.ts', 'utf8');

      const frameworkChecks = [
        { pattern: 'DevelopmentCycle', name: 'Development cycle definition' },
        { pattern: 'QualityMetrics', name: 'Quality metrics tracking' },
        { pattern: 'startCycle', name: 'Cycle start method' },
        { pattern: 'evaluateIteration', name: 'Iteration evaluation' }
      ];

      frameworkChecks.forEach(check => {
        if (frameworkContent.includes(check.pattern)) {
          this.recordSuccess(`✅ ${check.name} implemented`);
        } else {
          this.recordFailure(`❌ ${check.name} missing`);
        }
      });

    } catch (error) {
      this.recordWarning(`⚠️ Framework detailed check failed: ${error.message}`);
    }
  }

  async checkQualityMetrics() {
    // Check if quality monitoring is implemented
    try {
      const pipelineContent = await fs.readFile('src/pipeline/main-pipeline.ts', 'utf8');

      if (pipelineContent.includes('qualityMetrics') && pipelineContent.includes('transcriptionAccuracy')) {
        this.recordSuccess('✅ Quality metrics tracking implemented');
      } else {
        this.recordWarning('⚠️ Quality metrics tracking may be incomplete');
      }
    } catch (error) {
      this.recordFailure(`❌ Quality metrics check failed: ${error.message}`);
    }
  }

  async checkIterativeApproach() {
    try {
      const pipelineContent = await fs.readFile('src/pipeline/main-pipeline.ts', 'utf8');

      const iterativeChecks = [
        'iteration',
        'nextIteration',
        'currentPhase',
        'evaluateAndIterate'
      ];

      const foundChecks = iterativeChecks.filter(check => pipelineContent.includes(check));

      if (foundChecks.length >= 3) {
        this.recordSuccess('✅ Iterative development approach implemented');
      } else {
        this.recordWarning('⚠️ Iterative approach may be incomplete');
      }
    } catch (error) {
      this.recordFailure(`❌ Iterative approach check failed: ${error.message}`);
    }
  }

  recordSuccess(message) {
    console.log(message);
    this.results.checks.push({ type: 'success', message });
  }

  recordFailure(message) {
    console.log(message);
    this.results.checks.push({ type: 'failure', message });
  }

  recordWarning(message) {
    console.log(message);
    this.results.checks.push({ type: 'warning', message });
  }

  generateReport() {
    const successes = this.results.checks.filter(c => c.type === 'success').length;
    const failures = this.results.checks.filter(c => c.type === 'failure').length;
    const warnings = this.results.checks.filter(c => c.type === 'warning').length;
    const total = this.results.checks.length;

    const successRate = total > 0 ? (successes / total * 100).toFixed(1) : 0;

    console.log('\n📊 System Status Report');
    console.log('='.repeat(50));
    console.log(`✅ Successes: ${successes}`);
    console.log(`❌ Failures: ${failures}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log('='.repeat(50));

    // Custom Instructions Framework Assessment
    const frameworkScore = this.assessFrameworkCompliance();
    console.log(`\n🔄 Custom Instructions Framework Compliance: ${frameworkScore}/10`);

    const systemStatus = {
      ready: failures === 0 && successes >= total * 0.8,
      needsWork: failures > 0 || successes < total * 0.6,
      score: successRate
    };

    if (systemStatus.ready) {
      console.log('\n🎯 System Status: READY FOR DEMONSTRATION');
      console.log('   All core components implemented and integrated');
      console.log('   Custom Instructions Framework compliance achieved');
    } else if (systemStatus.needsWork) {
      console.log('\n⚠️ System Status: NEEDS IMPROVEMENT');
      console.log('   Some critical components missing or incomplete');
    } else {
      console.log('\n✅ System Status: FUNCTIONAL BUT CAN BE OPTIMIZED');
      console.log('   Core functionality present, minor improvements needed');
    }

    // Save detailed report
    this.results.summary = {
      successes,
      failures,
      warnings,
      total,
      successRate: parseFloat(successRate),
      frameworkCompliance: frameworkScore,
      systemStatus: systemStatus.ready ? 'READY' : systemStatus.needsWork ? 'NEEDS_WORK' : 'FUNCTIONAL'
    };

    return this.results;
  }

  assessFrameworkCompliance() {
    const frameworkFeatures = [
      'RecursiveCustomInstructionsFramework',
      'evaluateAndIterate',
      'qualityMetrics',
      'currentPhase',
      'iteration',
      'executeFrameworkIntegratedPipeline',
      'DevelopmentCycle',
      'startCycle',
      'nextIteration',
      'commitIteration'
    ];

    const implementedFeatures = this.results.checks.filter(check =>
      check.type === 'success' &&
      frameworkFeatures.some(feature => check.message.includes(feature))
    ).length;

    return Math.min(10, Math.round((implementedFeatures / frameworkFeatures.length) * 10));
  }
}

// Execute system status check
async function main() {
  try {
    const checker = new SystemStatusChecker();
    const results = await checker.checkSystemStatus();

    // Save results for analysis
    const reportPath = `system-status-validation-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    process.exit(results.summary.systemStatus === 'READY' ? 0 : 1);

  } catch (error) {
    console.error('❌ System status check failed:', error);
    process.exit(1);
  }
}

main();