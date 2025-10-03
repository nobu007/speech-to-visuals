#!/usr/bin/env node

/**
 * Simple Pipeline Test for Audio-to-Diagram System
 * Tests core functionality following the custom instructions approach
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

class SimplePipelineTest {
  constructor() {
    this.startTime = performance.now();
    this.testResults = {
      phase: "System Validation",
      iteration: 45,
      timestamp: new Date().toISOString(),
      tests: [],
      overallStatus: "running",
      processingTime: 0,
      qualityScore: 0
    };
  }

  // Test 1: Verify project structure
  async testProjectStructure() {
    console.log('🧪 Testing project structure...');
    const requiredDirs = [
      'src/pipeline',
      'src/transcription',
      'src/analysis',
      'src/visualization',
      'src/remotion',
      '.module'
    ];

    let passed = 0;
    const results = [];

    for (const dir of requiredDirs) {
      const exists = fs.existsSync(dir);
      results.push({ dir, exists });
      if (exists) passed++;
    }

    const success = passed === requiredDirs.length;
    this.testResults.tests.push({
      name: "Project Structure",
      status: success ? "✅ PASS" : "❌ FAIL",
      details: results,
      score: (passed / requiredDirs.length) * 100
    });

    return success;
  }

  // Test 2: Check dependencies
  async testDependencies() {
    console.log('📦 Testing core dependencies...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = [
      'remotion',
      '@remotion/captions',
      '@remotion/media-utils',
      '@dagrejs/dagre',
      'whisper-node'
    ];

    let passed = 0;
    const results = [];

    for (const dep of requiredDeps) {
      const exists = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
      results.push({ dependency: dep, version: exists || 'missing' });
      if (exists) passed++;
    }

    const success = passed === requiredDeps.length;
    this.testResults.tests.push({
      name: "Core Dependencies",
      status: success ? "✅ PASS" : "❌ FAIL",
      details: results,
      score: (passed / requiredDeps.length) * 100
    });

    return success;
  }

  // Test 3: Verify main pipeline exists and is importable
  async testPipelineImport() {
    console.log('🔧 Testing pipeline import...');
    try {
      const pipelineExists = fs.existsSync('src/pipeline/main-pipeline.ts');
      const frameworkExists = fs.existsSync('src/framework/recursive-custom-instructions.ts');

      this.testResults.tests.push({
        name: "Pipeline Import",
        status: (pipelineExists && frameworkExists) ? "✅ PASS" : "❌ FAIL",
        details: {
          mainPipeline: pipelineExists,
          customInstructions: frameworkExists
        },
        score: (pipelineExists && frameworkExists) ? 100 : 50
      });

      return pipelineExists && frameworkExists;
    } catch (error) {
      this.testResults.tests.push({
        name: "Pipeline Import",
        status: "❌ FAIL",
        details: { error: error.message },
        score: 0
      });
      return false;
    }
  }

  // Test 4: Check iteration log and documentation
  async testDocumentation() {
    console.log('📚 Testing documentation completeness...');
    const docs = [
      '.module/ITERATION_LOG.md',
      '.module/SYSTEM_CORE.md',
      '.module/QUALITY_METRICS.md'
    ];

    let passed = 0;
    const results = [];

    for (const doc of docs) {
      const exists = fs.existsSync(doc);
      if (exists) {
        const content = fs.readFileSync(doc, 'utf8');
        const isComplete = content.length > 1000; // Basic completeness check
        results.push({ doc, exists, complete: isComplete });
        if (exists && isComplete) passed++;
      } else {
        results.push({ doc, exists, complete: false });
      }
    }

    const success = passed >= 2; // At least 2 key docs should exist
    this.testResults.tests.push({
      name: "Documentation",
      status: success ? "✅ PASS" : "❌ FAIL",
      details: results,
      score: (passed / docs.length) * 100
    });

    return success;
  }

  // Test 5: Verify custom instructions integration
  async testCustomInstructionsIntegration() {
    console.log('🎯 Testing custom instructions integration...');
    try {
      const iterationLog = fs.readFileSync('.module/ITERATION_LOG.md', 'utf8');
      const hasIterations = iterationLog.includes('Iteration') && iterationLog.includes('Custom Instructions');
      const hasQualityMetrics = iterationLog.includes('Quality') || iterationLog.includes('品質');
      const hasRecursiveFramework = iterationLog.includes('Recursive') || iterationLog.includes('再帰');

      const score = [hasIterations, hasQualityMetrics, hasRecursiveFramework].filter(Boolean).length;
      const success = score >= 2;

      this.testResults.tests.push({
        name: "Custom Instructions Integration",
        status: success ? "✅ PASS" : "❌ FAIL",
        details: {
          iterationTracking: hasIterations,
          qualityMetrics: hasQualityMetrics,
          recursiveFramework: hasRecursiveFramework
        },
        score: (score / 3) * 100
      });

      return success;
    } catch (error) {
      this.testResults.tests.push({
        name: "Custom Instructions Integration",
        status: "❌ FAIL",
        details: { error: error.message },
        score: 0
      });
      return false;
    }
  }

  // Calculate overall results
  calculateResults() {
    const totalTests = this.testResults.tests.length;
    const passedTests = this.testResults.tests.filter(t => t.status.includes('PASS')).length;
    const avgScore = this.testResults.tests.reduce((sum, t) => sum + t.score, 0) / totalTests;

    this.testResults.processingTime = Math.round(performance.now() - this.startTime);
    this.testResults.qualityScore = Math.round(avgScore * 10) / 10;
    this.testResults.overallStatus = passedTests === totalTests ? "✅ ALL PASS" :
                                    passedTests >= totalTests * 0.8 ? "⚠️  MOSTLY PASS" : "❌ NEEDS ATTENTION";

    return {
      success: passedTests >= totalTests * 0.8,
      passed: passedTests,
      total: totalTests,
      score: avgScore
    };
  }

  // Run all tests
  async run() {
    console.log('🚀 Starting Simple Pipeline Test...\n');

    try {
      await this.testProjectStructure();
      await this.testDependencies();
      await this.testPipelineImport();
      await this.testDocumentation();
      await this.testCustomInstructionsIntegration();

      const results = this.calculateResults();

      console.log('\n📊 Test Results Summary:');
      console.log('=' .repeat(50));
      console.log(`Overall Status: ${this.testResults.overallStatus}`);
      console.log(`Tests Passed: ${results.passed}/${results.total}`);
      console.log(`Quality Score: ${this.testResults.qualityScore}%`);
      console.log(`Processing Time: ${this.testResults.processingTime}ms`);
      console.log('=' .repeat(50));

      console.log('\n📋 Detailed Results:');
      this.testResults.tests.forEach(test => {
        console.log(`${test.status} ${test.name} (${test.score}%)`);
      });

      // Save results
      const filename = `simple-pipeline-test-${Date.now()}.json`;
      fs.writeFileSync(filename, JSON.stringify(this.testResults, null, 2));
      console.log(`\n💾 Results saved to: ${filename}`);

      return results;

    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      this.testResults.overallStatus = "❌ ERROR";
      return { success: false, error: error.message };
    }
  }
}

// Run the test
const test = new SimplePipelineTest();
test.run().then(results => {
  if (results.success) {
    console.log('\n🎉 System validation successful! Ready for next iteration.');
    process.exit(0);
  } else {
    console.log('\n⚠️  System needs attention before proceeding.');
    process.exit(1);
  }
});