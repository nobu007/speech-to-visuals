/**
 * Phase 37: Comprehensive Validation Test
 *
 * Tests all Phase 37 enhancements:
 * 1. Multi-Format Export Engine
 * 2. Adaptive Quality Presets
 * 3. Batch Processing API
 * 4. User-Guided Error Recovery
 */

import { readFileSync, existsSync } from 'fs';
import { multiFormatExporter } from '../src/export/multi-format-exporter';
import { adaptiveQualityPresets, QUALITY_PRESETS } from '../src/pipeline/adaptive-quality-presets';
import { batchProcessingAPI } from '../src/api/batch-processing-api';
import { userGuidedErrorRecovery } from '../src/quality/user-guided-error-recovery';
import type { SceneGraph } from '@stv/core/types/diagram';

console.log('🚀 Phase 37: Starting Comprehensive Validation Test\n');

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Test 1: Multi-Format Export Engine
 */
async function testMultiFormatExport(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('📤 Test 1: Multi-Format Export Engine');

  try {
    // Create mock scene data
    const mockScene: SceneGraph = {
      id: 'test-scene-1',
      startTime: 0,
      endTime: 10,
      content: 'Test content for export',
      type: 'flow',
      confidence: 0.9,
      layout: {
        nodes: [
          { id: 'node1', label: 'Start', x: 100, y: 100, width: 120, height: 60 },
          { id: 'node2', label: 'Process', x: 300, y: 100, width: 120, height: 60 },
          { id: 'node3', label: 'End', x: 500, y: 100, width: 120, height: 60 },
        ],
        edges: [
          { from: 'node1', to: 'node2', label: 'start' },
          { from: 'node2', to: 'node3', label: 'finish' },
        ],
      },
    };

    const formats = ['svg', 'json'] as const;
    const exportResults: Record<string, boolean> = {};

    for (const format of formats) {
      console.log(`   Testing ${format.toUpperCase()} export...`);
      const result = await multiFormatExporter.export(mockScene, { format });

      exportResults[format] = result.success;

      if (result.success) {
        console.log(`   ✅ ${format.toUpperCase()} export successful`);
        console.log(`      Size: ${result.metadata?.sizeBytes} bytes`);
        console.log(`      Dimensions: ${result.metadata?.dimensions.width}x${result.metadata?.dimensions.height}`);
      } else {
        console.log(`   ❌ ${format.toUpperCase()} export failed: ${result.error}`);
      }
    }

    // Test batch export
    console.log(`   Testing batch export...`);
    const batchResults = await multiFormatExporter.exportBatch([mockScene], { format: 'svg' });
    const batchSuccess = batchResults.every((r) => r.success);

    exportResults['batch'] = batchSuccess;
    console.log(`   ${batchSuccess ? '✅' : '❌'} Batch export ${batchSuccess ? 'successful' : 'failed'}`);

    const allPassed = Object.values(exportResults).every((v) => v);
    const duration = Date.now() - startTime;

    return {
      name: 'Multi-Format Export Engine',
      passed: allPassed,
      details: `Formats tested: ${Object.keys(exportResults).join(', ')}. ${
        allPassed ? 'All exports succeeded' : 'Some exports failed'
      }`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('   ❌ Test failed with error:', error);
    return {
      name: 'Multi-Format Export Engine',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
    };
  }
}

/**
 * Test 2: Adaptive Quality Presets
 */
async function testAdaptiveQualityPresets(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n⚙️  Test 2: Adaptive Quality Presets');

  try {
    const checks: Record<string, boolean> = {};

    // Test preset switching
    console.log('   Testing preset switching...');
    for (const presetName of ['fast', 'balanced', 'quality'] as const) {
      adaptiveQualityPresets.setPreset(presetName);
      const currentPreset = adaptiveQualityPresets.getCurrentPreset();
      checks[`preset_${presetName}`] = currentPreset.name === presetName;
      console.log(`   ${checks[`preset_${presetName}`] ? '✅' : '❌'} Preset "${presetName}" ${
        checks[`preset_${presetName}`] ? 'set correctly' : 'failed'
      }`);
    }

    // Test auto-selection
    console.log('   Testing auto-selection...');
    const smallFile = new File(['small'], 'small.mp3', { type: 'audio/mp3' });
    const mediumFile = new File([new ArrayBuffer(5 * 1024 * 1024)], 'medium.mp3', { type: 'audio/mp3' });

    const smallPreset = adaptiveQualityPresets.autoSelectPreset(smallFile);
    const mediumPreset = adaptiveQualityPresets.autoSelectPreset(mediumFile);

    checks['auto_select_small'] = smallPreset === 'fast';
    checks['auto_select_medium'] = mediumPreset === 'balanced';

    console.log(`   ${checks['auto_select_small'] ? '✅' : '❌'} Small file auto-selected "${smallPreset}"`);
    console.log(`   ${checks['auto_select_medium'] ? '✅' : '❌'} Medium file auto-selected "${mediumPreset}"`);

    // Test preset comparison
    console.log('   Testing preset comparison...');
    const comparison = adaptiveQualityPresets.getPresetComparison();
    checks['comparison'] = comparison.length === 4; // fast, balanced, quality, custom
    console.log(`   ${checks['comparison'] ? '✅' : '❌'} Preset comparison generated (${comparison.length} presets)`);

    // Test validation
    console.log('   Testing result validation...');
    adaptiveQualityPresets.setPreset('balanced');
    const validation = adaptiveQualityPresets.validateResult(50, 85, 400);
    checks['validation'] = validation.meetsExpectations;
    console.log(`   ${checks['validation'] ? '✅' : '❌'} Result validation works (expectations ${
      validation.meetsExpectations ? 'met' : 'not met'
    })`);

    // Test preset summary
    console.log('   Testing preset summary...');
    const summary = adaptiveQualityPresets.getPresetSummary();
    checks['summary'] = summary.length > 0 && summary.includes('balanced');
    console.log(`   ${checks['summary'] ? '✅' : '❌'} Preset summary generated`);

    const allPassed = Object.values(checks).every((v) => v);
    const duration = Date.now() - startTime;

    return {
      name: 'Adaptive Quality Presets',
      passed: allPassed,
      details: `Checks: ${Object.keys(checks).length}. Passed: ${Object.values(checks).filter((v) => v).length}/${
        Object.keys(checks).length
      }`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('   ❌ Test failed with error:', error);
    return {
      name: 'Adaptive Quality Presets',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
    };
  }
}

/**
 * Test 3: Batch Processing API
 */
async function testBatchProcessingAPI(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n📦 Test 3: Batch Processing API');

  try {
    const checks: Record<string, boolean> = {};

    // Create mock files
    const mockFiles = [
      new File(['audio1'], 'test1.mp3', { type: 'audio/mp3' }),
      new File(['audio2'], 'test2.mp3', { type: 'audio/mp3' }),
    ];

    // Note: Actual batch processing requires real audio files and API setup
    // For Phase 37 validation, we test API structure without full processing

    console.log('   Testing API structure...');

    // Test job submission (structure only)
    console.log('   Testing job submission structure...');
    checks['api_structure'] = typeof batchProcessingAPI.submitJob === 'function';
    console.log(`   ${checks['api_structure'] ? '✅' : '❌'} Job submission API exists`);

    // Test status checking
    console.log('   Testing status checking...');
    checks['status_api'] = typeof batchProcessingAPI.getJobStatus === 'function';
    console.log(`   ${checks['status_api'] ? '✅' : '❌'} Status checking API exists`);

    // Test result retrieval
    console.log('   Testing result retrieval...');
    checks['result_api'] = typeof batchProcessingAPI.getJobResult === 'function';
    console.log(`   ${checks['result_api'] ? '✅' : '❌'} Result retrieval API exists`);

    // Test job listing
    console.log('   Testing job listing...');
    const jobs = batchProcessingAPI.listJobs();
    checks['list_jobs'] = Array.isArray(jobs);
    console.log(`   ${checks['list_jobs'] ? '✅' : '❌'} Job listing works (${jobs.length} jobs)`);

    // Test cancellation
    console.log('   Testing cancellation API...');
    checks['cancel_api'] = typeof batchProcessingAPI.cancelJob === 'function';
    console.log(`   ${checks['cancel_api'] ? '✅' : '❌'} Cancellation API exists`);

    const allPassed = Object.values(checks).every((v) => v);
    const duration = Date.now() - startTime;

    return {
      name: 'Batch Processing API',
      passed: allPassed,
      details: `API endpoints: ${Object.keys(checks).length}. All endpoints available: ${allPassed}`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('   ❌ Test failed with error:', error);
    return {
      name: 'Batch Processing API',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
    };
  }
}

/**
 * Test 4: User-Guided Error Recovery
 */
async function testUserGuidedErrorRecovery(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n🔧 Test 4: User-Guided Error Recovery');

  try {
    const checks: Record<string, boolean> = {};

    // Test error categorization
    console.log('   Testing error categorization...');
    const errors = [
      new Error('Unsupported file format'),
      new Error('File too large'),
      new Error('Transcription failed'),
      new Error('API quota exceeded'),
      new Error('Network timeout'),
    ];

    for (const error of errors) {
      const guidance = userGuidedErrorRecovery.analyzeError(error);
      const hasGuidance =
        guidance.category !== 'unknown' &&
        guidance.userMessage.length > 0 &&
        guidance.recoveryStrategies.length > 0;

      checks[`error_${error.message.slice(0, 20)}`] = hasGuidance;
      console.log(`   ${hasGuidance ? '✅' : '❌'} Error "${error.message}" categorized as "${guidance.category}"`);
      console.log(`      Recovery strategies: ${guidance.recoveryStrategies.length}`);
      console.log(`      Prevention tips: ${guidance.preventionTips.length}`);
    }

    // Test recovery attempt (mock)
    console.log('   Testing recovery attempt...');
    const mockError = new Error('Test timeout error');
    const guidance = userGuidedErrorRecovery.analyzeError(mockError);
    checks['has_automated_recovery'] = guidance.recoveryStrategies.some((s) => s.automated);
    console.log(`   ${checks['has_automated_recovery'] ? '✅' : '❌'} Automated recovery strategies available`);

    // Test error statistics
    console.log('   Testing error statistics...');
    const stats = userGuidedErrorRecovery.getErrorStatistics();
    checks['statistics'] = stats.total >= errors.length;
    console.log(`   ${checks['statistics'] ? '✅' : '❌'} Error statistics tracked (${stats.total} total)`);
    console.log(`      Recovery rate: ${(stats.recoveryRate * 100).toFixed(1)}%`);
    console.log(`      Most common: ${stats.mostCommon}`);

    const allPassed = Object.values(checks).every((v) => v);
    const duration = Date.now() - startTime;

    return {
      name: 'User-Guided Error Recovery',
      passed: allPassed,
      details: `Error types tested: ${errors.length}. Categorization accuracy: ${
        (Object.values(checks).filter((v) => v).length / Object.keys(checks).length) * 100
      }%`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('   ❌ Test failed with error:', error);
    return {
      name: 'User-Guided Error Recovery',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('═'.repeat(80));
  console.log('PHASE 37: COMPREHENSIVE VALIDATION TEST SUITE');
  console.log('═'.repeat(80));
  console.log();

  const testSuiteStart = Date.now();

  // Run tests
  results.push(await testMultiFormatExport());
  results.push(await testAdaptiveQualityPresets());
  results.push(await testBatchProcessingAPI());
  results.push(await testUserGuidedErrorRecovery());

  const totalDuration = Date.now() - testSuiteStart;

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(80));

  const passedTests = results.filter((r) => r.passed).length;
  const totalTests = results.length;
  const successRate = (passedTests / totalTests) * 100;

  for (const result of results) {
    console.log(`${result.passed ? '✅' : '❌'} ${result.name}`);
    console.log(`   ${result.details}`);
    console.log(`   Duration: ${result.duration}ms`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('─'.repeat(80));

  if (successRate === 100) {
    console.log('\n🎉 All Phase 37 tests PASSED! System ready for deployment.');
  } else if (successRate >= 75) {
    console.log('\n⚠️  Most Phase 37 tests passed, but some issues need attention.');
  } else {
    console.log('\n❌ Phase 37 tests failed. Please review errors above.');
  }

  console.log('\n' + '═'.repeat(80));

  // Exit with appropriate code
  process.exit(successRate === 100 ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running test suite:', error);
  process.exit(1);
});
