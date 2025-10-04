/**
 * Simplified Audio-to-Diagram Video Pipeline
 * MVP implementation following custom instructions
 * Focus: Working end-to-end flow from audio to video
 */

import { TranscriptionPipeline } from '@/transcription';
import { SceneSegmenter, DiagramDetector } from '@/analysis';
import { LayoutEngine } from '@/visualization';
import { SceneGraph } from '@/types/diagram';
import { VideoGenerator, VideoGenerationOptions } from './video-generator';
import { continuousLearner } from '@/framework/continuous-learner';

export interface SimplePipelineInput {
  audioFile: File;
  options?: {
    language?: string;
    maxScenes?: number;
    layoutType?: 'flow' | 'tree' | 'timeline' | 'auto';
    includeVideoGeneration?: boolean;
    videoOptions?: Partial<VideoGenerationOptions>;
  };
}

export interface SimplePipelineResult {
  success: boolean;
  audioUrl?: string;
  transcript?: string;
  scenes?: SceneGraph[];
  videoUrl?: string;
  error?: string;
  processingTime?: number;
}

export interface ProgressCallback {
  (step: string, progress: number): void;
}

/**
 * Simplified Pipeline Implementation
 * Implements the MVP requirements from custom instructions
 */
export class SimplePipeline {
  private transcription: TranscriptionPipeline;
  private segmenter: SceneSegmenter;
  private detector: DiagramDetector;
  private layoutEngine: LayoutEngine;
  private videoGenerator: VideoGenerator;

  // Progressive enhancement tracking (段階的改善追跡)
  private iterationCount: number = 0;
  private qualityMetrics: Map<string, number> = new Map();
  private performanceHistory: Array<{
    timestamp: string;
    processingTime: number;
    success: boolean;
    qualityScore?: number;
  }> = [];

  constructor() {
    // Initialize components with basic configurations
    this.transcription = new TranscriptionPipeline({
      model: 'base',
      combineMs: 200,
      maxRetries: 2
    });

    this.segmenter = new SceneSegmenter({
      minSceneLength: 30,
      maxSceneLength: 180,
      confidenceThreshold: 0.6
    });

    this.detector = new DiagramDetector({
      defaultType: 'flow',
      confidenceThreshold: 0.5
    });

    this.layoutEngine = new LayoutEngine({
      width: 1920,
      height: 1080,
      margin: 40
    });

    this.videoGenerator = new VideoGenerator({
      outputFormat: 'mp4',
      quality: 'high',
      resolution: '1080p',
      fps: 30,
      includeAudio: true
    });
  }

  /**
   * Process audio file through complete pipeline
   * Following iterative improvement approach (段階的改善アプローチ)
   */
  async process(
    input: SimplePipelineInput,
    onProgress?: ProgressCallback
  ): Promise<SimplePipelineResult> {
    const startTime = Date.now();
    this.iterationCount++;

    try {
      onProgress?.('Preparing audio file', 10);

      // Step 1: Create audio URL for processing
      const audioUrl = URL.createObjectURL(input.audioFile);

      onProgress?.('Transcribing audio', 20);

      // Step 2: Transcription with Continuous Learning Integration
      const transcriptionStartTime = Date.now();
      const transcriptionResult = await this.transcription.transcribe(audioUrl);

      const transcriptionProcessingTime = Date.now() - transcriptionStartTime;
      const transcriptionQuality = transcriptionResult.success && transcriptionResult.segments?.length > 0 ? 0.9 : 0.3;

      // Custom Instructions: Learn from transcription results
      await continuousLearner.learnFromProcessingResult(
        'transcription',
        { audioUrl, fileSize: input.audioFile.size },
        transcriptionResult,
        transcriptionProcessingTime,
        transcriptionQuality,
        transcriptionResult.success,
        transcriptionResult.success ? [] : ['transcription_failed'],
        {
          audioFileType: input.audioFile.type,
          audioFileName: input.audioFile.name,
          customInstructionsPhase: 'MVP構築'
        }
      );

      if (!transcriptionResult.success || !transcriptionResult.segments) {
        throw new Error('Transcription failed');
      }

      const transcript = transcriptionResult.segments
        .map(seg => seg.text)
        .join(' ');

      onProgress?.('Analyzing content', 50);

      // Step 3: Scene Segmentation with Continuous Learning Integration
      const segmentationStartTime = Date.now();
      const sceneResult = await this.segmenter.segment(
        transcriptionResult.segments
      );

      const segmentationProcessingTime = Date.now() - segmentationStartTime;
      const segmentationQuality = sceneResult.success && sceneResult.scenes?.length > 0 ?
        Math.min(0.95, 0.7 + (sceneResult.scenes.length / 10) * 0.25) : 0.3;

      // Custom Instructions: Learn from scene segmentation results
      await continuousLearner.learnFromProcessingResult(
        'scene_segmentation',
        { segments: transcriptionResult.segments },
        sceneResult,
        segmentationProcessingTime,
        segmentationQuality,
        sceneResult.success,
        sceneResult.success ? [] : ['scene_segmentation_failed'],
        {
          segmentCount: transcriptionResult.segments?.length || 0,
          sceneCount: sceneResult.scenes?.length || 0,
          customInstructionsPhase: '内容分析'
        }
      );

      if (!sceneResult.success || !sceneResult.scenes) {
        throw new Error('Scene segmentation failed');
      }

      onProgress?.('Detecting diagram types', 70);

      // Step 4: Diagram Detection & Layout with Continuous Learning Integration
      const scenes: SceneGraph[] = [];
      const diagramDetectionStartTime = Date.now();

      for (const scene of sceneResult.scenes) {
        const sceneStartTime = Date.now();

        // Detect diagram type for this scene
        const diagramAnalysis = await this.detector.detectDiagramType(
          scene.content
        );

        const diagramDetectionTime = Date.now() - sceneStartTime;

        // Custom Instructions: Learn from diagram detection
        await continuousLearner.learnFromProcessingResult(
          'diagram_detection',
          { content: scene.content },
          diagramAnalysis,
          diagramDetectionTime,
          diagramAnalysis.confidence,
          diagramAnalysis.confidence > 0.6,
          diagramAnalysis.confidence <= 0.6 ? ['low_confidence_detection'] : [],
          {
            sceneId: scene.id,
            detectedType: diagramAnalysis.type,
            customInstructionsPhase: '図解生成'
          }
        );

        // Generate layout
        const layoutStartTime = Date.now();
        const layoutResult = await this.layoutEngine.generateLayout({
          type: diagramAnalysis.type,
          content: scene.content,
          nodes: diagramAnalysis.nodes || [],
          relationships: diagramAnalysis.relationships || []
        });

        const layoutProcessingTime = Date.now() - layoutStartTime;
        const layoutQuality = layoutResult.success && layoutResult.layout ?
          Math.min(0.95, 0.8 + ((layoutResult.confidence || 0) * 0.15)) : 0.3;

        // Custom Instructions: Learn from layout generation
        await continuousLearner.learnFromProcessingResult(
          'layout_generation',
          { type: diagramAnalysis.type, nodeCount: diagramAnalysis.nodes?.length || 0 },
          layoutResult,
          layoutProcessingTime,
          layoutQuality,
          layoutResult.success,
          layoutResult.success ? [] : ['layout_generation_failed'],
          {
            sceneId: scene.id,
            diagramType: diagramAnalysis.type,
            nodeCount: diagramAnalysis.nodes?.length || 0,
            customInstructionsPhase: '図解生成'
          }
        );

        if (layoutResult.success && layoutResult.layout) {
          scenes.push({
            id: scene.id,
            startTime: scene.startTime,
            endTime: scene.endTime,
            content: scene.content,
            type: diagramAnalysis.type,
            layout: layoutResult.layout,
            confidence: Math.min(
              diagramAnalysis.confidence,
              layoutResult.confidence || 1
            )
          });
        }
      }

      const totalDiagramProcessingTime = Date.now() - diagramDetectionStartTime;

      // Custom Instructions: Learn from overall diagram pipeline performance
      await continuousLearner.learnFromProcessingResult(
        'diagram_pipeline',
        { sceneCount: sceneResult.scenes.length },
        { scenes, totalScenes: scenes.length },
        totalDiagramProcessingTime,
        scenes.length > 0 ? 0.9 : 0.3,
        scenes.length > 0,
        scenes.length === 0 ? ['no_scenes_generated'] : [],
        {
          inputScenes: sceneResult.scenes.length,
          outputScenes: scenes.length,
          successRate: scenes.length / sceneResult.scenes.length,
          customInstructionsPhase: '図解生成'
        }
      );

      // Step 5: Video Generation (optional) with Continuous Learning Integration
      let videoUrl: string | undefined;

      if (input.options?.includeVideoGeneration) {
        onProgress?.('Generating video', 85);

        const videoGenerationStartTime = Date.now();

        const pipelineResult: SimplePipelineResult = {
          success: true,
          audioUrl,
          transcript,
          scenes,
          processingTime: 0 // Will be updated later
        };

        const videoResult = await this.videoGenerator.generateVideo(
          pipelineResult,
          (stage, progress) => {
            onProgress?.(stage, 85 + (progress * 0.15)); // 85-100%
          }
        );

        const videoProcessingTime = Date.now() - videoGenerationStartTime;
        const videoQuality = videoResult.success ? 0.95 : 0.3;

        // Custom Instructions: Learn from video generation
        await continuousLearner.learnFromProcessingResult(
          'video_generation',
          { sceneCount: scenes.length, audioUrl },
          videoResult,
          videoProcessingTime,
          videoQuality,
          videoResult.success,
          videoResult.success ? [] : ['video_generation_failed'],
          {
            sceneCount: scenes.length,
            outputFormat: 'mp4',
            customInstructionsPhase: '品質向上'
          }
        );

        if (videoResult.success) {
          videoUrl = videoResult.videoUrl;
        } else {
          console.warn('Video generation failed:', videoResult.error);
        }
      }

      onProgress?.('Complete', 100);

      const processingTime = Date.now() - startTime;

      // Calculate quality score based on results
      const qualityScore = this.calculateQualityScore({
        transcript,
        scenes,
        processingTime,
        videoUrl
      });

      // Custom Instructions: Learn from overall pipeline performance
      await continuousLearner.learnFromProcessingResult(
        'pipeline_complete',
        {
          audioFile: input.audioFile.name,
          options: input.options,
          includeVideo: input.options?.includeVideoGeneration
        },
        {
          transcript,
          scenes,
          videoUrl,
          qualityScore
        },
        processingTime,
        qualityScore,
        true,
        [],
        {
          totalScenes: scenes.length,
          transcriptLength: transcript.length,
          includeVideoGeneration: input.options?.includeVideoGeneration || false,
          customInstructionsPhase: '品質向上',
          recursiveDevelopmentSuccess: true
        }
      );

      // Track performance for progressive enhancement
      this.performanceHistory.push({
        timestamp: new Date().toISOString(),
        processingTime,
        success: true,
        qualityScore
      });

      // Update quality metrics
      this.qualityMetrics.set('lastScore', qualityScore);
      this.qualityMetrics.set('averageProcessingTime',
        this.performanceHistory.reduce((sum, h) => sum + h.processingTime, 0) / this.performanceHistory.length
      );

      console.log(`🎯 Custom Instructions Compliance: Pipeline completed with quality score ${(qualityScore * 100).toFixed(1)}%`);

      return {
        success: true,
        audioUrl,
        transcript,
        scenes,
        videoUrl,
        processingTime
      };

    } catch (error) {
      console.error('Pipeline processing error:', error);

      // Enhanced error handling with recovery strategies
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const failureProcessingTime = Date.now() - startTime;

      // Custom Instructions: Learn from pipeline failures
      await continuousLearner.learnFromProcessingResult(
        'pipeline_failure',
        {
          audioFile: input.audioFile.name,
          options: input.options,
          errorMessage
        },
        { error: errorMessage },
        failureProcessingTime,
        0.0, // Quality score 0 for failures
        false,
        [errorMessage, 'pipeline_failure'],
        {
          inputFileSize: input.audioFile.size,
          inputFileType: input.audioFile.type,
          inputFileName: input.audioFile.name,
          customInstructionsPhase: 'エラー回復',
          recursiveDevelopmentNeeded: true,
          iterationNumber: this.iterationCount
        }
      );

      // Log detailed error information for debugging (including input metadata)
      console.error('Error details:', {
        timestamp: new Date().toISOString(),
        processingTime: failureProcessingTime,
        stack: error instanceof Error ? error.stack : undefined,
        inputFileSize: input.audioFile.size,
        inputFileType: input.audioFile.type,
        inputFileName: input.audioFile.name,
        inputLastModified: new Date(input.audioFile.lastModified).toISOString(),
        optionsProvided: input.options ? Object.keys(input.options) : [],
        customInstructionsIteration: this.iterationCount
      });

      // Attempt graceful degradation
      onProgress?.('Error encountered - attempting recovery', 90);

      // Clean up any temporary resources
      try {
        // Revoke object URLs to prevent memory leaks
        if (typeof audioUrl !== 'undefined') {
          URL.revokeObjectURL(audioUrl);
        }
      } catch (cleanupError) {
        console.warn('Cleanup warning:', cleanupError);
      }

      // Track failure for progressive enhancement
      this.performanceHistory.push({
        timestamp: new Date().toISOString(),
        processingTime: failureProcessingTime,
        success: false,
        qualityScore: 0
      });

      return {
        success: false,
        error: `Pipeline failed: ${errorMessage}`,
        processingTime: failureProcessingTime
      };
    }
  }

  /**
   * Process with retry logic
   * Implements failure recovery from custom instructions
   */
  async processWithRetry(
    input: SimplePipelineInput,
    onProgress?: ProgressCallback,
    maxRetries: number = 3
  ): Promise<SimplePipelineResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        onProgress?.(`Attempt ${attempt}/${maxRetries}`, 0);

        const result = await this.process(input, onProgress);

        if (result.success) {
          return result;
        }

        lastError = new Error(result.error || 'Processing failed');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Pipeline attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      success: false,
      error: `All ${maxRetries} attempts failed. Last error: ${lastError?.message}`,
      processingTime: 0
    };
  }

  /**
   * Calculate quality score for progressive enhancement
   * 品質スコア計算（段階的改善用）
   */
  private calculateQualityScore(result: {
    transcript?: string;
    scenes?: SceneGraph[];
    processingTime: number;
    videoUrl?: string;
  }): number {
    let score = 0;

    // Transcript quality (30%)
    if (result.transcript) {
      const transcriptScore = Math.min(result.transcript.length / 100, 1) * 30;
      score += transcriptScore;
    }

    // Scene detection quality (30%)
    if (result.scenes && result.scenes.length > 0) {
      const avgConfidence = result.scenes.reduce((sum, scene) => sum + (scene.confidence || 0), 0) / result.scenes.length;
      score += avgConfidence * 30;
    }

    // Performance score (20%)
    const performanceScore = Math.max(0, 20 - (result.processingTime / 1000)); // Penalty for slow processing
    score += Math.max(0, performanceScore);

    // Video generation bonus (20%)
    if (result.videoUrl) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  /**
   * Get progressive enhancement metrics
   * 段階的改善メトリクス取得
   */
  getProgressiveMetrics() {
    return {
      iterationCount: this.iterationCount,
      qualityMetrics: Object.fromEntries(this.qualityMetrics),
      performanceHistory: this.performanceHistory.slice(-10), // Last 10 runs
      averageQuality: this.performanceHistory.length > 0
        ? this.performanceHistory.reduce((sum, h) => sum + (h.qualityScore || 0), 0) / this.performanceHistory.length
        : 0,
      successRate: this.performanceHistory.length > 0
        ? this.performanceHistory.filter(h => h.success).length / this.performanceHistory.length * 100
        : 0
    };
  }

  /**
   * Get current processing capabilities
   * For debugging and monitoring
   */
  getCapabilities() {
    return {
      transcription: {
        model: 'whisper-base',
        supportedFormats: ['mp3', 'wav', 'ogg', 'm4a'],
        maxDuration: '30 minutes'
      },
      analysis: {
        sceneDetection: true,
        diagramTypes: ['flow', 'tree', 'timeline', 'concept'],
        languageSupport: ['ja', 'en']
      },
      visualization: {
        layoutTypes: ['dagre', 'force', 'manual'],
        outputFormats: ['svg', 'canvas'],
        maxNodes: 50
      },
      progressiveEnhancement: {
        enabled: true,
        trackingMetrics: Array.from(this.qualityMetrics.keys()),
        iterationCount: this.iterationCount,
        enhancementFeatures: [
          'quality_score_calculation',
          'performance_history_tracking',
          'iterative_improvement_metrics',
          'progressive_enhancement_monitoring'
        ]
      }
    };
  }
}

// Export singleton instance for easy use
export const simplePipeline = new SimplePipeline();