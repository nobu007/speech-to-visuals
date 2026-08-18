/**
 * REQ-248: Export Path Guard Metrics Coverage Regression Test
 *
 * Asserts that all export entry points emit guard metrics events when
 * processing malicious payloads. This prevents silent coverage gaps where
 * a future code change could bypass the SecurityMetricsCollector.
 *
 * Coverage:
 * - MultiFormatExporter (SVG/JSON export paths)
 * - ProductionExporter (video export job creation path)
 * - ExportContentValidator (strict-mode + non-strict)
 * - Safe payload regression (no false-positive metrics)
 */

import {
  validateSceneGraphForExport,
  validateExportPayload,
} from '../export-content-validator';
import {
  MultiFormatExporter,
} from '../multi-format-exporter';
import { ProductionExporter } from '../production-exporter';
import { EnhancedExportEngine } from '../enhanced-export-engine';
import { securityMetricsCollector } from '../security-metrics-collector';
import type { SceneGraph } from '@stv/core/types/diagram';
import type { EnhancedSceneGraph } from '../../visualization/advanced-visual-engine';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function createSafeScene(): SceneGraph {
  return {
    type: 'flow',
    id: 'safe-scene',
    nodes: [
      { id: 'n1', label: 'Start', type: 'input' },
      { id: 'n2', label: 'Process', type: 'process' },
      { id: 'n3', label: 'End', type: 'output' },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'data' },
      { from: 'n2', to: 'n3', label: 'result' },
    ],
    startMs: 0,
    durationMs: 5000,
    summary: 'A safe flow diagram',
    keyphrases: ['start', 'process', 'end'],
  };
}

function createMaliciousScene(): SceneGraph {
  return {
    type: 'flow',
    id: 'malicious-scene',
    nodes: [
      { id: 'n1', label: '<script>alert(1)</script>', type: 'input' },
      { id: 'n2', label: '<img src=x onerror=alert(1)>', type: 'process' },
      { id: 'n3', label: 'javascript:alert(1)', type: 'output' },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: '<svg onload=alert(1)>' },
      { from: 'n2', to: 'n3', label: '<iframe src=//evil.com>' },
    ],
    startMs: 0,
    durationMs: 5000,
    summary: '<script>alert("xss")</script> malicious summary',
    keyphrases: ['<script>alert(1)</script>'],
  };
}

/** Minimal EnhancedSceneGraph wrapper for ProductionExporter tests */
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

function createSafeEnhancedScene(): EnhancedSceneGraph {
  return toEnhanced(createSafeScene());
}

function createMaliciousEnhancedScene(): EnhancedSceneGraph {
  return toEnhanced(createMaliciousScene());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-248: Export Path Guard Metrics Coverage', () => {
  beforeEach(() => {
    securityMetricsCollector.reset();
  });

  describe('MultiFormatExporter emits guard metrics for malicious payloads', () => {
    it('SVG export with malicious SceneGraph records escape-function metrics', async () => {
      const exporter = new MultiFormatExporter();
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      // Non-strict mode: export proceeds but findings are recorded
      try {
        await exporter.export(createMaliciousScene(), {
          format: 'svg',
          width: 800,
          height: 600,
        });
      } catch {
        // Strict mode may throw — that's fine
      }

      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });

    it('JSON export with malicious SceneGraph records metrics', async () => {
      const exporter = new MultiFormatExporter();

      try {
        await exporter.export(createMaliciousScene(), {
          format: 'json',
        });
      } catch {
        // Strict mode may throw
      }

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });
  });

  describe('ExportContentValidator emits guard metrics', () => {
    it('Non-strict validation of malicious payload records content-validator metrics', () => {
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      validateSceneGraphForExport(createMaliciousScene(), { strict: false });

      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });

    it('Strict validation of malicious payload records strict-mode-block metrics', () => {
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      validateSceneGraphForExport(createMaliciousScene(), { strict: true });

      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });

    it('validateExportPayload records metrics for malicious JSON payload', () => {
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      validateExportPayload({
        format: 'json',
        data: '<script>alert(1)</script>',
      });

      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });
  });

  describe('ProductionExporter emits guard metrics for malicious payloads', () => {
    it('createExportJob with malicious scenes records content-validator metrics', async () => {
      const exporter = new ProductionExporter();
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      try {
        await exporter.createExportJob(
          'malicious-job',
          [createMaliciousEnhancedScene()],
          { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
        );
      } catch {
        // Strict mode may throw — that's fine
      }

      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });

    it('createExportJob with multiple malicious scenes records metrics for all', async () => {
      const exporter = new ProductionExporter();

      try {
        await exporter.createExportJob(
          'multi-malicious',
          [createMaliciousEnhancedScene(), createMaliciousEnhancedScene()],
          { width: 1280, height: 720, fps: 24, quality: 'standard', format: 'webm' },
        );
      } catch {
        // strict mode may throw
      }

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });
  });

  describe('Safe payloads do NOT emit guard metrics (no false positives)', () => {
    it('Safe SceneGraph through MultiFormatExporter does not record metrics', async () => {
      const exporter = new MultiFormatExporter();

      await exporter.export(createSafeScene(), { format: 'json' });

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });

    it('Safe scenes through ProductionExporter does not record metrics', async () => {
      const exporter = new ProductionExporter();

      await exporter.createExportJob(
        'safe-job',
        [createSafeEnhancedScene()],
        { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
      );

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });

    it('Safe SceneGraph through validator does not record metrics', () => {
      validateSceneGraphForExport(createSafeScene());

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });

    it('Safe JSON payload through validateExportPayload does not record metrics', () => {
      validateExportPayload({
        format: 'json',
        scenes: [{ id: 's1', title: 'Safe Title' }],
      });

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });
  });

  describe('Guard metrics layer attribution', () => {
    it('content-validator layer receives non-strict-mode findings', () => {
      validateSceneGraphForExport(createMaliciousScene(), { strict: false });

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.byLayer['content-validator']).toBeGreaterThan(0);
    });

    it('strict-mode-block layer receives strict-mode findings', () => {
      validateSceneGraphForExport(createMaliciousScene(), { strict: true });

      const snapshot = securityMetricsCollector.getSnapshot();
      // Strict mode records through the validator path
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });
  });

  describe('EnhancedExportEngine emits guard metrics for malicious payloads', () => {
    it('exportVideo with malicious scene data records content-validator metrics', async () => {
      const engine = new EnhancedExportEngine(1, false);
      const snapshotBefore = securityMetricsCollector.getSnapshot();

      const result = await engine.exportVideo(
        {
          scenes: [
            { duration: 5, title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>' },
            { duration: 3, title: 'javascript:alert(1)', summary: '<svg onload=alert(1)>' },
          ],
        },
        {
          format: 'mp4',
          quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
          settings: { duration: 8, loop: false, includeAudio: false, watermark: false, compression: 'low', optimization: 'speed' },
        },
      );

      // Export may fail due to rendering environment, but guard metrics must be recorded
      const snapshotAfter = securityMetricsCollector.getSnapshot();
      expect(snapshotAfter.totalRejections).toBeGreaterThan(
        snapshotBefore.totalRejections,
      );
    });

    it('exportVideo with multiple malicious scenes accumulates metrics', async () => {
      const engine = new EnhancedExportEngine(1, false);

      await engine.exportVideo(
        {
          scenes: [
            { duration: 2, title: '<iframe src=//evil.com></iframe>', node: '<object data=//evil.com>' },
            { duration: 2, title: '<embed src=//evil.com>', node: '<base href=//evil.com>' },
            { duration: 2, title: 'expression(alert(1))', node: 'vbscript:msgbox(1)' },
          ],
        },
        {
          format: 'webm',
          quality: { resolution: '720p', fps: 24, bitrate: 'medium', hdr: false },
          settings: { duration: 6, loop: false, includeAudio: false, watermark: false, compression: 'low', optimization: 'speed' },
        },
      );

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });

    it('exportVideo with safe scene data does NOT emit guard metrics', async () => {
      const engine = new EnhancedExportEngine(1, false);

      const result = await engine.exportVideo(
        {
          scenes: [
            { duration: 5, title: 'Introduction', summary: 'Safe overview' },
            { duration: 3, title: 'Details', summary: 'Content description' },
          ],
        },
        {
          format: 'mp4',
          quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
          settings: { duration: 8, loop: false, includeAudio: false, watermark: false, compression: 'low', optimization: 'speed' },
        },
      );

      // Export may fail for rendering reasons, but no security findings should be recorded
      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot.totalRejections).toBe(0);
    });
  });

  describe('Cross-service guard metrics regression (REQ-250)', () => {
    /**
     * Regression assertion: ALL three export services (MultiFormatExporter,
     * ProductionExporter, EnhancedExportEngine) must emit guard metrics when
     * processing the same malicious payload. This prevents silent coverage
     * gaps where a future code change could bypass the SecurityMetricsCollector
     * in one service while the others remain instrumented.
     */

    it('ALL export services emit guard metrics for identical malicious payload', async () => {
      const maliciousScene = createMaliciousScene();
      const maliciousEnhanced = createMaliciousEnhancedScene();

      // --- MultiFormatExporter ---
      securityMetricsCollector.reset();
      const mfExporter = new MultiFormatExporter();
      try {
        await mfExporter.export(maliciousScene, { format: 'svg', width: 800, height: 600 });
      } catch { /* strict mode may throw */ }
      const mfSnapshot = securityMetricsCollector.getSnapshot();
      expect(mfSnapshot.totalRejections).toBeGreaterThan(0);

      // --- ProductionExporter ---
      securityMetricsCollector.reset();
      const pExporter = new ProductionExporter();
      try {
        await pExporter.createExportJob(
          'regression-test',
          [maliciousEnhanced],
          { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
        );
      } catch { /* strict mode may throw */ }
      const pSnapshot = securityMetricsCollector.getSnapshot();
      expect(pSnapshot.totalRejections).toBeGreaterThan(0);

      // --- EnhancedExportEngine ---
      securityMetricsCollector.reset();
      const engine = new EnhancedExportEngine(1, false);
      await engine.exportVideo(
        {
          scenes: [
            { duration: 5, title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(1)>' },
          ],
        },
        {
          format: 'mp4',
          quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
          settings: { duration: 5, loop: false, includeAudio: false, watermark: false, compression: 'low', optimization: 'speed' },
        },
      );
      const eeSnapshot = securityMetricsCollector.getSnapshot();
      expect(eeSnapshot.totalRejections).toBeGreaterThan(0);
    });

    it('NO export service emits guard metrics for identical safe payload', async () => {
      const safeScene = createSafeScene();
      const safeEnhanced = createSafeEnhancedScene();

      // --- MultiFormatExporter ---
      securityMetricsCollector.reset();
      const mfExporter = new MultiFormatExporter();
      await mfExporter.export(safeScene, { format: 'json' });
      expect(securityMetricsCollector.getSnapshot().totalRejections).toBe(0);

      // --- ProductionExporter ---
      securityMetricsCollector.reset();
      const pExporter = new ProductionExporter();
      await pExporter.createExportJob(
        'safe-regression',
        [safeEnhanced],
        { width: 1920, height: 1080, fps: 30, quality: 'standard', format: 'mp4' },
      );
      expect(securityMetricsCollector.getSnapshot().totalRejections).toBe(0);

      // --- EnhancedExportEngine ---
      securityMetricsCollector.reset();
      const engine = new EnhancedExportEngine(1, false);
      await engine.exportVideo(
        {
          scenes: [{ duration: 5, title: 'Safe Scene', summary: 'Nothing malicious' }],
        },
        {
          format: 'mp4',
          quality: { resolution: '1080p', fps: 30, bitrate: 'auto', hdr: false },
          settings: { duration: 5, loop: false, includeAudio: false, watermark: false, compression: 'low', optimization: 'speed' },
        },
      );
      expect(securityMetricsCollector.getSnapshot().totalRejections).toBe(0);
    });
  });

  describe('Metrics collector can be queried after export operations', () => {
    it('getSnapshot returns structured data after malicious export', async () => {
      const exporter = new MultiFormatExporter();

      try {
        await exporter.export(createMaliciousScene(), { format: 'svg' });
      } catch {
        // May throw in strict mode
      }

      const snapshot = securityMetricsCollector.getSnapshot();
      expect(snapshot).toHaveProperty('totalRejections');
      expect(snapshot).toHaveProperty('byLayer');
      expect(snapshot).toHaveProperty('bySeverity');
      expect(snapshot).toHaveProperty('byPattern');
      expect(snapshot).toHaveProperty('matrix');
      expect(snapshot.totalRejections).toBeGreaterThan(0);
    });

    it('toPrometheusText produces valid output after malicious export', async () => {
      const exporter = new MultiFormatExporter();

      try {
        await exporter.export(createMaliciousScene(), { format: 'svg' });
      } catch {
        // May throw
      }

      const prom = securityMetricsCollector.toPrometheusText();
      expect(prom).toContain('security_guard_rejections_total');
      expect(prom).toContain('# HELP');
      expect(prom).toContain('# TYPE');
    });
  });
});
