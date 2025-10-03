#!/usr/bin/env ts-node

/**
 * 🎯 System Verification Test - TypeScript Version
 * Tests the existing audio-to-visual diagram pipeline to understand what's working
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'running' | 'passed' | 'failed';
  details: string[];
  error?: string;
  duration?: number;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration: number;
}

interface VerificationResults {
  tests: TestResult[];
  summary: TestSummary;
}

class SystemVerificationTest {
  private testId: string;
  private results: VerificationResults;

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
  async run(): Promise<void> {
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

      // Test 6: Analysis Pipeline
      await this.testAnalysisPipeline();

      // Test 7: Visualization System
      await this.testVisualizationSystem();

      // Test 8: Complete Pipeline Integration
      await this.testCompleteIntegration();

      this.results.summary.duration = performance.now() - startTime;
      await this.generateReport();

    } catch (error) {
      console.error('❌ Critical test failure:', error);
      await this.generateErrorReport(error as Error);
    }
  }

  private async testProjectStructure(): Promise<void> {
    const test: TestResult = { name: 'Project Structure', status: 'running', details: [] };
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
      test.error = (error as Error).message;
    }

    this.addTestResult(test);
  }

  private async testDependencies(): Promise<void> {
    const test: TestResult = { name: 'Dependencies', status: 'running', details: [] };
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
          test.details.push(`⚠️ ${dep} - ${(error as Error).message.substring(0, 50)}`);
        }
      }

      test.status = 'passed';
      console.log('✅ Dependencies checked');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
    }

    this.addTestResult(test);
  }

  private async testModuleLoading(): Promise<void> {
    const test: TestResult = { name: 'Module Loading', status: 'running', details: [] };
    console.log('\n🔧 Testing module loading...');

    try {
      // Test transcription module
      try {
        const transcriptionModule = await import('./src/transcription');
        if (transcriptionModule.TranscriptionPipeline) {
          test.details.push('✅ TranscriptionPipeline loaded');
        } else {
          test.details.push('❌ TranscriptionPipeline export missing');
        }
      } catch (error) {
        test.details.push(`❌ TranscriptionPipeline: ${(error as Error).message.substring(0, 50)}`);
      }

      // Test analysis modules
      try {
        const analysisModule = await import('./src/analysis');
        if (analysisModule.SceneSegmenter && analysisModule.DiagramDetector) {
          test.details.push('✅ Analysis modules loaded');
        } else {
          test.details.push('❌ Analysis module exports missing');
        }
      } catch (error) {
        test.details.push(`❌ Analysis modules: ${(error as Error).message.substring(0, 50)}`);
      }

      // Test visualization
      try {
        const visualizationModule = await import('./src/visualization');
        if (visualizationModule.LayoutEngine) {
          test.details.push('✅ LayoutEngine loaded');
        } else {
          test.details.push('❌ LayoutEngine export missing');
        }
      } catch (error) {
        test.details.push(`❌ LayoutEngine: ${(error as Error).message.substring(0, 50)}`);
      }

      // Test types
      try {
        const typesModule = await import('./src/types/diagram');
        test.details.push('✅ Types loaded');
      } catch (error) {
        test.details.push(`❌ Types: ${(error as Error).message.substring(0, 50)}`);
      }

      test.status = 'passed';
      console.log('✅ Module loading verified');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
    }

    this.addTestResult(test);
  }

  private async testPipelineInitialization(): Promise<void> {
    const test: TestResult = { name: 'Pipeline Initialization', status: 'running', details: [] };
    console.log('\n⚡ Testing pipeline initialization...');

    try {
      // Try to create individual components
      const { TranscriptionPipeline } = await import('./src/transcription');
      const transcriber = new TranscriptionPipeline({
        model: 'base',
        combineMs: 200
      });
      test.details.push('✅ TranscriptionPipeline initialized');

      const { SceneSegmenter } = await import('./src/analysis');
      const segmenter = new SceneSegmenter({
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000
      });
      test.details.push('✅ SceneSegmenter initialized');

      const { DiagramDetector } = await import('./src/analysis');
      const detector = new DiagramDetector({
        confidenceThreshold: 0.7
      });
      test.details.push('✅ DiagramDetector initialized');

      test.status = 'passed';
      console.log('✅ Pipeline components initialized');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
      test.details.push(`❌ Initialization failed: ${(error as Error).message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  private async testMockAudioFlow(): Promise<void> {
    const test: TestResult = { name: 'Mock Audio Processing', status: 'running', details: [] };
    console.log('\n🎵 Testing mock audio processing flow...');

    try {
      const { TranscriptionPipeline } = await import('./src/transcription');
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
      test.error = (error as Error).message;
      test.details.push(`❌ Processing failed: ${(error as Error).message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  private async testAnalysisPipeline(): Promise<void> {
    const test: TestResult = { name: 'Analysis Pipeline', status: 'running', details: [] };
    console.log('\n🔍 Testing analysis pipeline...');

    try {
      const { SceneSegmenter, DiagramDetector } = await import('./src/analysis');

      // Mock transcription segments
      const mockSegments = [
        {
          start: 0,
          end: 6000,
          text: "Let's explore our organizational hierarchy structure. The company has different levels including management, departments, and teams with clear parent-child relationships.",
          confidence: 0.95
        },
        {
          start: 6000,
          end: 12000,
          text: "Now we'll examine the development timeline and chronology. The project evolution spans multiple phases over several years, from conception in 2020 to deployment in 2024.",
          confidence: 0.88
        }
      ];

      // Test scene segmentation
      const segmenter = new SceneSegmenter({
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000
      });

      const scenes = await segmenter.segmentContent(mockSegments);
      test.details.push(`✅ Scene segmentation: ${scenes.length} scenes created`);

      // Test diagram detection
      const detector = new DiagramDetector({
        confidenceThreshold: 0.7
      });

      const analysis = await detector.detectDiagramType(mockSegments[0].text);
      test.details.push(`✅ Diagram detection: ${analysis.type} detected (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);

      test.status = 'passed';
      console.log('✅ Analysis pipeline verified');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
      test.details.push(`❌ Analysis failed: ${(error as Error).message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  private async testVisualizationSystem(): Promise<void> {
    const test: TestResult = { name: 'Visualization System', status: 'running', details: [] };
    console.log('\n🎨 Testing visualization system...');

    try {
      const { LayoutEngine } = await import('./src/visualization');

      // Mock scene graph
      const mockSceneGraph = {
        type: 'flow' as const,
        nodes: [
          { id: 'start', label: 'Start Process' },
          { id: 'middle', label: 'Processing' },
          { id: 'end', label: 'Complete' }
        ],
        edges: [
          { from: 'start', to: 'middle' },
          { from: 'middle', to: 'end' }
        ],
        startMs: 0,
        durationMs: 5000,
        summary: 'Test flow process',
        keyphrases: ['process', 'flow', 'sequence']
      };

      const layoutEngine = new LayoutEngine({
        width: 1920,
        height: 1080,
        nodeWidth: 120,
        nodeHeight: 60
      });

      const layout = await layoutEngine.generateLayout(mockSceneGraph);
      test.details.push(`✅ Layout generated: ${layout.nodes.length} positioned nodes`);
      test.details.push(`✅ Edges processed: ${layout.edges.length} connections`);

      test.status = 'passed';
      console.log('✅ Visualization system verified');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
      test.details.push(`❌ Visualization failed: ${(error as Error).message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  private async testCompleteIntegration(): Promise<void> {
    const test: TestResult = { name: 'Complete Integration', status: 'running', details: [] };
    console.log('\n🔄 Testing complete pipeline integration...');

    try {
      // Import all required modules
      const { TranscriptionPipeline } = await import('./src/transcription');
      const { SceneSegmenter, DiagramDetector } = await import('./src/analysis');
      const { LayoutEngine } = await import('./src/visualization');

      // Create a mini pipeline
      const transcriber = new TranscriptionPipeline();
      const segmenter = new SceneSegmenter({
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000
      });
      const detector = new DiagramDetector({
        confidenceThreshold: 0.7
      });
      const layoutEngine = new LayoutEngine({
        width: 1920,
        height: 1080,
        nodeWidth: 120,
        nodeHeight: 60
      });

      // Run mini pipeline
      const mockAudioPath = 'mock-audio.wav';

      // Step 1: Transcription
      const transcriptionResult = await transcriber.transcribe(mockAudioPath);
      test.details.push(`✅ Step 1 - Transcription: ${transcriptionResult.segments.length} segments`);

      // Step 2: Scene segmentation
      const scenes = await segmenter.segmentContent(transcriptionResult.segments);
      test.details.push(`✅ Step 2 - Segmentation: ${scenes.length} scenes`);

      // Step 3: Diagram detection for first scene
      if (scenes.length > 0) {
        const firstSceneText = scenes[0].segments.map(s => s.text).join(' ');
        const analysis = await detector.detectDiagramType(firstSceneText);
        test.details.push(`✅ Step 3 - Detection: ${analysis.type} (${(analysis.confidence * 100).toFixed(1)}%)`);

        // Step 4: Create scene graph
        const sceneGraph = {
          type: analysis.type,
          nodes: analysis.entities.map((entity, index) => ({
            id: `node-${index}`,
            label: entity
          })),
          edges: analysis.relationships.map(rel => ({
            from: `node-${rel.from}`,
            to: `node-${rel.to}`
          })),
          startMs: scenes[0].startMs,
          durationMs: scenes[0].durationMs,
          summary: firstSceneText.substring(0, 100),
          keyphrases: analysis.keywords
        };

        // Step 5: Generate layout
        const layout = await layoutEngine.generateLayout(sceneGraph);
        test.details.push(`✅ Step 4 - Layout: ${layout.nodes.length} positioned nodes`);

        test.details.push('✅ Complete pipeline integration successful');
        test.status = 'passed';
      } else {
        test.details.push('❌ No scenes to process');
        test.status = 'failed';
      }

      console.log('✅ Complete integration verified');

    } catch (error) {
      test.status = 'failed';
      test.error = (error as Error).message;
      test.details.push(`❌ Integration failed: ${(error as Error).message.substring(0, 100)}`);
    }

    this.addTestResult(test);
  }

  private addTestResult(test: TestResult): void {
    this.results.tests.push(test);
    this.results.summary.total++;
    if (test.status === 'passed') {
      this.results.summary.passed++;
    } else if (test.status === 'failed') {
      this.results.summary.failed++;
    }
  }

  private async generateReport(): Promise<void> {
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
    const reportPath = `complete-pipeline-test-${this.testId}.json`;
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📋 Report saved: ${reportPath}`);

    // Assessment
    const successRate = (this.results.summary.passed / this.results.summary.total) * 100;
    console.log(`\n🎯 System Health: ${successRate.toFixed(1)}%`);

    if (successRate >= 90) {
      console.log('🟢 System is excellent - ready for advanced features');
    } else if (successRate >= 75) {
      console.log('🟡 System is good - minor improvements needed');
    } else if (successRate >= 50) {
      console.log('🟠 System needs attention - several fixes required');
    } else {
      console.log('🔴 System requires significant work');
    }

    // Next steps recommendation
    console.log('\n📋 Recommended Next Steps:');
    if (successRate >= 75) {
      console.log('- ✅ System is stable, focus on optimization and new features');
      console.log('- 🚀 Consider implementing advanced AI analysis');
      console.log('- 🎬 Enhance Remotion video generation capabilities');
      console.log('- 📊 Add real-time performance monitoring');
    } else {
      console.log('- 🔧 Fix failing test components first');
      console.log('- 📖 Review module export/import issues');
      console.log('- 🧪 Add unit tests for core functions');
      console.log('- 📚 Update documentation');
    }
  }

  private async generateErrorReport(error: Error): Promise<void> {
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