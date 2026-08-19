// Prometheus label-value sanitization is consolidated in the shared helper —
// see src/utils/prometheus-label-escape.ts (formerly a private copy here that
// drifted from the sibling copy in prometheus-exporter.ts).
import { sanitizePrometheusLabel } from '@stv/core/utils/prometheus-label-escape';
import { CappedMap } from '@stv/core/lib/capped-map';

/**
 * Security Guard Rejection Metrics Collector
 *
 * Tracks how often each defense-in-depth layer catches dangerous content,
 * making the layered security architecture observable rather than just
 * fail-fast. Exposes Prometheus-compatible counter output.
 *
 * Metrics exposed:
 * - security_guard_rejections_total (counter by layer × severity × pattern)
 * - security_guard_layers_active     (gauge of active layers)
 */

export type SecurityLayer =
  | 'content-validator'
  | 'strict-mode-block'
  | 'escape-function';

export type Severity = 'high' | 'medium';

/**
 * One aggregated rejection entry, keyed by the compound
 * `${layer}\0${severity}\0${pattern}` key in `byCompoundKey`.
 */
interface CompoundRejectionEntry {
  layer: SecurityLayer;
  severity: Severity;
  pattern: string;
  count: number;
  lastSeen: number;
}

export interface SecurityRejectionSnapshot {
  /** Total rejections across all layers */
  totalRejections: number;
  /** Per-layer breakdown */
  byLayer: Record<SecurityLayer, number>;
  /** Per-severity breakdown */
  bySeverity: Record<Severity, number>;
  /** Per-pattern breakdown (top patterns by count) */
  byPattern: Array<{ pattern: string; count: number }>;
  /** Per-layer × severity matrix */
  matrix: Record<SecurityLayer, Record<Severity, number>>;
  /** Timestamp of the oldest non-expired entry (ms since epoch), null if empty or all expired */
  oldestEntryAt: number | null;
}

/**
 * Collects security guard rejection metrics for observability.
 *
 * Each time a defense layer detects dangerous content, call `recordRejection()`.
 * The accumulated data can be exported as Prometheus text or JSON snapshot.
 *
 * @param maxAgeMs - Rejection entries older than this are pruned on snapshot/export.
 *                   Default: 0 (disabled). Set to e.g. 86_400_000 for 24-hour retention.
 */
/**
 * Default ceiling on the number of distinct compound-key rejection entries
 * retained by the singleton. The pattern component of the key is an arbitrary
 * string; this cap is the structural safety net that bounds memory when TTL
 * pruning is disabled (the default config).
 */
const DEFAULT_MAX_COMPOUND_ENTRIES = 10_000;

export class SecurityMetricsCollector {
  private totalRejections = 0;
  private byLayer: Record<SecurityLayer, number> = {
    'content-validator': 0,
    'strict-mode-block': 0,
    'escape-function': 0,
  };
  private bySeverity: Record<Severity, number> = { high: 0, medium: 0 };
  /**
   * Compound key `${layer}\0${severity}\0${pattern}` → aggregate.
   *
   * A `CappedMap` (not a plain `Map`): `pattern` is an arbitrary string and the
   * default-deployed singleton runs with TTL pruning DISABLED (`maxAgeMs === 0`),
   * so a plain `Map` grew without bound. The `CappedMap` bounds the distinct
   * keys at `maxEntries` on every insert, FIFO-evicting the oldest-seen pattern.
   * Eviction can desync the denormalized aggregate counters
   * (`totalRejections`/`byLayer`/`bySeverity`/`matrix`), so whenever a cap
   * eviction occurs on insert the aggregates are rebuilt by
   * `recomputeAggregates()`.
   *
   * No definite-assignment assertion: the constructor assigns this field
   * unconditionally (`new CappedMap(this.maxEntries)`), which strict-mode
   * property-initialization analysis already proves.
   */
  private byCompoundKey: CappedMap<string, CompoundRejectionEntry>;
  private matrix: Record<SecurityLayer, Record<Severity, number>> = {
    'content-validator': { high: 0, medium: 0 },
    'strict-mode-block': { high: 0, medium: 0 },
    'escape-function': { high: 0, medium: 0 },
  };
  /** Rejection TTL in ms. 0 = disabled. */
  private maxAgeMs: number;
  /** Max distinct compound-key entries retained (FIFO). */
  private readonly maxEntries: number;

  /**
   * @param maxAgeMs   Rejection entries older than this are pruned on snapshot/export.
   *                   Default: reads from SECURITY_METRICS_TTL_MS env var, or 0 (disabled).
   * @param maxEntries Max distinct compound-key entries retained (FIFO-evicts
   *                   oldest). Default: {@link DEFAULT_MAX_COMPOUND_ENTRIES}.
   */
  constructor(maxAgeMs?: number, maxEntries?: number) {
    this.maxAgeMs = maxAgeMs ?? resolveTtlFromEnv();
    this.maxEntries = maxEntries ?? DEFAULT_MAX_COMPOUND_ENTRIES;
    this.byCompoundKey = new CappedMap<string, CompoundRejectionEntry>(this.maxEntries);
  }

  /** Update the TTL for rejection entries. Set to 0 to disable. */
  setMaxAge(maxAgeMs: number): void {
    this.maxAgeMs = maxAgeMs;
  }

  /**
   * Record a security guard rejection.
   *
   * @param layer - Which defense layer caught the content
   * @param severity - Severity level of the finding
   * @param patternName - Name of the pattern that triggered the rejection
   */
  recordRejection(
    layer: SecurityLayer,
    severity: Severity,
    patternName: string,
  ): void {
    const now = Date.now();
    this.totalRejections++;
    this.byLayer[layer]++;
    this.bySeverity[severity]++;
    this.matrix[layer][severity]++;

    const key = `${layer}\0${severity}\0${patternName}`;
    const entry = this.byCompoundKey.get(key);
    if (entry) {
      entry.count++;
      entry.lastSeen = now;
    } else {
      // At the size cap a new-key insert FIFO-evicts the oldest entry to make
      // room. Detect that (the map was already at/over its cap before this new
      // key) and rebuild the denormalized aggregates so the counters stay
      // consistent with the retained entries — the same invariant
      // `pruneExpired` restores after a TTL deletion.
      const evicted = this.byCompoundKey.size >= this.maxEntries;
      this.byCompoundKey.set(key, {
        layer,
        severity,
        pattern: patternName,
        count: 1,
        lastSeen: now,
      });
      if (evicted) this.recomputeAggregates();
    }
  }

  /**
   * Record multiple findings at once (convenience for ValidationResult integration).
   */
  recordFindings(
    layer: SecurityLayer,
    findings: Array<{ severity: Severity; pattern: string }>,
  ): void {
    for (const f of findings) {
      this.recordRejection(layer, f.severity, f.pattern);
    }
  }

  /**
   * Remove expired entries when TTL is configured.
   * Recalculates aggregate counters from the remaining compound-key entries.
   */
  private pruneExpired(): void {
    if (this.maxAgeMs <= 0) return;

    const cutoff = Date.now() - this.maxAgeMs;
    let pruned = false;

    for (const [key, entry] of this.byCompoundKey) {
      if (entry.lastSeen < cutoff) {
        this.byCompoundKey.delete(key);
        pruned = true;
      }
    }

    if (!pruned) return;

    // Recalculate aggregates from remaining entries.
    this.recomputeAggregates();
  }

  /**
   * Rebuild the denormalized aggregate counters (`totalRejections`, `byLayer`,
   * `bySeverity`, `matrix`) from the retained compound-key entries.
   *
   * Restores the invariant (counters == sum of map entries) after ANY entry
   * removal — TTL prune (`pruneExpired`) or size-cap eviction (a `CappedMap`
   * FIFO eviction on insert). Without this, eviction would leave the counters
   * over-counting relative to the retained entries.
   */
  private recomputeAggregates(): void {
    this.totalRejections = 0;
    this.byLayer = { 'content-validator': 0, 'strict-mode-block': 0, 'escape-function': 0 };
    this.bySeverity = { high: 0, medium: 0 };
    this.matrix = {
      'content-validator': { high: 0, medium: 0 },
      'strict-mode-block': { high: 0, medium: 0 },
      'escape-function': { high: 0, medium: 0 },
    };

    for (const { layer, severity, count } of this.byCompoundKey.values()) {
      this.totalRejections += count;
      this.byLayer[layer] += count;
      this.bySeverity[severity] += count;
      this.matrix[layer][severity] += count;
    }
  }

  /** Get a snapshot of all collected security metrics. */
  getSnapshot(): SecurityRejectionSnapshot {
    this.pruneExpired();

    // Aggregate by pattern name across all layers/severities for the snapshot
    const patternTotals = new Map<string, number>();
    let oldestEntryAt: number | null = null;
    for (const { pattern, count, lastSeen } of this.byCompoundKey.values()) {
      patternTotals.set(pattern, (patternTotals.get(pattern) ?? 0) + count);
      if (oldestEntryAt === null || lastSeen < oldestEntryAt) {
        oldestEntryAt = lastSeen;
      }
    }
    const byPattern = Array.from(patternTotals.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalRejections: this.totalRejections,
      byLayer: { ...this.byLayer },
      bySeverity: { ...this.bySeverity },
      byPattern,
      matrix: {
        'content-validator': { ...this.matrix['content-validator'] },
        'strict-mode-block': { ...this.matrix['strict-mode-block'] },
        'escape-function': { ...this.matrix['escape-function'] },
      },
      oldestEntryAt,
    };
  }

  /**
   * Export metrics in Prometheus text exposition format (v0.0.4).
   *
   * Example output:
   * ```
   * # HELP security_guard_rejections_total Total content rejections by defense layer
   * # TYPE security_guard_rejections_total counter
   * security_guard_rejections_total{layer="content-validator",severity="high",pattern="script-tag"} 5
   * ```
   */
  toPrometheusText(): string {
    this.pruneExpired();

    const lines: string[] = [
      '# HELP security_guard_rejections_total Total content rejections by defense layer',
      '# TYPE security_guard_rejections_total counter',
    ];

    // Output each (layer, severity, pattern) combination with its correct count
    const sorted = Array.from(this.byCompoundKey.values()).sort((a, b) =>
      b.count - a.count,
    );
    for (const { layer, severity, pattern, count } of sorted) {
      lines.push(
        `security_guard_rejections_total{layer="${sanitizePrometheusLabel(layer)}",severity="${sanitizePrometheusLabel(severity)}",pattern="${sanitizePrometheusLabel(pattern)}"} ${count}`,
      );
    }

    // Also output per-layer totals
    lines.push('');
    lines.push('# HELP security_guard_rejections_by_layer Rejections by layer');
    lines.push('# TYPE security_guard_rejections_by_layer gauge');
    for (const layer of Object.keys(this.byLayer) as SecurityLayer[]) {
      lines.push(
        `security_guard_rejections_by_layer{layer="${layer}"} ${this.byLayer[layer]}`,
      );
    }

    lines.push('');
    lines.push('# HELP security_guard_rejections_by_severity Rejections by severity');
    lines.push('# TYPE security_guard_rejections_by_severity gauge');
    for (const sev of Object.keys(this.bySeverity) as Severity[]) {
      lines.push(
        `security_guard_rejections_by_severity{severity="${sev}"} ${this.bySeverity[sev]}`,
      );
    }

    return lines.join('\n');
  }

  /** Reset all collected metrics. */
  reset(): void {
    this.totalRejections = 0;
    this.byLayer = { 'content-validator': 0, 'strict-mode-block': 0, 'escape-function': 0 };
    this.bySeverity = { high: 0, medium: 0 };
    this.byCompoundKey.clear();
    this.matrix = {
      'content-validator': { high: 0, medium: 0 },
      'strict-mode-block': { high: 0, medium: 0 },
      'escape-function': { high: 0, medium: 0 },
    };
  }
}

/**
 * Global singleton for application-wide security metrics.
 *
 * Integration points:
 * - ExportContentValidator: call `recordFindings('content-validator', findings)` after validation
 * - EnhancedExportEngine: call `recordRejection('strict-mode-block', 'high', pattern)` when strict mode blocks
 */
/**
 * Read TTL configuration from SECURITY_METRICS_TTL_MS environment variable.
 * Returns 0 if unset or invalid (TTL disabled).
 */
function resolveTtlFromEnv(): number {
  const raw = process.env['SECURITY_METRICS_TTL_MS'];
  if (!raw) return 0;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

export const securityMetricsCollector = new SecurityMetricsCollector();
