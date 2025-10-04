/**
 * Test script for the Audio-to-Diagram Pipeline
 * Following the recursive development approach from custom instructions
 */

import { AudioDiagramPipeline } from './src/pipeline/audio-diagram-pipeline';
import * as fs from 'fs';

async function testPipeline(): Promise<boolean> {
  console.log('🚀 Testing Audio-to-Diagram Pipeline');
  console.log('=' .repeat(50));

  try {
    console.log('📦 Initializing AudioDiagramPipeline...');

    // Initialize pipeline with default config
    const pipeline = new AudioDiagramPipeline({
      audio: {
        whisperModel: 'base',
        combineMs: 200,
        retryCount: 3,
        languageDetection: true
      },
      diagram: {
        layoutAlgorithm: 'dagre',
        maxNodes: 15,
        labelStrategy: 'ai-enhanced',
        animationDuration: 2000
      },
      output: {
        width: 1920,
        height: 1080,
        fps: 30,
        format: 'mp4'
      }
    });

    console.log('✅ Pipeline initialized successfully');

    // Test with a simulated audio file path
    const mockAudioPath = '/tmp/test-system-overview.wav';
    console.log(`📁 Testing with mock audio: ${mockAudioPath}`);

    // Execute the full pipeline
    console.log('🔄 Executing pipeline...');
    const result = await pipeline.execute(mockAudioPath);

    if (result.success) {
      console.log('\n✅ Pipeline Test SUCCESSFUL!');
      console.log('📊 Results Summary:');
      console.log(`   • Total Duration: ${result.totalDuration.toFixed(0)}ms`);
      console.log(`   • Transcription: ${result.phases.transcription.metrics.captionCount} captions`);
      console.log(`   • Analysis: ${result.phases.analysis.metrics.sceneCount} scenes`);
      console.log(`   • Visualization: ${result.phases.visualization.metrics.layoutCount} layouts`);
      console.log(`   • Video Output: ${result.output.outputPath}`);

      // Print detailed scene analysis
      console.log('\n📋 Scene Analysis:');
      result.phases.analysis.scenes.forEach((scene: any, index: number) => {
        console.log(`   Scene ${index + 1}: ${scene.type} (${scene.duration}ms) - "${scene.text.substring(0, 50)}..."`);
      });

      // Print diagram types detected
      console.log('\n🎯 Diagram Types Detected:');
      result.phases.analysis.diagramTypes.forEach((diagramType: any, index: number) => {
        console.log(`   Scene ${diagramType.sceneId}: ${diagramType.diagramType} (confidence: ${(diagramType.confidence * 100).toFixed(1)}%)`);
      });

      // Save detailed results
      const reportPath = `pipeline-test-report-${Date.now()}.json`;
      await fs.promises.writeFile(reportPath, JSON.stringify(result, null, 2));
      console.log(`\n📋 Detailed report saved to: ${reportPath}`);

      return true;
    } else {
      console.log('\n❌ Pipeline Test FAILED');
      console.error('Error:', result.error);
      console.error('Framework Report:', result.framework);
      return false;
    }

  } catch (error: any) {
    console.error('\n💥 Pipeline Test CRASHED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testPipeline().then(success => {
  console.log('\n' + '='.repeat(50));
  console.log(success ? '🎉 Test completed successfully!' : '🔥 Test failed - needs debugging');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});