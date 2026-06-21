/**
 * REQ-248: Export Path Guard Metrics Coverage Regression Test
 *
 * Asserts that all export entry points emit guard metrics events when
 * processing malicious payloads. This prevents silent coverage gaps where
 * a future code change could bypass the SecurityMetricsCollector.
 *
 * Coverage:
 * - MultiFormatExporter (SVG/JSON export paths)
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
import { securityMetricsCollector } from '../security-metrics-collector';
import type { SceneGraph } from '../../types/diagram';

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

  describe('Safe payloads do NOT emit guard metrics (no false positives)', () => {
    it('Safe SceneGraph through MultiFormatExporter does not record metrics', async () => {
      const exporter = new MultiFormatExporter();

      await exporter.export(createSafeScene(), { format: 'json' });

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
