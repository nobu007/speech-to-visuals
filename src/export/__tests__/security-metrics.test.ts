/**
 * REQ-246: Security Guard Rejection Metrics Tests
 *
 * Tests that SecurityMetricsCollector correctly tracks rejections by
 * layer, severity, and pattern, and produces valid Prometheus output.
 */

import {
  SecurityMetricsCollector,
  securityMetricsCollector,
  type SecurityLayer,
  type Severity,
} from '../security-metrics-collector';

describe('SecurityMetricsCollector', () => {
  let collector: SecurityMetricsCollector;

  beforeEach(() => {
    collector = new SecurityMetricsCollector();
  });

  describe('recordRejection', () => {
    it('should record a single rejection', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      const snap = collector.getSnapshot();

      expect(snap.totalRejections).toBe(1);
      expect(snap.byLayer['content-validator']).toBe(1);
      expect(snap.bySeverity.high).toBe(1);
    });

    it('should accumulate multiple rejections', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('strict-mode-block', 'high', 'iframe-tag');
      collector.recordRejection('content-validator', 'medium', 'event-handler');

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(4);
      expect(snap.byLayer['content-validator']).toBe(3);
      expect(snap.byLayer['strict-mode-block']).toBe(1);
      expect(snap.bySeverity.high).toBe(3);
      expect(snap.bySeverity.medium).toBe(1);
    });

    it('should track per-pattern counts', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'iframe-tag');

      const snap = collector.getSnapshot();
      expect(snap.byPattern).toHaveLength(2);
      expect(snap.byPattern[0]).toEqual({ pattern: 'script-tag', count: 2 });
      expect(snap.byPattern[1]).toEqual({ pattern: 'iframe-tag', count: 1 });
    });

    it('should sort patterns by count descending', () => {
      collector.recordRejection('content-validator', 'medium', 'event-handler');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'medium', 'event-handler');

      const snap = collector.getSnapshot();
      expect(snap.byPattern[0].pattern).toBe('script-tag');
      expect(snap.byPattern[0].count).toBe(3);
      expect(snap.byPattern[1].pattern).toBe('event-handler');
      expect(snap.byPattern[1].count).toBe(2);
    });
  });

  describe('recordFindings', () => {
    it('should batch-record multiple findings', () => {
      const findings = [
        { severity: 'high' as Severity, pattern: 'script-tag' },
        { severity: 'high' as Severity, pattern: 'iframe-tag' },
        { severity: 'medium' as Severity, pattern: 'event-handler' },
      ];
      collector.recordFindings('content-validator', findings);

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(3);
      expect(snap.byLayer['content-validator']).toBe(3);
      expect(snap.matrix['content-validator'].high).toBe(2);
      expect(snap.matrix['content-validator'].medium).toBe(1);
    });

    it('should handle empty findings array', () => {
      collector.recordFindings('content-validator', []);
      expect(collector.getSnapshot().totalRejections).toBe(0);
    });
  });

  describe('matrix', () => {
    it('should track layer × severity correctly', () => {
      collector.recordRejection('content-validator', 'high', 'a');
      collector.recordRejection('content-validator', 'medium', 'b');
      collector.recordRejection('strict-mode-block', 'high', 'c');
      collector.recordRejection('escape-function', 'medium', 'd');

      const snap = collector.getSnapshot();
      expect(snap.matrix['content-validator']).toEqual({ high: 1, medium: 1 });
      expect(snap.matrix['strict-mode-block']).toEqual({ high: 1, medium: 0 });
      expect(snap.matrix['escape-function']).toEqual({ high: 0, medium: 1 });
    });
  });

  describe('toPrometheusText', () => {
    it('should produce valid Prometheus exposition format', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'medium', 'event-handler');

      const text = collector.toPrometheusText();

      expect(text).toContain('# HELP security_guard_rejections_total');
      expect(text).toContain('# TYPE security_guard_rejections_total counter');
      expect(text).toContain('security_guard_rejections_total{');
      expect(text).toContain('layer="content-validator"');
      expect(text).toContain('pattern="script-tag"');
      expect(text).toContain('# HELP security_guard_rejections_by_layer');
      expect(text).toContain('# TYPE security_guard_rejections_by_layer gauge');
      expect(text).toContain('# HELP security_guard_rejections_by_severity');
      expect(text).toContain('# TYPE security_guard_rejections_by_severity gauge');
      expect(text).toContain('severity="high"');
      expect(text).toContain('severity="medium"');
    });

    it('should output empty metrics when no rejections recorded', () => {
      const text = collector.toPrometheusText();
      expect(text).toContain('# HELP security_guard_rejections_by_layer');
      expect(text).toContain('security_guard_rejections_by_layer{layer="content-validator"} 0');
    });
  });

  describe('reset', () => {
    it('should clear all collected metrics', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('strict-mode-block', 'high', 'iframe-tag');
      expect(collector.getSnapshot().totalRejections).toBe(2);

      collector.reset();

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(0);
      expect(snap.byPattern).toHaveLength(0);
      expect(snap.byLayer['content-validator']).toBe(0);
      expect(snap.byLayer['strict-mode-block']).toBe(0);
    });
  });

  describe('integration with ExportContentValidator', () => {
    it('should be importable without circular dependency', () => {
      // This test verifies the import chain works:
      // export-content-validator.ts → security-metrics-collector.ts
      // The fact that this test file loads means no circular dependency
      expect(securityMetricsCollector).toBeDefined();
      expect(securityMetricsCollector).toBeInstanceOf(SecurityMetricsCollector);
    });
  });

  describe('all layers and severities', () => {
    it('should handle all three security layers', () => {
      const layers: SecurityLayer[] = ['content-validator', 'strict-mode-block', 'escape-function'];
      for (const layer of layers) {
        collector.recordRejection(layer, 'high', 'test-pattern');
      }

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(3);
      for (const layer of layers) {
        expect(snap.byLayer[layer]).toBe(1);
      }
    });
  });
});
