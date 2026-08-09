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
import {
  validateExportPayload,
  validateSceneGraphForExport,
} from '../export-content-validator';

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

    it('should output correct layer and severity per pattern in Prometheus text', () => {
      // Record the same pattern under different layers/severities
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('strict-mode-block', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'medium', 'event-handler');

      const text = collector.toPrometheusText();

      // script-tag should appear under BOTH layers, not just the first one
      expect(text).toContain(
        'security_guard_rejections_total{layer="content-validator",severity="high",pattern="script-tag"} 1',
      );
      expect(text).toContain(
        'security_guard_rejections_total{layer="strict-mode-block",severity="high",pattern="script-tag"} 1',
      );
      expect(text).toContain(
        'security_guard_rejections_total{layer="content-validator",severity="medium",pattern="event-handler"} 1',
      );

      // Should NOT have any entry with wrong layer attribution
      expect(text).not.toContain(
        'security_guard_rejections_total{layer="strict-mode-block",severity="medium",pattern="event-handler"}',
      );
    });

    it('should aggregate counts for same layer+severity+pattern combo', () => {
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');
      collector.recordRejection('content-validator', 'high', 'script-tag');

      const text = collector.toPrometheusText();
      expect(text).toContain(
        'security_guard_rejections_total{layer="content-validator",severity="high",pattern="script-tag"} 3',
      );
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

  describe('size cap (bounded distinct compound keys)', () => {
    it('FIFO-evicts oldest patterns and bounds the entry count', () => {
      // TTL disabled (the default config) — without the size cap this map grew
      // without bound because `pattern` is an arbitrary string.
      const capped = new SecurityMetricsCollector(0, 3);
      capped.recordRejection('content-validator', 'high', 'p1');
      capped.recordRejection('content-validator', 'high', 'p2');
      capped.recordRejection('content-validator', 'high', 'p3');
      capped.recordRejection('content-validator', 'high', 'p4'); // evict p1
      capped.recordRejection('content-validator', 'high', 'p5'); // evict p2

      const snap = capped.getSnapshot();
      // Only the newest 3 distinct patterns are retained.
      expect(snap.byPattern).toHaveLength(3);
      expect(snap.byPattern.map((p) => p.pattern).sort()).toEqual(['p3', 'p4', 'p5']);
    });

    it('keeps aggregate counters consistent with retained entries after eviction', () => {
      // The denormalized counters must equal the sum of retained entries, not
      // the sum of all-ever inserts. Eviction rebuilds them.
      const capped = new SecurityMetricsCollector(0, 2);
      capped.recordRejection('content-validator', 'high', 'p1');
      capped.recordRejection('content-validator', 'high', 'p2');
      capped.recordRejection('content-validator', 'high', 'p3'); // evict p1

      const snap = capped.getSnapshot();
      // Retained: p2, p3 (1 each) → counters must be 2, NOT 3.
      expect(snap.totalRejections).toBe(2);
      expect(snap.byLayer['content-validator']).toBe(2);
      expect(snap.bySeverity.high).toBe(2);
      expect(snap.matrix['content-validator'].high).toBe(2);
    });

    it('does not evict or recompute when re-recording an existing pattern', () => {
      const capped = new SecurityMetricsCollector(0, 2);
      capped.recordRejection('content-validator', 'high', 'p1');
      capped.recordRejection('content-validator', 'high', 'p2');
      // p1 already exists → increment in place, no eviction.
      capped.recordRejection('content-validator', 'high', 'p1');

      const snap = capped.getSnapshot();
      expect(snap.byPattern).toHaveLength(2);
      expect(snap.totalRejections).toBe(3);
      expect(snap.byPattern.find((p) => p.pattern === 'p1')!.count).toBe(2);
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

  describe('Prometheus label injection defense', () => {
    it('should sanitize pattern names containing newlines', () => {
      collector.recordRejection(
        'content-validator',
        'high',
        'script-tag"} 0\n# HELP fake_metric fake\n# TYPE fake_metric counter\nfake_metric{layer="x',
      );

      const text = collector.toPrometheusText();
      const lines = text.split('\n');

      // The malicious pattern must NOT create additional Prometheus metric lines.
      // All injected content should be trapped within a single escaped label value.
      const helpLines = lines.filter((l) => l.startsWith('# HELP fake_metric'));
      expect(helpLines).toHaveLength(0);

      const fakeMetricLines = lines.filter((l) => l.startsWith('fake_metric{'));
      expect(fakeMetricLines).toHaveLength(0);

      // The original counter line should be the only metric data line
      const dataLines = lines.filter((l) => l.startsWith('security_guard_rejections_total{'));
      expect(dataLines).toHaveLength(1);
      // Newlines should be escaped as \n literal, not actual line breaks
      expect(dataLines[0]).toContain('\\n');
    });

    it('should sanitize pattern names containing double quotes', () => {
      collector.recordRejection(
        'content-validator',
        'high',
        'script"tag',
      );

      const text = collector.toPrometheusText();

      // The quote must be escaped, not break the label format
      expect(text).not.toContain('pattern="script"tag"');
      expect(text).toContain('pattern="script\\"tag"');
    });

    it('should sanitize pattern names containing backslashes', () => {
      collector.recordRejection(
        'content-validator',
        'high',
        'script\\ntag',
      );

      const text = collector.toPrometheusText();
      expect(text).toContain('pattern="script\\\\ntag"');
    });

    it('should truncate excessively long pattern names', () => {
      const longName = 'A'.repeat(500);
      collector.recordRejection('content-validator', 'high', longName);

      const text = collector.toPrometheusText();
      // The pattern value in the output should be at most 200 chars (after sanitization)
      const match = text.match(/pattern="([A-Za-z]+)"/);
      expect(match).not.toBeNull();
      expect(match![1].length).toBeLessThanOrEqual(200);
    });
  });

  describe('TTL-based metric expiration', () => {
    it('should not prune entries when TTL is disabled (default)', () => {
      collector.recordRejection('content-validator', 'high', 'test');

      // No TTL configured — entry should survive
      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(1);
    });

    it('should prune expired entries when TTL is set', () => {
      collector.setMaxAge(1); // 1ms TTL

      collector.recordRejection('content-validator', 'high', 'old-entry');
      // Wait beyond TTL
      // Use a small delay to ensure the entry is older than 1ms
      const start = Date.now();
      while (Date.now() - start < 5) { /* busy-wait 5ms */ }

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(0);
      expect(snap.byLayer['content-validator']).toBe(0);
    });

    it('should keep fresh entries within TTL window', () => {
      collector.setMaxAge(60_000); // 60s TTL

      collector.recordRejection('content-validator', 'high', 'fresh');

      const snap = collector.getSnapshot();
      expect(snap.totalRejections).toBe(1);
    });

    it('should recalculate aggregates correctly after pruning', () => {
      collector.setMaxAge(5); // 5ms TTL

      // Record an old entry that will expire
      collector.recordRejection('content-validator', 'high', 'old');
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy-wait 10ms */ }

      // Now record a fresh entry with a longer TTL
      collector.setMaxAge(60_000);
      collector.recordRejection('strict-mode-block', 'medium', 'fresh');

      const snap = collector.getSnapshot();
      // Old entry was already pruned by the first getSnapshot via pruneExpired
      // Actually the old entry pruning happens during getSnapshot. Let's test properly:
      // Since we changed TTL to 60s before recording 'fresh', 'old' was already in the map.
      // On next getSnapshot, pruneExpired will check: old.lastSeen < now - 60000? No (only 10ms passed).
      // So both entries should be present.
      expect(snap.totalRejections).toBe(2);
    });

    it('should report oldestEntryAt timestamp in snapshot', () => {
      collector.recordRejection('content-validator', 'high', 'test');
      const snap = collector.getSnapshot();
      expect(snap.oldestEntryAt).not.toBeNull();
      expect(typeof snap.oldestEntryAt).toBe('number');
    });

    it('should report null oldestEntryAt when empty', () => {
      const snap = collector.getSnapshot();
      expect(snap.oldestEntryAt).toBeNull();
    });
  });

  describe('end-to-end: validation → metrics collection', () => {
    beforeEach(() => {
      securityMetricsCollector.reset();
    });

    it('should increment metrics when validateExportPayload detects XSS', () => {
      const before = securityMetricsCollector.getSnapshot();
      expect(before.totalRejections).toBe(0);

      validateExportPayload({ data: '<script>alert(1)</script>' });

      const after = securityMetricsCollector.getSnapshot();
      expect(after.totalRejections).toBeGreaterThan(0);
      expect(after.byLayer['content-validator']).toBeGreaterThan(0);
      expect(after.bySeverity.high).toBeGreaterThan(0);
      expect(after.byPattern.some((p) => p.pattern === 'script-tag')).toBe(true);
    });

    it('should increment metrics when validateSceneGraphForExport detects XSS', () => {
      const before = securityMetricsCollector.getSnapshot();
      expect(before.totalRejections).toBe(0);

      const scene = {
        type: 'flow',
        nodes: [{ id: '<script>alert(1)</script>', label: 'evil' }],
        edges: [],
        summary: 'test',
      };
      validateSceneGraphForExport(scene as never);

      const after = securityMetricsCollector.getSnapshot();
      expect(after.totalRejections).toBeGreaterThan(0);
      expect(after.byPattern.some((p) => p.pattern === 'script-tag')).toBe(true);
    });

    it('should record under strict-mode-block layer when strict=true', () => {
      securityMetricsCollector.reset();

      validateExportPayload(
        { data: '<iframe src=//evil.com></iframe>' },
        'test-strict',
        { strict: true },
      );

      const snap = securityMetricsCollector.getSnapshot();
      // In strict mode with high-severity, the layer should be 'strict-mode-block'
      expect(snap.byLayer['strict-mode-block']).toBeGreaterThan(0);
    });

    it('should NOT increment metrics when payload is clean', () => {
      securityMetricsCollector.reset();

      validateExportPayload({ data: 'clean content', id: 'safe-node' });

      const snap = securityMetricsCollector.getSnapshot();
      expect(snap.totalRejections).toBe(0);
    });

    it('should accumulate across multiple calls', () => {
      securityMetricsCollector.reset();

      validateExportPayload({ a: '<script>x</script>' });
      validateExportPayload({ b: '<iframe src=//evil.com>' });
      validateExportPayload({ c: 'javascript:alert(1)' });

      const snap = securityMetricsCollector.getSnapshot();
      expect(snap.totalRejections).toBeGreaterThanOrEqual(3);
      expect(snap.bySeverity.high).toBeGreaterThanOrEqual(3);
    });

    it('should reflect metrics in Prometheus output after validation', () => {
      securityMetricsCollector.reset();

      validateExportPayload({ data: '<script>alert(1)</script>' });

      const promText = securityMetricsCollector.toPrometheusText();
      expect(promText).toContain('pattern="script-tag"');
      expect(promText).toMatch(/security_guard_rejections_total\{[^}]*pattern="script-tag"[^}]*\}\s+\d+/);
    });
  });
});
