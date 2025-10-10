#!/usr/bin/env ts-node
/**
 * End-to-End Test: Audio → Diagram Video Pipeline
 *
 * 🧪 Test Coverage:
 * 1. Audio transcription module
 * 2. Scene segmentation
 * 3. Diagram detection
 * 4. Complete pipeline flow
 *
 * 🔄 Custom Instructions Compliance:
 * - 段階的テスト実行
 * - 各ステップで評価
 * - 成功基準の明確化
 */

import { AudioToDiagramPipeline, PipelineResult } from './pipeline-mvp';
import { AudioTranscriber } from './transcribe-audio';
import { SimpleDiagramDetector } from '../src/analysis/simple-diagram-detector';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: any;
  error?: string;
}

interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  totalDuration: number;
}

/**
 * Comprehensive E2E Test Suite
 */
class AudioToDiagramTestSuite {
  private results: TestResult[] = [];

  /**
   * Run all tests
   */
  async runAll(): Promise<TestSuite> {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🧪 Audio-to-Diagram Pipeline - E2E Test Suite`);
    console.log(`${'═'.repeat(70)}\n`);

    const suiteStartTime = performance.now();

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 1: Audio Transcriber Module
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Audio Transcriber - Mock Fallback',
      async () => {
        const transcriber = new AudioTranscriber();
        const result = await transcriber.transcribe('/tmp/test-audio.mp3');

        this.assert(result.success, 'Transcription should succeed');
        this.assert(result.segments.length > 0, 'Should have segments');
        this.assert(result.metrics.averageConfidence > 0, 'Should have confidence scores');

        return {
          segments: result.segments.length,
          confidence: result.metrics.averageConfidence
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 2: Diagram Detector - Flow Detection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Diagram Detector - Flow Chart',
      async () => {
        const detector = new SimpleDiagramDetector();
        const result = await detector.analyze({
          text: "First, we start the process. Then we check the condition. Finally, we complete the workflow.",
          startMs: 0,
          endMs: 5000
        });

        this.assert(result.type === 'flow', `Should detect flow chart (got: ${result.type})`);
        this.assert(result.confidence > 0.5, 'Confidence should be > 0.5');
        this.assert(result.nodes.length > 0, 'Should have nodes');

        return {
          type: result.type,
          confidence: result.confidence,
          nodes: result.nodes.length,
          edges: result.edges.length
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 3: Diagram Detector - Tree Detection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Diagram Detector - Tree Structure',
      async () => {
        const detector = new SimpleDiagramDetector();
        const result = await detector.analyze({
          text: "The organization has a CEO at the top, with departments as branches and teams as leaves.",
          startMs: 0,
          endMs: 5000
        });

        this.assert(result.type === 'tree', `Should detect tree (got: ${result.type})`);
        this.assert(result.nodes.length > 0, 'Should have nodes');

        return {
          type: result.type,
          confidence: result.confidence
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 4: Diagram Detector - Timeline Detection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Diagram Detector - Timeline',
      async () => {
        const detector = new SimpleDiagramDetector();
        const result = await detector.analyze({
          text: "In 2020, we started. In 2021, we developed. In 2022, we launched.",
          startMs: 0,
          endMs: 5000
        });

        this.assert(result.type === 'timeline', `Should detect timeline (got: ${result.type})`);

        return {
          type: result.type,
          confidence: result.confidence
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 5: Complete Pipeline Execution
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Complete Pipeline - E2E Flow',
      async () => {
        const pipeline = new AudioToDiagramPipeline();
        const result = await pipeline.execute('/tmp/test-audio.mp3');

        this.assert(result.success, 'Pipeline should succeed');
        this.assert(result.scenes.length > 0, 'Should generate scenes');
        this.assert(result.transcription !== null, 'Should have transcription');
        this.assert(result.metrics.averageConfidence >= 0, 'Should have confidence metrics');

        // Validate each scene
        for (const scene of result.scenes) {
          this.assert(scene.nodes.length > 0, `Scene ${scene.sceneId} should have nodes`);
          this.assert(scene.diagramType !== '', `Scene ${scene.sceneId} should have diagram type`);
        }

        return {
          scenes: result.scenes.length,
          avgConfidence: result.metrics.averageConfidence,
          processingTime: result.metrics.processingTime
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 6: Scene Segmentation Quality
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Scene Segmentation - Quality Check',
      async () => {
        const pipeline = new AudioToDiagramPipeline();
        const result = await pipeline.execute('/tmp/test-audio.mp3');

        this.assert(result.success, 'Pipeline should succeed');

        // Check scene durations are reasonable
        for (const scene of result.scenes) {
          const duration = scene.endMs - scene.startMs;
          this.assert(duration > 0, 'Scene duration should be positive');
          this.assert(duration < 30000, 'Scene duration should be < 30s');
        }

        return {
          scenes: result.scenes.length,
          avgDuration: result.scenes.reduce((sum, s) => sum + (s.endMs - s.startMs), 0) / result.scenes.length / 1000
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 7: Diagram Element Quality
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Diagram Elements - Quality Check',
      async () => {
        const pipeline = new AudioToDiagramPipeline();
        const result = await pipeline.execute('/tmp/test-audio.mp3');

        this.assert(result.success, 'Pipeline should succeed');

        let totalNodes = 0;
        let totalEdges = 0;

        for (const scene of result.scenes) {
          totalNodes += scene.nodes.length;
          totalEdges += scene.edges.length;

          // Validate node structure
          for (const node of scene.nodes) {
            this.assert(node.id, 'Node should have ID');
            this.assert(node.label, 'Node should have label');
          }

          // Validate edge structure
          for (const edge of scene.edges) {
            this.assert(edge.id, 'Edge should have ID');
            this.assert(edge.from, 'Edge should have from');
            this.assert(edge.to, 'Edge should have to');
          }
        }

        return {
          totalNodes,
          totalEdges,
          avgNodesPerScene: totalNodes / result.scenes.length,
          avgEdgesPerScene: totalEdges / result.scenes.length
        };
      }
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Test 8: Performance Benchmarks
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await this.runTest(
      'Performance - Processing Speed',
      async () => {
        const pipeline = new AudioToDiagramPipeline();
        const result = await pipeline.execute('/tmp/test-audio.mp3');

        this.assert(result.success, 'Pipeline should succeed');
        this.assert(result.metrics.processingTime < 10000, 'Processing should complete in < 10s');

        return {
          processingTime: result.metrics.processingTime,
          throughput: result.scenes.length / (result.metrics.processingTime / 1000) // scenes per second
        };
      }
    );

    const suiteDuration = performance.now() - suiteStartTime;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Generate Test Report
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.filter(r => !r.passed).length;
    const successRate = (passedTests / this.results.length) * 100;

    const suite: TestSuite = {
      suiteName: 'Audio-to-Diagram Pipeline E2E',
      tests: this.results,
      totalTests: this.results.length,
      passedTests,
      failedTests,
      successRate,
      totalDuration: suiteDuration
    };

    this.printReport(suite);
    await this.saveReport(suite);

    return suite;
  }

  /**
   * Run individual test
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    console.log(`🧪 ${name}`);

    const startTime = performance.now();

    try {
      const details = await testFn();
      const duration = performance.now() - startTime;

      this.results.push({
        name,
        passed: true,
        duration,
        details
      });

      console.log(`   ✅ PASSED (${duration.toFixed(2)}ms)`);
      if (details) {
        console.log(`   📊 Details:`, JSON.stringify(details, null, 2).split('\n').map(l => `      ${l}`).join('\n'));
      }
      console.log();

    } catch (error) {
      const duration = performance.now() - startTime;

      this.results.push({
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      console.log(`   ❌ FAILED (${duration.toFixed(2)}ms)`);
      console.log(`   💥 Error: ${error instanceof Error ? error.message : error}`);
      console.log();
    }
  }

  /**
   * Assert condition
   */
  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Print test report
   */
  private printReport(suite: TestSuite): void {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 Test Suite Results`);
    console.log(`${'═'.repeat(70)}\n`);

    console.log(`Suite: ${suite.suiteName}`);
    console.log(`Total Tests: ${suite.totalTests}`);
    console.log(`✅ Passed: ${suite.passedTests}`);
    console.log(`❌ Failed: ${suite.failedTests}`);
    console.log(`📈 Success Rate: ${suite.successRate.toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${(suite.totalDuration / 1000).toFixed(2)}s\n`);

    if (suite.failedTests > 0) {
      console.log(`Failed Tests:`);
      suite.tests.filter(t => !t.passed).forEach(test => {
        console.log(`  ❌ ${test.name}`);
        console.log(`     Error: ${test.error}`);
      });
      console.log();
    }

    console.log(`${'═'.repeat(70)}`);
    console.log(suite.successRate === 100 ? `🎉 All tests passed!` : `⚠️  Some tests failed`);
    console.log(`${'═'.repeat(70)}\n`);
  }

  /**
   * Save test report to file
   */
  private async saveReport(suite: TestSuite): Promise<void> {
    const outputDir = path.join(process.cwd(), 'demo-output');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = Date.now();
    const reportPath = path.join(outputDir, `test-report-${timestamp}.json`);

    await fs.writeFile(reportPath, JSON.stringify(suite, null, 2));

    console.log(`💾 Test report saved: ${reportPath}\n`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Execution
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Run tests automatically
const testSuite = new AudioToDiagramTestSuite();
const results = await testSuite.runAll();

// Exit with appropriate code
process.exit(results.successRate === 100 ? 0 : 1);

export { AudioToDiagramTestSuite };
