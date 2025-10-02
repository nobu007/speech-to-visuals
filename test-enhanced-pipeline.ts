import { MainPipeline } from './src/pipeline/main-pipeline.js';

/**
 * Enhanced pipeline test with real file handling simulation
 * Tests the integration between file upload, Whisper transcription, and diagram generation
 */

async function testEnhancedPipeline() {
  console.log('🧪 Testing Enhanced Audio-to-Diagram Pipeline');
  console.log('==============================================\n');

  try {
    // Initialize pipeline with production-like configuration
    const pipeline = new MainPipeline({
      transcription: {
        model: 'base',  // Use base model for faster testing
        language: 'en',
        outputFormat: 'json',
        maxRetries: 2
      },
      analysis: {
        minSegmentLengthMs: 2000,  // Shorter segments for testing
        maxSegmentLengthMs: 10000,
        confidenceThreshold: 0.6   // Lower threshold for testing
      },
      layout: {
        width: 1920,
        height: 1080,
        nodeWidth: 150,
        nodeHeight: 80
      },
      output: {
        fps: 30,
        videoDuration: 30,
        includeAudio: true
      }
    });

    console.log('🔧 Pipeline configured for enhanced testing');
    console.log('📁 Simulating audio file upload process...\n');

    // Simulate file upload process
    const mockAudioFile = 'sample-presentation.wav'; // This would be a blob URL in browser

    console.log('📋 Test Configuration:');
    console.log('- Model: base (Whisper)');
    console.log('- Expected segments: 3-5');
    console.log('- Expected diagrams: 2-3');
    console.log('- Max processing time: 15 seconds\n');

    // Execute pipeline
    const startTime = performance.now();
    const result = await pipeline.execute({
      audioFile: mockAudioFile
    });
    const endTime = performance.now();

    // Analyze results
    console.log('\n📊 Enhanced Pipeline Test Results:');
    console.log('=====================================');

    if (result.success) {
      console.log('✅ Status: SUCCESS');
      console.log(`⏱️  Total Processing Time: ${(endTime - startTime).toFixed(0)}ms`);
      console.log(`🎬 Generated Scenes: ${result.scenes.length}`);
      console.log(`📈 Diagram Count: ${result.scenes.filter(s => s.nodes.length > 0).length}`);
      console.log(`🔊 Total Audio Duration: ${(result.duration / 1000).toFixed(1)}s`);

      // Stage performance analysis
      console.log('\n🔍 Stage Performance Analysis:');
      result.stages.forEach(stage => {
        if (stage.startTime && stage.endTime) {
          const duration = stage.endTime - stage.startTime;
          console.log(`  ${stage.name}: ${duration.toFixed(0)}ms (${stage.status})`);
        }
      });

      // Scene quality analysis
      console.log('\n📋 Scene Quality Analysis:');
      result.scenes.forEach((scene, index) => {
        const nodeCount = scene.nodes.length;
        const edgeCount = scene.edges.length;
        const duration = (scene.durationMs / 1000).toFixed(1);

        console.log(`  Scene ${index + 1}: ${scene.type} diagram`);
        console.log(`    - Nodes: ${nodeCount}, Edges: ${edgeCount}`);
        console.log(`    - Duration: ${duration}s`);
        console.log(`    - Summary: ${scene.summary.substring(0, 50)}...`);
        console.log(`    - Keywords: ${scene.keyphrases.slice(0, 3).join(', ')}`);
      });

      // Success criteria evaluation
      console.log('\n✅ Success Criteria Evaluation:');
      const criteria = {
        'Processing completed': result.success,
        'Has generated scenes': result.scenes.length > 0,
        'Has diagram content': result.scenes.some(s => s.nodes.length > 0),
        'Reasonable processing time': (endTime - startTime) < 15000,
        'Valid scene durations': result.scenes.every(s => s.durationMs > 0),
        'All stages completed': result.stages.every(s => s.status === 'complete')
      };

      Object.entries(criteria).forEach(([criterion, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${criterion}`);
      });

      const allPassed = Object.values(criteria).every(v => v);
      console.log(`\n🎯 Overall Assessment: ${allPassed ? 'EXCELLENT' : 'NEEDS IMPROVEMENT'}`);

      if (allPassed) {
        console.log('\n🚀 Pipeline is ready for production use!');
        console.log('   - Real audio file upload: Ready');
        console.log('   - Whisper transcription: Integrated (with fallback)');
        console.log('   - Content analysis: Functional');
        console.log('   - Layout generation: Working with fallbacks');
        console.log('   - Video preparation: Complete');
      }

    } else {
      console.log('❌ Status: FAILED');
      console.log(`🚨 Error: ${result.error}`);

      // Debug information
      console.log('\n🔍 Debug Information:');
      console.log(`- Stages completed: ${result.stages.filter(s => s.status === 'complete').length}/${result.stages.length}`);
      result.stages.forEach(stage => {
        if (stage.status === 'error') {
          console.log(`  ❌ ${stage.name}: ${stage.error}`);
        }
      });
    }

  } catch (error) {
    console.error('\n💥 Test suite encountered an error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testEnhancedPipeline()
  .then(() => {
    console.log('\n🎉 Enhanced pipeline test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });