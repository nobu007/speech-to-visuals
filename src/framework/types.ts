/**
 * Framework Types for Custom Instructions Implementation
 * Following the exact interface definitions from custom instructions
 */

export interface DevelopmentCycle {
  phase: string;
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: 'on_success' | 'on_checkpoint' | 'on_review';
}

export interface QualityReport {
  timestamp: Date;
  phase: string;
  checks: ModuleCheck[];
}

export interface ModuleCheck {
  module: string;
  passed: boolean;
  issues: Issue[];
  score: number;
}

export interface Issue {
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface QualityMetrics {
  transcriptionAccuracy: number;
  sceneSegmentationF1: number;
  layoutOverlap: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface Resolution {
  type: 'fix' | 'rollback' | 'optimize' | 'fallback';
  description: string;
  success: boolean;
  timeElapsed: number;
}

export interface Context {
  phase: string;
  iteration: number;
  lastWorkingState: string;
  errorCount: number;
  startTime: number;
}

export interface AnalysisIteration {
  version: number;
  approach: 'rule-based' | 'statistical' | 'hybrid';
  accuracy: number;
  improvements: string[];
}

export interface TranscriptionResult {
  success: boolean;
  captions: any[];
  metrics: {
    duration: number;
    captionCount: number;
    avgConfidence: number;
  };
  needsIteration?: boolean;
}

export interface DiagramType {
  type: 'flowchart' | 'hierarchy' | 'network' | 'sequence' | 'other';
  confidence: number;
  subtype?: string;
}

export interface MVPCriteria {
  functional: {
    audioInput: boolean;
    autoTranscription: boolean;
    sceneSegmentation: boolean;
    diagramDetection: boolean;
    layoutGeneration: boolean;
    videoOutput: boolean;
  };
  quality: {
    successRate: number;
    avgProcessingTime: number;
    outputQuality: string;
  };
  usability: {
    webUI: boolean;
    errorDisplay: string;
    progressDisplay: string;
  };
}

export interface ImprovementMetrics {
  focus: string;
  target: string;
  currentValue?: number;
  targetValue?: number;
}

export interface WeeklyTargets {
  week_1: ImprovementMetrics;
  week_2: ImprovementMetrics;
  week_3: ImprovementMetrics;
  week_4: ImprovementMetrics;
}