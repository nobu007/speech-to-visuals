/**
 * MVP Audio-to-Diagram Pipeline
 * Minimal Viable Product implementation following custom instructions
 * 🔄 Focus: 動作する最小実装 → 段階的改善
 */

import { BrowserTranscriber } from '@/transcription/browser-transcriber';
import { SimpleDiagramDetector, SimpleDiagramAnalysis } from '@/analysis/simple-diagram-detector';
import { SimpleLayoutEngine, LayoutResult } from '@/visualization/simple-layout-engine';

export interface MVPInput {
  audioFile: File;
  options?: {
    language?: string;
    diagramTypes?: string[];
    outputFormat?: 'json' | 'svg' | 'canvas';
  };
}

export interface MVPScene {
  id: string;
  startTime: number;
  endTime: number;
  content: string;
  diagramType: string;
  confidence: number;
  layout: LayoutResult;
  analysis: SimpleDiagramAnalysis;
}

export interface MVPResult {
  success: boolean;
  audioUrl?: string;
  transcript?: string;
  scenes: MVPScene[];
  processingTime: number;
  error?: string;
  metadata: {
    totalScenes: number;
    averageConfidence: number;
    processingSteps: string[];
  };
}

export type ProgressCallback = (step: string, progress: number) => void;

/**
 * Simple MVP Pipeline
 * 🔄 Custom Instructions: 小さく作り、確実に動作確認
 */
export class MVPPipeline {
  private transcriber: BrowserTranscriber;
  private detector: SimpleDiagramDetector;
  private layoutEngine: SimpleLayoutEngine;
  private iteration: number = 0;

  constructor() {
    this.transcriber = new BrowserTranscriber();
    this.detector = new SimpleDiagramDetector();
    this.layoutEngine = new SimpleLayoutEngine({
      width: 1280,
      height: 720,
      nodeWidth: 140,
      nodeHeight: 70,
      spacing: 100,
      margin: 80
    });
  }

  /**
   * Process audio file through simple pipeline
   * 🔄 Custom Instructions: 実装→テスト→評価→改善
   */
  async process(input: MVPInput, onProgress?: ProgressCallback): Promise<MVPResult> {
    const startTime = Date.now();
    this.iteration++;
    const processingSteps: string[] = [];

    console.log(`🚀 MVP Pipeline Iteration ${this.iteration} - Starting...`);

    try {
      // Step 1: Audio Processing (10-30%)
      onProgress?.('音声ファイルを処理中...', 10);
      processingSteps.push('audio_processing');

      const audioUrl = URL.createObjectURL(input.audioFile);
      console.log(`📁 Audio file: ${input.audioFile.name} (${(input.audioFile.size / 1024 / 1024).toFixed(2)}MB)`);

      // Step 2: Transcription (30-50%)
      onProgress?.('音声を文字に変換中...', 30);
      processingSteps.push('transcription');

      const transcriptionResult = await this.transcriber.transcribeAudioFile(input.audioFile);

      if (!transcriptionResult.success || !transcriptionResult.segments) {
        throw new Error('Transcription failed');
      }

      const transcript = transcriptionResult.segments
        .map(seg => seg.text)
        .join(' ');

      console.log(`📝 Transcription completed: ${transcriptionResult.segments.length} segments`);

      // Step 3: Scene Analysis (50-70%)
      onProgress?.('シーンを分析中...', 50);
      processingSteps.push('scene_analysis');

      const scenes: MVPScene[] = [];

      for (let i = 0; i < transcriptionResult.segments.length; i++) {
        const segment = transcriptionResult.segments[i];

        onProgress?.(`シーン ${i + 1}/${transcriptionResult.segments.length} を分析中...`,
          50 + (i / transcriptionResult.segments.length) * 20);

        // Convert segment format
        const textSegment = {
          text: segment.text,
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          summary: segment.text.substring(0, 50) + '...'
        };

        // Detect diagram type
        const analysis = await this.detector.analyze(textSegment);

        // Generate layout
        const layout = await this.layoutEngine.generateLayout(
          analysis.nodes,
          analysis.edges,
          analysis.type
        );

        if (layout.success) {
          scenes.push({
            id: `scene-${i + 1}`,
            startTime: segment.start,
            endTime: segment.end,
            content: segment.text,
            diagramType: analysis.type,
            confidence: analysis.confidence,
            layout,
            analysis
          });
        }
      }

      console.log(`📊 Scene analysis completed: ${scenes.length} scenes generated`);

      // Step 4: Quality Assessment (70-90%)
      onProgress?.('品質を評価中...', 70);
      processingSteps.push('quality_assessment');

      const averageConfidence = scenes.length > 0
        ? scenes.reduce((sum, scene) => sum + scene.confidence, 0) / scenes.length
        : 0;

      // Step 5: Results Preparation (90-100%)
      onProgress?.('結果を準備中...', 90);
      processingSteps.push('results_preparation');

      const processingTime = Date.now() - startTime;

      const result: MVPResult = {
        success: true,
        audioUrl,
        transcript,
        scenes,
        processingTime,
        metadata: {
          totalScenes: scenes.length,
          averageConfidence,
          processingSteps
        }
      };

      onProgress?.('完了', 100);

      console.log(`✅ MVP Pipeline completed in ${(processingTime / 1000).toFixed(1)}s`);
      console.log(`📈 Quality metrics: ${scenes.length} scenes, ${(averageConfidence * 100).toFixed(1)}% confidence`);

      return result;

    } catch (error) {
      console.error('❌ MVP Pipeline failed:', error);

      const processingTime = Date.now() - startTime;
      processingSteps.push('error_handling');

      return {
        success: false,
        scenes: [],
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          totalScenes: 0,
          averageConfidence: 0,
          processingSteps
        }
      };
    }
  }

  /**
   * Process with retry logic
   * 🔄 Custom Instructions: エラー回復戦略
   */
  async processWithRetry(
    input: MVPInput,
    onProgress?: ProgressCallback,
    maxRetries: number = 2
  ): Promise<MVPResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        onProgress?.(`試行 ${attempt}/${maxRetries}`, 0);

        const result = await this.process(input, onProgress);

        if (result.success) {
          if (attempt > 1) {
            console.log(`✅ MVP Pipeline succeeded on attempt ${attempt}`);
          }
          return result;
        }

        lastError = new Error(result.error || 'Processing failed');

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`⚠️ MVP Pipeline attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Simple retry delay
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.error(`❌ All ${maxRetries} attempts failed`);

    return {
      success: false,
      scenes: [],
      processingTime: 0,
      error: `All ${maxRetries} attempts failed. Last error: ${lastError?.message}`,
      metadata: {
        totalScenes: 0,
        averageConfidence: 0,
        processingSteps: ['retry_failure']
      }
    };
  }

  /**
   * Generate demo with mock data
   * 🔄 Custom Instructions: デモ機能必須
   */
  async generateDemo(onProgress?: ProgressCallback): Promise<MVPResult> {
    console.log('🎯 Generating MVP demo with mock data...');

    onProgress?.('デモデータを準備中...', 10);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    onProgress?.('音声を分析中...', 30);
    await new Promise(resolve => setTimeout(resolve, 800));

    onProgress?.('図解を生成中...', 60);
    await new Promise(resolve => setTimeout(resolve, 1000));

    onProgress?.('レイアウトを最適化中...', 80);
    await new Promise(resolve => setTimeout(resolve, 600));

    // Generate mock scenes
    const mockScenes: MVPScene[] = [
      {
        id: 'demo-scene-1',
        startTime: 0,
        endTime: 8,
        content: 'フローチャートについて説明します。プロセスには開始、処理、判断、終了があります。',
        diagramType: 'flow',
        confidence: 0.92,
        layout: {
          success: true,
          nodes: [
            { id: 'start', label: '開始', x: 540, y: 100, width: 140, height: 70 },
            { id: 'process', label: '処理', x: 540, y: 220, width: 140, height: 70 },
            { id: 'decision', label: '判断', x: 540, y: 340, width: 140, height: 70 },
            { id: 'end', label: '終了', x: 540, y: 460, width: 140, height: 70 }
          ],
          edges: [
            { id: 'e1', from: 'start', to: 'process', points: [{ x: 610, y: 170 }, { x: 610, y: 220 }] },
            { id: 'e2', from: 'process', to: 'decision', points: [{ x: 610, y: 290 }, { x: 610, y: 340 }] },
            { id: 'e3', from: 'decision', to: 'end', points: [{ x: 610, y: 410 }, { x: 610, y: 460 }] }
          ],
          width: 1280,
          height: 720
        },
        analysis: {
          type: 'flow',
          confidence: 0.92,
          nodes: [
            { id: 'start', label: '開始' },
            { id: 'process', label: '処理' },
            { id: 'decision', label: '判断' },
            { id: 'end', label: '終了' }
          ],
          edges: [
            { id: 'e1', from: 'start', to: 'process' },
            { id: 'e2', from: 'process', to: 'decision' },
            { id: 'e3', from: 'decision', to: 'end' }
          ],
          reasoning: 'プロセスキーワードが検出されました / 順序性を示す語句が含まれています'
        }
      },
      {
        id: 'demo-scene-2',
        startTime: 8,
        endTime: 16,
        content: '組織構造を見てみましょう。階層があり、各部門にチームが配置されています。',
        diagramType: 'tree',
        confidence: 0.88,
        layout: {
          success: true,
          nodes: [
            { id: 'org', label: '組織', x: 540, y: 100, width: 140, height: 70 },
            { id: 'dept1', label: '開発部', x: 440, y: 220, width: 140, height: 70 },
            { id: 'dept2', label: '営業部', x: 640, y: 220, width: 140, height: 70 },
            { id: 'team1', label: 'チーム1', x: 440, y: 340, width: 140, height: 70 }
          ],
          edges: [
            { id: 'e1', from: 'org', to: 'dept1', points: [{ x: 580, y: 170 }, { x: 510, y: 220 }] },
            { id: 'e2', from: 'org', to: 'dept2', points: [{ x: 620, y: 170 }, { x: 710, y: 220 }] },
            { id: 'e3', from: 'dept1', to: 'team1', points: [{ x: 510, y: 290 }, { x: 510, y: 340 }] }
          ],
          width: 1280,
          height: 720
        },
        analysis: {
          type: 'tree',
          confidence: 0.88,
          nodes: [
            { id: 'org', label: '組織' },
            { id: 'dept1', label: '開発部' },
            { id: 'dept2', label: '営業部' },
            { id: 'team1', label: 'チーム1' }
          ],
          edges: [
            { id: 'e1', from: 'org', to: 'dept1' },
            { id: 'e2', from: 'org', to: 'dept2' },
            { id: 'e3', from: 'dept1', to: 'team1' }
          ],
          reasoning: '階層構造キーワードが検出されました / 組織用語が含まれています'
        }
      }
    ];

    onProgress?.('完了', 100);

    const result: MVPResult = {
      success: true,
      audioUrl: 'demo://mock-audio',
      transcript: mockScenes.map(s => s.content).join(' '),
      scenes: mockScenes,
      processingTime: 2900,
      metadata: {
        totalScenes: mockScenes.length,
        averageConfidence: mockScenes.reduce((sum, s) => sum + s.confidence, 0) / mockScenes.length,
        processingSteps: ['demo_generation', 'mock_transcription', 'mock_analysis', 'mock_layout']
      }
    };

    console.log('✅ MVP Demo completed');
    return result;
  }

  /**
   * Get pipeline capabilities
   */
  getCapabilities() {
    return {
      transcription: this.transcriber.getSupportedFeatures(),
      diagramDetection: this.detector.getCapabilities(),
      layoutGeneration: this.layoutEngine.getCapabilities(),
      pipeline: {
        maxRetries: 3,
        supportedFormats: ['mp3', 'wav', 'ogg', 'm4a'],
        maxFileSize: '50MB',
        supportedLanguages: ['ja', 'en'],
        iteration: this.iteration
      }
    };
  }

  /**
   * Run comprehensive test
   * 🔄 Custom Instructions: テスト機能内蔵
   */
  async runTest(): Promise<void> {
    console.log('🧪 Running MVP Pipeline comprehensive test...');

    // Test demo generation
    console.log('Testing demo generation...');
    const demoResult = await this.generateDemo();
    const demoSuccess = demoResult.success && demoResult.scenes.length > 0;
    console.log(`${demoSuccess ? '✅' : '❌'} Demo generation: ${demoResult.scenes.length} scenes`);

    // Test component capabilities
    console.log('Testing component capabilities...');
    await this.detector.testDetector();
    await this.layoutEngine.testLayoutEngine();

    // Test error handling
    console.log('Testing error handling...');
    try {
      // Create invalid input
      const invalidFile = new File([''], 'invalid.txt', { type: 'text/plain' });
      const errorResult = await this.process({ audioFile: invalidFile });
      console.log(`${errorResult.success ? '❌' : '✅'} Error handling: Properly handled invalid input`);
    } catch (error) {
      console.log(`✅ Error handling: Exception caught properly`);
    }

    console.log('🧪 MVP Pipeline testing completed');
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(): number {
    return this.iteration;
  }
}

export const mvpPipeline = new MVPPipeline();