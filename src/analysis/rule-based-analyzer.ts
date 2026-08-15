/**
 * TASK-0022: Rule-Based V1 Fallback Analyzer
 *
 * Final fallback when all LLM layers fail.
 * Splits text into sentences and generates a sequential (flow) diagram.
 * Guarantees 100% success rate - never throws, always returns a result.
 */

import type { NodeDatum, EdgeDatum, DiagramType } from '@/types/diagram';
import { logger } from '@/utils/logger';
import { SENTENCE_BOUNDARY_REGEX } from './sentence-boundaries';

/**
 * Scene segment for input
 */
export interface SceneSegment {
  text: string;
  startMs?: number;
  endMs?: number;
}

/**
 * Analysis result from the rule-based analyzer
 */
export interface RuleBasedAnalysisResult {
  diagramType: DiagramType;
  entities: NodeDatum[];
  relations: EdgeDatum[];
  summary: string;
  confidence: number;
}

const MAX_LABEL_LENGTH = 20;
const MIN_SENTENCE_LENGTH = 3;
const DEFAULT_CONFIDENCE = 0.5;

/**
 * Split text into sentences
 * Splits on: Japanese period (。), English period+space, question marks, exclamation marks, newlines
 * Removes empty and very short sentences (< 3 chars)
 */
export function splitSentences(text: string): string[] {
  // Sentence boundaries come from sentence-boundaries.ts (round 21) — same
  // membership this function already had (it was the fullest of the seven
  // hand-rolled shapes), now spelled once. Outcome-equivalent for every
  // input: 。 singly vs in a run, and `\.\s+|\.$` vs `\.(?:\s+|$)` give the
  // same fragments after trim/filter.
  return text
    .split(SENTENCE_BOUNDARY_REGEX)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SENTENCE_LENGTH);
}

/**
 * Create node data from sentences
 * Each sentence becomes a node with:
 * - id: `node-{index}`
 * - label: first 20 chars of sentence (truncated with '...' if longer)
 */
export function createNodesFromSentences(sentences: string[]): NodeDatum[] {
  return sentences.map((sentence, index) => {
    const label =
      sentence.length > MAX_LABEL_LENGTH
        ? sentence.slice(0, MAX_LABEL_LENGTH) + '...'
        : sentence;

    return {
      id: `node-${index}`,
      label,
      meta: {
        category: 'concept',
      },
    };
  });
}

/**
 * Generate sequential (flow) diagram from nodes
 * Creates edges between adjacent nodes: node-0 → node-1, node-1 → node-2, ...
 */
export function generateSequentialDiagram(nodes: NodeDatum[]): RuleBasedAnalysisResult {
  const relations: EdgeDatum[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    relations.push({
      from: nodes[i].id,
      to: nodes[i + 1].id,
      id: `edge-${i}`,
    });
  }

  return {
    diagramType: 'flow',
    entities: nodes,
    relations,
    summary: nodes.length > 0 ? nodes[0].label : '',
    confidence: DEFAULT_CONFIDENCE,
  };
}

/**
 * Check if Gemini is disabled via environment variable (ISS-022: browser-safe)
 */
export function isDisabledGemini(): boolean {
  try {
    return (typeof process !== 'undefined' && process.env)
      ? process.env.ANALYSIS_DISABLE_GEMINI === '1'
      : false;
  } catch (err) {
    logger.warn('[rule-based-analyzer] process.env access failed in isDisabledGemini', err);
    return false;
  }
}

/**
 * RuleBasedAnalyzer class
 *
 * Main entry point for rule-based diagram analysis.
 * Always returns a result - guarantees 100% success rate.
 */
export class RuleBasedAnalyzer {
  /**
   * Analyze text or segments and generate a sequential flow diagram.
   * Never throws - always returns a valid result.
   */
  analyze(input: string | SceneSegment[]): RuleBasedAnalysisResult {
    try {
      const text = this.extractText(input);

      if (!text || text.trim().length === 0) {
        return this.emptyResult();
      }

      const sentences = splitSentences(text);

      if (sentences.length === 0) {
        return this.emptyResult();
      }

      const nodes = createNodesFromSentences(sentences);
      return generateSequentialDiagram(nodes);
    } catch (err) {
      // Never throw - return empty result on any unexpected error
      logger.error('[RuleBasedAnalyzer] Unexpected error during analysis:', err instanceof Error ? err.message : String(err));
      return this.emptyResult();
    }
  }

  private extractText(input: string | SceneSegment[]): string {
    if (typeof input === 'string') {
      return input;
    }

    // Concatenate all segment texts
    return input
      .map((segment) => segment.text)
      .filter(Boolean)
      .join(' ');
  }

  private emptyResult(): RuleBasedAnalysisResult {
    return {
      diagramType: 'flow',
      entities: [],
      relations: [],
      summary: '',
      confidence: DEFAULT_CONFIDENCE,
    };
  }
}

/**
 * Singleton instance
 */
export const ruleBasedAnalyzer = new RuleBasedAnalyzer();
