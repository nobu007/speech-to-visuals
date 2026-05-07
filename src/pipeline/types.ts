import { SceneGraph, ProcessingStatus } from '@/types/diagram';
import { TranscriptionResult } from '@/transcription/types';
import { ContentSegment, DiagramAnalysis } from '@/analysis/types';
import { LayoutResult } from '@/visualization/types';
import { QualityAssessment } from '@/quality';

export interface PipelineInput {
  audioFile: File | string;
  config?: PipelineConfig;
}

export interface PipelineConfig {
  transcription: {
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language?: string;
  };
  analysis: {
    minSegmentLengthMs: number;
    maxSegmentLengthMs: number;
    confidenceThreshold: number;
  };
  layout: {
    width: number;
    height: number;
    nodeWidth: number;
    nodeHeight: number;
  };
  output: {
    fps: number;
    videoDuration: number;
    includeAudio: boolean;
  };
}

export interface PipelineStage {
  name: string;
  status: ProcessingStatus;
  /** Whether this stage completed successfully */
  success?: boolean;
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: SceneGraph | LayoutResult | ContentSegment[] | TranscriptionResult | unknown;
}

export interface PipelineResult {
  success: boolean;
  scenes: SceneGraph[];
  audioUrl: string;
  duration: number;
  processingTime: number;
  stages: PipelineStage[];
  error?: string;
  qualityAssessment?: QualityAssessment;
  /** Output file path, if generated */
  outputPath?: string;
  /**
   * Optional extended metrics captured during the run
   */
  metrics?: Partial<ExtendedPipelineMetrics>;
}

export interface PipelineMetrics {
  totalProcessingTime: number;
  transcriptionTime: number;
  analysisTime: number;
  layoutTime: number;
  renderTime: number;
  segmentCount: number;
  diagramCount: number;
  successRate: number;
}

/**
 * Extended metrics including LLM-specific quality indicators.
 * All fields are optional to remain backward-compatible with existing pipeline outputs.
 */
export interface ExtendedPipelineMetrics extends PipelineMetrics {
  /** Peak process memory usage in bytes */
  memoryUsage?: number;
  /** Entity extraction F1 score (0.0 - 1.0), if ground truth is available */
  entityExtractionF1Score?: number;
  /** Relation extraction accuracy (0.0 - 1.0), if ground truth is available */
  relationAccuracy?: number;
  /** Layout quality composite score after optimization (0.0~1.0) (REQ-084) */
  layoutQualityScore?: number;
  /** Number of auto-optimization attempts made (0~3) (REQ-084) */
  optimizationAttempts?: number;
  /** Whether auto-optimization improved the layout score (REQ-084) */
  optimizationImproved?: boolean;
  /** Average label overflow score across all layouts (0.0~1.0, higher = less overflow) (REQ-085) */
  labelOverflowScore?: number;
  /** Number of labels that were truncated during sizing (REQ-085) */
  labelTruncationCount?: number;
  /** Per-stage quality scores recorded by QualityMonitor (REQ-088) */
  qualityScores?: StageQualityScores;
}

/** Quality scores per pipeline stage, recorded via QualityMonitor (REQ-088) */
export interface StageQualityScores {
  transcription?: number;
  analysis?: number;
  layout?: number;
  rendering?: number;
}
