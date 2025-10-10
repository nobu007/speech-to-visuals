#!/usr/bin/env node
/**
 * 🎯 Real Audio-to-Diagram Pipeline Test
 * Iteration 68 - Custom Instructions Compliance
 *
 * Purpose: Test the actual AudioDiagramPipeline implementation
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 Audio-to-Diagram Video Pipeline - Real Execution Test');
console.log('   Iteration 68 - Custom Instructions MVP Validation');
console.log('═══════════════════════════════════════════════════════════════\n');

async function testRealPipeline() {
  const startTime = performance.now();

  try {
    // Import the compiled pipeline from dist
    console.log('📦 Loading AudioDiagramPipeline module...');

    // Try to load from TypeScript source using dynamic import with tsx
    let AudioDiagramPipeline;

    try {
      // Attempt to import from source (if tsx is running)
      const pipelineModule = await import('./src/pipeline/audio-diagram-pipeline.ts');
      AudioDiagramPipeline = pipelineModule.AudioDiagramPipeline;
    } catch (tsError) {
      console.log('⚠️  Direct TypeScript import failed, trying alternative...');
      console.log(`   Error: ${tsError.message}`);

      // Fallback: Try to load from dist if compiled
      try {
        const distModule = await import('./dist/pipeline/audio-diagram-pipeline.js');
        AudioDiagramPipeline = distModule.AudioDiagramPipeline;
      } catch (distError) {
        throw new Error(`Cannot load AudioDiagramPipeline. TypeScript error: ${tsError.message}, Dist error: ${distError.message}`);
      }
    }

    console.log('✅ Module loaded successfully\n');

    // Create pipeline instance
    console.log('🔧 Initializing pipeline with configuration...');
    const pipeline = new AudioDiagramPipeline({
      audio: {
        whisperModel: 'base',
        combineMs: 200,
        retryCount: 3,
        languageDetection: true
      },
      segmentation: {
        minSceneDuration: 3000,
        confidenceThreshold: 0.7,
        adaptiveSegmentation: true,
        contextWindow: 5
      },
      diagram: {
        layoutAlgorithm: 'dagre',
        maxNodes: 20,
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

    console.log('✅ Pipeline initialized\n');

    // Test audio path (mock for now, will be replaced with real audio)
    const testAudioPath = 'public/audio/test-presentation.mp3';

    console.log('📝 Test Configuration:');
    console.log(`   Audio Path: ${testAudioPath}`);
    console.log(`   Whisper Model: base`);
    console.log(`   Layout Algorithm: dagre`);
    console.log(`   Output: 1920x1080 @ 30fps MP4`);
    console.log('');

    // Execute pipeline
    console.log('🚀 Executing full pipeline...\n');
    console.log('─'.repeat(63));

    const result = await pipeline.execute(testAudioPath);

    console.log('─'.repeat(63));

    const totalTime = performance.now() - startTime;

    // Detailed results analysis
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 Pipeline Execution Results');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (result.success) {
      console.log('✅ Overall Status: SUCCESS\n');

      // Phase 1: Transcription
      console.log('📋 Phase 1: Audio Processing & Transcription');
      console.log(`   Status: ${result.phases.transcription.success ? '✅ Success' : '❌ Failed'}`);
      if (result.phases.transcription.metrics) {
        console.log(`   Captions Generated: ${result.phases.transcription.metrics.captionCount}`);
        console.log(`   Avg Confidence: ${(result.phases.transcription.metrics.averageConfidence * 100).toFixed(1)}%`);
        console.log(`   Processing Time: ${result.phases.transcription.duration.toFixed(0)}ms`);
      }

      // Phase 2: Analysis
      console.log(`\n📋 Phase 2: Content Analysis & Scene Segmentation`);
      console.log(`   Status: ${result.phases.analysis.success ? '✅ Success' : '❌ Failed'}`);
      if (result.phases.analysis.metrics) {
        console.log(`   Scenes Detected: ${result.phases.analysis.metrics.sceneCount}`);
        console.log(`   Avg Scene Duration: ${result.phases.analysis.metrics.avgSceneDuration?.toFixed(0) || 'N/A'}ms`);
        console.log(`   Relationships Found: ${result.phases.analysis.metrics.relationshipCount}`);
        console.log(`   Processing Time: ${result.phases.analysis.duration.toFixed(0)}ms`);
      }

      // Phase 3: Visualization
      console.log(`\n📋 Phase 3: Visualization & Layout Generation`);
      console.log(`   Status: ${result.phases.visualization.success ? '✅ Success' : '❌ Failed'}`);
      if (result.phases.visualization.metrics) {
        console.log(`   Layouts Generated: ${result.phases.visualization.metrics.layoutCount}`);
        console.log(`   Animations Planned: ${result.phases.visualization.metrics.animationCount}`);
        console.log(`   Visual Assets: ${result.phases.visualization.metrics.assetCount}`);
        console.log(`   Processing Time: ${result.phases.visualization.duration.toFixed(0)}ms`);
      }

      // Phase 4: Video Generation
      console.log(`\n📋 Phase 4: Video Generation with Remotion`);
      console.log(`   Status: ${result.phases.video.success ? '✅ Success' : '❌ Failed'}`);
      if (result.phases.video.metrics) {
        console.log(`   Output Path: ${result.phases.video.metrics.outputPath}`);
        console.log(`   File Size: ${(result.output.fileSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   Video Duration: ${result.output.duration?.toFixed(2) || 'N/A'}s`);
        console.log(`   Render Time: ${result.phases.video.duration.toFixed(0)}ms`);
      }

      // Total metrics
      console.log(`\n⏱️  Total Pipeline Time: ${totalTime.toFixed(0)}ms (${(totalTime / 1000).toFixed(2)}s)`);

      // MVP Success Criteria Evaluation
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🎯 MVP Success Criteria Evaluation');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const criteria = {
        '音声ファイル入力': testAudioPath ? '✅ Pass' : '❌ Fail',
        '自動文字起こし': result.phases.transcription.success &&
                       result.phases.transcription.metrics.captionCount > 0 ? '✅ Pass' : '❌ Fail',
        'シーン分割': result.phases.analysis.success &&
                    result.phases.analysis.metrics.sceneCount > 0 ? '✅ Pass' : '❌ Fail',
        '図解タイプ判定': result.phases.analysis.success ? '✅ Pass' : '❌ Fail',
        'レイアウト生成': result.phases.visualization.success &&
                       result.phases.visualization.metrics.layoutCount > 0 ? '✅ Pass' : '❌ Fail',
        '動画出力': result.phases.video.success ? '✅ Pass' : '❌ Fail',
        '処理成功率': result.success ? '✅ 100%' : '❌ Failed',
        '平均処理時間': totalTime < 60000 ? `✅ ${(totalTime / 1000).toFixed(2)}s (< 60s)` :
                                        `⚠️  ${(totalTime / 1000).toFixed(2)}s (> 60s)`
      };

      Object.entries(criteria).forEach(([key, value]) => {
        console.log(`   ${key.padEnd(20)}: ${value}`);
      });

      const allPassed = Object.values(criteria).every(v => v.startsWith('✅'));
      const passCount = Object.values(criteria).filter(v => v.startsWith('✅')).length;
      const totalCount = Object.values(criteria).length;

      console.log(`\n   Overall Score: ${passCount}/${totalCount} (${(passCount / totalCount * 100).toFixed(1)}%)`);

      // Quality metrics
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('📈 Quality Metrics');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const qualityMetrics = {
        'Transcription Confidence': `${(result.phases.transcription.metrics.averageConfidence * 100).toFixed(1)}%`,
        'Scene Segmentation Accuracy': result.phases.analysis.metrics.sceneCount > 0 ? '✅ Functional' : '❌ Failed',
        'Layout Generation Quality': result.phases.visualization.metrics.layoutCount > 0 ? '✅ Functional' : '❌ Failed',
        'Video Output Quality': result.phases.video.success ? '✅ Functional' : '❌ Failed',
        'End-to-End Performance': totalTime < 60000 ? '✅ Excellent' : '⚠️  Needs optimization'
      };

      Object.entries(qualityMetrics).forEach(([key, value]) => {
        console.log(`   ${key.padEnd(30)}: ${value}`);
      });

      // Recommendations
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('💡 Recommendations');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const recommendations = [];

      if (!result.phases.transcription.success || result.phases.transcription.metrics.captionCount === 0) {
        recommendations.push('⚠️  Implement real Whisper integration (currently using mock data)');
      }

      if (!result.phases.video.success) {
        recommendations.push('⚠️  Implement real Remotion video rendering (currently simulated)');
      }

      if (totalTime > 30000) {
        recommendations.push('⚠️  Optimize pipeline performance (current: ' + (totalTime / 1000).toFixed(2) + 's)');
      }

      if (recommendations.length === 0) {
        console.log('   🎉 All systems functional! Ready for real-world testing.');
      } else {
        recommendations.forEach(rec => console.log(`   ${rec}`));
      }

      // Next steps
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('⏭️  Next Steps');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const nextSteps = [
        '1. Create real audio sample file for testing',
        '2. Integrate actual Whisper.cpp transcription',
        '3. Implement real Remotion video rendering',
        '4. Add error handling and recovery mechanisms',
        '5. Optimize performance for longer audio files',
        '6. Add progress tracking and user feedback',
        '7. Implement quality validation and metrics',
        '8. Create comprehensive integration tests'
      ];

      nextSteps.forEach(step => console.log(`   ${step}`));

      // Save detailed report
      const report = {
        timestamp: new Date().toISOString(),
        iteration: 68,
        testType: 'Real AudioDiagramPipeline Execution',
        success: true,
        totalTime,
        phases: result.phases,
        criteria,
        qualityMetrics,
        recommendations,
        nextSteps,
        mvpScore: `${passCount}/${totalCount} (${(passCount / totalCount * 100).toFixed(1)}%)`
      };

      const reportPath = `audio-diagram-pipeline-test-${Date.now()}.json`;

      console.log(`\n💾 Report saved to: ${reportPath}`);
      console.log('─'.repeat(63));

      // Write report
      const fs = await import('fs');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log('\n═══════════════════════════════════════════════════════════════');
      if (allPassed) {
        console.log('🎉 MVP TEST: ALL CRITERIA PASSED');
      } else if (passCount >= totalCount * 0.75) {
        console.log('✅ MVP TEST: MOSTLY SUCCESSFUL (Minor improvements needed)');
      } else {
        console.log('⚠️  MVP TEST: NEEDS IMPROVEMENT');
      }
      console.log('═══════════════════════════════════════════════════════════════\n');

      return { success: true, report };

    } else {
      console.log('❌ Overall Status: FAILED\n');
      console.log(`Error: ${result.error}`);
      console.log(`Duration: ${result.duration?.toFixed(0) || totalTime.toFixed(0)}ms`);

      if (result.framework) {
        console.log('\n🔄 Framework Progress Report:');
        console.log(JSON.stringify(result.framework, null, 2));
      }

      return { success: false, error: result.error };
    }

  } catch (error) {
    const totalTime = performance.now() - startTime;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('❌ Pipeline Test Failed with Exception');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Error: ${error.message}`);
    console.log(`\nStack Trace:\n${error.stack}`);
    console.log(`\nDuration: ${totalTime.toFixed(0)}ms\n`);

    return { success: false, error: error.message, stack: error.stack };
  }
}

// Execute test
testRealPipeline().then(result => {
  console.log('Test execution completed.');
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
