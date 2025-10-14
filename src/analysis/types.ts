import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';
import { TranscriptionSegment } from '@/transcription/types';

export interface ContentSegment {
  startMs: number;
  endMs: number;
  text: string;
  summary: string;
  keyphrases: string[];
  confidence: number;
}

export interface DiagramAnalysis {
  type: DiagramType;
  confidence: number;
  nodes: NodeDatum[];
  edges: EdgeDatum[];
  reasoning: string;
}

export interface SceneAnalysisResult {
  segments: ContentSegment[];
  diagrams: DiagramAnalysis[];
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface AnalysisConfig {
  minSegmentLengthMs: number;
  maxSegmentLengthMs: number;
  confidenceThreshold: number;
  keywordDensityThreshold: number;
  enableSemanticAnalysis: boolean;
}

export interface KeywordAnalysis {
  term: string;
  frequency: number;
  importance: number;
  context: string[];
}

export interface SemanticRelation {
  subject: string;
  relation: string;
  object: string;
  confidence: number;
}

// PHASE 46 ENHANCEMENT: Added matrix and cycle types
export interface DiagramData {
  title?: string;
  type: "flowchart" | "mindmap" | "timeline" | "orgchart" | "matrix" | "cycle";
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label?: string }[];
}