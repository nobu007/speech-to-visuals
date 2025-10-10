#!/usr/bin/env ts-node
/**
 * MVP Pipeline: Audio → Diagram Video
 *
 * 🎯 End-to-End Flow:
 * 1. Audio → Text (transcribe-audio.ts)
 * 2. Text → Scenes (scene segmentation)
 * 3. Scenes → Diagrams (simple-diagram-detector.ts)
 * 4. Diagrams → Video (Remotion rendering)
 *
 * 🔄 Custom Instructions:
 * - 段階的に実装・検証
 * - 各ステップで動作確認
 * - 失敗時はロールバック可能
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { AudioTranscriber, TranscriptionResult, TranscriptionSegment } from './transcribe-audio';
import { SimpleDiagramDetector, SimpleDiagramAnalysis, TextSegment } from '../src/analysis/simple-diagram-detector';

export interface SceneWithDiagram {
  sceneId: string;
  startMs: number;
  endMs: number;
  text: string;
  diagramType: string;
  confidence: number;
  nodes: any[];
  edges: any[];
  reasoning: string;
}

export interface PipelineResult {
  success: boolean;
  audioPath: string;
  transcription: TranscriptionResult | null;
  scenes: SceneWithDiagram[];
  metrics: {
    totalDuration: number;
    processingTime: number;
    scenesGenerated: number;
    averageConfidence: number;
  };
  error?: string;
}

/**
 * MVP Pipeline Orchestrator
 * Coordinates the entire audio-to-diagram-video flow
 */
export class AudioToDiagramPipeline {
  private transcriber: AudioTranscriber;
  private diagramDetector: SimpleDiagramDetector;

  constructor() {
    this.transcriber = new AudioTranscriber();
    this.diagramDetector = new SimpleDiagramDetector();
  }

  /**
   * Execute the complete pipeline
   *
   * @param audioPath - Path to input audio file
   * @returns Pipeline execution result
   */
  async execute(audioPath: string): Promise<PipelineResult> {
    const startTime = performance.now();

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 MVP Pipeline Execution Started`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(`📁 Input Audio: ${audioPath}\n`);

    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 1: Audio Transcription
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log(`┌─ STEP 1: Audio Transcription`);
      console.log(`└─────────────────────────────────────\n`);

      const transcription = await this.transcriber.transcribe(audioPath);

      if (!transcription.success) {
        throw new Error(`Transcription failed: ${transcription.error}`);
      }

      console.log(`✅ Step 1 Complete: ${transcription.segments.length} segments transcribed\n`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 2: Scene Segmentation
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log(`┌─ STEP 2: Scene Segmentation`);
      console.log(`└─────────────────────────────────────\n`);

      const textSegments = this.segmentByContent(transcription.segments);

      console.log(`✅ Step 2 Complete: ${textSegments.length} scenes created\n`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 3: Diagram Detection & Generation
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log(`┌─ STEP 3: Diagram Detection`);
      console.log(`└─────────────────────────────────────\n`);

      const scenes: SceneWithDiagram[] = [];

      for (let i = 0; i < textSegments.length; i++) {
        const segment = textSegments[i];

        console.log(`  🔍 Analyzing scene ${i + 1}/${textSegments.length}...`);

        const diagramAnalysis = await this.diagramDetector.analyze(segment);

        const scene: SceneWithDiagram = {
          sceneId: `scene-${i + 1}`,
          startMs: segment.startMs,
          endMs: segment.endMs,
          text: segment.text,
          diagramType: diagramAnalysis.type,
          confidence: diagramAnalysis.confidence,
          nodes: diagramAnalysis.nodes,
          edges: diagramAnalysis.edges,
          reasoning: diagramAnalysis.reasoning
        };

        scenes.push(scene);

        console.log(`    ✓ Type: ${scene.diagramType} (${(scene.confidence * 100).toFixed(1)}%)`);
        console.log(`    ✓ Elements: ${scene.nodes.length} nodes, ${scene.edges.length} edges\n`);
      }

      console.log(`✅ Step 3 Complete: ${scenes.length} diagrams generated\n`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 4: Metrics & Results
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const processingTime = performance.now() - startTime;
      const averageConfidence = scenes.reduce((sum, s) => sum + s.confidence, 0) / scenes.length;

      const result: PipelineResult = {
        success: true,
        audioPath,
        transcription,
        scenes,
        metrics: {
          totalDuration: transcription.duration,
          processingTime,
          scenesGenerated: scenes.length,
          averageConfidence
        }
      };

      // Save pipeline result to file
      await this.savePipelineResult(result);

      console.log(`┌─ Pipeline Summary`);
      console.log(`└─────────────────────────────────────`);
      console.log(`  ✓ Processing Time: ${(processingTime / 1000).toFixed(2)}s`);
      console.log(`  ✓ Audio Duration: ${(transcription.duration / 1000).toFixed(2)}s`);
      console.log(`  ✓ Scenes Generated: ${scenes.length}`);
      console.log(`  ✓ Average Confidence: ${(averageConfidence * 100).toFixed(1)}%\n`);

      console.log(`${'='.repeat(70)}`);
      console.log(`✅ Pipeline Execution Complete!`);
      console.log(`${'='.repeat(70)}\n`);

      return result;

    } catch (error) {
      const processingTime = performance.now() - startTime;

      console.error(`\n❌ Pipeline failed:`, error);

      return {
        success: false,
        audioPath,
        transcription: null,
        scenes: [],
        metrics: {
          totalDuration: 0,
          processingTime,
          scenesGenerated: 0,
          averageConfidence: 0
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Segment transcription into logical scenes
   * MVP: Simple time-based + content-based segmentation
   */
  private segmentByContent(segments: TranscriptionSegment[]): TextSegment[] {
    console.log(`  🔄 Segmenting ${segments.length} transcription segments into scenes...`);

    // Strategy: Combine segments into scenes based on:
    // 1. Minimum scene duration (5 seconds)
    // 2. Maximum scene duration (15 seconds)
    // 3. Sentence boundaries (periods, question marks)

    const MIN_SCENE_MS = 5000;
    const MAX_SCENE_MS = 15000;

    const textSegments: TextSegment[] = [];
    let currentScene: string[] = [];
    let sceneStartMs = 0;
    let sceneEndMs = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (currentScene.length === 0) {
        sceneStartMs = segment.startMs;
      }

      currentScene.push(segment.text);
      sceneEndMs = segment.endMs;

      const sceneDuration = sceneEndMs - sceneStartMs;
      const isLastSegment = i === segments.length - 1;
      const endsWithPeriod = segment.text.match(/[。.!?]$/);

      // Create new scene if:
      // - Duration exceeds MAX_SCENE_MS
      // - Duration >= MIN_SCENE_MS AND ends with period
      // - Last segment
      if (
        sceneDuration >= MAX_SCENE_MS ||
        (sceneDuration >= MIN_SCENE_MS && endsWithPeriod) ||
        isLastSegment
      ) {
        textSegments.push({
          text: currentScene.join(' '),
          startMs: sceneStartMs,
          endMs: sceneEndMs,
          summary: currentScene[0] // First sentence as summary
        });

        currentScene = [];
      }
    }

    console.log(`  ✓ Created ${textSegments.length} scenes from ${segments.length} segments`);

    return textSegments;
  }

  /**
   * Save pipeline result to JSON file
   */
  private async savePipelineResult(result: PipelineResult): Promise<void> {
    const outputDir = path.join(process.cwd(), 'demo-output');
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `pipeline-result-${timestamp}.json`);

    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));

    console.log(`💾 Pipeline result saved: ${outputPath}\n`);
  }

  /**
   * Get pipeline status and metrics
   */
  getStatus(): any {
    return {
      modules: {
        transcriber: 'AudioTranscriber',
        diagramDetector: 'SimpleDiagramDetector'
      },
      capabilities: {
        audioFormats: ['mp3', 'wav', 'm4a', 'flac'],
        diagramTypes: ['flow', 'tree', 'timeline', 'cycle', 'network'],
        languages: ['ja', 'en']
      }
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Execution (commented out for ES module compatibility)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// if (require.main === module) {
//   (async () => {
//     const pipeline = new AudioToDiagramPipeline();

//     // Test with mock audio (will use fallback transcription)
//     const testAudioPath = path.join(process.cwd(), 'public', 'audio', 'test-sample.mp3');

//     const result = await pipeline.execute(testAudioPath);

//     if (result.success) {
//       console.log(`\n🎉 Success! Generated ${result.scenes.length} diagram scenes`);
//       console.log(`📊 Average confidence: ${(result.metrics.averageConfidence * 100).toFixed(1)}%`);

//       // Show sample scenes
//       if (result.scenes.length > 0) {
//         console.log(`\n📝 Sample Scenes:`);
//         result.scenes.slice(0, 3).forEach((scene, idx) => {
//           console.log(`\n  Scene ${idx + 1}:`);
//           console.log(`    Type: ${scene.diagramType}`);
//           console.log(`    Time: ${(scene.startMs / 1000).toFixed(2)}s - ${(scene.endMs / 1000).toFixed(2)}s`);
//           console.log(`    Text: "${scene.text.substring(0, 60)}..."`);
//           console.log(`    Elements: ${scene.nodes.length} nodes, ${scene.edges.length} edges`);
//         });
//       }
//     } else {
//       console.error(`\n❌ Pipeline failed: ${result.error}`);
//       process.exit(1);
//     }
//   })();
// }

export const audioDiagramPipeline = new AudioToDiagramPipeline();
