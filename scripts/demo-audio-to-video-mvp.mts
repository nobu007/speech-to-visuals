#!/usr/bin/env tsx
/**
 * Audio-to-Diagram Video MVP Demonstration
 * 🔄 Custom Instructions Compliant: 段階的開発・再帰的改善
 *
 * Purpose: Demonstrate complete audio → transcript → diagram → video pipeline
 * Iteration: 1 (Minimal Working Implementation)
 */

import { mvpPipeline, MVPResult } from '../src/pipeline/mvp-pipeline';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ============================================================================
// Phase 1: Configuration
// ============================================================================

const DEMO_CONFIG = {
  outputDir: './demo-output',
  audioFile: null, // Will use demo mode (no audio file required)
  remotionConfig: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300, // 10 seconds at 30fps
    compositionId: 'DiagramVideo'
  }
};

interface RemotionInputProps {
  scenes: Array<{
    id: string;
    startMs: number;
    durationMs: number;
    content: string;
    diagramType: string;
    layout: any;
  }>;
  audioUrl: string | null;
  totalDuration: number;
}

// ============================================================================
// Phase 2: Pipeline Execution
// ============================================================================

async function executePipeline(): Promise<MVPResult> {
  console.log('\n🎯 Phase 2: Executing Audio-to-Diagram Pipeline');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Use demo mode since we don't have actual audio file
  console.log('📊 Running MVP pipeline in demo mode...');

  const result = await mvpPipeline.generateDemo((step, progress) => {
    console.log(`  [${progress}%] ${step}`);
  });

  if (!result.success) {
    throw new Error(`Pipeline failed: ${result.error}`);
  }

  console.log(`\n✅ Pipeline completed successfully!`);
  console.log(`   - Scenes generated: ${result.scenes.length}`);
  console.log(`   - Average confidence: ${(result.metadata.averageConfidence * 100).toFixed(1)}%`);
  console.log(`   - Processing time: ${(result.processingTime / 1000).toFixed(2)}s`);

  return result;
}

// ============================================================================
// Phase 3: Remotion Video Rendering
// ============================================================================

async function renderVideo(pipelineResult: MVPResult): Promise<string> {
  console.log('\n🎬 Phase 3: Rendering Video with Remotion');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Create output directory
  if (!existsSync(DEMO_CONFIG.outputDir)) {
    mkdirSync(DEMO_CONFIG.outputDir, { recursive: true });
  }

  // Convert pipeline result to Remotion input format
  const scenes = pipelineResult.scenes.map(scene => ({
    id: scene.id,
    startMs: scene.startTime * 1000,
    durationMs: (scene.endTime - scene.startTime) * 1000,
    content: scene.content,
    diagramType: scene.diagramType,
    layout: scene.layout
  }));

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationMs, 0);
  const durationInFrames = Math.ceil((totalDuration / 1000) * DEMO_CONFIG.remotionConfig.fps);

  console.log('📋 Remotion Configuration:');
  console.log(`   - Composition: ${DEMO_CONFIG.remotionConfig.compositionId}`);
  console.log(`   - Resolution: ${DEMO_CONFIG.remotionConfig.width}x${DEMO_CONFIG.remotionConfig.height}`);
  console.log(`   - FPS: ${DEMO_CONFIG.remotionConfig.fps}`);
  console.log(`   - Duration: ${(totalDuration / 1000).toFixed(2)}s (${durationInFrames} frames)`);
  console.log(`   - Scenes: ${scenes.length}\n`);

  // Save input data for Remotion
  const inputPropsPath = join(DEMO_CONFIG.outputDir, 'remotion-input.json');
  const inputProps: RemotionInputProps = {
    scenes,
    audioUrl: pipelineResult.audioUrl || null,
    totalDuration
  };

  writeFileSync(inputPropsPath, JSON.stringify(inputProps, null, 2));
  console.log(`✅ Saved Remotion input data: ${inputPropsPath}`);

  // Bundle Remotion project
  console.log('\n📦 Bundling Remotion project...');
  const bundleLocation = await bundle({
    entryPoint: './src/remotion/index.ts',
    webpackOverride: (config) => config
  });

  console.log(`✅ Bundle created: ${bundleLocation}`);

  // Get composition
  console.log('\n🎥 Loading composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: DEMO_CONFIG.remotionConfig.compositionId,
    inputProps
  });

  console.log(`✅ Composition loaded: ${composition.id}`);
  console.log(`   - Size: ${composition.width}x${composition.height}`);
  console.log(`   - FPS: ${composition.fps}`);
  console.log(`   - Duration: ${composition.durationInFrames} frames`);

  // Render video
  const outputPath = join(DEMO_CONFIG.outputDir, 'output-video.mp4');
  console.log(`\n🎬 Rendering video to: ${outputPath}`);
  console.log('   This may take a few minutes...\n');

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ renderedFrames, encodedFrames, progress }) => {
      const percent = (progress * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${percent}% (${renderedFrames}/${composition.durationInFrames} frames)`);
    }
  });

  console.log('\n\n✅ Video rendering completed!');
  return outputPath;
}

// ============================================================================
// Phase 4: Quality Assessment
// ============================================================================

function assessQuality(pipelineResult: MVPResult, videoPath: string): void {
  console.log('\n📊 Phase 4: Quality Assessment');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const metrics = {
    pipelineSuccess: pipelineResult.success,
    scenesGenerated: pipelineResult.scenes.length,
    averageConfidence: pipelineResult.metadata.averageConfidence,
    processingTime: pipelineResult.processingTime,
    videoGenerated: existsSync(videoPath)
  };

  console.log('📈 Pipeline Metrics:');
  console.log(`   ✅ Success: ${metrics.pipelineSuccess}`);
  console.log(`   📊 Scenes: ${metrics.scenesGenerated}`);
  console.log(`   🎯 Confidence: ${(metrics.averageConfidence * 100).toFixed(1)}%`);
  console.log(`   ⏱️  Processing: ${(metrics.processingTime / 1000).toFixed(2)}s`);
  console.log(`   🎬 Video: ${metrics.videoGenerated ? 'Generated' : 'Failed'}\n`);

  // Success criteria (MVP Phase)
  const successCriteria = {
    pipelineCompleted: metrics.pipelineSuccess,
    hasSufficientScenes: metrics.scenesGenerated >= 2,
    acceptableConfidence: metrics.averageConfidence >= 0.7,
    videoExists: metrics.videoGenerated
  };

  const allPassed = Object.values(successCriteria).every(v => v);
  const passedCount = Object.values(successCriteria).filter(v => v).length;

  console.log('🎯 Success Criteria (MVP):');
  console.log(`   ${successCriteria.pipelineCompleted ? '✅' : '❌'} Pipeline completed`);
  console.log(`   ${successCriteria.hasSufficientScenes ? '✅' : '❌'} Sufficient scenes (>= 2)`);
  console.log(`   ${successCriteria.acceptableConfidence ? '✅' : '❌'} Acceptable confidence (>= 70%)`);
  console.log(`   ${successCriteria.videoExists ? '✅' : '❌'} Video file generated\n`);

  console.log(`📊 Overall: ${passedCount}/${Object.keys(successCriteria).length} criteria passed`);

  if (allPassed) {
    console.log('✅ MVP SUCCESS: All criteria met!\n');
  } else {
    console.log('⚠️  MVP PARTIAL SUCCESS: Some criteria need improvement\n');
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🎯 Audio-to-Diagram Video Generator MVP Demo               ║');
  console.log('║   🔄 Custom Instructions: Recursive Development Framework     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('📋 MVP Objectives:');
  console.log('   1. Process audio/demo content');
  console.log('   2. Analyze and segment scenes');
  console.log('   3. Generate diagram layouts');
  console.log('   4. Render video with Remotion');
  console.log('   5. Assess quality and iterate\n');

  const startTime = Date.now();

  try {
    // Phase 1: Already configured
    console.log('✅ Phase 1: Configuration loaded\n');

    // Phase 2: Execute pipeline
    const pipelineResult = await executePipeline();

    // Phase 3: Render video
    const videoPath = await renderVideo(pipelineResult);

    // Phase 4: Assess quality
    assessQuality(pipelineResult, videoPath);

    // Success summary
    const totalTime = Date.now() - startTime;
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                     🎉 DEMO COMPLETED                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`📁 Output directory: ${DEMO_CONFIG.outputDir}`);
    console.log(`🎬 Video file: ${videoPath}\n`);

    console.log('🚀 Next Steps:');
    console.log('   1. Review generated video');
    console.log('   2. Iterate on diagram detection accuracy');
    console.log('   3. Enhance Remotion animations');
    console.log('   4. Add real audio transcription');
    console.log('   5. Commit MVP and plan next iteration\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('   - Check that all dependencies are installed');
    console.error('   - Verify Remotion configuration');
    console.error('   - Review error stack trace above');
    console.error('   - Try running: npm run remotion:studio\n');

    process.exit(1);
  }
}

// Run the demo
main().catch(console.error);
