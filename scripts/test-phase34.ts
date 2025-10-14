/**
 * Phase 34: Comprehensive Test Suite
 * Tests persistent logging system and improvements
 *
 * Philosophy: 実装→テスト→評価→改善→コミット (Custom Instructions Compliant)
 */

import { globalIterationLogger, IterationLogEntry } from '../src/utils/iteration-logger';
import * as fs from 'fs';
import * as path from 'path';

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

/**
 * Test 1: Iteration Logger Creation and Initialization
 */
async function testIterationLoggerInit(): Promise<boolean> {
  console.log('\n🧪 Test 1: Iteration Logger Initialization');

  try {
    // Test that logger can be created
    if (!globalIterationLogger) {
      throw new Error('Global iteration logger not initialized');
    }

    console.log('✅ Logger initialized successfully');

    // Test that log file structure is correct
    const history = await globalIterationLogger.readHistory();
    console.log(`✅ Can read history (${history.length} entries found)`);

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Test 2: Appending Iteration Entries
 */
async function testAppendIteration(): Promise<boolean> {
  console.log('\n🧪 Test 2: Appending Iteration Entries');

  try {
    const testEntry: IterationLogEntry = {
      iteration: 999,
      phase: 'phase-34-test',
      timestamp: new Date().toISOString(),
      success: true,
      metrics: {
        totalProcessingTime: 5000,
        transcriptionTime: 1000,
        analysisTime: 1500,
        layoutTime: 1200,
        renderTime: 1300,
        segmentCount: 5,
        diagramCount: 3,
        successRate: 1.0,
        memoryUsage: 100 * 1024 * 1024 // 100MB
      },
      config: {
        transcription: { model: 'base', language: 'en' },
        analysis: { minSegmentLengthMs: 3000, maxSegmentLengthMs: 15000, confidenceThreshold: 0.7 }
      },
      improvements: ['Test improvement 1', 'Test improvement 2'],
      nextSteps: ['Test next step 1']
    };

    await globalIterationLogger.appendIteration(testEntry);
    console.log('✅ Successfully appended test iteration entry');

    // Verify it was appended
    const logPath = path.join(process.cwd(), 'docs', 'architecture', 'ITERATION_LOG.md');
    const content = await fs.promises.readFile(logPath, 'utf-8');

    if (!content.includes('phase-34-test')) {
      throw new Error('Test entry not found in log file');
    }

    if (!content.includes('Iteration 999')) {
      throw new Error('Iteration number not found in log file');
    }

    console.log('✅ Test entry verified in log file');

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Test 3: Calculating Improvement Trends
 */
async function testImprovementTrends(): Promise<boolean> {
  console.log('\n🧪 Test 3: Calculating Improvement Trends');

  try {
    const trends = await globalIterationLogger.calculateImprovementTrends();

    if (typeof trends.averageProcessingTime !== 'number') {
      throw new Error('Average processing time not calculated');
    }

    if (typeof trends.successRate !== 'number' || trends.successRate < 0 || trends.successRate > 1) {
      throw new Error('Invalid success rate');
    }

    if (!['improving', 'stable', 'regressing'].includes(trends.trendDirection)) {
      throw new Error('Invalid trend direction');
    }

    if (!Array.isArray(trends.recommendations)) {
      throw new Error('Recommendations not generated');
    }

    console.log(`✅ Average Processing Time: ${trends.averageProcessingTime.toFixed(2)}ms`);
    console.log(`✅ Success Rate: ${(trends.successRate * 100).toFixed(1)}%`);
    console.log(`✅ Trend Direction: ${trends.trendDirection}`);
    console.log(`✅ Recommendations: ${trends.recommendations.length} generated`);

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Test 4: Phase Summary Generation
 */
async function testPhaseSummary(): Promise<boolean> {
  console.log('\n🧪 Test 4: Phase Summary Generation');

  try {
    const summary = await globalIterationLogger.generatePhaseSummary('phase-34-test');

    if (typeof summary !== 'string' || summary.length === 0) {
      throw new Error('Phase summary not generated');
    }

    if (!summary.includes('Phase Summary')) {
      throw new Error('Summary format incorrect');
    }

    console.log('✅ Phase summary generated successfully');
    console.log(`Summary length: ${summary.length} characters`);

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Test 5: Integration Test - Full Pipeline Logging Workflow
 */
async function testIntegration(): Promise<boolean> {
  console.log('\n🧪 Test 5: Integration Test - Full Workflow');

  try {
    // Simulate multiple iterations
    for (let i = 1; i <= 3; i++) {
      const entry: IterationLogEntry = {
        iteration: 1000 + i,
        phase: 'phase-34-integration-test',
        timestamp: new Date().toISOString(),
        success: true,
        metrics: {
          totalProcessingTime: 5000 - (i * 100), // Simulating improvement
          transcriptionTime: 1000,
          analysisTime: 1500,
          layoutTime: 1200,
          renderTime: 1300 - (i * 50),
          segmentCount: 5,
          diagramCount: 3,
          successRate: 1.0
        },
        config: {
          transcription: { model: 'base', language: 'en' },
          analysis: { minSegmentLengthMs: 3000, maxSegmentLengthMs: 15000, confidenceThreshold: 0.7 }
        },
        improvements: [`Iteration ${i} improvement`],
        nextSteps: [`Next step for iteration ${i + 1}`]
      };

      await globalIterationLogger.appendIteration(entry);
    }

    console.log('✅ Simulated 3 iterations successfully');

    // Calculate trends from these iterations
    const trends = await globalIterationLogger.calculateImprovementTrends();
    console.log(`✅ Trends calculated after simulation`);
    console.log(`   Trend Direction: ${trends.trendDirection}`);

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Test 6: Error Handling and Edge Cases
 */
async function testErrorHandling(): Promise<boolean> {
  console.log('\n🧪 Test 6: Error Handling and Edge Cases');

  try {
    // Test with minimal entry (missing optional fields)
    const minimalEntry: IterationLogEntry = {
      iteration: 2000,
      phase: 'phase-34-minimal-test',
      timestamp: new Date().toISOString(),
      success: false,
      metrics: {
        totalProcessingTime: 1000,
        transcriptionTime: 0,
        analysisTime: 0,
        layoutTime: 0,
        renderTime: 0,
        segmentCount: 0,
        diagramCount: 0,
        successRate: 0
      },
      config: {},
      errorMessage: 'Test error for validation'
    };

    await globalIterationLogger.appendIteration(minimalEntry);
    console.log('✅ Handled minimal entry with error message');

    // Test summary for non-existent phase
    const nonExistentSummary = await globalIterationLogger.generatePhaseSummary('non-existent-phase');

    if (!nonExistentSummary.includes('No iterations')) {
      throw new Error('Did not handle non-existent phase correctly');
    }

    console.log('✅ Handled non-existent phase correctly');

    return true;
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Phase 34 Test Suite - Persistent Logging & Improvements');
  console.log('=' .repeat(60));

  const tests = [
    { name: 'Iteration Logger Init', fn: testIterationLoggerInit },
    { name: 'Append Iteration', fn: testAppendIteration },
    { name: 'Improvement Trends', fn: testImprovementTrends },
    { name: 'Phase Summary', fn: testPhaseSummary },
    { name: 'Integration Test', fn: testIntegration },
    { name: 'Error Handling', fn: testErrorHandling }
  ];

  const startTime = Date.now();

  for (const test of tests) {
    testsRun++;
    const passed = await test.fn();

    if (passed) {
      testsPassed++;
    } else {
      testsFailed++;
    }
  }

  const totalTime = Date.now() - startTime;

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`✅ Passed: ${testsPassed}/${testsRun}`);
  console.log(`❌ Failed: ${testsFailed}/${testsRun}`);
  console.log(`⏱️  Total time: ${(totalTime / 1000).toFixed(2)}s`);

  const successRate = (testsPassed / testsRun) * 100;
  console.log(`\n${successRate === 100 ? '🎉' : '⚠️ '} Phase 34 Test Suite ${successRate === 100 ? 'PASSED' : 'FAILED'} (${successRate.toFixed(1)}% success rate)`);

  if (testsFailed === 0) {
    console.log('✅ Phase 34 implementation is complete and functional');
    console.log('📝 Persistent logging system working correctly');
    console.log('📈 Improvement tracking operational');
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Fatal error running tests:', error);
  process.exit(1);
});
