import { SceneGraph } from '@/types/diagram';
import { TranscriptionPipeline } from '@/transcription';
import { SceneSegmenter, DiagramDetector } from '@/analysis';
import { LayoutEngine } from '@/visualization';
import {
  PipelineInput,
  PipelineConfig,
  PipelineResult,
  PipelineStage,
  PipelineMetrics
} from './types';

/**
 * Main Audio-to-Diagram Video Generation Pipeline
 * Orchestrates the complete process from audio input to video output
 * Implements iterative improvement approach
 */
export class MainPipeline {
  private config: PipelineConfig;
  private stages: PipelineStage[] = [];
  private iteration: number = 1;

  // Pipeline components
  private transcriber: TranscriptionPipeline;
  private segmenter: SceneSegmenter;
  private detector: DiagramDetector;
  private layoutEngine: LayoutEngine;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = {
      transcription: {
        model: 'base',
        language: 'en',
        ...config.transcription
      },
      analysis: {
        minSegmentLengthMs: 3000,
        maxSegmentLengthMs: 15000,
        confidenceThreshold: 0.7,
        ...config.analysis
      },
      layout: {
        width: 1920,
        height: 1080,
        nodeWidth: 120,
        nodeHeight: 60,
        ...config.layout
      },
      output: {
        fps: 30,
        videoDuration: 60,
        includeAudio: true,
        ...config.output
      }
    };

    // Initialize pipeline components
    this.transcriber = new TranscriptionPipeline({
      model: this.config.transcription.model,
      language: this.config.transcription.language,
      outputFormat: 'json',
      maxRetries: 3
    });

    this.segmenter = new SceneSegmenter({
      minSegmentLengthMs: this.config.analysis.minSegmentLengthMs,
      maxSegmentLengthMs: this.config.analysis.maxSegmentLengthMs,
      confidenceThreshold: this.config.analysis.confidenceThreshold
    });

    this.detector = new DiagramDetector();

    this.layoutEngine = new LayoutEngine({
      width: this.config.layout.width,
      height: this.config.layout.height,
      nodeWidth: this.config.layout.nodeWidth,
      nodeHeight: this.config.layout.nodeHeight
    });
  }

  /**
   * Execute the complete pipeline
   */
  async execute(input: PipelineInput): Promise<PipelineResult> {
    const startTime = performance.now();
    console.log(`\n🚀 Starting Audio-to-Diagram Pipeline V${this.iteration}`);
    console.log(`Input: ${typeof input.audioFile === 'string' ? input.audioFile : input.audioFile.name}`);

    this.stages = [];

    try {
      // Stage 1: Audio Transcription
      const transcriptionResult = await this.executeStage(
        'transcription',
        () => this.transcribeAudio(input)
      );

      if (!transcriptionResult.success) {
        throw new Error('Transcription failed');
      }

      // Stage 2: Content Analysis & Scene Segmentation
      const analysisResult = await this.executeStage(
        'analysis',
        () => this.analyzeContent(transcriptionResult)
      );

      // Stage 3: Diagram Generation & Layout
      const layoutResult = await this.executeStage(
        'layout',
        () => this.generateLayouts(analysisResult)
      );

      // Stage 4: Video Preparation (Scene Graph Assembly)
      const scenes = await this.executeStage(
        'preparation',
        () => this.prepareScenes(analysisResult, layoutResult)
      );

      const totalTime = performance.now() - startTime;
      const result = this.createSuccessResult(scenes, input, totalTime);

      await this.logResults(result);
      return result;

    } catch (error) {
      const totalTime = performance.now() - startTime;
      console.error('[Pipeline] Error:', error);

      return {
        success: false,
        scenes: [],
        audioUrl: '',
        duration: 0,
        processingTime: totalTime,
        stages: this.stages,
        error: error instanceof Error ? error.message : 'Unknown pipeline error'
      };
    }
  }

  /**
   * Execute a pipeline stage with error handling and timing
   */
  private async executeStage<T>(
    stageName: string,
    stageFunction: () => Promise<T>
  ): Promise<T> {
    const stage: PipelineStage = {
      name: stageName,
      status: 'analyzing',
      startTime: performance.now()
    };

    console.log(`\n📋 Stage: ${stageName.toUpperCase()}`);
    this.stages.push(stage);

    try {
      const result = await stageFunction();
      stage.status = 'complete';
      stage.endTime = performance.now();
      stage.result = result;

      const duration = stage.endTime - (stage.startTime || 0);
      console.log(`✅ ${stageName} completed in ${duration.toFixed(0)}ms`);

      return result;

    } catch (error) {
      stage.status = 'error';
      stage.endTime = performance.now();
      stage.error = error instanceof Error ? error.message : 'Unknown error';

      console.error(`❌ ${stageName} failed:`, stage.error);
      throw error;
    }
  }

  /**
   * Stage 1: Transcribe audio to text with timestamps
   */
  private async transcribeAudio(input: PipelineInput) {
    let audioPath: string;

    if (typeof input.audioFile === 'string') {
      audioPath = input.audioFile;
    } else {
      // For File objects, we'd need to save to disk first
      // For now, simulate with a path
      audioPath = 'temp_audio.wav';
    }

    const transcriptionResult = await this.transcriber.transcribe(audioPath);

    if (!transcriptionResult.success || transcriptionResult.segments.length === 0) {
      throw new Error('Audio transcription failed or produced no segments');
    }

    console.log(`Generated ${transcriptionResult.segments.length} transcription segments`);
    return transcriptionResult;
  }

  /**
   * Stage 2: Analyze content and segment into scenes
   */
  private async analyzeContent(transcriptionResult: any) {
    console.log('Segmenting content into scenes...');
    const contentSegments = await this.segmenter.segment(transcriptionResult.segments);

    if (contentSegments.length === 0) {
      throw new Error('Content segmentation produced no segments');
    }

    console.log(`Generated ${contentSegments.length} content segments`);

    // Analyze each segment for diagram content
    console.log('Detecting diagram types and extracting entities...');
    const diagramAnalyses = [];

    for (const segment of contentSegments) {
      const analysis = await this.detector.analyze(segment);
      diagramAnalyses.push({ segment, analysis });
    }

    console.log(`Analyzed ${diagramAnalyses.length} segments for diagram content`);
    return { contentSegments, diagramAnalyses };
  }

  /**
   * Stage 3: Generate layouts for each diagram
   */
  private async generateLayouts(analysisResult: any) {
    console.log('Generating diagram layouts...');
    const { diagramAnalyses } = analysisResult;
    const layouts = [];

    for (const { segment, analysis } of diagramAnalyses) {
      if (analysis.nodes.length > 0) {
        const layoutResult = await this.layoutEngine.generateLayout(
          analysis.nodes,
          analysis.edges,
          analysis.type
        );

        if (layoutResult.success) {
          layouts.push({ segment, analysis, layout: layoutResult.layout });
        } else {
          console.warn(`Layout generation failed for segment: ${segment.summary}`);
          // Create fallback layout
          layouts.push({
            segment,
            analysis,
            layout: this.createFallbackLayout(analysis.nodes, analysis.edges)
          });
        }
      }
    }

    console.log(`Generated ${layouts.length} diagram layouts`);
    return layouts;
  }

  /**
   * Stage 4: Prepare final scene graphs for video rendering
   */
  private async prepareScenes(analysisResult: any, layouts: any[]): Promise<SceneGraph[]> {
    console.log('Preparing scene graphs for video rendering...');

    const scenes: SceneGraph[] = layouts.map((item, index) => {
      const { segment, analysis, layout } = item;

      return {
        type: analysis.type,
        nodes: analysis.nodes,
        edges: analysis.edges,
        layout: layout,
        startMs: segment.startMs,
        durationMs: segment.endMs - segment.startMs,
        summary: segment.summary,
        keyphrases: segment.keyphrases
      };
    });

    console.log(`Prepared ${scenes.length} scenes for video generation`);
    return scenes;
  }

  /**
   * Create a fallback layout when automatic layout fails
   */
  private createFallbackLayout(nodes: any[], edges: any[]) {
    const layoutNodes = nodes.map((node, index) => ({
      ...node,
      x: 100 + (index % 3) * 200,
      y: 100 + Math.floor(index / 3) * 150,
      w: this.config.layout.nodeWidth,
      h: this.config.layout.nodeHeight
    }));

    const layoutEdges = edges.map(edge => ({
      ...edge,
      points: [
        { x: 150, y: 150 },
        { x: 350, y: 150 }
      ]
    }));

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  /**
   * Create successful pipeline result
   */
  private createSuccessResult(
    scenes: SceneGraph[],
    input: PipelineInput,
    totalTime: number
  ): PipelineResult {
    const audioUrl = typeof input.audioFile === 'string'
      ? input.audioFile
      : URL.createObjectURL(input.audioFile);

    const totalDuration = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);

    return {
      success: true,
      scenes,
      audioUrl,
      duration: totalDuration,
      processingTime: totalTime,
      stages: this.stages
    };
  }

  /**
   * Calculate and log pipeline metrics
   */
  private async logResults(result: PipelineResult): Promise<void> {
    const metrics: PipelineMetrics = {
      totalProcessingTime: result.processingTime,
      transcriptionTime: this.getStageTime('transcription'),
      analysisTime: this.getStageTime('analysis'),
      layoutTime: this.getStageTime('layout'),
      renderTime: this.getStageTime('preparation'),
      segmentCount: result.scenes.length,
      diagramCount: result.scenes.filter(s => s.nodes.length > 0).length,
      successRate: result.success ? 1 : 0
    };

    console.log('\n📊 Pipeline Results:');
    console.log(`- Success: ${result.success ? '✅' : '❌'}`);
    console.log(`- Total Time: ${(metrics.totalProcessingTime / 1000).toFixed(1)}s`);
    console.log(`- Scenes Generated: ${metrics.segmentCount}`);
    console.log(`- Diagrams Created: ${metrics.diagramCount}`);
    console.log(`- Video Duration: ${(result.duration / 1000).toFixed(1)}s`);

    console.log('\n⏱️ Stage Timings:');
    console.log(`- Transcription: ${(metrics.transcriptionTime / 1000).toFixed(1)}s`);
    console.log(`- Analysis: ${(metrics.analysisTime / 1000).toFixed(1)}s`);
    console.log(`- Layout: ${(metrics.layoutTime / 1000).toFixed(1)}s`);
    console.log(`- Preparation: ${(metrics.renderTime / 1000).toFixed(1)}s`);

    // Success criteria evaluation
    const successCriteria = {
      hasScenes: metrics.segmentCount > 0,
      hasDiagrams: metrics.diagramCount > 0,
      reasonableTime: metrics.totalProcessingTime < 120000, // 2 minutes
      goodSuccess: metrics.successRate > 0
    };

    const overallSuccess = Object.values(successCriteria).every(v => v);
    console.log(`\n${overallSuccess ? '🎉' : '⚠️'} Pipeline ${overallSuccess ? 'succeeded' : 'needs improvement'}`);

    if (!overallSuccess) {
      console.log('Issues:');
      Object.entries(successCriteria).forEach(([key, passed]) => {
        if (!passed) console.log(`  - ${key}: FAILED`);
      });
    }

    // Log iteration for improvement tracking
    await this.logIteration(metrics, overallSuccess);
  }

  /**
   * Get timing for a specific stage
   */
  private getStageTime(stageName: string): number {
    const stage = this.stages.find(s => s.name === stageName);
    if (stage && stage.startTime && stage.endTime) {
      return stage.endTime - stage.startTime;
    }
    return 0;
  }

  /**
   * Log iteration results for improvement tracking
   */
  private async logIteration(metrics: PipelineMetrics, success: boolean): Promise<void> {
    const iterationLog = {
      iteration: this.iteration,
      timestamp: new Date().toISOString(),
      success,
      metrics,
      config: this.config
    };

    console.log(`[Pipeline Iteration ${this.iteration}] Logged results for improvement analysis`);

    // TODO: In real implementation, append to .module/ITERATION_LOG.md
    // This would help track improvement across iterations
  }

  /**
   * Move to next iteration with optional config updates
   */
  public nextIteration(configUpdates: Partial<PipelineConfig> = {}): void {
    this.iteration++;
    this.config = { ...this.config, ...configUpdates };

    // Update component iterations
    if (this.transcriber) this.transcriber.nextIteration();
    if (this.segmenter) this.segmenter.nextIteration();
    if (this.detector) this.detector.nextIteration();
    if (this.layoutEngine) this.layoutEngine.nextIteration();

    console.log(`\n🔄 Moving to pipeline iteration ${this.iteration}`);
  }

  /**
   * Get current pipeline configuration
   */
  public getConfig(): PipelineConfig {
    return { ...this.config };
  }

  /**
   * Get pipeline metrics from last run
   */
  public getLastRunStages(): PipelineStage[] {
    return [...this.stages];
  }
}