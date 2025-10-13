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
  startTime?: number;
  endTime?: number;
  error?: string;
  result?: any;
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
  /**
   * Optional extended metrics captured during the run
   */
  metrics?: ExtendedPipelineMetrics;
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
}
