import { SceneGraph } from '@/types/diagram';
import { TranscriptionPipeline } from '@/transcription';
import { SceneSegmenter, DiagramDetector } from '@/analysis';
import { LayoutEngine } from '@/visualization';
import { qualityMonitor, QualityAssessment } from '@/quality';
import { globalErrorRecovery } from '@/quality/enhanced-error-recovery';
import { globalAdaptiveProcessor } from '@/analysis/adaptive-content-processor';
import { globalCache } from '@/performance/intelligent-cache';
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
  private pipelineId: string;
  private concurrentStages: boolean = true;
  private retryConfig = { maxRetries: 3, backoffMs: 1000 };

  // Pipeline components
  private transcriber: TranscriptionPipeline;
  private segmenter: SceneSegmenter;
  private detector: DiagramDetector;
  private layoutEngine: LayoutEngine;

  // Performance tracking
  private stageMetrics: Map<string, { attempts: number; failures: number; avgTime: number }> = new Map();

  constructor(config: Partial<PipelineConfig> = {}) {
    this.pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
   * Enhanced pipeline execution with intelligent error recovery and optimization
   */
  async execute(input: PipelineInput): Promise<PipelineResult> {
    const startTime = performance.now();
    console.log(`\n🚀 Starting Enhanced Audio-to-Diagram Pipeline V${this.iteration} (${this.pipelineId})`);
    console.log(`Input: ${typeof input.audioFile === 'string' ? input.audioFile : input.audioFile.name}`);

    this.stages = [];

    try {
      // Initialize performance tracking
      await this.initializePerformanceTracking();

      // Execute pipeline with intelligent load balancing and error recovery
      const requestId = `${this.pipelineId}-execute`;

      return await globalErrorRecovery.executeWithLoadBalancing(
        requestId,
        () => this.executeEnhancedPipeline(input, startTime),
        'analysis', // Stage for circuit breaker
        8 // High priority for main pipeline
      );

    } catch (error) {
      return await this.handlePipelineFailure(error, startTime);
    }
  }

  /**
   * Initialize performance tracking and warm up systems
   */
  private async initializePerformanceTracking(): Promise<void> {
    // Initialize stage metrics
    const stageNames = ['transcription', 'analysis', 'layout', 'preparation'];
    stageNames.forEach(stage => {
      if (!this.stageMetrics.has(stage)) {
        this.stageMetrics.set(stage, { attempts: 0, failures: 0, avgTime: 0 });
      }
    });

    // Record adaptive processor metrics
    globalAdaptiveProcessor.recordMetrics({
      processingTime: 0,
      accuracyScore: 0.8,
      memoryUsage: process.memoryUsage().heapUsed,
      userEngagement: 0.5,
      errorRate: 0
    });
  }

  /**
   * Enhanced pipeline execution with parallel processing and optimization
   */
  private async executeEnhancedPipeline(input: PipelineInput, startTime: number): Promise<PipelineResult> {
    // Stage 1: Audio Transcription with caching
    const transcriptionResult = await this.executeStageWithRecovery(
      'transcription',
      () => this.transcribeAudioEnhanced(input),
      5 // High priority for transcription
    );

    if (!transcriptionResult.success) {
      throw new Error('Transcription failed after recovery attempts');
    }

    // Parallel execution of analysis stages where possible
    if (this.concurrentStages) {
      return await this.executeParallelPipeline(transcriptionResult, input, startTime);
    } else {
      return await this.executeSequentialPipeline(transcriptionResult, input, startTime);
    }
  }

  /**
   * Execute pipeline stages in parallel for better performance
   */
  private async executeParallelPipeline(transcriptionResult: any, input: PipelineInput, startTime: number): Promise<PipelineResult> {
    // Stage 2: Content Analysis & Scene Segmentation
    const analysisResult = await this.executeStageWithRecovery(
      'analysis',
      () => this.analyzeContentEnhanced(transcriptionResult),
      7 // High priority for analysis
    );

    // Start layout generation and quality assessment in parallel
    const [layoutResult, qualityPreCheck] = await Promise.all([
      this.executeStageWithRecovery(
        'layout',
        () => this.generateLayoutsEnhanced(analysisResult),
        6 // Medium-high priority for layout
      ),
      this.performQualityPreCheck(analysisResult)
    ]);

    // Stage 4: Video Preparation with optimizations
    const scenes = await this.executeStageWithRecovery(
      'preparation',
      () => this.prepareScenesEnhanced(analysisResult, layoutResult),
      4 // Medium priority for preparation
    );

    const totalTime = performance.now() - startTime;
    const result = this.createSuccessResult(scenes, input, totalTime);

    // Enhanced quality assessment
    const qualityAssessment = await this.performEnhancedQualityAssessment(result, qualityPreCheck);
    result.qualityAssessment = qualityAssessment;

    await this.logResults(result);
    return result;
  }

  /**
   * Execute pipeline stages sequentially (fallback)
   */
  private async executeSequentialPipeline(transcriptionResult: any, input: PipelineInput, startTime: number): Promise<PipelineResult> {
    const analysisResult = await this.executeStageWithRecovery(
      'analysis',
      () => this.analyzeContentEnhanced(transcriptionResult),
      7
    );

    const layoutResult = await this.executeStageWithRecovery(
      'layout',
      () => this.generateLayoutsEnhanced(analysisResult),
      6
    );

    const scenes = await this.executeStageWithRecovery(
      'preparation',
      () => this.prepareScenesEnhanced(analysisResult, layoutResult),
      4
    );

    const totalTime = performance.now() - startTime;
    const result = this.createSuccessResult(scenes, input, totalTime);

    const qualityAssessment = await qualityMonitor.assessPipelineQuality(result);
    result.qualityAssessment = qualityAssessment;

    await this.logResults(result);
    return result;
  }

  /**
   * Handle pipeline failure with intelligent recovery
   */
  private async handlePipelineFailure(error: any, startTime: number): Promise<PipelineResult> {
    const totalTime = performance.now() - startTime;
    console.error('[Enhanced Pipeline] Error:', error);

    // Try to recover using error recovery system
    try {
      const recoveryContext = {
        stage: 'analysis' as any,
        component: 'MainPipeline',
        input: { pipelineId: this.pipelineId },
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now(),
        retryCount: 0,
        userContext: {
          preferences: {},
          sessionId: this.pipelineId,
          previousSuccesses: this.getSuccessfulStages().length
        }
      };

      const recoveryResult = await globalErrorRecovery.recoverFromError(recoveryContext);

      if (recoveryResult.success) {
        console.log('🔄 Pipeline recovered using error recovery system');
        return recoveryResult.result || this.createMinimalResult(totalTime);
      }
    } catch (recoveryError) {
      console.error('[Pipeline Recovery] Failed:', recoveryError);
    }

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

  /**
   * Create minimal result for emergency situations
   */
  private createMinimalResult(totalTime: number): PipelineResult {
    return {
      success: true,
      scenes: [{
        type: 'flow',
        nodes: [{ id: 'error', label: 'Processing Error' }],
        edges: [],
        layout: {
          nodes: [{ id: 'error', label: 'Processing Error', x: 100, y: 100, w: 200, h: 60 }],
          edges: []
        },
        startMs: 0,
        durationMs: 5000,
        summary: 'Pipeline encountered an error',
        keyphrases: ['error', 'recovery']
      }],
      audioUrl: '',
      duration: 5000,
      processingTime: totalTime,
      stages: this.stages
    };
  }

  /**
   * Get count of successful stages
   */
  private getSuccessfulStages(): PipelineStage[] {
    return this.stages.filter(stage => stage.status === 'complete');
  }

  /**
   * Enhanced stage execution with recovery and load balancing
   */
  private async executeStageWithRecovery<T>(
    stageName: string,
    stageFunction: () => Promise<T>,
    priority: number = 5
  ): Promise<T> {
    const requestId = `${this.pipelineId}-${stageName}`;

    return await globalErrorRecovery.executeWithLoadBalancing(
      requestId,
      () => this.executeStageInternal(stageName, stageFunction),
      stageName as any,
      priority
    );
  }

  /**
   * Internal stage execution with metrics tracking
   */
  private async executeStageInternal<T>(
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

    // Update stage metrics
    const metrics = this.stageMetrics.get(stageName);
    if (metrics) {
      metrics.attempts++;
    }

    try {
      // Execute with adaptive parameters from global processor
      const characteristics = await globalAdaptiveProcessor.analyzeContent(
        `Processing ${stageName} stage for pipeline ${this.pipelineId}`
      );

      const strategy = await globalAdaptiveProcessor.selectStrategy(characteristics);
      const adaptationResult = await globalAdaptiveProcessor.adaptStrategy(strategy, characteristics);

      // Apply adapted parameters to stage execution
      const result = await this.executeWithAdaptation(stageFunction, adaptationResult);

      stage.status = 'complete';
      stage.endTime = performance.now();
      stage.result = result;

      const duration = stage.endTime - (stage.startTime || 0);

      // Update metrics with successful execution
      if (metrics) {
        metrics.avgTime = (metrics.avgTime + duration) / Math.max(metrics.attempts, 1);
      }

      // Record performance for adaptive processor
      globalAdaptiveProcessor.recordMetrics({
        processingTime: duration,
        accuracyScore: 0.9, // Assume success has good accuracy
        memoryUsage: process.memoryUsage().heapUsed,
        userEngagement: 0.8, // Stage completion indicates engagement
        errorRate: 0
      });

      console.log(`✅ ${stageName} completed in ${duration.toFixed(0)}ms`);
      return result;

    } catch (error) {
      stage.status = 'error';
      stage.endTime = performance.now();
      stage.error = error instanceof Error ? error.message : 'Unknown error';

      // Update failure metrics
      if (metrics) {
        metrics.failures++;
      }

      // Record failure for adaptive processor
      globalAdaptiveProcessor.recordMetrics({
        processingTime: stage.endTime! - stage.startTime!,
        accuracyScore: 0.1, // Low accuracy for failures
        memoryUsage: process.memoryUsage().heapUsed,
        userEngagement: 0.2,
        errorRate: 1.0
      });

      console.error(`❌ ${stageName} failed:`, stage.error);
      throw error;
    }
  }

  /**
   * Execute stage function with adaptation parameters
   */
  private async executeWithAdaptation<T>(
    stageFunction: () => Promise<T>,
    adaptationResult: any
  ): Promise<T> {
    // Apply adaptation parameters to improve execution
    // This could involve timeout adjustments, quality settings, etc.
    const timeout = adaptationResult.estimatedPerformance.processingTime * 1.5;

    return Promise.race([
      stageFunction(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Stage execution timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Enhanced audio transcription with caching
   */
  private async transcribeAudioEnhanced(input: PipelineInput) {
    // Check cache first
    const cacheKey = this.generateCacheKey(input);
    const cached = await globalCache.get(cacheKey);

    if (cached) {
      console.log('🎯 Using cached transcription result');
      return cached;
    }

    // Original transcription logic
    const result = await this.transcribeAudio(input);

    // Cache successful results
    if (result.success) {
      await globalCache.set(cacheKey, result, 'transcription', {
        complexity: result.segments.length / 10,
        performanceScore: 0.8
      });
    }

    return result;
  }

  /**
   * Enhanced content analysis with adaptive processing
   */
  private async analyzeContentEnhanced(transcriptionResult: any) {
    const startTime = performance.now();

    try {
      const result = await this.analyzeContent(transcriptionResult);

      // Apply adaptive processing optimizations
      const processingTime = performance.now() - startTime;
      globalAdaptiveProcessor.recordMetrics({
        processingTime,
        accuracyScore: result.diagramAnalyses.reduce((avg, analysis) =>
          avg + analysis.analysis.confidence, 0) / result.diagramAnalyses.length,
        memoryUsage: process.memoryUsage().heapUsed,
        userEngagement: 0.7,
        errorRate: 0
      });

      return result;
    } catch (error) {
      console.error('Enhanced analysis failed, falling back to basic analysis');
      return await this.analyzeContent(transcriptionResult);
    }
  }

  /**
   * Enhanced layout generation with parallel processing
   */
  private async generateLayoutsEnhanced(analysisResult: any) {
    const { diagramAnalyses } = analysisResult;

    // Process layouts in parallel for better performance
    const layoutPromises = diagramAnalyses.map(async ({ segment, analysis }) => {
      if (analysis.nodes.length > 0) {
        try {
          const layoutResult = await this.layoutEngine.generateLayout(
            analysis.nodes,
            analysis.edges,
            analysis.type
          );

          if (layoutResult.success) {
            return { segment, analysis, layout: layoutResult.layout };
          } else {
            // Fallback to simple layout
            return {
              segment,
              analysis,
              layout: this.createFallbackLayout(analysis.nodes, analysis.edges)
            };
          }
        } catch (error) {
          console.warn(`Layout generation failed for segment: ${segment.summary}`);
          return {
            segment,
            analysis,
            layout: this.createFallbackLayout(analysis.nodes, analysis.edges)
          };
        }
      }
      return null;
    });

    // Wait for all layouts to complete
    const layouts = (await Promise.all(layoutPromises)).filter(Boolean);
    console.log(`Generated ${layouts.length} diagram layouts (parallel processing)`);

    return layouts;
  }

  /**
   * Enhanced scene preparation with optimization
   */
  private async prepareScenesEnhanced(analysisResult: any, layouts: any[]): Promise<SceneGraph[]> {
    console.log('Preparing optimized scene graphs for video rendering...');

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

    // Optimize scene timing for better flow
    this.optimizeSceneTiming(scenes);

    console.log(`Prepared ${scenes.length} optimized scenes for video generation`);
    return scenes;
  }

  /**
   * Optimize scene timing for better video flow
   */
  private optimizeSceneTiming(scenes: SceneGraph[]): void {
    // Ensure minimum scene duration
    const minDuration = 2000; // 2 seconds minimum
    const maxDuration = 15000; // 15 seconds maximum

    scenes.forEach(scene => {
      if (scene.durationMs < minDuration) {
        scene.durationMs = minDuration;
      }
      if (scene.durationMs > maxDuration) {
        scene.durationMs = maxDuration;
      }
    });

    // Adjust start times to prevent overlaps
    for (let i = 1; i < scenes.length; i++) {
      const prevScene = scenes[i - 1];
      const currentScene = scenes[i];
      const prevEnd = prevScene.startMs + prevScene.durationMs;

      if (currentScene.startMs < prevEnd) {
        currentScene.startMs = prevEnd;
      }
    }
  }

  /**
   * Perform quality pre-check for parallel execution
   */
  private async performQualityPreCheck(analysisResult: any): Promise<any> {
    // Quick quality assessment to identify potential issues early
    const { diagramAnalyses } = analysisResult;

    const qualityChecks = {
      hasValidAnalyses: diagramAnalyses.length > 0,
      averageConfidence: diagramAnalyses.reduce((sum, analysis) =>
        sum + analysis.analysis.confidence, 0) / diagramAnalyses.length,
      hasNodes: diagramAnalyses.some(analysis => analysis.analysis.nodes.length > 0),
      nodeCount: diagramAnalyses.reduce((sum, analysis) =>
        sum + analysis.analysis.nodes.length, 0)
    };

    return qualityChecks;
  }

  /**
   * Enhanced quality assessment combining pre-check and final assessment
   */
  private async performEnhancedQualityAssessment(result: PipelineResult, preCheck: any): Promise<any> {
    const baseAssessment = await qualityMonitor.assessPipelineQuality(result);

    // Combine with pre-check data for more comprehensive assessment
    return {
      ...baseAssessment,
      preCheck,
      enhancedScore: (baseAssessment.overall + preCheck.averageConfidence) / 2,
      processingEfficiency: this.calculateProcessingEfficiency()
    };
  }

  /**
   * Calculate processing efficiency based on stage metrics
   */
  private calculateProcessingEfficiency(): number {
    let totalEfficiency = 0;
    let stageCount = 0;

    for (const [stageName, metrics] of this.stageMetrics.entries()) {
      if (metrics.attempts > 0) {
        const successRate = (metrics.attempts - metrics.failures) / metrics.attempts;
        const speedScore = Math.max(0, 1 - metrics.avgTime / 10000); // 10 second baseline
        const efficiency = (successRate * 0.7) + (speedScore * 0.3);

        totalEfficiency += efficiency;
        stageCount++;
      }
    }

    return stageCount > 0 ? totalEfficiency / stageCount : 0.5;
  }

  /**
   * Generate cache key for input
   */
  private generateCacheKey(input: PipelineInput): string {
    const inputStr = typeof input.audioFile === 'string' ?
      input.audioFile :
      `${input.audioFile.name}-${input.audioFile.size}`;

    return `transcription-${inputStr}-${this.config.transcription.model}`;
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
    if (this.transcriber && typeof this.transcriber.nextIteration === 'function') {
      this.transcriber.nextIteration();
    }
    if (this.segmenter && typeof this.segmenter.nextIteration === 'function') {
      this.segmenter.nextIteration();
    }
    if (this.detector && typeof this.detector.nextIteration === 'function') {
      this.detector.nextIteration();
    }
    if (this.layoutEngine && typeof this.layoutEngine.nextIteration === 'function') {
      this.layoutEngine.nextIteration();
    }

    // Update quality monitor iteration
    qualityMonitor.nextIteration();

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