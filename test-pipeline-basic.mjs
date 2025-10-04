#!/usr/bin/env node

/**
 * Basic pipeline test script
 * Tests core functionality following custom instructions
 */

import { simplePipeline } from './src/pipeline/simple-pipeline.js';

console.log('🚀 Starting basic pipeline test...');
console.log('📋 This test follows the Custom Instructions for Audio-to-Visual Generation System');

async function testBasicPipeline() {
  try {
    console.log('\n📊 Testing pipeline capabilities...');

    // Test 1: Check pipeline capabilities
    const capabilities = simplePipeline.getCapabilities();
    console.log('✅ Pipeline capabilities:', JSON.stringify(capabilities, null, 2));

    // Test 2: Check progressive enhancement metrics
    const metrics = simplePipeline.getProgressiveMetrics();
    console.log('✅ Progressive enhancement metrics:', JSON.stringify(metrics, null, 2));

    // Test 3: Simulate a basic process with mock data
    console.log('\n🎯 Simulating processing with mock audio file...');

    // Create a mock audio file
    const mockAudioData = new Uint8Array(1024); // 1KB of mock audio data
    const mockFile = new File([mockAudioData], 'test-audio.wav', { type: 'audio/wav' });

    const result = await simplePipeline.process({
      audioFile: mockFile,
      options: {
        includeVideoGeneration: false // Skip video for quick test
      }
    }, (step, progress) => {
      console.log(`📈 Progress: ${step} (${progress}%)`);
    });

    console.log('\n✅ Pipeline test completed!');
    console.log('📋 Result summary:', {
      success: result.success,
      transcriptLength: result.transcript?.length || 0,
      sceneCount: result.scenes?.length || 0,
      processingTime: result.processingTime ? `${Math.round(result.processingTime / 1000)}s` : 'N/A',
      error: result.error || null
    });

    // Test 4: Verify custom instructions compliance
    console.log('\n🎯 Custom Instructions Compliance Check:');
    console.log(`- MVP基盤構築: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- 音声処理パイプライン: ${result.transcript ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- 内容分析エンジン: ${result.scenes && result.scenes.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`- 段階的改善追跡: ${metrics.iterationCount > 0 ? '✅ PASS' : '❌ FAIL'}`);

    return result.success;

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testBasicPipeline()
  .then(success => {
    if (success) {
      console.log('\n🎉 Basic pipeline test PASSED');
      console.log('✅ System is ready for advanced features implementation');
      process.exit(0);
    } else {
      console.log('\n❌ Basic pipeline test FAILED');
      console.log('🔧 System needs fixes before proceeding');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });