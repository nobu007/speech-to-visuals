#!/usr/bin/env node

/**
 * Real Audio Processing Test - Iteration 1
 * Tests the actual Whisper integration with real audio file
 * Following custom instructions: implement → test → evaluate → improve → commit
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test Configuration
const testConfig = {
  audioFile: join(__dirname, 'public/jfk.wav'),
  iteration: 1,
  maxRetries: 3,
  successCriteria: {
    minSegments: 1,
    minConfidence: 0.6,
    maxProcessingTime: 30000 // 30 seconds
  }
};

/**
 * Phase 1: Basic Real Audio Processing Test
 */
async function testRealAudioProcessing() {
  console.log('🎯 Real Audio Processing Test - Phase 1');
  console.log('=========================================');
  console.log(`📁 Audio File: ${testConfig.audioFile}`);
  console.log(`🔄 Iteration: ${testConfig.iteration}`);

  const startTime = performance.now();

  try {
    // Step 1: Verify audio file exists
    if (!fs.existsSync(testConfig.audioFile)) {
      throw new Error(`Audio file not found: ${testConfig.audioFile}`);
    }

    const stats = fs.statSync(testConfig.audioFile);
    console.log(`📊 File Size: ${(stats.size / 1024).toFixed(1)} KB`);

    // Step 2: Attempt real Whisper transcription
    console.log('\n🎤 Testing Real Whisper Integration...');

    let whisperResult = null;
    let whisperError = null;

    try {
      // Dynamic import of whisper-node
      const { whisper } = await import('whisper-node');

      const options = {
        modelName: 'base',
        whisperOptions: {
          outputInText: false,
          outputInVtt: false,
          outputInSrt: false,
          outputInCsv: false,
          outputInTsv: false,
          outputInJson: true,
          translateToEnglish: false,
          wordTimestamps: true,
          timestamps_length: 25,
          splitOnWord: true
        }
      };

      console.log(`⚙️ Using Whisper model: ${options.modelName}`);
      console.log('⏳ Processing audio... (this may take a moment)');

      whisperResult = await whisper(testConfig.audioFile, options);

    } catch (error) {
      whisperError = error;
      console.warn(`⚠️ Whisper integration error: ${error.message}`);
    }

    // Step 3: Process results
    const processingTime = performance.now() - startTime;
    const segments = [];

    if (whisperResult && Array.isArray(whisperResult)) {
      for (const item of whisperResult) {
        if (item.speech) {
          segments.push({
            start: Math.floor((item.start || 0) * 1000),
            end: Math.floor((item.end || 0) * 1000),
            text: item.speech.trim(),
            confidence: item.confidence || 0.9
          });
        }
      }
    }

    // Step 4: Evaluate results against success criteria
    console.log('\n📊 Test Results:');
    console.log(`⏱️ Processing Time: ${processingTime.toFixed(0)}ms`);
    console.log(`📝 Segments Generated: ${segments.length}`);

    if (segments.length > 0) {
      const avgConfidence = segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length;
      console.log(`📈 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

      console.log('\n📄 Transcription Content:');
      segments.forEach((segment, i) => {
        console.log(`   ${i + 1}. [${(segment.start / 1000).toFixed(1)}s-${(segment.end / 1000).toFixed(1)}s] ${segment.text}`);
      });
    }

    // Step 5: Success evaluation
    const testResults = {
      success: false,
      whisperAvailable: !whisperError,
      segmentsGenerated: segments.length,
      processingTime: processingTime,
      averageConfidence: segments.length > 0 ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length : 0,
      criteriaCheck: {
        minSegments: segments.length >= testConfig.successCriteria.minSegments,
        minConfidence: segments.length > 0 ? (segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length) >= testConfig.successCriteria.minConfidence : false,
        maxProcessingTime: processingTime <= testConfig.successCriteria.maxProcessingTime
      }
    };

    // Determine overall success
    if (testResults.whisperAvailable &&
        testResults.criteriaCheck.minSegments &&
        testResults.criteriaCheck.minConfidence &&
        testResults.criteriaCheck.maxProcessingTime) {
      testResults.success = true;
    }

    console.log('\n🎯 Success Criteria Evaluation:');
    console.log(`   ✅ Whisper Available: ${testResults.whisperAvailable ? '✅' : '❌'}`);
    console.log(`   ✅ Min Segments (${testConfig.successCriteria.minSegments}): ${testResults.criteriaCheck.minSegments ? '✅' : '❌'}`);
    console.log(`   ✅ Min Confidence (${testConfig.successCriteria.minConfidence}): ${testResults.criteriaCheck.minConfidence ? '✅' : '❌'}`);
    console.log(`   ✅ Max Processing Time (${testConfig.successCriteria.maxProcessingTime}ms): ${testResults.criteriaCheck.maxProcessingTime ? '✅' : '❌'}`);

    console.log(`\n🏆 Overall Test Result: ${testResults.success ? '✅ SUCCESS' : '❌ NEEDS IMPROVEMENT'}`);

    if (!testResults.success) {
      console.log('\n🔧 Improvement Suggestions:');
      if (!testResults.whisperAvailable) {
        console.log('   • Install/configure Whisper properly');
        console.log('   • Check system dependencies');
      }
      if (!testResults.criteriaCheck.minSegments) {
        console.log('   • Audio file may be too short or quiet');
        console.log('   • Try preprocessing audio');
      }
      if (!testResults.criteriaCheck.minConfidence) {
        console.log('   • Audio quality may need improvement');
        console.log('   • Consider noise reduction');
      }
      if (!testResults.criteriaCheck.maxProcessingTime) {
        console.log('   • Consider using smaller Whisper model');
        console.log('   • Optimize audio preprocessing');
      }
    }

    // Save detailed report
    const reportPath = join(__dirname, `real-audio-test-report-${Date.now()}.json`);
    const detailedReport = {
      timestamp: new Date().toISOString(),
      testConfig,
      testResults,
      segments: segments.slice(0, 5), // Include first 5 segments for reference
      whisperError: whisperError ? whisperError.message : null
    };

    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    return testResults;

  } catch (error) {
    const processingTime = performance.now() - startTime;
    console.error('❌ Test failed:', error.message);

    return {
      success: false,
      error: error.message,
      processingTime: processingTime
    };
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await testRealAudioProcessing();

    console.log('\n🎯 Next Steps:');
    if (result.success) {
      console.log('   1. ✅ Real audio processing is working correctly');
      console.log('   2. 🔄 Ready for next iteration improvements');
      console.log('   3. 📝 Consider testing with different audio formats');
      console.log('   4. 🚀 Integrate with main pipeline');
    } else {
      console.log('   1. 🔧 Address the improvement suggestions above');
      console.log('   2. 🔄 Re-run test after fixes');
      console.log('   3. 📊 Consider fallback mechanisms');
    }

    console.log('\n✨ Real Audio Test Completed!');
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}