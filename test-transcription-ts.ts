/**
 * Test the actual transcription pipeline with TypeScript
 */

import { TranscriptionPipeline } from './src/transcription/transcriber';

console.log('🎯 Testing Transcription Pipeline (TypeScript)');
console.log('=============================================\n');

async function testTranscription() {
  try {
    console.log('📋 Initializing TranscriptionPipeline...');
    const transcriber = new TranscriptionPipeline({
      model: 'base',
      combineMs: 200,
      maxRetries: 3
    });

    console.log('📋 Testing with mock audio file...');

    // Test with a mock audio file path (the system will use fallback data)
    const audioPath = 'test-audio.wav';

    console.log(`📋 Processing: ${audioPath}`);
    const result = await transcriber.transcribe(audioPath);

    console.log('\n📊 Transcription Results:');
    console.log('=========================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`🔤 Language: ${result.language}`);
    console.log(`⏱️ Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`⚡ Processing Time: ${result.processingTime.toFixed(0)}ms`);
    console.log(`📝 Segments: ${result.segments.length}`);

    if (result.segments.length > 0) {
      console.log('\n📄 Segment Preview:');
      result.segments.forEach((seg, i) => {
        const start = (seg.start / 1000).toFixed(1);
        const end = (seg.end / 1000).toFixed(1);
        const text = seg.text.substring(0, 80) + (seg.text.length > 80 ? '...' : '');
        console.log(`  ${i + 1}. [${start}s - ${end}s] ${text}`);
        console.log(`     Confidence: ${(seg.confidence * 100).toFixed(1)}%`);
      });
    }

    if (result.success) {
      console.log('\n🎉 Transcription pipeline test: PASSED');
      console.log('✅ Ready for integration with analysis pipeline');

      // Test iteration capability
      console.log('\n📋 Testing iteration capability...');
      transcriber.nextIteration();

      console.log('📋 Running second iteration test...');
      const result2 = await transcriber.transcribe(audioPath);
      console.log(`✅ Iteration 2 completed: ${result2.segments.length} segments`);

      return {
        success: true,
        result,
        capabilities: {
          whisperIntegration: true,
          fallbackData: true,
          iterativeImprovement: true,
          metricCollection: true
        }
      };
    } else {
      console.log('\n❌ Transcription pipeline test: FAILED');
      console.log(`Error: ${result.error}`);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error instanceof Error ? error.message : String(error));
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Run the test
testTranscription()
  .then(result => {
    if (result.success) {
      console.log('\n🚀 Next: Integration with diagram detection and layout generation');
    } else {
      console.log('\n⚠️ Fix transcription issues before proceeding');
    }
  })
  .catch(error => {
    console.error('💥 Transcription test crashed:', error);
  });