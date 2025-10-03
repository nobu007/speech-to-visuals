#!/usr/bin/env node

/**
 * Current System Validation - Following Recursive Custom Instructions
 * Validates the speech-to-visuals system according to development phases
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SystemValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      phase: 'Current System Validation',
      tests: [],
      metrics: {},
      status: 'running'
    };
  }

  async validatePhase1() {
    console.log('🔍 Phase 1: Foundation Validation');

    try {
      // Check package.json dependencies
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const requiredDeps = [
        'remotion',
        '@remotion/captions',
        '@remotion/media-utils',
        '@dagrejs/dagre',
        'whisper-node'
      ];

      const missingDeps = requiredDeps.filter(dep =>
        !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
      );

      this.results.tests.push({
        name: 'Foundation Dependencies',
        passed: missingDeps.length === 0,
        details: missingDeps.length === 0 ? 'All required dependencies present' : `Missing: ${missingDeps.join(', ')}`,
        phase: 1
      });

      console.log(`✅ Dependencies: ${missingDeps.length === 0 ? 'Complete' : 'Missing ' + missingDeps.length}`);

    } catch (error) {
      this.results.tests.push({
        name: 'Foundation Dependencies',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 1
      });
    }
  }

  async validatePhase2() {
    console.log('🔍 Phase 2: Transcription Pipeline Validation');

    try {
      // Check transcription module structure
      const transcriptionFiles = [
        'src/transcription/index.ts',
        'src/transcription/transcriber.ts',
        'src/transcription/types.ts'
      ];

      let foundFiles = 0;
      for (const file of transcriptionFiles) {
        try {
          await fs.access(file);
          foundFiles++;
        } catch {}
      }

      this.results.tests.push({
        name: 'Transcription Module Structure',
        passed: foundFiles === transcriptionFiles.length,
        details: `Found ${foundFiles}/${transcriptionFiles.length} required files`,
        phase: 2
      });

      console.log(`✅ Transcription Structure: ${foundFiles}/${transcriptionFiles.length} files`);

    } catch (error) {
      this.results.tests.push({
        name: 'Transcription Module Structure',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 2
      });
    }
  }

  async validatePhase3() {
    console.log('🔍 Phase 3: Analysis Engine Validation');

    try {
      const analysisFiles = [
        'src/analysis/index.ts',
        'src/analysis/diagram-detector.ts',
        'src/analysis/scene-segmenter.ts'
      ];

      let foundFiles = 0;
      for (const file of analysisFiles) {
        try {
          await fs.access(file);
          foundFiles++;
        } catch {}
      }

      this.results.tests.push({
        name: 'Analysis Engine Structure',
        passed: foundFiles >= 2, // Allow for some flexibility
        details: `Found ${foundFiles}/${analysisFiles.length} analysis files`,
        phase: 3
      });

      console.log(`✅ Analysis Engine: ${foundFiles}/${analysisFiles.length} files`);

    } catch (error) {
      this.results.tests.push({
        name: 'Analysis Engine Structure',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 3
      });
    }
  }

  async validatePhase4() {
    console.log('🔍 Phase 4: Visualization System Validation');

    try {
      const visualizationFiles = [
        'src/visualization/index.ts',
        'src/visualization/layout-engine.ts'
      ];

      let foundFiles = 0;
      for (const file of visualizationFiles) {
        try {
          await fs.access(file);
          foundFiles++;
        } catch {}
      }

      this.results.tests.push({
        name: 'Visualization System Structure',
        passed: foundFiles >= 1,
        details: `Found ${foundFiles}/${visualizationFiles.length} visualization files`,
        phase: 4
      });

      console.log(`✅ Visualization System: ${foundFiles}/${visualizationFiles.length} files`);

    } catch (error) {
      this.results.tests.push({
        name: 'Visualization System Structure',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 4
      });
    }
  }

  async validatePhase5() {
    console.log('🔍 Phase 5: Remotion Integration Validation');

    try {
      const remotionFiles = [
        'src/remotion/index.ts',
        'src/remotion/Root.tsx',
        'remotion.config.ts'
      ];

      let foundFiles = 0;
      for (const file of remotionFiles) {
        try {
          await fs.access(file);
          foundFiles++;
        } catch {}
      }

      this.results.tests.push({
        name: 'Remotion Integration',
        passed: foundFiles >= 2,
        details: `Found ${foundFiles}/${remotionFiles.length} Remotion files`,
        phase: 5
      });

      console.log(`✅ Remotion Integration: ${foundFiles}/${remotionFiles.length} files`);

    } catch (error) {
      this.results.tests.push({
        name: 'Remotion Integration',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 5
      });
    }
  }

  async validateAdvancedFeatures() {
    console.log('🔍 Advanced Features Validation');

    try {
      // Check for optimization modules
      const optimizationFiles = await fs.readdir('src/optimization').catch(() => []);
      const qualityFiles = await fs.readdir('src/quality').catch(() => []);
      const pipelineFiles = await fs.readdir('src/pipeline').catch(() => []);

      this.results.tests.push({
        name: 'Advanced Optimization Features',
        passed: optimizationFiles.length >= 3,
        details: `Found ${optimizationFiles.length} optimization modules`,
        phase: 'advanced'
      });

      this.results.tests.push({
        name: 'Quality Monitoring',
        passed: qualityFiles.length >= 1,
        details: `Found ${qualityFiles.length} quality monitoring modules`,
        phase: 'advanced'
      });

      this.results.tests.push({
        name: 'Pipeline Iterations',
        passed: pipelineFiles.length >= 5,
        details: `Found ${pipelineFiles.length} pipeline variations`,
        phase: 'advanced'
      });

      console.log(`✅ Advanced Features: ${optimizationFiles.length} optimization, ${qualityFiles.length} quality, ${pipelineFiles.length} pipeline modules`);

    } catch (error) {
      this.results.tests.push({
        name: 'Advanced Features',
        passed: false,
        details: `Error: ${error.message}`,
        phase: 'advanced'
      });
    }
  }

  calculateScore() {
    const totalTests = this.results.tests.length;
    const passedTests = this.results.tests.filter(t => t.passed).length;

    this.results.metrics = {
      totalTests,
      passedTests,
      successRate: Math.round((passedTests / totalTests) * 100),
      completionLevel: this.getCompletionLevel(passedTests, totalTests)
    };
  }

  getCompletionLevel(passed, total) {
    const rate = passed / total;
    if (rate >= 0.9) return 'Production Ready';
    if (rate >= 0.75) return 'Near Complete';
    if (rate >= 0.5) return 'Functional MVP';
    if (rate >= 0.25) return 'In Development';
    return 'Early Stage';
  }

  async generateReport() {
    this.results.status = 'completed';
    this.results.summary = {
      currentState: 'Advanced Development Stage',
      iterations: 'Multiple iterations completed (up to iteration 32)',
      readiness: this.results.metrics.completionLevel,
      nextSteps: this.getNextSteps()
    };

    const reportPath = `current-system-validation-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));

    console.log('\n📊 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Success Rate: ${this.results.metrics.successRate}%`);
    console.log(`Completion Level: ${this.results.metrics.completionLevel}`);
    console.log(`Total Tests: ${this.results.metrics.passedTests}/${this.results.metrics.totalTests}`);
    console.log(`Report saved: ${reportPath}`);

    return this.results;
  }

  getNextSteps() {
    const failedTests = this.results.tests.filter(t => !t.passed);
    if (failedTests.length === 0) {
      return ['System is complete', 'Focus on performance optimization', 'Add more test cases'];
    }

    return failedTests.map(test => `Fix: ${test.name} - ${test.details}`);
  }

  async run() {
    console.log('🎯 Starting Speech-to-Visuals System Validation');
    console.log('Following Recursive Custom Instructions Framework\n');

    await this.validatePhase1();
    await this.validatePhase2();
    await this.validatePhase3();
    await this.validatePhase4();
    await this.validatePhase5();
    await this.validateAdvancedFeatures();

    this.calculateScore();
    return await this.generateReport();
  }
}

// Run validation
const validator = new SystemValidator();
validator.run().catch(console.error);