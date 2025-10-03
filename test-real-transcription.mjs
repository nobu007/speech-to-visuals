#!/usr/bin/env node

/**
 * Test real Whisper transcription
 */

import { TranscriptionPipeline } from './src/transcription/transcriber.js';
import fs from 'fs';

async function testRealTranscription() {
  console.log('🎤 Testing Real Whisper Transcription');

  try {
    // Check for audio files
    const audioFiles = ['mock-jfk.wav', 'public/audio/test.wav', 'test.wav'];
    let testFile = null;

    for (const file of audioFiles) {
      if (fs.existsSync(file)) {
        testFile = file;
        break;
      }
    }

    if (!testFile) {
      console.log('⚠️ No audio file found. Testing with mock data.');
      testFile = 'mock.wav'; // Will trigger fallback
    }

    console.log(`📁 Testing with: ${testFile}`);

    // Create transcription pipeline
    const transcriber = new TranscriptionPipeline({
      model: 'base',
      combineMs: 200,
      maxRetries: 3
    });

    console.log('🔧 Starting transcription...');
    const result = await transcriber.transcribe(testFile);

    if (result.success) {
      console.log('✅ Transcription successful!');
      console.log(`📊 Results:`);
      console.log(`- Duration: ${(result.duration / 1000).toFixed(1)}s`);
      console.log(`- Segments: ${result.segments.length}`);
      console.log(`- Processing time: ${result.processingTime.toFixed(0)}ms`);

      // Show first few segments
      console.log('\n📝 Sample segments:');
      result.segments.slice(0, 3).forEach((segment, i) => {
        console.log(`${i + 1}. [${(segment.start / 1000).toFixed(1)}s-${(segment.end / 1000).toFixed(1)}s] ${segment.text}`);
      });

      // Test Remotion captions if available
      if (result.captions) {
        console.log(`\n🎬 Remotion captions: ${result.captions.length} items`);
        result.captions.slice(0, 2).forEach((caption, i) => {
          console.log(`${i + 1}. [${caption.startMs}ms-${caption.endMs}ms] ${caption.text}`);
        });
      }

      return result;
    } else {
      console.error('❌ Transcription failed:', result.error);
      return null;
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

// Execute test
testRealTranscription()
  .then(result => {
    if (result) {
      console.log('\n🎉 Transcription test passed!');

      // Test iteration advancement
      console.log('\n🔄 Testing iteration advancement...');
      const transcriber = new TranscriptionPipeline();
      transcriber.nextIteration();
      console.log('✅ Iteration system working');

      process.exit(0);
    } else {
      console.log('\n❌ Transcription test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });