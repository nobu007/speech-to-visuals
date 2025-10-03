#!/usr/bin/env node

/**
 * Quick test of the Audio Diagram Pipeline
 */

import { AudioDiagramPipeline } from './src/pipeline/audio-diagram-pipeline.ts';

async function testPipeline() {
  console.log('🚀 Testing Audio Diagram Pipeline');

  try {
    // Create pipeline instance
    const pipeline = new AudioDiagramPipeline({
      audio: {
        whisperModel: 'base',
        combineMs: 200,
        retryCount: 3,
        languageDetection: true
      },
      output: {
        width: 1280,
        height: 720,
        fps: 30,
        format: 'mp4'
      }
    });

    console.log('✅ Pipeline created successfully');

    // Test with mock audio file
    const mockAudioPath = './mock-jfk.wav';
    console.log(`📁 Testing with: ${mockAudioPath}`);

    const result = await pipeline.execute(mockAudioPath);

    if (result.success) {
      console.log('🎉 Pipeline execution successful!');
      console.log('📊 Results:');
      console.log(`- Total Duration: ${result.totalDuration.toFixed(0)}ms`);
      console.log(`- Scenes: ${result.phases.analysis.scenes.length}`);
      console.log(`- Diagram Types: ${result.phases.analysis.diagramTypes.length}`);
      console.log(`- Relationships: ${result.phases.analysis.relationships.length}`);
      console.log(`- Layouts: ${result.phases.visualization.layouts.length}`);
      console.log(`- Video Output: ${result.output.outputPath}`);

      return result;
    } else {
      console.error('❌ Pipeline execution failed:', result.error);
      return null;
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    return null;
  }
}

// Execute test
testPipeline()
  .then(result => {
    if (result) {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n❌ Tests failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });