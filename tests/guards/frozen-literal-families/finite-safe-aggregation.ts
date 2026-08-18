import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 18 (specs/finite-safe-aggregation): external-origin aggregations
   * (LLM scores, response times, transcription timestamps, job times) MUST
   * delegate to safeSum/safeMean/safeMax/safeMin in src/lib/metrics-utils.ts.
   * Two rules below — (1) a files-pinned regression rule banning the EXACT
   * legacy expressions removed in waves 2-6 (so the same line cannot be
   * pasted back), and (2) a roots-swept discovery rule catching NEW files in
   * the migrated module families that grow a raw `(a,b)=>a+b` mean or a
   * Math.min/max spread. Per REQ-402 the discovery rule deliberately does NOT
   * ban `reduce((sum,` / count aggregations — keyphrase-length, match-count
   * and `.length` sums are structurally finite and stay inline.
   */
  {
    id: 'finite-safe aggregation: exact legacy expressions stay migrated (waves 2-6 site pins)',
    files: [
      'src/analysis/llm-service.ts',
      'src/analysis/diagram-detector.ts',
      'src/analysis/scene-segmenter.ts',
      'src/quality/enhanced-error-recovery.ts',
      // Split 2026-08: the loadMetrics means/timestamp sites below moved here.
      'src/quality/error-recovery/load-balanced-executor.ts',
      'src/export/production-exporter.ts',
      // round 19 (TASK-0010): monitoring continent + interface-value means.
      'src/monitoring/production-monitor.ts',
      'src/quality/error-recovery-health-tracker.ts',
      // round 20 (TASK-0011): framework + api continents.
      'src/api/batch-processing-api.ts',
      'src/framework/recursive-custom-instructions.ts',
      'src/framework/continuous-learner.ts',
    ],
    patterns: [
      // llm-service wave 2 (response-time means).
      /flashResponseTimes\.reduce\(\(a, b\) => a \+ b, 0\)/,
      /proResponseTimes\.reduce\(\(a, b\) => a \+ b, 0\)/,
      /responseTimeHistory\.reduce\(\(a, b\) => a \+ b, 0\)/,
      // diagram-detector wave 3 (pattern max + test-score mean).
      /Math\.max\(\.\.\.patternScores\)/,
      /reduce\(\(sum, result\) => sum \+ result\.score, 0\)/,
      // scene-segmenter wave 4 (duration mean).
      /sum \+ \(seg\.endMs - seg\.startMs\), 0\)/,
      // enhanced-error-recovery wave 5 (timestamp spreads).
      /Math\.max\(\.\.\.similarErrors\.map\(e => e\.timestamp\)\)/,
      /Math\.min\(\.\.\.allErrors\.map\(e => e\.timestamp\)\)/,
      /Math\.max\(\.\.\.allErrors\.map\(e => e\.timestamp\)\)/,
      // production-exporter wave 6 (duration sum + processing-time mean).
      /sum \+ Math\.max\(0, scene\.durationMs \|\| 0\), 0\)/,
      /sum \+ \(job\.endTime! - job\.startTime!\)/,
      // enhanced-error-recovery round 19 (loadMetrics interface means
      // 355-357/420 + the pre-filtered 471/821 folds).
      /currentMetrics\.reduce\(\(sum, m\) => sum \+ m\.(averageResponseTime|errorRate|memoryPressure), 0\)/,
      /recentMetrics\.reduce\(\(sum, m\) => sum \+ m\.averageResponseTime, 0\)/,
      /requestStats\.avgResponseTime = recentMetrics\.reduce/,
      // production-monitor round 19 (raw mean + hand-rolled floor-rank p95/p99
      // + component incremental mean over raw latency).
      /processingTimes\.reduce\(\(a, b\) => a \+ b, 0\)/,
      /Math\.floor\(sorted\.length \* 0\.9[0-9]*\)/,
      /sorted\[p9[59]Index\] \|\| 0/,
      /compMetrics\.averageLatency \* \(compMetrics\.successes - 1\)/,
      // error-recovery-health-tracker round 19 (interface-value mean over
      // report.summary.recoverySuccessRate).
      /this\.samples\.reduce\(\(a, s\) => a \+ s\.recoverySuccessRate, 0\)/,
      // batch-processing-api round 20 (interface-field quality summary:
      // SimplePipelineResult.qualityScore crosses the pipeline→REST boundary).
      /qualityScores\.reduce\(\(sum, score\) => sum \+ score, 0\)/,
      // recursive-custom-instructions round 20 (module-score validity filter
      // that ADMITTED NaN/±Infinity — `typeof v === 'number'` is exactly the
      // wrong predicate for "valid metric").
      /filter\(v => typeof v === 'number'\)/,
      // continuous-learner round 20 (userFeedback interface means over the
      // unvalidated learnFromUserFeedback boundary; `|| 0` zero-substituted).
      /sum \+ \(d\.userFeedback \|\| 0\), 0\)/,
    ],
    minSweptFiles: 10,
  },

  {
    id: 'finite-safe aggregation: no NEW raw (a,b)=>a+b mean or min/max spread in migrated module families',
    roots: ['src/analysis', 'src/quality', 'src/export', 'src/monitoring', 'src/framework', 'src/api'],
    exclude: {
      // T2-deferred sites, verified finite-by-construction or internally
      // generated — full line-level inventory in
      // specs/finite-safe-aggregation/tasks/sweep-20260815.md. When a future
      // wave migrates a file below, shrink its exclusion (or drop it).
      'src/analysis/diagram-detector.ts':
        'T2-deferred: internal qualityFactors raw mean (1386) + statistical-enable threshold spread (1451, internal qualityScores)',
      'src/analysis/scene-segmenter.ts':
        'T2-deferred: sanitizeFinite-guarded confidence spread (595), semantic-enable threshold spread (783), factorValues raw mean (719)',
      'src/quality/quality-monitor.ts':
        'T2-deferred: internally generated raw means (310/781/810/845) + layout-origin coordinate-range spreads (448-449)',
      'src/quality/error-recovery-health-tracker.ts':
        'T2-deferred: raw means over internally generated deltas (203/243/245) — avgRecovery migrated in round 19 (TASK-0010)',
      'src/quality/recovery-telemetry-aggregator.ts':
        'T2-deferred: raw means over internally generated recovery times (155/180)',
      'src/quality/adaptive-quality-gates.ts':
        'T2-deferred: raw means over internally generated half-samples (547-548)',
      'src/monitoring/real-time-performance-monitor.ts':
        'T2-deferred: raw means over process.memoryUsage()-derived samples, guarded length>0 (587/590); percentiles already delegate to percentileCeil',
      // Round 20 (TASK-0011): the framework continent's remaining raw means
      // are over learningDatabase fields with a SINGLE internal producer —
      // simple-pipeline passes Date.now()-diff processingTime and
      // literal/clamped qualityScore at every one of its 8 call sites
      // (recovery-telemetry exclusion precedent). Population guards present
      // (length===0 continue / <2 return / <10 return / Math.max(len,1)).
      // The userFeedback interface means (was 497/502) migrated in round 20.
      'src/framework/continuous-learner.ts':
        'T2-deferred: internally generated processingTime/qualityScore means (381, 760-761) + pearson folds over isFinite-pre-filtered pairs — single finite producer (simple-pipeline), population-guarded',
    },
    patterns: [
      /\.reduce\(\(a, b\) => a \+ b, 0\)\s*\//,
      /Math\.max\(\.\.\./,
      /Math\.min\(\.\.\./,
    ],
    minSweptFiles: 90,
  },

  /**
   * Round 19 (TASK-0010): floor/ceil-rank percentile INDEX ARITHMETIC must
   * delegate to computePercentiles / percentileCeil in src/lib/metrics-utils.
   * production-monitor carried the last hand-rolled floor-rank twin
   * (`sorted[Math.floor(sorted.length * 0.95)] || 0`), whose inline shape had
   * drifted from the canonical helper (no index clamp, `|| 0` falsy fallback
   * that coerced a NaN percentile to a fast-looking 0). adaptive-quality-gates
   * is NOT an offender: its `Math.floor((n - 1) * p)` linear-interpolation
   * rank is a deliberately distinct method (documented in-source) and this
   * pattern does not match it.
   */
  {
    id: 'percentile family: no hand-rolled floor/ceil-rank index arithmetic outside metrics-utils',
    roots: ['src/analysis', 'src/quality', 'src/monitoring', 'src/export'],
    patterns: [
      /Math\.(floor|ceil)\([a-zA-Z]+\.length \* 0\.9[0-9]*\)/,
    ],
    minSweptFiles: 65,
  },
];
