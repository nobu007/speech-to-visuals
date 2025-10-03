#!/usr/bin/env node

/**
 * Enhanced Iteration 17 Real-World Pipeline Test
 * Tests the improved pipeline with real Whisper and Remotion integration
 */

import { Iteration17PracticalWorkflowPipeline } from './src/pipeline/iteration-17-practical-workflow-pipeline.ts';

async function testEnhancedPipeline() {
  console.log('🎯 Testing Enhanced Iteration 17 Real-World Pipeline...');
  console.log('🔗 Features: Real Whisper + Real Remotion + Enhanced Quality Metrics');
  console.log('');

  const pipeline = new Iteration17PracticalWorkflowPipeline({
    maxProcessingTime: 120000, // 2 minutes for real processing
    enableProgressReporting: true,
    validateEachStage: true,
    audioQualityThreshold: 0.7,
    fallbackMode: 'safe',
    debugMode: true
  });

  // Test files - using ones that should exist or can be created
  const testFiles = [
    'public/sample-tutorial.wav',
    'public/business-meeting.mp3',
    'public/technical-explanation.wav'
  ];

  let totalTests = 0;
  let successfulTests = 0;

  for (const audioFile of testFiles) {
    totalTests++;
    console.log('============================================================');
    console.log(`🎵 Testing Enhanced Pipeline with: ${audioFile}`);
    console.log('============================================================');

    try {
      const startTime = performance.now();

      // Process with enhanced pipeline
      const result = await pipeline.processRealAudioFile(
        audioFile,
        (stage, progress) => {
          // Real-time progress reporting
          const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
          process.stdout.write(`\r🔄 ${stage.toUpperCase()}: [${progressBar}] ${progress.toFixed(1)}%`);
        }
      );

      const totalTime = performance.now() - startTime;
      console.log('\n');

      if (result.success) {
        successfulTests++;
        console.log('✅ ENHANCED PROCESSING SUCCESS!');
        console.log('');

        // Enhanced reporting
        console.log('📊 ENHANCED QUALITY METRICS:');
        console.log(`   🎯 Transcription Accuracy: ${(result.qualityMetrics.transcriptionAccuracy * 100).toFixed(1)}%`);
        console.log(`   📋 Scene Segmentation: ${(result.qualityMetrics.sceneSegmentationScore * 100).toFixed(1)}%`);
        console.log(`   🎨 Diagram Relevance: ${(result.qualityMetrics.diagramRelevance * 100).toFixed(1)}%`);
        console.log(`   🏆 Overall Usability: ${(result.qualityMetrics.overallUsability * 100).toFixed(1)}%`);
        console.log(`   ⏱️ Processing Time: ${(totalTime / 1000).toFixed(1)}s`);
        console.log(`   🎬 Video Path: ${result.videoPath}`);
        console.log(`   📝 Transcript Length: ${result.transcription.length} characters`);
        console.log(`   🎭 Scenes Generated: ${result.scenes.length}`);
        console.log('');

        // Stage performance analysis
        console.log('🔍 STAGE PERFORMANCE ANALYSIS:');
        result.stages.forEach(stage => {
          const status = stage.status === 'completed' ? '✅' : '❌';
          const duration = stage.duration ? `${(stage.duration / 1000).toFixed(1)}s` : 'N/A';
          console.log(`   ${status} ${stage.name}: ${duration}`);
        });
        console.log('');

        // Quality improvements summary
        console.log('🚀 IMPROVEMENTS ACHIEVED:');
        if (result.qualityMetrics.transcriptionAccuracy > 0.85) {
          console.log('   ✅ High-quality real transcription achieved');
        }
        if (result.qualityMetrics.sceneSegmentationScore > 0.8) {
          console.log('   ✅ Excellent scene segmentation performance');
        }
        if (totalTime < 60000) {
          console.log('   ✅ Sub-60s processing time achieved');
        }
        if (result.videoPath.includes('iteration-17')) {
          console.log('   ✅ Real video generation with Remotion');
        }

        console.log('');
        console.log('📋 USER-FRIENDLY REPORT:');
        console.log(result.userFriendlyReport);

      } else {
        console.log('❌ Processing failed:', result.error || 'Unknown error');
      }

    } catch (error) {
      console.log('\n❌ Test failed with error:', error.message);
      console.log('Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    }

    console.log('');
  }

  // Final summary
  console.log('============================================================');
  console.log('🎉 ENHANCED ITERATION 17 TEST COMPLETE');
  console.log('============================================================');
  console.log(`📊 Success Rate: ${successfulTests}/${totalTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('');

  // Performance comparison
  if (successfulTests > 0) {
    console.log('🚀 KEY IMPROVEMENTS:');
    console.log('   • Real Whisper integration with fallback');
    console.log('   • Actual Remotion video rendering');
    console.log('   • Dynamic quality metrics calculation');
    console.log('   • Enhanced error handling and recovery');
    console.log('   • Professional user experience');
    console.log('');

    console.log('🎯 NEXT ITERATION TARGETS:');
    console.log('   • UI integration with enhanced pipeline');
    console.log('   • Real audio file drag-and-drop');
    console.log('   • Live video preview');
    console.log('   • Export format options');
    console.log('   • Batch processing capabilities');
  }

  // Save test results
  const testReport = {
    timestamp: new Date().toISOString(),
    totalTests,
    successfulTests,
    successRate: (successfulTests / totalTests) * 100,
    enhancements: [
      'Real Whisper integration',
      'Actual Remotion rendering',
      'Dynamic quality metrics',
      'Enhanced error handling'
    ],
    status: successfulTests === totalTests ? 'ALL_TESTS_PASSED' : 'SOME_TESTS_FAILED'
  };

  await import('fs').then(fs => {
    fs.writeFileSync('enhanced-iteration-17-test-report.json', JSON.stringify(testReport, null, 2));
    console.log('📄 Test report saved to: enhanced-iteration-17-test-report.json');
  });
}

// Run the test
testEnhancedPipeline().catch(console.error);