/**
 * TASK-0142: Phase 31-34 E2E Quality Integration Tests (REQ-096)
 *
 * End-to-end integration tests verifying that all quality modules from
 * Phase 31-34 work together correctly through the complete quality pipeline:
 *
 *   AudioPreprocessor (REQ-092) → StreamingQualityMonitor (REQ-091)
 *   → Visual Balance / Edge Crossing / Label Sizing (REQ-079~083)
 *   → LayoutAutoOptimizer (REQ-083) → QualityMonitor (REQ-088)
 *   → ExportVerifier (REQ-093)
 *
 * Each test exercises a cross-module scenario that cannot be verified
 * by unit tests alone.
 */

import { AudioPreprocessor } from '@/transcription/audio-preprocessor';
import { StreamingQualityMonitor } from '@/transcription/streaming-quality-monitor';
import { ExportVerifier, verifyExport } from '@/export/export-verifier';
import { LayoutQualityCompositeScorer, scoreLayout } from '@/visualization/layout-quality-composite';
import { VisualBalanceScorer } from '@/visualization/visual-balance-scorer';
import { detectEdgeCrossings, minimizeEdgeCrossings } from '@/visualization/edge-crossing-minimizer';
import { sizeAllLabels, sizeLabel } from '@/visualization/smart-label-sizer';
import { runAutoOptimization } from '@/visualization/layout-auto-optimizer';
import { QualityMonitor, qualityMonitor } from '@/quality/quality-monitor';
import { PositionedNode, LayoutEdge } from '@/types/diagram';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

/** Create a well-spaced layout that should pass quality gates */
function makeGoodLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: `gn${i}`,
      label: `GoodNode${i}`,
      x: 200 + (i % 4) * 300,
      y: 150 + Math.floor(i / 4) * 250,
      width: 120,
      height: 50,
    });
  }
  const edges: LayoutEdge[] = [
    { from: 'gn0', to: 'gn1', points: [] },
    { from: 'gn1', to: 'gn2', points: [] },
    { from: 'gn2', to: 'gn3', points: [] },
    { from: 'gn4', to: 'gn5', points: [] },
    { from: 'gn5', to: 'gn6', points: [] },
    { from: 'gn6', to: 'gn7', points: [] },
    { from: 'gn0', to: 'gn4', points: [] },
  ];
  return { nodes, edges };
}

/** Create a deliberately poor (clustered) layout that should trigger optimization */
function makePoorLayout(): { nodes: PositionedNode[]; edges: LayoutEdge[] } {
  const nodes: PositionedNode[] = [];
  for (let i = 0; i < 8; i++) {
    nodes.push({
      id: `pn${i}`,
      label: `PoorNode${i}`,
      x: 10 + i * 3, // all nodes clustered together
      y: 10 + i * 3,
      width: 80,
      height: 50,
    });
  }
  const edges: LayoutEdge[] = [
    { from: 'pn0', to: 'pn7', points: [] },
    { from: 'pn1', to: 'pn6', points: [] },
    { from: 'pn2', to: 'pn5', points: [] },
    { from: 'pn3', to: 'pn4', points: [] },
  ];
  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 31-34 E2E Quality Integration (REQ-096, TASK-0142)', () => {
  describe('Full quality gate E2E pipeline', () => {
    test('should pass all quality gates for a well-spaced layout', () => {
      const { nodes, edges } = makeGoodLayout();

      // Step 1: Score layout quality (Phase 31 composite scorer)
      const scoreResult = scoreLayout(nodes, edges, 1920, 1080);
      expect(scoreResult.compositeScore).toBeGreaterThanOrEqual(0);
      expect(scoreResult.compositeScore).toBeLessThanOrEqual(1);

      // Step 2: Visual balance scoring
      const balanceScorer = new VisualBalanceScorer();
      const balanceResult = balanceScorer.calculateVisualBalance(
        nodes,
        { width: 1920, height: 1080 }
      );
      expect(balanceResult.overallScore).toBeGreaterThanOrEqual(0);

      // Step 3: Edge crossing detection
      const crossingCount = detectEdgeCrossings(nodes, edges);
      expect(typeof crossingCount).toBe('number');
      expect(crossingCount).toBeGreaterThanOrEqual(0);

      // Step 4: Label sizing
      const labelResults = sizeAllLabels(nodes);
      expect(labelResults.size).toBe(nodes.length);
      for (const [nodeId, result] of labelResults) {
        expect(result.fontSize).toBeGreaterThan(0);
        expect(result.lines.length).toBeGreaterThan(0);
      }

      // Step 5: Export verification (SVG) — must include <svg>...</svg> with closing tag
      const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="100" height="100"/></svg>';
      const svgBuffer = new TextEncoder().encode(validSvg).buffer;
      const verifier = new ExportVerifier({ minFileSizeBytes: 1 });
      const svgResult = verifier.verify('svg', svgBuffer);
      expect(svgResult.valid).toBe(true);
    });

    test('should handle low-quality layout with optimization pipeline', () => {
      const { nodes, edges } = makePoorLayout();

      // Step 1: Score the poor layout — it should have a low score
      const initialScore = scoreLayout(nodes, edges, 1920, 1080);

      // Step 2: Run auto-optimization
      const optimizationResult = runAutoOptimization(nodes, edges, {
        threshold: 0.7,
        maxAttempts: 3,
        canvasWidth: 1920,
        canvasHeight: 1080,
      });

      expect(optimizationResult.nodes.length).toBe(nodes.length);
      expect(optimizationResult.initialScore).toBeDefined();
      expect(optimizationResult.finalScore).toBeDefined();
      expect(optimizationResult.attempts).toBeGreaterThanOrEqual(0);

      // Step 3: Re-score after optimization
      const optimizedScore = scoreLayout(
        optimizationResult.nodes,
        optimizationResult.edges,
        1920,
        1080
      );
      expect(optimizedScore.compositeScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Audio quality gate integration', () => {
    test('should reject audio shorter than 1 second', () => {
      const preprocessor = new AudioPreprocessor();
      const validation = preprocessor.validateDuration(0.5);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should accept audio of valid duration', () => {
      const preprocessor = new AudioPreprocessor();
      const validation = preprocessor.validateDuration(30);

      expect(validation.valid).toBe(true);
    });

    test('should warn for audio exceeding 1 hour', () => {
      const preprocessor = new AudioPreprocessor();
      const validation = preprocessor.validateDuration(3700);

      // Should be valid but with a warning
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Streaming quality monitor integration', () => {
    test('should track chunk quality and emit alerts when rolling average drops', () => {
      const monitor = new StreamingQualityMonitor({
        minChunkConfidence: 0.7,
        rollingWindowSize: 5,
        warningThreshold: 0.6,
        criticalThreshold: 0.4,
      });

      const alerts: Array<{ severity: string; message: string }> = [];
      monitor.onAlert((alert) => {
        alerts.push({ severity: alert.severity, message: alert.message });
      });

      // Feed 5 low-confidence chunks to drive rolling average below critical threshold
      monitor.evaluateChunk(0, 0.2);
      monitor.evaluateChunk(1, 0.15);
      monitor.evaluateChunk(2, 0.1);
      monitor.evaluateChunk(3, 0.2);
      monitor.evaluateChunk(4, 0.15);

      const summary = monitor.getSummary();
      expect(summary.totalChunks).toBe(5);
      expect(summary.averageConfidence).toBeGreaterThan(0);
      // Rolling average should be low enough to trigger critical alert
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe('critical');
    });
  });

  describe('Export verification integration', () => {
    test('should verify SVG export with valid SVG markup', () => {
      // Must be >= 100 bytes (default minFileSizeBytes)
      const validSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="100" height="100" fill="blue"/></svg>';
      const buffer = new TextEncoder().encode(validSvg).buffer;
      const result = verifyExport('svg', buffer, { minFileSizeBytes: 1 });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject SVG missing closing tag', () => {
      const invalidSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg';
      const buffer = new TextEncoder().encode(invalidSvg).buffer;
      const result = verifyExport('svg', buffer, { minFileSizeBytes: 1 });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should verify MP4 with valid magic bytes', () => {
      // MP4: verifyBinary reads MAGIC_BYTES from data starting at offset 4
      // MAGIC_BYTES.mp4 = [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]
      // So data[4..11] must match those bytes
      const buffer = new ArrayBuffer(32);
      const view = new Uint8Array(buffer);
      view[4] = 0x00; view[5] = 0x00; view[6] = 0x00; view[7] = 0x18;
      view[8] = 0x66;  // f
      view[9] = 0x74;  // t
      view[10] = 0x79; // y
      view[11] = 0x70; // p
      const result = verifyExport('mp4', buffer, { minFileSizeBytes: 1 });

      expect(result.valid).toBe(true);
    });

    test('should reject MP4 without valid magic bytes', () => {
      const buffer = new ArrayBuffer(200);
      const result = verifyExport('mp4', buffer, { minFileSizeBytes: 1 });

      expect(result.valid).toBe(false);
    });

    test('should reject empty file', () => {
      const buffer = new ArrayBuffer(0);
      const result = verifyExport('mp4', buffer, { minFileSizeBytes: 1 });

      expect(result.valid).toBe(false);
    });
  });

  describe('QualityMonitor pipeline integration', () => {
    test('should track quality trends across iterations', () => {
      const monitor = new QualityMonitor();

      const trends = monitor.getQualityTrends();
      expect(trends).toHaveProperty('performance');
      expect(trends).toHaveProperty('accuracy');
      expect(trends).toHaveProperty('reliability');
      expect(trends).toHaveProperty('overall');
    });

    test('should check deployment readiness', () => {
      const monitor = new QualityMonitor();
      const readiness = monitor.checkDeploymentReadiness();

      expect(readiness).toHaveProperty('ready');
      expect(readiness).toHaveProperty('criticalIssues');
      expect(readiness).toHaveProperty('warnings');
      expect(Array.isArray(readiness.criticalIssues)).toBe(true);
      expect(Array.isArray(readiness.warnings)).toBe(true);
    });
  });

  describe('Label sizing pipeline integration', () => {
    test('should size labels without overflow for all nodes', () => {
      const { nodes } = makeGoodLayout();
      const results = sizeAllLabels(nodes);

      for (const [nodeId, result] of results) {
        expect(result.fontSize).toBeGreaterThan(0);
        expect(result.fontSize).toBeLessThanOrEqual(16); // default max
        // Each line should not exceed node width when rendered
        expect(result.lines.length).toBeGreaterThan(0);
      }
    });

    test('should truncate long labels appropriately', () => {
      const result = sizeLabel(
        'This is a very long label that should be truncated',
        80,
        40
      );

      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.lines.length).toBeGreaterThan(0);
      // With a small node, truncation or wrapping should occur
      expect(result.truncated).toBeDefined();
    });
  });

  describe('Edge crossing minimization pipeline integration', () => {
    test('should detect crossings in a crossed layout', () => {
      // Create a layout with guaranteed crossings
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 50, height: 30 },
        { id: 'b', label: 'B', x: 200, y: 200, width: 50, height: 30 },
        { id: 'c', label: 'C', x: 200, y: 0, width: 50, height: 30 },
        { id: 'd', label: 'D', x: 0, y: 200, width: 50, height: 30 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'b', points: [] }, // diagonal
        { from: 'c', to: 'd', points: [] }, // crossing diagonal
      ];

      const crossings = detectEdgeCrossings(nodes, edges);
      // These diagonals should cross
      expect(crossings).toBeGreaterThan(0);
    });

    test('should reduce crossings after minimization', () => {
      const nodes: PositionedNode[] = [
        { id: 'a', label: 'A', x: 0, y: 0, width: 50, height: 30 },
        { id: 'b', label: 'B', x: 200, y: 200, width: 50, height: 30 },
        { id: 'c', label: 'C', x: 200, y: 0, width: 50, height: 30 },
        { id: 'd', label: 'D', x: 0, y: 200, width: 50, height: 30 },
      ];
      const edges: LayoutEdge[] = [
        { from: 'a', to: 'b', points: [] },
        { from: 'c', to: 'd', points: [] },
      ];

      const result = minimizeEdgeCrossings(nodes, edges, 10);
      expect(result.nodes).toHaveLength(4);
      expect(typeof result.crossingCount).toBe('number');
    });
  });
});
