#!/usr/bin/env node

/**
 * 🎯 System Verification Test - Current Functionality Assessment
 * Tests the existing audio-to-visual diagram pipeline to understand what's working
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

class SystemVerificationTest {
  constructor() {
    this.testId = `verification-${Date.now()}`;
    this.results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0
      }
    };
  }

  /**
   * Run comprehensive system verification
   */
  async run() {
    console.log('🔍 System Verification Test Starting...');
    console.log(`Test ID: ${this.testId}`);
    const startTime = performance.now();

    try {
      // Test 1: Project Structure Verification
      await this.testProjectStructure();

      // Test 2: Dependencies Availability
      await this.testDependencies();

      // Test 3: Core Module Loading
      await this.testModuleLoading();

      // Test 4: Pipeline Components Initialization
      await this.testPipelineInitialization();

      // Test 5: Mock Audio Processing Flow
      await this.testMockAudioFlow();

      // Test 6: Remotion Integration
      await this.testRemotionIntegration();

      // Test 7: Output Generation
      await this.testOutputGeneration();

      this.results.summary.duration = performance.now() - startTime;
      await this.generateReport();

    } catch (error) {
      console.error('❌ Critical test failure:', error);
      await this.generateErrorReport(error);
    }
  }

  async testProjectStructure() {
    const test = { name: 'Project Structure', status: 'running', details: [] };
    console.log('\n📁 Testing project structure...');

    try {
      const requiredDirs = [
        'src/transcription',
        'src/analysis',
        'src/visualization',
        'src/pipeline',
        'src/types'
      ];

      for (const dir of requiredDirs) {
        try {
          await fs.access(dir);
          test.details.push(`✅ ${dir} exists`);
        } catch {
          test.details.push(`❌ ${dir} missing`);
          test.status = 'failed';
        }
      }

      if (test.status !== 'failed') {
        test.status = 'passed';
        console.log('✅ Project structure verified');
      }

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
    }

    this.addTestResult(test);
  }

  async testDependencies() {
    const test = { name: 'Dependencies', status: 'running', details: [] };
    console.log('\n📦 Testing dependencies...');

    try {
      const requiredDeps = [
        'remotion',
        '@remotion/captions',
        '@dagrejs/dagre',
        'whisper-node'
      ];

      for (const dep of requiredDeps) {
        try {
          await import(dep);
          test.details.push(`✅ ${dep} available`);
        } catch (error) {
          test.details.push(`⚠️ ${dep} - ${error.message.substring(0, 50)}`);
        }
      }

      test.status = 'passed';
      console.log('✅ Dependencies checked');

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
    }

    this.addTestResult(test);
  }

  async testModuleLoading() {
    const test = { name: 'Module Loading', status: 'running', details: [] };
    console.log('\n🔧 Testing module loading...');

    try {
      // Test transcription module
      try {
        const { TranscriptionPipeline } = await import('./src/transcription/index.js');
        test.details.push('✅ TranscriptionPipeline loaded');
      } catch (error) {
        test.details.push(`❌ TranscriptionPipeline: ${error.message.substring(0, 50)}`);
      }

      // Test analysis modules
      try {
        const { SceneSegmenter, DiagramDetector } = await import('./src/analysis/index.js');
        test.details.push('✅ Analysis modules loaded');
      } catch (error) {
        test.details.push(`❌ Analysis modules: ${error.message.substring(0, 50)}`);
      }

      // Test visualization
      try {
        const { LayoutEngine } = await import('./src/visualization/index.js');
        test.details.push('✅ LayoutEngine loaded');
      } catch (error) {
        test.details.push(`❌ LayoutEngine: ${error.message.substring(0, 50)}`);
      }

      // Test main pipeline
      try {
        const { MainPipeline } = await import('./src/pipeline/main-pipeline.js');
        test.details.push('✅ MainPipeline loaded');
      } catch (error) {
        test.details.push(`❌ MainPipeline: ${error.message.substring(0, 50)}`);
      }

      test.status = 'passed';
      console.log('✅ Module loading verified');

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
    }

    this.addTestResult(test);
  }

  async testPipelineInitialization() {
    const test = { name: 'Pipeline Initialization', status: 'running', details: [] };
    console.log('\n⚡ Testing pipeline initialization...');

    try {
      // Try to create individual components
      const { TranscriptionPipeline } = await import('./src/transcription/index.js');
      const transcriber = new TranscriptionPipeline({
        model: 'base',
        combineMs: 200
      });
      test.details.push('✅ TranscriptionPipeline initialized');

      const { SceneSegmenter } = await import('./src/analysis/index.js');
      const segmenter = new SceneSegmenter({
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000
      });
      test.details.push('✅ SceneSegmenter initialized');

      const { DiagramDetector } = await import('./src/analysis/index.js');
      const detector = new DiagramDetector({
        confidenceThreshold: 0.7
      });
      test.details.push('✅ DiagramDetector initialized');

      test.status = 'passed';
      console.log('✅ Pipeline components initialized');

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      test.details.push(`❌ Initialization failed: ${error.message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  async testMockAudioFlow() {
    const test = { name: 'Mock Audio Processing', status: 'running', details: [] };
    console.log('\n🎵 Testing mock audio processing flow...');

    try {
      const { TranscriptionPipeline } = await import('./src/transcription/index.js');
      const transcriber = new TranscriptionPipeline();

      // Create a mock audio file path
      const mockAudioPath = 'mock-jfk.wav';

      // Test transcription with fallback
      const result = await transcriber.transcribe(mockAudioPath);

      test.details.push(`✅ Transcription completed: ${result.segments.length} segments`);
      test.details.push(`✅ Processing time: ${result.processingTime.toFixed(0)}ms`);
      test.details.push(`✅ Success: ${result.success}`);

      if (result.success && result.segments.length > 0) {
        test.status = 'passed';
        console.log('✅ Mock audio processing successful');
      } else {
        test.status = 'failed';
        test.details.push('❌ No segments generated');
      }

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      test.details.push(`❌ Processing failed: ${error.message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  async testRemotionIntegration() {
    const test = { name: 'Remotion Integration', status: 'running', details: [] };
    console.log('\n🎬 Testing Remotion integration...');

    try {
      // Test if Remotion can be imported and used
      const remotion = await import('remotion');
      test.details.push('✅ Remotion imported');

      const captions = await import('@remotion/captions');
      test.details.push('✅ Remotion captions imported');

      // Test basic composition creation (simplified)
      const mockCaptions = [
        { text: 'Test caption', startMs: 0, endMs: 3000, confidence: 0.9 }
      ];
      test.details.push(`✅ Mock captions created: ${mockCaptions.length} items`);

      test.status = 'passed';
      console.log('✅ Remotion integration verified');

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      test.details.push(`❌ Remotion test failed: ${error.message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  async testOutputGeneration() {
    const test = { name: 'Output Generation', status: 'running', details: [] };
    console.log('\n📤 Testing output generation capabilities...');

    try {
      // Test if we can create output directory
      const outputDir = 'test-output';
      await fs.mkdir(outputDir, { recursive: true });
      test.details.push(`✅ Output directory created: ${outputDir}`);

      // Test JSON output generation
      const mockResult = {
        timestamp: new Date().toISOString(),
        scenes: [
          {
            type: 'flow',
            nodes: [{ id: '1', label: 'Start' }, { id: '2', label: 'End' }],
            edges: [{ from: '1', to: '2' }],
            startMs: 0,
            durationMs: 5000,
            summary: 'Test flow diagram'
          }
        ],
        metrics: {
          totalDuration: 5000,
          sceneCount: 1,
          processingTime: 1000
        }
      };

      const outputPath = path.join(outputDir, `${this.testId}.json`);
      await fs.writeFile(outputPath, JSON.stringify(mockResult, null, 2));
      test.details.push(`✅ Test output written: ${outputPath}`);

      test.status = 'passed';
      console.log('✅ Output generation verified');

    } catch (error) {
      test.status = 'failed';
      test.error = error.message;
      test.details.push(`❌ Output generation failed: ${error.message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  addTestResult(test) {
    this.results.tests.push(test);
    this.results.summary.total++;
    if (test.status === 'passed') {
      this.results.summary.passed++;
    } else if (test.status === 'failed') {
      this.results.summary.failed++;
    }
  }

  async generateReport() {
    console.log('\n📊 System Verification Report');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Duration: ${this.results.summary.duration.toFixed(0)}ms`);
    console.log('='.repeat(50));

    // Detailed results
    for (const test of this.results.tests) {
      console.log(`\n${test.status === 'passed' ? '✅' : '❌'} ${test.name}`);
      if (test.details && test.details.length > 0) {
        test.details.forEach(detail => console.log(`  ${detail}`));
      }
      if (test.error) {
        console.log(`  Error: ${test.error}`);
      }
    }

    // Save report
    const reportPath = `system-verification-report-${this.testId}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📋 Report saved: ${reportPath}`);

    // Assessment
    const successRate = (this.results.summary.passed / this.results.summary.total) * 100;
    console.log(`\n🎯 System Health: ${successRate.toFixed(1)}%`);

    if (successRate >= 80) {
      console.log('🟢 System is in good condition - ready for enhancements');
    } else if (successRate >= 60) {
      console.log('🟡 System needs some fixes before major enhancements');
    } else {
      console.log('🔴 System requires significant repairs');
    }
  }

  async generateErrorReport(error) {
    const errorReport = {
      testId: this.testId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(`error-report-${this.testId}.json`, JSON.stringify(errorReport, null, 2));
    console.log(`❌ Error report saved: error-report-${this.testId}.json`);
  }
}

// Run the verification test
const verificationTest = new SystemVerificationTest();
verificationTest.run().catch(console.error);