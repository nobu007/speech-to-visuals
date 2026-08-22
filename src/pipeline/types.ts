import { SceneGraph, ProcessingStatus } from '@stv/core/types/diagram';
import { TranscriptionResult } from '@/transcription/types';
import { ContentSegment, DiagramAnalysis } from '@/analysis/types';
import { LayoutResult } from '@/visualization/types';
import { QualityAssessment } from '@/quality';
import type { StageTimingRecord, StageTimingReport } from './stage-timing-metrics';
import type { BottleneckReport } from './bottleneck-detector';

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
  /**
   * Peak process memory usage in bytes. MainPipeline populates this on the
   * success path (REQ-387) from the run's memory snapshots + a fresh
   * memory-backend reading; the field is OMITTED when nothing was measured
   * (never 0-as-unmeasured — REQ-383/386 score it as a real reading).
   */
  memoryUsage?: number;
  /**
   * REQ-392: `entityExtractionF1Score` / `relationAccuracy` deleted — the
   * "if ground truth is available" pair had ZERO producers (only tests set
   * them), so assessLLMExtractionQuality's measured branch was a
   * permanently-dead hatch around the REQ-389 canonical-estimator
   * delegation. A real ground-truth producer MAY re-introduce a field here
   * — the optional-metric-producer census (tests/guards) then requires the
   * writer to ship in the same change.
   */
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
  /** Per-stage timing records for bottleneck detection (REQ-097 / TASK-0143) */
  stageTimings?: StageTimingRecord[];
  /** Aggregated timing report (totalDurationMs/totalItemsProcessed/overallThroughputPerMs) — REQ-297 */
  timingReport?: StageTimingReport;
  /** Bottleneck analysis report (REQ-097 / TASK-0143) */
  bottleneckReport?: BottleneckReport;
  /** Total retry attempts across all stages (for observability) */
  totalRetryAttempts?: number;
  /** Per-run recovery report from PipelineRunRecoveryTracker (TASK-0045) */
  recoveryReport?: import('@/quality/pipeline-run-recovery-tracker').RunRecoveryReport;
  /** Structured error classification from ErrorClassifier (REQ-159) */
  classifiedError?: import('@/quality/error-classifier').ClassifiedError;
}

/** Quality scores per pipeline stage, recorded via QualityMonitor (REQ-088) */
export interface StageQualityScores {
  transcription?: number;
  analysis?: number;
  layout?: number;
  rendering?: number;
}
