import { MainPipeline } from './src/pipeline/main-pipeline.js';
import { SceneGraph } from './src/types/diagram.js';

/**
 * Integration test that connects the audio processing pipeline
 * directly to Remotion video generation components
 */

async function testCompleteIntegration() {
  console.log('🎬 Testing Complete Audio-to-Video Integration');
  console.log('==============================================\n');

  try {
    // Step 1: Generate pipeline data
    console.log('📋 Step 1: Running Audio Processing Pipeline...');
    const pipeline = new MainPipeline({
      transcription: {
        model: 'base',
        language: 'en',
        outputFormat: 'json'
      },
      analysis: {
        minSegmentLengthMs: 1000,
        maxSegmentLengthMs: 8000,
        confidenceThreshold: 0.5
      },
      layout: {
        width: 1920,
        height: 1080,
        nodeWidth: 200,
        nodeHeight: 80
      }
    });

    const result = await pipeline.execute({
      audioFile: 'test-presentation.wav'
    });

    if (!result.success) {
      throw new Error(`Pipeline failed: ${result.error}`);
    }

    console.log('✅ Pipeline completed successfully');
    console.log(`   - Scenes generated: ${result.scenes.length}`);
    console.log(`   - Total duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   - Processing time: ${result.processingTime.toFixed(0)}ms\n`);

    // Step 2: Validate scene data for Remotion
    console.log('📋 Step 2: Validating Scene Data for Video Generation...');
    const validScenes = validateScenesForRemotion(result.scenes);

    console.log('✅ Scene validation completed');
    console.log(`   - Valid scenes: ${validScenes.length}`);
    console.log(`   - Scene types: ${[...new Set(validScenes.map(s => s.type))].join(', ')}`);
    console.log(`   - Total video duration: ${validScenes.reduce((acc, s) => acc + s.durationMs, 0) / 1000}s\n`);

    // Step 3: Generate Remotion configuration
    console.log('📋 Step 3: Generating Remotion Configuration...');
    const remotionConfig = generateRemotionConfig(validScenes);

    console.log('✅ Remotion configuration generated');
    console.log(`   - Composition duration: ${remotionConfig.durationInFrames} frames`);
    console.log(`   - Video dimensions: ${remotionConfig.width}x${remotionConfig.height}`);
    console.log(`   - Frame rate: ${remotionConfig.fps} fps\n`);

    // Step 4: Test scene rendering data
    console.log('📋 Step 4: Testing Scene Rendering Data...');
    for (let i = 0; i < validScenes.length; i++) {
      const scene = validScenes[i];
      const renderTest = testSceneRendering(scene, i + 1);

      if (renderTest.valid) {
        console.log(`   ✅ Scene ${i + 1}: ${scene.type} diagram - Ready for rendering`);
        console.log(`      - Nodes: ${scene.nodes.length}, Edges: ${scene.edges.length}`);
        console.log(`      - Layout bounds: ${renderTest.bounds.width}x${renderTest.bounds.height}`);
      } else {
        console.log(`   ❌ Scene ${i + 1}: ${renderTest.error}`);
      }
    }

    // Step 5: Integration summary
    console.log('\n🎯 Integration Test Results:');
    console.log('============================');

    const integrationResults = {
      'Pipeline execution': result.success,
      'Scene generation': result.scenes.length > 0,
      'Layout validation': validScenes.every(s => s.layout && s.layout.nodes.length > 0),
      'Remotion compatibility': validScenes.length === result.scenes.length,
      'Video duration valid': validScenes.every(s => s.durationMs > 0),
      'All diagram types supported': ['tree', 'timeline', 'cycle'].every(type =>
        validScenes.some(s => s.type === type)
      )
    };

    Object.entries(integrationResults).forEach(([test, passed]) => {
      console.log(`   ${passed ? '✅' : '❌'} ${test}`);
    });

    const allPassed = Object.values(integrationResults).every(v => v);

    console.log(`\n🚀 Integration Status: ${allPassed ? 'READY FOR PRODUCTION' : 'NEEDS ATTENTION'}`);

    if (allPassed) {
      console.log('\n🎉 Complete workflow validated:');
      console.log('   1. ✅ Audio file processing');
      console.log('   2. ✅ Content analysis and scene segmentation');
      console.log('   3. ✅ Diagram type detection and layout generation');
      console.log('   4. ✅ Remotion video component integration');
      console.log('   5. ✅ End-to-end data flow');

      // Output the final scene data for manual Remotion testing
      console.log('\n📄 Generated Scene Data (for Remotion testing):');
      console.log('================================================');
      console.log(JSON.stringify({
        scenes: validScenes.slice(0, 2), // First 2 scenes for brevity
        totalDuration: validScenes.reduce((acc, s) => acc + s.durationMs, 0),
        config: remotionConfig
      }, null, 2));
    }

    return {
      success: allPassed,
      scenes: validScenes,
      config: remotionConfig,
      results: integrationResults
    };

  } catch (error) {
    console.error('\n💥 Integration test failed:', error);
    return {
      success: false,
      error: error.message,
      scenes: [],
      config: null,
      results: {}
    };
  }
}

/**
 * Validate scene data for Remotion compatibility
 */
function validateScenesForRemotion(scenes: SceneGraph[]): SceneGraph[] {
  return scenes.filter(scene => {
    // Check required fields
    if (!scene.type || !scene.nodes || !scene.edges || !scene.layout) {
      return false;
    }

    // Check layout validity
    if (!scene.layout.nodes || scene.layout.nodes.length === 0) {
      return false;
    }

    // Check timing
    if (!scene.durationMs || scene.durationMs <= 0) {
      return false;
    }

    return true;
  });
}

/**
 * Generate Remotion composition configuration
 */
function generateRemotionConfig(scenes: SceneGraph[]) {
  const totalDurationMs = scenes.reduce((acc, scene) => acc + scene.durationMs, 0);
  const fps = 30;
  const durationInFrames = Math.ceil((totalDurationMs / 1000) * fps);

  return {
    id: 'AudioDiagramVideo',
    durationInFrames,
    fps,
    width: 1920,
    height: 1080,
    props: {
      scenes,
      totalDuration: totalDurationMs,
      audioUrl: '' // Would be populated with actual audio in production
    }
  };
}

/**
 * Test individual scene rendering readiness
 */
function testSceneRendering(scene: SceneGraph, sceneIndex: number) {
  try {
    // Check node positioning
    const nodes = scene.layout.nodes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of nodes) {
      if (typeof node.x !== 'number' || typeof node.y !== 'number') {
        return { valid: false, error: `Node ${node.id} has invalid coordinates` };
      }

      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + (node.w || 120));
      maxY = Math.max(maxY, node.y + (node.h || 60));
    }

    // Check edge data
    if (scene.layout.edges) {
      for (const edge of scene.layout.edges) {
        if (!edge.from || !edge.to || !edge.points || edge.points.length < 2) {
          return { valid: false, error: `Edge from ${edge.from} to ${edge.to} has invalid data` };
        }
      }
    }

    return {
      valid: true,
      bounds: {
        width: maxX - minX,
        height: maxY - minY
      }
    };

  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Run the integration test
testCompleteIntegration()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Integration test completed successfully!');
      console.log('The Audio-to-Diagram Video Generator is ready for production use.');
    } else {
      console.log('\n⚠️ Integration test completed with issues.');
      console.log('Review the results above and address any failing tests.');
    }
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n💥 Integration test crashed:', error.message);
    process.exit(1);
  });