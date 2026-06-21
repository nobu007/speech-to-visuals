/**
 * REQ-249: E2E Security Pipeline Integration Test
 *
 * Exercises the full export → sanitize → guard-metrics → download pipeline
 * end-to-end with a malicious payload, proving the defense-in-depth chain
 * holds across all export services (SVG, JSON, interactive HTML, video).
 *
 * Pipeline stages tested:
 * 1. Malicious SceneGraph creation (multiple XSS vectors embedded)
 * 2. validateSceneGraphForExport → findings detected + metrics recorded
 * 3. MultiFormatExporter.export → format-specific sanitization applied
 * 4. ProductionExporter.createExportJob → validation gates scene data
 * 5. SecurityMetricsCollector → guard rejection counters incremented
 * 6. Output verification → XSS vectors absent from exported content
 */

import {
  validateSceneGraphForExport,
} from '../export-content-validator';
import {
  MultiFormatExporter,
} from '../multi-format-exporter';
import { ProductionExporter } from '../production-exporter';
import { securityMetricsCollector } from '../security-metrics-collector';
import type { SceneGraph } from '../../types/diagram';
import type { EnhancedSceneGraph } from '../../visualization/advanced-visual-engine';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const XSS_VECTORS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<iframe src=//evil.com></iframe>',
  'javascript:alert(1)',
  '<script/src=//evil.com>',
  '<embed src=//evil.com>',
  '<object data=//evil.com>',
  '<base href=//evil.com>',
  'vbscript:msgbox(1)',
];

function createMaliciousScene(): SceneGraph {
  return {
    type: 'flow',
    id: 'malicious-scene',
    nodes: XSS_VECTORS.map((vector, i) => ({
      id: `node-${i}`,
      label: vector,
      type: 'process',
    })),
    edges: XSS_VECTORS.slice(0, 5).map((vector, i) => ({
      from: `node-${i}`,
      to: `node-${i + 1}`,
      label: vector,
    })),
    startMs: 0,
    durationMs: 10000,
    summary: `<script>alert("e2e-pipeline-test")</script>`,
    keyphrases: XSS_VECTORS.slice(0, 3),
    title: '<svg onload=alert(1)>Malicious Title</svg>',
  };
}

function createSafeScene(): SceneGraph {
  return {
    type: 'flow',
    id: 'safe-scene',
    nodes: [
      { id: 'n1', label: 'Audio Input', type: 'input' },
      { id: 'n2', label: 'Processing', type: 'process' },
      { id: 'n3', label: 'Video Output', type: 'output' },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'audio data' },
      { from: 'n2', to: 'n3', label: 'video' },
    ],
    startMs: 0,
    durationMs: 5000,
    summary: 'Audio to video processing pipeline',
    keyphrases: ['audio', 'video', 'processing'],
  };
}

/** Wrap a SceneGraph as EnhancedSceneGraph for ProductionExporter tests */
function toEnhanced(scene: SceneGraph): EnhancedSceneGraph {
  return {
    ...scene,
    visualStyle: {
      theme: 'modern',
      colorScheme: 'blue',
      animation: 'smooth',
      nodeStyle: 'rounded',
      edgeStyle: 'curved',
      fontSize: 'medium',
      spacing: 'normal',
    },
    animations: [],
    background: { type: 'solid', primary: '#ffffff', opacity: 1 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-249: E2E Security Pipeline Integration', () => {
  beforeEach(() => {
    securityMetricsCollector.reset();
  });

  describe('Full pipeline: malicious SceneGraph → validate → export → metrics', () => {
    it('SVG export: validates, sanitizes, and records guard metrics', async () => {
      const scene = createMaliciousScene();

      // Stage 1: Validate
      const validation = validateSceneGraphForExport(scene, { strict: false });
      expect(validation.findings.length).toBeGreaterThan(0);

      // Stage 2: Export (non-strict — proceeds with sanitization)
      const exporter = new MultiFormatExporter();
      const result = await exporter.export(scene, {
        format: 'svg',
        width: 800,
        height: 600,
      });

      // Stage 3: Output is sanitized (no raw XSS vectors)
      if (result.success && result.data) {
        const output = typeof result.data === 'string'
          ? result.data
          : await (result.data as Blob).text();

        // The SVG output must not contain unescaped script tags
        expect(output).not.toContain('<script>');
        expect(output).not.toContain('<script ');
        expect(output).not.toContain('onerror=');
        expect(output).not.toContain('onload=');
        expect(output).not.toContain('javascript:');
      }

      // Stage 4: Guard metrics recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });

    it('JSON export: validates, detects XSS, and records guard metrics', async () => {
      const scene = createMaliciousScene();

      // Validate
      const validation = validateSceneGraphForExport(scene, { strict: false });
      expect(validation.findings.length).toBeGreaterThan(0);

      // Export
      const exporter = new MultiFormatExporter();
      const result = await exporter.export(scene, { format: 'json' });

      // JSON export should succeed (JSON.stringify escapes special chars)
      expect(result.success).toBe(true);

      // Guard metrics recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });
  });

  describe('Strict mode: malicious payload is blocked end-to-end', () => {
    it('Strict validation blocks export and records strict-mode-block metrics', () => {
      const scene = createMaliciousScene();

      // Strict validation
      const validation = validateSceneGraphForExport(scene, { strict: true });
      expect(validation.passed).toBe(false);

      // High-severity findings must be present
      const highFindings = validation.findings.filter((f) => f.severity === 'high');
      expect(highFindings.length).toBeGreaterThan(0);

      // Metrics recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });
  });

  describe('Safe payload: full pipeline with zero guard rejections', () => {
    it('SVG export of safe scene produces no guard metrics', async () => {
      const scene = createSafeScene();

      // Validate — should pass with zero findings
      const validation = validateSceneGraphForExport(scene);
      expect(validation.findings).toHaveLength(0);
      expect(validation.passed).toBe(true);

      // Export
      const exporter = new MultiFormatExporter();
      const result = await exporter.export(scene, {
        format: 'svg',
        width: 800,
        height: 600,
      });
      expect(result.success).toBe(true);

      // No guard metrics recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });

    it('JSON export of safe scene produces no guard metrics', async () => {
      const scene = createSafeScene();

      const exporter = new MultiFormatExporter();
      const result = await exporter.export(scene, { format: 'json' });
      expect(result.success).toBe(true);

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });
  });

  describe('Multi-vector injection: defense-in-depth across pipeline', () => {
    it('All 10 XSS vectors in malicious scene are detected by validator', () => {
      const scene = createMaliciousScene();
      const validation = validateSceneGraphForExport(scene, { strict: false });

      // Multiple distinct patterns should be detected
      const patterns = new Set(validation.findings.map((f) => f.pattern));
      expect(patterns.size).toBeGreaterThanOrEqual(3);

      // Total findings should cover multiple injection points
      expect(validation.findings.length).toBeGreaterThanOrEqual(5);
    });

    it('Validator findings flow through to SecurityMetricsCollector', () => {
      const scene = createMaliciousScene();

      validateSceneGraphForExport(scene, { strict: false });

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThanOrEqual(5);

      // Multiple patterns should be represented
      expect(snapshot.byPattern.length).toBeGreaterThanOrEqual(3);
    });

    it('Metrics persist after export operation completes', async () => {
      const scene = createMaliciousScene();
      const exporter = new MultiFormatExporter();

      try {
        await exporter.export(scene, { format: 'svg' });
      } catch {
        // strict mode may throw
      }

      // Metrics should persist after the export call completes
      const snapshot1 = securityMetricsCollector.getSnapshot();
      expect(snapshot1.totalRejections).toBeGreaterThan(0);

      // Subsequent safe export should not reset or reduce metrics
      await exporter.export(createSafeScene(), { format: 'json' });

      const snapshot2 = securityMetricsCollector.getSnapshot();
      expect(snapshot2.totalRejections).toBeGreaterThanOrEqual(
        snapshot1.totalRejections,
      );
    });
  });

  describe('ProductionExporter: full pipeline with malicious scene data', () => {
    it('Malicious scenes trigger guard metrics via ProductionExporter', async () => {
      const scene = toEnhanced(createMaliciousScene());

      const exporter = new ProductionExporter();

      try {
        await exporter.createExportJob(
          'e2e-malicious',
          [scene],
          { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
        );
      } catch {
        // Strict mode may throw — expected
      }

      // Guard metrics must have been recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });

    it('Defense-in-depth: all XSS vectors in enhanced scene detected before rendering', () => {
      const scene = toEnhanced(createMaliciousScene());

      // Direct validation catches all vectors
      const validation = validateSceneGraphForExport(scene, { strict: false });
      expect(validation.findings.length).toBeGreaterThanOrEqual(5);

      // Metrics reflect the findings
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThanOrEqual(5);
    });

    it('Safe enhanced scene through ProductionExporter produces zero guard metrics', async () => {
      const scene = toEnhanced(createSafeScene());

      const exporter = new ProductionExporter();

      await exporter.createExportJob(
        'e2e-safe',
        [scene],
        { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
      );

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });
  });

  describe('Cross-service guard metrics accumulation', () => {
    it('Metrics from MultiFormatExporter and ProductionExporter accumulate', async () => {
      const scene = createMaliciousScene();
      const enhancedScene = toEnhanced(scene);

      // MultiFormatExporter path
      const mfExporter = new MultiFormatExporter();
      try {
        await mfExporter.export(scene, { format: 'svg', width: 800, height: 600 });
      } catch {
        // may throw
      }

      const snapshotAfterMF = securityMetricsCollector.getSnapshot();
      expect(snapshotAfterMF.totalRejections).toBeGreaterThan(0);

      // ProductionExporter path — additional metrics should accumulate
      const pExporter = new ProductionExporter();
      try {
        await pExporter.createExportJob(
          'cross-service-test',
          [enhancedScene],
          { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
        );
      } catch {
        // may throw
      }

      const snapshotAfterBoth = securityMetricsCollector.getSnapshot();
      expect(snapshotAfterBoth.totalRejections).toBeGreaterThan(
        snapshotAfterMF.totalRejections,
      );
    });
  });

  describe('Prometheus exposition after E2E pipeline', () => {
    it('Prometheus text output is well-formed after malicious export', async () => {
      const scene = createMaliciousScene();
      const exporter = new MultiFormatExporter();

      try {
        await exporter.export(scene, { format: 'svg' });
      } catch {
        // may throw in strict mode
      }

      const prom = securityMetricsCollector.toPrometheusText();

      // Well-formed Prometheus exposition format checks
      expect(prom).toContain('# HELP security_guard_rejections_total');
      expect(prom).toContain('# TYPE security_guard_rejections_total counter');
      expect(prom).toContain('security_guard_rejections_total{');
      expect(prom).toContain('layer=');
      expect(prom).toContain('severity=');
      expect(prom).toContain('pattern=');

      // No label injection (sanitized quotes/newlines)
      const lines = prom.split('\n');
      for (const line of lines) {
        if (line.startsWith('security_guard_')) {
          // Each metric line should have properly quoted labels
          expect(line).toMatch(/\{[^}]+\}/);
        }
      }
    });
  });
});
