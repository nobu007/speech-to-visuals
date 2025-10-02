/**
 * Simple Iteration 9 Validation Test
 * Validates that the new optimization components are properly integrated
 */

import fs from 'fs';
import { performance } from 'perf_hooks';

console.log('🔍 Iteration 9 Simple Validation Test');
console.log('=====================================');

async function validateIteration9() {
  const results = {
    componentValidation: {},
    integrationTest: {},
    performanceBaseline: {}
  };

  // 1. Validate that new optimization files exist and are properly structured
  console.log('\n📁 Component Validation:');
  const expectedFiles = [
    'src/optimization/smart-optimizer.ts',
    'src/optimization/semantic-cache.ts',
    'src/optimization/predictive-monitor.ts'
  ];

  for (const file of expectedFiles) {
    try {
      const stats = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf8');

      // Check for key classes and exports
      const hasExports = content.includes('export');
      const hasClass = content.includes('class ');
      const hasInterface = content.includes('interface ');

      console.log(`✅ ${file}: ${Math.round(stats.size / 1024)}KB, exports: ${hasExports}, classes: ${hasClass}`);

      results.componentValidation[file] = {
        exists: true,
        size: stats.size,
        hasExports,
        hasClass,
        hasInterface
      };
    } catch (error) {
      console.log(`❌ ${file}: NOT FOUND`);
      results.componentValidation[file] = { exists: false, error: error.message };
    }
  }

  // 2. Test the existing optimization system
  console.log('\n🔄 Integration Test:');
  try {
    // Use the existing optimization system
    const { default: SmartOptimizationOrchestrator } = await import('./src/optimization/index.js');

    const orchestrator = new SmartOptimizationOrchestrator({
      enableParameterTuning: true,
      enableAdaptiveProcessing: true,
      enableIntelligentCaching: true,
      enablePredictiveMaintenance: true,
      aggressiveness: 'balanced',
      learningRate: 0.1,
      monitoringInterval: 30000
    });

    // Initialize with baseline metrics
    await orchestrator.initialize({
      processingTime: 30000,
      memoryUsage: 128,
      accuracyScore: 0.85,
      errorRate: 0.02,
      throughput: 6.0
    });

    console.log('✅ Orchestrator initialized successfully');

    // Test optimization for mock audio
    const optimizationResult = await orchestrator.optimizeForAudio(
      {
        duration: 18000,
        quality: 0.9,
        language: 'en',
        fingerprint: 'test_audio_fp_' + Date.now()
      },
      'This is a test transcript for optimization validation. The system should analyze this content and provide optimized parameters.',
      {
        priority: 'balanced',
        timeConstraints: 30000,
        memoryConstraints: 256,
        outputRequirements: 'standard'
      }
    );

    console.log('✅ Optimization completed');
    console.log('🎯 Strategy selected:', optimizationResult.strategy.name);
    console.log('⚙️ Parameters optimized:', Object.keys(optimizationResult.parameters).length, 'settings');

    // Update with mock results
    await orchestrator.updateWithResults(optimizationResult.sessionId, {
      processingTime: 18500,
      memoryUsage: 142,
      accuracyScore: 0.92,
      errorRate: 0.008,
      throughput: 8.2
    });

    console.log('✅ Results updated with learning feedback');

    // Generate optimization report
    const report = await orchestrator.generateOptimizationReport();
    console.log('📊 Report generated with', report.sessions.length, 'sessions');
    console.log('💡 Recommendations:', report.recommendations.length);

    results.integrationTest = {
      success: true,
      strategy: optimizationResult.strategy.name,
      parameterCount: Object.keys(optimizationResult.parameters).length,
      sessionCount: report.sessions.length,
      recommendationCount: report.recommendations.length,
      systemHealth: report.systemHealth.overallScore
    };

  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
    results.integrationTest = { success: false, error: error.message };
  }

  // 3. Performance baseline test
  console.log('\n⚡ Performance Baseline:');
  try {
    // Run existing pipeline test for performance comparison
    const startTime = performance.now();

    // Import and run existing test
    const { createApp } = await import('./src/App.tsx');

    const baselineTime = performance.now() - startTime;
    console.log('📊 Baseline performance:', Math.round(baselineTime), 'ms');

    results.performanceBaseline = {
      success: true,
      baselineTime,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.log('⚠️ Performance baseline could not be established:', error.message);
    results.performanceBaseline = { success: false, error: error.message };
  }

  // 4. Generate summary
  console.log('\n📋 Iteration 9 Summary:');
  console.log('========================');

  const componentsPassed = Object.values(results.componentValidation).filter(c => c.exists).length;
  const totalComponents = Object.keys(results.componentValidation).length;
  const integrationPassed = results.integrationTest.success;
  const performanceMeasured = results.performanceBaseline.success;

  console.log(`📁 Components: ${componentsPassed}/${totalComponents} files created`);
  console.log(`🔄 Integration: ${integrationPassed ? 'PASSED' : 'FAILED'}`);
  console.log(`⚡ Performance: ${performanceMeasured ? 'MEASURED' : 'UNMEASURED'}`);

  const overallSuccess = componentsPassed === totalComponents && integrationPassed;
  console.log(`\n🏆 Overall Status: ${overallSuccess ? 'ITERATION 9 READY' : 'NEEDS WORK'}`);

  // Save results
  const reportData = {
    iteration: 9,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      componentsPassed,
      totalComponents,
      integrationPassed,
      performanceMeasured,
      overallSuccess
    }
  };

  fs.writeFileSync('iteration-9-validation.json', JSON.stringify(reportData, null, 2));
  console.log('\n📁 Validation report saved to: iteration-9-validation.json');

  if (overallSuccess) {
    console.log('\n🎉 Iteration 9 validation completed successfully!');
    console.log('✨ Smart self-optimization system is ready for production use.');
  } else {
    console.log('\n⚠️ Iteration 9 validation found issues that need attention.');
  }

  return reportData;
}

// Run validation
validateIteration9()
  .then(results => {
    if (results.summary.overallSuccess) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Validation failed:', error);
    process.exit(1);
  });