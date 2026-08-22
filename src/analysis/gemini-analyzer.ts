/**
 * Phase 26: Gemini Analyzer - Enhanced Relationship Extraction
 *
 * Evolution:
 * - Phase 19: Adaptive model selection
 * - Phase 22-23: Unified LLMService architecture
 * - Phase 26: Advanced prompt engineering for superior relationship accuracy
 *
 * Key Improvements (Phase 26):
 * - Enhanced prompt with multi-stage reasoning (think → extract → validate)
 * - Explicit examples for relationship patterns (cause→effect, sequence, hierarchy)
 * - Chain-of-thought prompting for complex relationship inference
 * - Validation rules embedded in prompt for self-correction
 * - Edge case handling (implicit relationships, bidirectional connections)
 *
 * Target Metrics:
 * - Relationship extraction accuracy: 85% → 92% (target +7%)
 * - Edge completeness: 70% → 88% (target +18%)
 * - False positive rate: <5% (maintained)
 * - Processing time: <10s (95th percentile, maintained)
 *
 * Benefits:
 * - Reduced code complexity (437 lines → ~150 lines, 65% reduction)
 * - Shared cache with ContentAnalyzer and future analyzers
 * - Consistent retry and error handling
 * - Unified performance metrics across all LLM operations
 * - Single source of truth for rate limiting
 */

import 'dotenv/config';
import type { DiagramType, NodeDatum, EdgeDatum } from "@stv/core/types/diagram";
import type { DiagramAnalysis, DiagramData } from "./types";
import { parseJsonFromLLMText } from "./llm-utils";
import { DEFAULT_RETRY_OPTIONS } from "./retry-strategy";
import { LLMService, llmService } from "./llm-service";
import { getQualityMonitor } from "@/pipeline/quality-monitor";
import { scoreNodeDensity } from "@/pipeline/quality-estimators";
import { getGeminiAnalyzerPrompt, type Language } from "./prompt-templates";
import { DiagramStructureError } from "./analysis-errors";
import { buildContentCacheKey } from "./cache-key";
import { logger } from '@stv/core/utils/logger';

type GeminiDiagramType = DiagramData['type'];

// PHASE 46 ENHANCEMENT: Added matrix and cycle type mappings
const typeMap: Record<GeminiDiagramType, DiagramType> = {
  flowchart: "flow",
  mindmap: "tree",
  timeline: "timeline",
  orgchart: "tree",
  matrix: "matrix", // NEW: Direct mapping for matrix type
  cycle: "cycle", // NEW: Direct mapping for cycle type
};

const INITIAL_LLM_CONFIDENCE = 0.9;

/**
 * Cache-key version tag for GeminiAnalyzer results. Bump when the analyzer
 * prompt or output schema changes so stale cached analyses are invalidated.
 */
export const GEMINI_ANALYZER_CACHE_VERSION = 'v26';

/**
 * Build the LLM cache key for a given analysis text.
 *
 * Delegates to the canonical `buildContentCacheKey` (src/analysis/cache-key.ts)
 * — the single source of truth for the "scope + FULL text" caller-side keying
 * pattern consumed by LLMService → LLMCache. The key incorporates the FULL text,
 * never a truncated prefix: two inputs that differ only past the first N
 * characters must NOT share a key, or the cache returns the wrong analysis for
 * the second input. LLMService forwards this key to LLMCache, which hashes it
 * (sha256) before storage, so using the full text here carries no memory cost.
 * See cache-key.ts for the cross-layer recurrence this centralization closes.
 */
export function buildAnalyzerCacheKey(text: string): string {
  return buildContentCacheKey(`gemini-analyzer-${GEMINI_ANALYZER_CACHE_VERSION}`, text);
}

/**
 * GeminiAnalyzer: Specialized analyzer for diagram structure extraction
 * Now powered by unified LLMService for consistency and performance
 */
export class GeminiAnalyzer {
  private llmService: LLMService;
  private preferredLanguage: Language;

  constructor(apiKey?: string, llmServiceInstance?: LLMService, preferredLanguage: Language = 'auto') {
    // Use provided LLMService or create new one (for testing)
    // Default to singleton llmService for shared caching
    this.llmService = llmServiceInstance || (apiKey ? new LLMService(apiKey) : llmService);
    this.preferredLanguage = preferredLanguage;
  }

  isEnabled(): boolean {
    return this.llmService.isEnabled();
  }

  /**
   * Phase 32: Set preferred language for prompts
   */
  setLanguage(language: Language): void {
    this.preferredLanguage = language;
  }


  /**
   * Phase 26: Detect cycles in edge graph (for quality assessment)
   */
  private detectCycles(edges: EdgeDatum[], nodeIds: Set<string>): boolean {
    if (edges.length === 0) return false;

    const graph = new Map<string, string[]>();
    for (const node of nodeIds) {
      graph.set(node, []);
    }
    for (const edge of edges) {
      graph.get(edge.from)?.push(edge.to);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycleDFS = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      for (const neighbor of graph.get(node) || []) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of nodeIds) {
      if (!visited.has(node)) {
        if (hasCycleDFS(node)) return true;
      }
    }

    return false;
  }

  /**
   * Phase 26: Find disconnected nodes (isolated nodes with no edges)
   */
  private findDisconnectedNodes(nodes: NodeDatum[], edges: EdgeDatum[]): string[] {
    const connectedNodes = new Set<string>();
    for (const edge of edges) {
      connectedNodes.add(edge.from);
      connectedNodes.add(edge.to);
    }
    return nodes.filter(n => !connectedNodes.has(n.id)).map(n => n.id);
  }

  /**
   * Phase 26: Create enhanced parser with relationship quality validation
   */
  private createEnhancedParser(): (responseText: string) => DiagramAnalysis {
    return (responseText: string): DiagramAnalysis => {
      // Log response for debugging (first 200 chars)

      const parsed = parseJsonFromLLMText<DiagramData>(responseText);

      // Validate parsed data structure (edges may be missing in truncated responses)
      if (!parsed || !parsed.type || !Array.isArray(parsed.nodes)) {
        throw new DiagramStructureError('Invalid diagram data structure from LLM');
      }

      // Normalize missing or invalid edges array
      if (!parsed.edges || !Array.isArray(parsed.edges)) {
        logger.warn('Missing edges field in LLM response, defaulting to empty array');
        parsed.edges = [];
      }

      const mappedType: DiagramType = typeMap[parsed.type] ?? "flow";

      // Filter nodes with valid id and label fields
      const rawNodes: NodeDatum[] = (parsed.nodes || [])
        .filter((n): n is { id: string; label: string } =>
          n != null && typeof n.id === 'string' && n.id.length > 0 && typeof n.label === 'string'
        )
        .map((n) => ({ id: n.id, label: n.label }));

      // Deduplicate nodes by id (first occurrence wins)
      const seenIds = new Set<string>();
      const nodes: NodeDatum[] = [];
      for (const node of rawNodes) {
        if (seenIds.has(node.id)) {
          logger.warn(`Phase 26: Duplicate node id "${node.id}" — keeping first occurrence`);
          continue;
        }
        seenIds.add(node.id);
        nodes.push(node);
      }

      const rawEdges: EdgeDatum[] = (parsed.edges || []).map((e) => ({ from: e.from, to: e.to, label: e.label }));

      // Filter and deduplicate edges
      const nodeIds = new Set(nodes.map(n => n.id));
      const seenEdgeKeys = new Set<string>();
      const validEdges = rawEdges.filter(e => {
        // Reject self-loops
        if (e.from === e.to) {
          logger.warn(`Phase 26: Self-loop edge "${e.from}→${e.to}" filtered`);
          return false;
        }
        // Validate edge references existing nodes
        if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) {
          logger.warn(`Phase 26: Invalid edge ${e.from}→${e.to} (node not found)`);
          return false;
        }
        // Deduplicate edges by (from, to) pair
        const key = `${e.from}->${e.to}`;
        if (seenEdgeKeys.has(key)) {
          logger.warn(`Phase 26: Duplicate edge ${e.from}→${e.to} — keeping first occurrence`);
          return false;
        }
        seenEdgeKeys.add(key);
        return true;
      });

      // Calculate relationship quality metrics
      const edgeRatio = nodes.length > 1 ? validEdges.length / (nodes.length - 1) : 0;
      const hasCycles = this.detectCycles(validEdges, nodeIds);
      const disconnectedNodes = this.findDisconnectedNodes(nodes, validEdges);

      // Adjust confidence based on relationship quality
      let confidence = INITIAL_LLM_CONFIDENCE;
      if (edgeRatio < 0.5 && nodes.length > 2) {
        confidence -= 0.1; // Penalty for sparse relationships
      }
      if (disconnectedNodes.length > nodes.length * 0.3) {
        confidence -= 0.1; // Penalty for too many isolated nodes
      }
      // Penalty for unexpected cycles. A cyclic edge graph in a non-'cycle'
      // diagram type signals structural extraction noise. The 'cycle' type is
      // exempt because a closed loop (last node → first node) is its intended
      // structure (see diagram-content-generation: createCircularEdge).
      if (hasCycles && mappedType !== 'cycle') {
        confidence -= 0.1; // Penalty for unexpected cyclic relationships
      }


      // Phase 27: Record relationship extraction quality.
      //
      // entityExtractionF1 delegates to the canonical density→score scale
      // (scoreNodeDensity, shared with the pipeline-side estimator) instead
      // of the previous `nodes.length > 0 ? 0.85 : 0.3`: that fabricated
      // 0.85 exceeded the 0.80 entity threshold on EVERY non-empty
      // extraction, so this gate was permanently green while a singleton
      // (0.70) or over-dense (>10 → 0.50) extraction — real quality
      // signals — went unreported. `nodes.length` is the density input:
      // the LLM detection sample is one diagram's worth of entities.
      // Nothing extracted at all is a hard 0 (below every threshold),
      // not scoreNodeDensity(0) — the mapping's 0.50 is for degenerate
      // densities, not empty extractions.
      const qualityMonitor = getQualityMonitor();
      qualityMonitor.recordMetrics({
        entityExtractionF1: nodes.length > 0 ? scoreNodeDensity(nodes.length) : 0,
        relationshipAccuracy: confidence,
        edgeCompleteness: edgeRatio,
        edgeRatioQuality: edgeRatio,
        errorCount: 0,
        warningCount: disconnectedNodes.length > 0 ? 1 : 0,
        fallbackTriggered: false,
      });

      return {
        type: mappedType,
        confidence: Math.max(0.5, confidence), // Minimum confidence 0.5
        nodes,
        edges: validEdges,
        reasoning: `LLM 解析結果 (Phase 26強化版: ${validEdges.length}関係性抽出, 品質スコア${(confidence*100).toFixed(0)}%)`,
      };
    };
  }

  /**
   * Phase 26: Analyze text and extract diagram structure with enhanced relationship extraction
   * Uses LLMService for all LLM operations with adaptive model selection
   */
  async analyzeText(text: string, timeoutMs?: number): Promise<DiagramAnalysis | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Phase 32: Use adaptive multilingual prompts
    const prompt = getGeminiAnalyzerPrompt(text, this.preferredLanguage);

    // Use enhanced parser with quality validation
    const parser = this.createEnhancedParser();

    // Use LLMService with custom parser
    // LLMService handles: caching, complexity analysis, model selection, retry, fallback
    const response = await this.llmService.execute<DiagramAnalysis>({
      prompt,
      context: text,
      options: {
        temperature: 0.1, // Very low temperature for consistent, deterministic outputs
        maxOutputTokens: 2048, // Increased to prevent truncation
        timeout: timeoutMs,
        cacheKey: buildAnalyzerCacheKey(text), // full-text key (no truncation → no collision)
        maxRetries: DEFAULT_RETRY_OPTIONS.maxRetries
      },
      parser
    });

    if (response.success && response.data) {

      return response.data;
    } else {
      logger.warn(`GeminiAnalyzer: LLMService failed - ${response.error}`);
      return null;
    }
  }

  /**
   * Get cache statistics and performance metrics
   * Phase 23: Delegates to unified LLMService for consistent reporting
   */
  getCacheStats() {
    const stats = this.llmService.getStats();

    // Map LLMServiceStats to legacy format for backward compatibility
    return {
      // Cache stats
      hits: stats.cacheHits,
      misses: stats.cacheMisses,
      size: stats.cacheHits + stats.cacheMisses,

      // Performance stats
      totalRequests: stats.totalRequests,
      adaptiveTimeout: {
        // REQ-391: the LIVE gate value for the next request (P95×buffer
        // clamped to [15s, 60s]; 30000 default with no history yet) — the
        // former frozen 30000 stand-in stayed at the default forever.
        currentTimeoutMs: this.llmService.getAdaptiveTimeout(),
        avgResponseTimeMs: stats.performance.avgResponseTime,
        p50ResponseTimeMs: stats.performance.p50,
        p95ResponseTimeMs: stats.performance.p95,
        p99ResponseTimeMs: stats.performance.p99,
        historySamples: stats.totalRequests
      },

      // Phase 23: Model selection metrics (unified from LLMService)
      modelSelection: {
        totalRequests: stats.totalRequests,
        flashRequests: stats.modelUsage.flash,
        proRequests: stats.modelUsage.pro,
        flashUsagePercent: stats.modelUsage.flashPercent,
        complexityOverrides: 0, // LLMService tracks fallbackRate instead
        overrideRate: stats.reliability.fallbackRate,
        avgFlashResponseTimeMs: stats.performance.avgFlashTime,
        avgProResponseTimeMs: stats.performance.avgProTime,
        estimatedTimeSavings: stats.timeSavings
      }
    };
  }
}
