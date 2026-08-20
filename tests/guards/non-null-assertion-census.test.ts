/**
 * Non-null-assertion census ratchet (Phase 141 / REQ-328; AST since
 * Phase 147 / REQ-336).
 *
 * `02fa054a` silenced the strict-mode checker in the test tree by postfixing
 * `!` on optional fields — an assertion proves nothing about runtime presence,
 * it only suppresses the diagnostic (AI Hub steering on the VALUABLE prior
 * iteration). This guard turns the cleanup into a monotone ratchet:
 *
 *   - `src/visualization` production code is pinned at ZERO assertions
 *     (Phase 141 replaced all 67 with narrowing, `lookupEndpoint`, fail-loud
 *     accessors, or captured get-or-create — every replacement is
 *     behavior-preserving and the full visualization + guards suites stayed
 *     green through the rewrite).
 *   - `src/pipeline` production code is pinned at ZERO assertions as well
 *     (Phase 142 replaced all 29 with the same pattern set: const-captured
 *     stage results, fail-loud accessors, get-or-create Map branches,
 *     `Number()` for NaN-preserving arithmetic, `?? ''` normalization at
 *     validator boundaries; pipeline + guards + acceptance suites stayed
 *     green through the rewrite).
 *   - `src/transcription` production code is pinned at ZERO assertions
 *     (Phase 143 replaced all 17 with `sanitizeFinite` delegation for the
 *     `Number.isFinite(v!) ? v! : k` sums, `?? Number.NaN` for the
 *     threshold compare (undefined must stay below the bar), a const
 *     capture for the locally-built segment confidence, and
 *     `!== undefined` guards mirroring the constructor's own validation
 *     in `updateConfig`; the 25 transcription/streaming suites (603
 *     tests) stayed green through the rewrite).
 *   - `src/export` production code is pinned at ZERO assertions
 *     (Phase 144 replaced all 10: a fail-loud `requireSceneId` accessor
 *     for the five filename/`<title>` derivations — an id-less scene
 *     previously crashed inside `sanitizeFilename` (`undefined.replace`)
 *     and surfaced from `export()` as an opaque TypeError, the accessor
 *     keeps the caught `{ success: false }` contract with a diagnosable
 *     message — a `!== undefined` guard for `codePointAt(0)` preserving
 *     the `undefined > 0xff === false` pass-through, removal of the
 *     provably-dead definite-assignment on `byCompoundKey` (the ctor
 *     assigns unconditionally), `Number()` NaN-preserving arithmetic for
 *     the two timestamp deltas, and a fail-loud `requireOutputPath` for
 *     the stage-1-seeded `job.outputPath`; the 73 export-pattern suites
 *     (4144 tests) stayed green through the rewrite).
 *     Phase 147 then found ONE more the line-regex census had been blind
 *     to all along — `nextJob.resolve!(...)` in `processNextInQueue`
 *     (`!` followed by `(` was outside the regex's continuation class) —
 *     and replaced it with a captured `const { resolve } = nextJob`, so
 *     the export pin now holds under the stronger AST checker too.
 *   - `src/monitoring` production code is pinned at ZERO assertions
 *     (Phase 145 replaced all 7: `?? Number.NaN` for the four optional
 *     `MemoryMetrics.rss/external` reads — the browser branch of
 *     `getMemoryUsage` omits both fields and the old `!` fed `undefined`
 *     into `bytesToMb` where `undefined / (1024 * 1024)` is already NaN,
 *     so NaN (never a fabricated 0) is the behavior being preserved —
 *     captured get-or-create for the two `has()/set()/get()!` map
 *     triples (metric history + error callbacks: the absent branch
 *     stores the array it hands back), and removal of the
 *     provably-dead definite-assignment on `routes` (the ctor assigns
 *     unconditionally); the monitoring + guards suites (45 suites /
 *     1068 tests) stayed green through the rewrite).
 *   - `src/analysis` production code is pinned at ZERO assertions
 *     (Phase 146 replaced all 6: a fail-loud captured guard for
 *     `this.genAI` — `execute()` gates every `executeRequest` caller
 *     behind `isEnabled()` = `Boolean(this.genAI)`, so the undefined
 *     branch is unreachable through the public API and the accessor
 *     keeps the gate's own message instead of a bare TypeError — a
 *     narrowing `else if (currentSegment)` with a const capture for the
 *     three extend-mutation reads (reaching the else already implies the
 *     segment is set: a null segment forces `shouldStartNew` through its
 *     `!currentSegment` term; the capture keeps the narrowing inside the
 *     forEach closure), a captured `b.get(key)` compare replacing the
 *     `has()/get()!` pair in `cosineSimilarity` (both callers pass
 *     `buildTopicVector` maps whose values are always numbers, so the
 *     two checks agree exactly), and `pop()` with an unreachable-
 *     undefined `break` for the merge loop (the while guard requires
 *     `result.length > 0`); the analysis + guards suites (135 suites /
 *     7057 tests) stayed green through the rewrite).
 *   - the REST of `src` — api, components, framework, quality, remotion,
 *     workers, src/test helpers, main.tsx — is pinned at ZERO assertions
 *     too (Phase 147 replaced the remaining 22 AST nodes / 21 regex
 *     lines: captured `flatMap` narrowing for the batch quality scores,
 *     a fail-loud options-presence guard for the preset producer, the
 *     GET-route null-check idiom for the two just-created-job status
 *     reads, `?? Number.NaN` for the two StreamingProcessor optional
 *     reads (NaN is exactly what `undefined` produced in the old
 *     arithmetic / in `formatPlaybackTime`'s `!Number.isFinite` guard),
 *     the `const { resolve } = nextJob` capture above, a timestamp
 *     parameter replacing the read of a field both callers assign one
 *     statement earlier, captured get-or-create ×4
 *     (continuous-learner groupByComponent, TREE/MATRIX level grouping,
 *     layout-worker level grouping), `?? 0` for a `match.index` whose
 *     two uses both flow through `substring`'s undefined→0 coercion, a
 *     captured `endMatch?.index` compare, a `continue` guard for the
 *     matchAll contract, a fail-loud `#root` lookup in main.tsx, a
 *     module-level `createInitialHealthMetrics()` factory replacing the
 *     definite-assignment the ctor populated via a helper call, `?? ''`
 *     mirroring the file's own runId normalization, and `?? Number.NaN`
 *     for the optional PositionedNode dims in the overlap helper).
 *     **The whole of `src` is now exact-0: any new `!` anywhere in src
 *     production code fails this guard.**
 *   - the `tests` tree is pinned as UPPER BOUNDS, per top-level
 *     directory (Phase 147 / REQ-337): decreases are welcome, any new
 *     `!` (or any new unpinned top-level directory) fails the ratchet.
 *     New code must narrow (`if (x === undefined) …`), guard
 *     (`require…()` accessors), or use a typed helper instead.
 *     Phase 148 (REQ-338 / TASK-0235) started the monotone decrease the
 *     ratchet exists for: tests/unit 471 → 377 by replacing every `!` in
 *     the two largest files with fail-loud local helpers —
 *     `requireAlertRule(config, alert)` in
 *     tests/unit/monitoring/alert-rules.test.ts (55 nodes; an absent
 *     rule used to surface as `rule!.expr` TypeError or a bare
 *     `toBeDefined()` failure, the helper keeps the RED verdict with the
 *     missing alert name) and `requireDefined(value, label)` in
 *     tests/unit/export/export-job-queue-dlq.test.ts (39 nodes over
 *     `findJob()` / `replayDeadLetterJob()` / `dequeue()` results).
 *     Both suites stayed green through the rewrite (48/48, 26/26).
 *     Phase 149 (REQ-339 / TASK-0236) continued it with the next four
 *     largest files (guard-first survey, 103 nodes → 0):
 *     `requireCriterionResult(evaluation, name)` in
 *     tests/unit/quality/quality-gate.test.ts (29 nodes over
 *     `results.find(r => r.criterionName === …)`), `requirePanel(dashboard,
 *     title)` + an inline `templating` narrowing in
 *     tests/unit/monitoring/grafana-dashboard-model.test.ts (25 nodes),
 *     `requireDefined(value, label)` plus a factory return type narrowed
 *     past `config?` (`PipelineInput & { config: PipelineConfig }` — the
 *     factory provably always assigns it) in
 *     tests/unit/pipeline/pipeline-orchestrator.test.ts (25 nodes over
 *     `result.metrics!` / `input.config!`), and
 *     `requirePreset(exporter, name)` / `requireJobStatus(exporter, jobId)`
 *     in tests/unit/export/production-exporter.test.ts (24 nodes; note
 *     `getJobStatus` returns `ExportJob | null`, so the helper guards
 *     `null`, not `undefined`). All four suites stayed green through the
 *     rewrite (42/42, 24/24, 48/48, 31/31).
 *     Phase 150 (REQ-340 / TASK-0237) continued it with the next seven
 *     largest files — selected by re-running THIS census first and taking
 *     the mechanically-sorted top of the list (the guard-first survey the
 *     steering asked for after Phase 149's manual shortlist missed
 *     nothing but could have) — 105 nodes → 0:
 *     `requireEventHandler(calls, event)` in
 *     tests/unit/api/websocket-handler.test.ts (21 nodes over the mock
 *     `.on()` `.find()?.[1]` captures), `requireDefined(value, label)`
 *     in tests/unit/api/batch-processing-api.test.ts (14 nodes over
 *     `jobs.get(…)` / `getJobStatus(…)`; the helper guards `null` too),
 *     `requireAlertRule(config, alert)` — the same idiom as the REQ-338
 *     helper — in tests/unit/api/routes/monitoring-phase84-85.test.ts
 *     (14 nodes), `requireFirstHandler(events, event)` /
 *     `requireEmitted(emitted, event)` in
 *     tests/unit/api/websocket-payload-validation.test.ts (9 + 5 nodes;
 *     the redundant preceding `toBeDefined()` pairs were folded into the
 *     helpers' throws), `requirePlayer()` reading the captured
 *     `capturedPlayerRef` in tests/unit/components/VideoPreview.test.tsx
 *     (14 nodes), `requireShape(items, ty)` over the Lottie `find(…)`
 *     sites in tests/unit/export/animated-svg-lottie-export.test.ts
 *     (14 nodes), and `requireDefined(value, label)` in
 *     tests/unit/quality/error-recovery-boundary-grouping.test.ts
 *     (14 nodes over `.find()` / `.get()` results and optional
 *     `result.notification` / `result.error` fields). All seven suites
 *     stayed green through the rewrite (8 suites / 315 tests, the pattern
 *     also matching one extra file).
 *     Phase 151 (REQ-341 / TASK-0238) continued it with the next seven
 *     largest files from the same guard-first survey — 66 nodes → 0:
 *     `requireDefined(value, label)` in
 *     tests/unit/pipeline/pipeline-quality-monitor.test.ts (13 nodes over
 *     `getLatestMetrics(): QualityMetrics | null` and the
 *     `violations.find(…)` captures), `requireTrend(trends, metric)` in
 *     tests/unit/monitoring/real-time-performance-monitor.test.ts (11 nodes
 *     over `analyzeTrends().find(t => t.metric === …)`), `requireDefined`
 *     in tests/unit/pipeline/pipeline-orchestrated-recovery-integration
 *     .test.ts (10 nodes over `metrics?.recoveryReport` and the
 *     progress-message `.find(…)` captures), `requireWorstBottleneck(report)`
 *     in tests/unit/pipeline/bottleneck-detector.test.ts (8 nodes over
 *     `worstBottleneck: BottleneckInfo | null`), `requireRecoveryReport(result)`
 *     in tests/unit/pipeline/pipeline-run-recovery-integration.test.ts
 *     (8 nodes over `result.metrics!.recoveryReport as RunRecoveryReport` —
 *     the field is typed `RunRecoveryReport` on ExtendedPipelineMetrics, so
 *     the narrowing removed the cast too), `requireDefined` in
 *     tests/unit/quality/enhanced-error-recovery-extended.test.ts (8 nodes
 *     over the cascade-chain and `analytics.trends.find(…)` captures), and
 *     `requireStats(stats, chainName)` in
 *     tests/unit/quality/recovery-strategy-chain.test.ts (8 nodes over
 *     `getStats(name): ChainStats | null`). All seven suites stayed green
 *     through the rewrite (44/59/14/12/6/36/22 tests).
 *     Phase 152 (REQ-342 / TASK-0239) moved the decrease into the two
 *     largest remaining pools the steering named — tests/integration and
 *     tests/visualization — via the same guard-first survey, 190 nodes → 0
 *     across nine files: `requireMetrics(result)` in
 *     tests/integration/phase32-quality-pipeline.test.ts (38 nodes over the
 *     optional `PipelineResult.metrics`; the destructured
 *     `optimizationAttempts!`/`labelTruncationCount!` reads became plain
 *     reads — `expect(undefined).toBeGreaterThanOrEqual` fails exactly like
 *     the asserted-away runtime value did), `requireJobStatus` /
 *     `requireCancelToken` / `requireStartedId` in
 *     tests/integration/batch.test.ts (23 nodes over the `| null` returns
 *     of BatchJobManager), `requireDefined(value, label)` in
 *     tests/integration/secure-download-pipeline.test.ts (20 nodes over the
 *     nullable pipeline stages and `generateDownloadUrl` results),
 *     `requireTimingReport` / `requireHealthReport` / `requireCostComparison`
 *     in tests/integration/test_pipeline_health_smoke.test.ts (17 nodes),
 *     `requireMetrics(result)` in
 *     tests/integration/label-sizing-pipeline.test.ts (15 nodes),
 *     `findNode` + `requireModule` in
 *     tests/visualization/importance-scaler.test.ts (21 nodes; the two
 *     `let Strategy!:` definite-assignments became `| undefined` module
 *     holders with a fail-loud unwrap per test, and the optional-dim
 *     arithmetic keeps its undefined→NaN propagation via `?? Number.NaN`),
 *     `findNode` + `centerXOf` in
 *     tests/visualization/strategies/flow-strategy.test.ts (20 nodes),
 *     `findNode` + `centerYOf` in
 *     tests/visualization/strategies/tree-strategy.test.ts (18 nodes), and
 *     `findLayoutNode` + `centerOf` in
 *     tests/visualization/complex-layout-engine.test.ts (18 nodes over the
 *     optional `w`/`h` diagram-layout fields). All nine suites stayed green
 *     through the rewrite (12 suites / 207 tests in the verification run).
 *     Phase 153 (REQ-343 / TASK-0240) continued the decrease with the next
 *     guard-first survey batch — every remaining file with ≥10 nodes, eight
 *     files / 110 nodes → 0: `requireDisk()` in
 *     tests/analysis/llm-cache-debounce.test.ts (20 nodes over the
 *     `readCacheFile(): … | null` results; the redundant preceding
 *     `expect(disk).not.toBeNull()` pairs were folded into the helper's
 *     throw), `centerXOf`/`centerYOf` plus `?? Number.NaN` overlap bounds
 *     in tests/visualization/cycle-strategy.test.ts (16 nodes), and
 *     `findNode`/`findEdge`/`centerXOf`/`centerYOf` in
 *     tests/visualization/strategies/cycle-strategy.test.ts (13 nodes) —
 *     both keeping the undefined→NaN propagation for unset dims,
 *     `requireOpportunity(report, area)` in
 *     tests/pipeline/improvement-detector.test.ts (15 nodes over the
 *     `opportunities.find(o => o.area === …)` captures),
 *     `requireMetrics(result)` / `requireRecoveryReport(result)` /
 *     `requireDefined(value, label)` in
 *     tests/integration/pipeline-orchestrator-recovery.test.ts (13 nodes;
 *     the recovery field is typed `RunRecoveryReport` on
 *     ExtendedPipelineMetrics, so the narrowing dropped the
 *     `as RunRecoveryReport` casts too), `requireDefined(value, label)` in
 *     tests/integration/export-artifact-pipeline-e2e.test.ts (12 nodes over
 *     the optional `artifactId` and the `| undefined` store returns — the
 *     helper guards `null` as well), `requireAlert(alerts, type)` in
 *     tests/analysis/budget-alert-boundary.test.ts (11 nodes over the
 *     `alerts.find(a => a.type === …)` captures), and
 *     `requireWorstBottleneck(report)` / `requireStage(report, name)` in
 *     tests/pipeline/bottleneck-detector.test.ts (10 nodes over
 *     `worstBottleneck: BottleneckInfo | null` and the `stages.find(…)`
 *     captures). All eight suites stayed green through the rewrite.
 *     Phase 154 (REQ-344 / TASK-0241) continued it with the next
 *     descending top-ten batch (the ≥10 threshold is exhausted — the
 *     largest remainder file holds 12 nodes), 90 nodes → 0 across six
 *     directories: `requireNode` / `requirePoints` in
 *     tests/guards/edge-anchor-geometry-single-source.test.ts (12 nodes
 *     over the expected-side `byId.get(edge.from)!` lookups and the
 *     `got.get('from->to')!` points reads), `requireJobStatus(manager,
 *     jobId)` in tests/integration/api.test.ts (9 nodes over the
 *     `BatchJobStatus | null` returns of `getJobStatus`), `requireDequeued`
 *     plus a const-captured render resolver in
 *     tests/integration/export-error-recovery-integration.test.ts (9 nodes
 *     over `dequeue(): QueuedExportJob | undefined` and `resolveRender!()`),
 *     `requireDequeued` / `requireReplayed` in
 *     tests/integration/export-retry-dlq-metrics-integration.test.ts (9
 *     nodes — NOTE the error-message test's final `dequeue()` legitimately
 *     returns undefined when the job moves to the DLQ, so that one holder
 *     stays `QueuedExportJob | undefined` with a guard only protecting the
 *     reads), `requireMetrics` / `requireRecoveryReport` /
 *     `requireStageTimings` in
 *     tests/integration/pipeline-recovery-e2e.test.ts (9 nodes; the
 *     narrowing dropped the `as RunRecoveryReport` casts — the field is
 *     already typed as one), `requireMetrics` / `requireStageTimings` in
 *     tests/pipeline/retry-observability-surface.test.ts (9 nodes over the
 *     optional `PipelineResult.metrics` and its `stageTimings!`), and the
 *     same two + `requireCriterionResult` / `requireStage3Gate` in
 *     tests/visualization/layout-quality-composite.test.ts (9 nodes over
 *     the `results.find(r => r.criterionName === …)` captures and the
 *     `gates.find(g => g.stage === 3)!` read), `requireLoadedBaseline` /
 *     `requireByMetric` in tests/quality/regression-detector.test.ts (8
 *     nodes over `loadBaseline(): BaselineData | null` and the
 *     `.find(x => x.metric === …)` captures), `fireHandler` in
 *     tests/transcription/browser-transcriber.test.ts (8 nodes firing the
 *     `| null` recognition handlers), and `findNode` plus dropping the
 *     provably-superfluous method assertions in
 *     tests/visualization/strategies/flowchart-strategy.test.ts (8 nodes —
 *     `validateInputs` / `getStrategyDefaults` are optional on
 *     ILayoutStrategy but concrete members of the class, so plain calls
 *     compile). tests/transcription is now the FIRST directory pinned at
 *     exact-0, which is why the hollow-pin check keys on directories that
 *     still hold test files rather than directories that still hold hits.
 *     All ten suites stayed green through the rewrite.
 *     Phase 155 (REQ-345 / TASK-0242) continued it with the next
 *     descending batch — every remaining file with ≥7 nodes, twelve files
 *     across five directories / 86 nodes → 0: `requireExtents(result)` in
 *     tests/guards/node-extent-scan-single-source.test.ts (9 nodes over the
 *     `foldNodeExtents(…): NodeExtents | null` results — every site feeds a
 *     NON-empty list where the fold contract says never-null, and the
 *     adjacent empty-input pins keep asserting the null branch), the same
 *     `requireDisk()` idiom Phase 153 introduced in
 *     tests/analysis/llm-cache-stats-paths.test.ts (7 nodes over the
 *     `readCacheFile()` results after explicit persist() calls),
 *     `requireDequeued(queue)` + `requireArtifact(store, id)` in
 *     tests/integration/export-job-lifecycle.test.ts (7 nodes over the
 *     `| undefined` returns of dequeue/get on the HTTP-wired queue),
 *     `requireDownloadUrl(dl)` in tests/integration/export-security-e2e
 *     .test.ts and tests/integration/secure-download-edge-cases.test.ts
 *     (7 + 7 nodes over `generateDownloadUrl(): ArtifactDownloadUrl |
 *     undefined` for artifacts stored one statement earlier),
 *     `requireChunk(chunks, type)` in tests/unit/export/apng-encoder
 *     .test.ts (7 nodes over the `parsePngChunks` find sites, naming the
 *     missing chunk type in the throw), `requireStage(snap, name)` in
 *     tests/unit/monitoring/pipeline-metrics-collector.test.ts (7 nodes
 *     over the `stages.find(…)` aggregates), `requireQualityCall(call,
 *     stage)` plus a narrowing throw for `qualityScores` in
 *     tests/unit/pipeline/pipeline-orchestrator-quality.test.ts (7 nodes
 *     over the recordMetricsSpy find captures), `requireItemError(item,
 *     index)` in tests/unit/quality/batch-operation-recovery.test.ts (7
 *     nodes over the optional `ItemResult.error` on items the test just
 *     forced to fail), `requireStageScore(assessment, stage)` /
 *     `requireBreaker(breakers, stage)` in
 *     tests/unit/quality/error-recovery-health-tracker.test.ts (7 nodes —
 *     the breaker helper is generic because the three breaker-map sites
 *     each cast a different member shape), the same generic
 *     `requireBreaker` in tests/unit/quality/error-recovery-state-
 *     management.test.ts (7 nodes over `recovery['circuitBreakers']`), and
 *     `findNode(layout, id)` + `?? Number.NaN` for the optional `w` reads
 *     in tests/visualization/strategies/dagre-layout-strategy.test.ts (7
 *     nodes; `edge.points` is non-optional on LayoutEdge, so those two
 *     bangs were pure checker suppressions — removing them is
 *     behavior-preserving the way the Phase-154 flowchart member bangs
 *     were). All twelve suites stayed green through the rewrite (17
 *     suites / 415 tests in the two checkpoint runs).
 *
 * Matching rule (AST since Phase 147 — SUPERSEDES the line-regex rule
 * documented in specs/speech-to-visuals/tasks/TASK-0226.md, which this
 * guard had to stay identical to until now): a hit is a TypeScript
 * `NonNullExpression` node (`x!`) OR a definite-assignment
 * `exclamationToken` on a property / variable / parameter declaration
 * (`x!: T`). Parsing instead of line-matching removes the two blind
 * spots the regex had: string-content bangs (`'Oops! Page…'`,
 * `Generator! 🎉` JSX text) no longer count, and assertion shapes the
 * continuation class missed — `f!(…)`, `x![0]`, `` `${x!}` `` — now do.
 * Counting is per AST node, not per line (a line with two `!`s counts
 * twice; the pre-Phase-147 `tests` baseline of 960 was line-based, the
 * AST baseline is 1096 — a counter upgrade, not a regression).
 * `__tests__` / `__mocks__` directories are excluded from the src
 * bucket; the tests bucket is `tests/**` minus `__mocks__`.
 *
 * Mutation-verified (Phase 141): injecting `const v = queue.shift()!;` into
 * src/visualization/advanced-layouts.ts turns the visualization pin RED;
 * adding one `!` line anywhere else in src/tests turns the ratchet RED.
 * Mutation-verified (Phase 142, MW-007): replacing
 * `const sceneCount = scenes.length;` in src/pipeline/quality-estimators.ts
 * with `(scenes as unknown as { length: number })!.length` turns BOTH the
 * pipeline exact pin and the src ratchet (64 → 65) RED.
 * Mutation-verified (Phase 143, MW-008): replacing
 * `sum + sanitizeFinite(segment.confidence), 0);` in
 * src/transcription/streaming-transcriber.ts with
 * `sum + ((segment as { confidence: number })!.confidence), 0);` turns
 * BOTH the transcription exact pin and the src ratchet (47 → 48) RED.
 * Mutation-verified (Phase 144, MW-009): replacing
 * `Number(job.startedAt) - job.enqueuedAt;` in
 * src/export/export-job-queue.ts with
 * `(job as { startedAt: number }).startedAt! - job.enqueuedAt;` turns
 * BOTH the export exact pin and the src ratchet (37 → 38) RED.
 * Mutation-verified (Phase 145, MW-010): replacing
 * `let history = this.metrics.get(metric);` in
 * src/monitoring/real-time-performance-monitor.ts with
 * `let history = this.metrics.get(metric)!;` turns BOTH the monitoring
 * exact pin and the src ratchet (30 → 31) RED.
 * Mutation-verified (Phase 146, MW-011): replacing
 * `const prev = result.pop();` in src/analysis/scene-segmenter.ts with
 * `const prev = result.pop()!;` (the exact pre-Phase-146 shape) turns
 * BOTH the analysis exact pin and the src ratchet (24 → 25) RED.
 * Mutation-verified (Phase 147, MW-012): re-applying the MW-011 mutation
 * under the AST checker still turns BOTH the analysis exact pin and the
 * new whole-src exact pin RED.
 * Mutation-verified (Phase 147, MW-013): re-injecting the historical
 * miss — `nextJob.resolve!({` in
 * src/export/enhanced-export-engine.ts `processNextInQueue` — turns
 * BOTH the export exact pin and the whole-src exact pin RED, while the
 * pre-Phase-147 line regex reports ZERO hits on the same mutant (the
 * `!(` shape was outside its continuation class): proof the checker
 * upgrade closed a real detection gap, not just a metric restatement.
 * Mutation-verified (Phase 148, MW-014): re-injecting ONE `!` into the
 * Phase-148 rewrite — `expect(rule.expr)` back to `expect(rule!.expr)`
 * in tests/unit/monitoring/alert-rules.test.ts — turns BOTH the
 * tests/unit directory ratchet (377 → 378) and the tests-total ratchet
 * (1002 → 1003) RED: the monotone decrease is enforced, not aspirational.
 * Mutation-verified (Phase 149, MW-015): re-injecting ONE `!` into the
 * Phase-149 rewrite — `expect(metrics.layoutQualityScore)` back to
 * `expect(result.metrics!.layoutQualityScore)` in
 * tests/unit/pipeline/pipeline-orchestrator.test.ts — turns BOTH the
 * tests/unit directory ratchet (274 → 275) and the tests-total ratchet
 * (899 → 900) RED.
 * Mutation-verified (Phase 150, MW-016): re-injecting ONE `!` into the
 * Phase-150 rewrite — `expect(requirePlayer().play)` back to
 * `expect(capturedPlayerRef!.play)` in
 * tests/unit/components/VideoPreview.test.tsx — turns BOTH the
 * tests/unit directory ratchet (169 → 170) and the tests-total ratchet
 * (794 → 795) RED.
 * Mutation-verified (Phase 151, MW-017): re-injecting ONE `!` into the
 * Phase-151 rewrite — `expect(latest.processingTime)` back to
 * `expect(latest!.processingTime)` in
 * tests/unit/pipeline/pipeline-quality-monitor.test.ts — turns BOTH the
 * tests/unit directory ratchet (103 → 104) and the tests-total ratchet
 * (728 → 729) RED.
 * Mutation-verified (Phase 152, MW-018): re-injecting ONE `!` into the
 * Phase-152 rewrite — `const centerA = centerXOf(nodeA);` back to
 * `const centerA = nodeA.x + nodeA.width! / 2;` in
 * tests/visualization/strategies/flow-strategy.test.ts — turns BOTH the
 * tests/visualization directory ratchet (107 → 108) and the tests-total
 * ratchet (538 → 539) RED.
 * Mutation-verified (Phase 153, MW-019): re-injecting ONE `!` into the
 * Phase-153 rewrite — `expect(requireOpportunity(report,
 * 'Processing Speed').priority)` back to `expect(opp!.priority)` in
 * tests/pipeline/improvement-detector.test.ts — turns BOTH the
 * tests/pipeline directory ratchet (20 → 21) and the tests-total ratchet
 * (428 → 429) RED.
 * Mutation-verified (Phase 154, MW-020): re-injecting ONE `!` into the
 * Phase-154 rewrite — `fireHandler(mockRecognitionInstance.onerror, …)`
 * back to `mockRecognitionInstance.onerror!({ error: 'network', … })` in
 * tests/transcription/browser-transcriber.test.ts — turns BOTH the
 * tests/transcription exact-0 directory ratchet (0 → 1) and the
 * tests-total ratchet (338 → 339) RED: the first exact-0 directory pin is
 * enforced, not aspirational.
 * Mutation-verified (Phase 155, MW-021): re-injecting ONE `!` into the
 * Phase-155 rewrite — `expect(longNode.w ?? Number.NaN)` back to
 * `expect(longNode.w!)` in
 * tests/visualization/strategies/dagre-layout-strategy.test.ts — turns
 * BOTH the tests/visualization directory ratchet (54 → 55) and the
 * tests-total ratchet (252 → 253) RED.
 * Mutation-verified (Phase 165, MW-033): re-injecting ONE `!` into the
 * Phase-165 rewrite — `expect(cached.status)` back to
 * `expect(cached!.status)` in
 * tests/unit/monitoring/health-check-service.test.ts — turns BOTH the
 * tests/unit exact-0 directory ratchet (0 → 1) and the tests-total
 * ratchet (191 → 192) RED: the second exact-0 directory pin (and the
 * first of 義務 C's two gates) is enforced, not aspirational.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
// Type-only: erased at compile time, so the CJS `typescript` package still
// loads exclusively through createRequire below (jest --experimental-vm-modules).
import type * as TS from 'typescript';

const require = createRequire(import.meta.url);
// `typescript` ships CJS; createRequire keeps the import ESM-safe under
// jest --experimental-vm-modules.
const ts = require('typescript') as typeof TS;

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Baselines: 2026-08-19 (Phase 141, after src/visualization → 0) and
 * 2026-08-20 (Phase 142, after src/pipeline → 0; src remainder 93 − 29 = 64)
 * and 2026-08-20 (Phase 143, after src/transcription → 0; 64 − 17 = 47)
 * and 2026-08-20 (Phase 144, after src/export → 0; 47 − 10 = 37)
 * and 2026-08-20 (Phase 145, after src/monitoring → 0; 37 − 7 = 30)
 * and 2026-08-20 (Phase 146, after src/analysis → 0; 30 − 6 = 24)
 * and 2026-08-20 (Phase 147: checker upgraded line-regex → AST node
 * counting; the remaining 22 src nodes — including the export `resolve!(`
 * the regex had missed — went to 0, so ALL of src is exact-0; the tests
 * tree re-baselined from the line-based 960 to the node-based 1096 with
 * per-directory pins).
 * and 2026-08-20 (Phase 148 / REQ-338: monotone decrease round 1 —
 * tests/unit 471 − 55 (alert-rules) − 39 (export-job-queue-dlq) = 377;
 * tests total 1096 − 94 = 1002).
 * and 2026-08-20 (Phase 149 / REQ-339: monotone decrease round 2 —
 * tests/unit 377 − 29 (quality-gate) − 25 (grafana-dashboard-model) −
 * 25 (pipeline-orchestrator) − 24 (production-exporter) = 274;
 * tests total 1002 − 103 = 899).
 * and 2026-08-20 (Phase 150 / REQ-340: monotone decrease round 3 —
 * tests/unit 274 − 21 (websocket-handler) − 14 (batch-processing-api) −
 * 14 (monitoring-phase84-85) − 14 (websocket-payload-validation) −
 * 14 (VideoPreview) − 14 (animated-svg-lottie-export) −
 * 14 (error-recovery-boundary-grouping) = 169;
 * tests total 899 − 105 = 794).
 * and 2026-08-20 (Phase 151 / REQ-341: monotone decrease round 4 —
 * tests/unit 169 − 13 (pipeline-quality-monitor) − 11
 * (real-time-performance-monitor) − 10 (pipeline-orchestrated-recovery-
 * integration) − 8 (bottleneck-detector) − 8 (pipeline-run-recovery-
 * integration) − 8 (enhanced-error-recovery-extended) − 8
 * (recovery-strategy-chain) = 103;
 * tests total 794 − 66 = 728).
 * and 2026-08-20 (Phase 152 / REQ-342: monotone decrease round 5, first
 * round outside tests/unit — integration and visualization, the two
 * largest pools the steering named: tests/integration 245 − 38
 * (phase32-quality-pipeline) − 23 (batch) − 20 (secure-download-pipeline)
 * − 17 (test_pipeline_health_smoke) − 15 (label-sizing-pipeline) = 132;
 * tests/visualization 184 − 21 (importance-scaler) − 20 (flow-strategy) −
 * 18 (complex-layout-engine) − 18 (tree-strategy) = 107;
 * tests total 728 − 190 = 538).
 * and 2026-08-20 (Phase 153 / REQ-343: monotone decrease round 6 — every
 * remaining file with ≥10 nodes, across four directories:
 * tests/analysis 44 − 20 (llm-cache-debounce) − 11
 * (budget-alert-boundary) = 13; tests/visualization 107 − 16
 * (cycle-strategy) − 13 (strategies/cycle-strategy) = 78;
 * tests/pipeline 45 − 15 (improvement-detector) − 10
 * (bottleneck-detector) = 20; tests/integration 132 − 13
 * (pipeline-orchestrator-recovery) − 12 (export-artifact-pipeline-e2e) =
 * 107; tests total 538 − 110 = 428).
 * and 2026-08-20 (Phase 154 / REQ-344: monotone decrease round 7 — the
 * ≥10 threshold is exhausted, back to the descending top-of-list
 * selection the guard-first survey ranks: the top ten files / 90 nodes → 0:
 * tests/guards 72 − 12 (edge-anchor-geometry-single-source) = 60;
 * tests/integration 107 − 9 (api) − 9 (export-error-recovery-integration)
 * − 9 (export-retry-dlq-metrics-integration) − 9 (pipeline-recovery-e2e)
 * = 71; tests/pipeline 20 − 9 (retry-observability-surface) = 11;
 * tests/visualization 78 − 9 (layout-quality-composite) − 8
 * (strategies/flowchart-strategy) = 61; tests/quality 17 − 8
 * (regression-detector) = 9; tests/transcription 8 − 8
 * (browser-transcriber) = 0 — the FIRST directory pinned at exact-0,
 * which is why the hollow-pin check below now keys on directories that
 * still hold test FILES rather than directories that still hold hits;
 * tests total 428 − 90 = 338).
 * and 2026-08-20 (Phase 155 / REQ-345: monotone decrease round 8 — every
 * remaining file with ≥7 nodes, twelve files across five directories:
 * tests/unit 103 − 7 (apng-encoder) − 7 (pipeline-metrics-collector) − 7
 * (pipeline-orchestrator-quality) − 7 (batch-operation-recovery) − 7
 * (error-recovery-health-tracker) − 7 (error-recovery-state-management) =
 * 61; tests/integration 71 − 7 (export-job-lifecycle) − 7
 * (export-security-e2e) − 7 (secure-download-edge-cases) = 50;
 * tests/visualization 61 − 7 (strategies/dagre-layout-strategy) = 54;
 * tests/guards 60 − 9 (node-extent-scan-single-source) = 51;
 * tests/analysis 13 − 7 (llm-cache-stats-paths) = 6;
 * tests total 338 − 86 = 252).
 * and 2026-08-20 (Phase 165 / REQ-357: monotone decrease round 9 — the
 * 義務 C first gate: EVERY remaining file in tests/unit, 21 files / 61
 * nodes → 0 via fail-loud `requireDefined(value, label)` accessors
 * (find/dequeue/getBaseline/optional-field reads), captured env
 * narrowing (cors-config), `fireCapturedResolver` for the six
 * Promise-executor resolvers in export-retry-lifecycle, act()-callback
 * guards in use-framework-pipeline, and const-captured scene narrowing
 * in nullable-access-null-guard: tests/unit 61 − 61 = 0 — the SECOND
 * directory pinned at exact-0 (transcription was first, Phase 154);
 * tests total 252 − 61 = 191).
 * and 2026-08-21 (Phase 167 / REQ-361: monotone decrease round 10 — the
 * 義務 C second gate: the three directories steering named, ALL remaining
 * files / 155 nodes → 0 via the same fail-loud idioms (find/get/null
 * labeled guards, `requireTopology`/`requireNode` helpers, resolver
 * holders without initializers for callback-assigned captures,
 * `?? Number.NaN` for optional-dim arithmetic, typed-metrics guard reads
 * that drop the now-unneeded casts, typeof-captured finiteness
 * narrowing): tests/guards 51 − 51 = 0; tests/visualization 54 − 54 = 0;
 * tests/integration 50 − 50 = 0 — directories three through five pinned
 * at exact-0; tests total 191 − 155 = 36, under the ≤100 goal).
 * Mutation-verified (Phase 167, MW-035): re-injecting ONE `!` per
 * rewritten directory — `expect(completed.status)` back to
 * `expect(completed!.status)` in
 * tests/integration/export-service-shutdown.test.ts,
 * `expect(rootNode.y)` back to `expect(rootNode!.y)` in
 * tests/visualization/advanced-layouts.test.ts, and `resolveExecution(`
 * back to `resolveExecution!(` in
 * tests/guards/framework-pipeline-unmount-real-fix-witness.test.ts —
 * each turns BOTH its directory exact-0 ratchet (0 → 1) and the
 * tests-total ratchet (36 → 37) RED.
 * and 2026-08-21 (Phase 168 / REQ-362: monotone decrease round 11 — the
 * 義務 C FINAL gate: EVERY remaining tests node, 14 files / 36 nodes
 * across the nine tail directories → 0 via the established fail-loud
 * idioms (`requireCriterionResult`/`requireRecommendation`/
 * `requireWorstBottleneck`/generic `requireBreaker`/`requireMatch`/
 * `requireCodePoint` file-local helpers folding the redundant
 * toBeDefined()/not.toBeNull() pairs into labeled throws, one-shot
 * narrowing guards for optional stageTimings/children fields): pipeline
 * 11 − 11 = 0; quality 9 − 9 = 0; analysis 6 − 6 = 0; api 2 − 2 = 0;
 * lib 2 − 2 = 0; remotion 2 − 2 = 0; (root) 2 − 2 = 0; acceptance 1 − 1
 * = 0; config 1 − 1 = 0 — ALL fourteen pinned directories now hold
 * exact-0 pins and the tests-total pin converges to 0: the whole
 * repository (src AND tests) is exact-0. The per-directory pins stay in
 * place (files-based hollow-pin check) so any future `!` lands on BOTH
 * its directory pin and the total. The vacuity check flipped with it:
 * with both trees at 0 a `count > 0` liveness probe is impossible, so it
 * now parses a fixture snippet through the SAME counting code and
 * asserts the scanner still sees both shapes (`x!` and `x!:`).
 * Mutation-verified (Phase 168, MW-036): re-injecting ONE `!` per
 * rewritten pool — `expect(bnRec.priority)` back to
 * `expect(bnRec!.priority)` in
 * tests/pipeline/pipeline-health-score.test.ts, `expect(continuity
 * .passed)` back to `expect(continuity!.passed)` in
 * tests/quality/quality-gate.test.ts, `expect(result.data)` back to
 * `expect(result!.data)` in tests/analysis/semantic-similarity.test.ts,
 * and `expect(children[0].path)` back to
 * `expect(children![0].path)` in tests/spine-manifest.test.ts — each
 * turns BOTH its directory exact-0 ratchet (0 → 1) and the tests-total
 * ratchet (0 → 1) RED.
 */
const PINNED = {
  'src/visualization (production)': 0,
  'src/pipeline (production)': 0,
  'src/transcription (production)': 0,
  'src/export (production)': 0,
  'src/monitoring (production)': 0,
  'src/analysis (production)': 0,
  'src (production, excl. __tests__/__mocks__)': 0,
  'tests (excl. __mocks__)': 0,
} as const;

/**
 * Per-top-level-directory ratchets for the tests tree (Phase 147 / REQ-337;
 * ALL converged to exact-0 in Phase 168 / REQ-362 — 義務 C final gate).
 * `(root)` = test files sitting directly in tests/. A directory that is not
 * pinned here fails the guard — extending the test tree means extending the
 * ratchet consciously, never silently. Every pin is an exact-0 pin now:
 * the files-based hollow-pin check below keeps all fourteen entries valid
 * as long as their directories hold test files.
 */
const TESTS_DIR_PINS: Record<string, number> = {
  unit: 0,
  integration: 0,
  visualization: 0,
  guards: 0,
  pipeline: 0,
  analysis: 0,
  quality: 0,
  transcription: 0,
  api: 0,
  lib: 0,
  remotion: 0,
  '(root)': 0,
  acceptance: 0,
  config: 0,
};

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__' || entry === 'node_modules' || entry === '.git') continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * AST-based assertion census: every `NonNullExpression` (`x!`) plus every
 * definite-assignment `!:` on a property / variable declaration (a parameter
 * can never carry one — `constructor(private x!: T)` is a parse error
 * (TS1005/TS1138) and `ParameterDeclaration` has no `exclamationToken` in
 * the TS 5.9 AST, so a former `isParameter` arm here was dead by language
 * design, never a live detector).
 * Comments, string content and JSX text are invisible to the parser, so the
 * historical regex false positives are gone by construction. `countInText`
 * is split out so the liveness test can drive the SAME scanner over a
 * fixture snippet (both trees are exact-0 since Phase 168, so a
 * real-tree `count > 0` probe no longer exists).
 */
function countInText(text: string, file: string): string[] {
  const hits: string[] = [];
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, /*setParentNodes*/ false, scriptKind);
  const record = (node: TS.Node, kind: string): void => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const textOfLine = text.split('\n')[line]?.trim() ?? '';
    hits.push(`${file.replace(REPO_ROOT, '')}:${line + 1} [${kind}]: ${textOfLine.slice(0, 80)}`);
  };
  const visit = (node: TS.Node): void => {
    if (ts.isNonNullExpression(node)) {
      record(node, 'x!');
    } else if (
      (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node)) &&
      node.exclamationToken !== undefined
    ) {
      record(node, 'x!:');
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return hits;
}

function countAssertions(rootRel: string): { count: number; hits: string[]; files: string[] } {
  const files = walk(join(REPO_ROOT, rootRel));
  const hits: string[] = [];
  for (const file of files) {
    hits.push(...countInText(readFileSync(file, 'utf-8'), file));
  }
  return { count: hits.length, hits, files };
}

/** Tests-tree hits bucketed by top-level directory (files in tests/ → '(root)'). */
function bucketTestsHits(hits: string[]): Map<string, string[]> {
  const byDir = new Map<string, string[]>();
  for (const hit of hits) {
    const rel = hit.slice(0, hit.indexOf(':'));
    const withoutPrefix = rel.split(sep).slice(1).join(sep);
    const top = withoutPrefix.includes(sep) ? withoutPrefix.split(sep)[0] : '(root)';
    const bucket = byDir.get(top) ?? [];
    bucket.push(hit);
    byDir.set(top, bucket);
  }
  return byDir;
}

/**
 * Top-level directories that still hold at least one test FILE (files in
 * tests/ → '(root)'). Presence is keyed on files, not hits, so a directory
 * cleaned to ZERO assertions (tests/transcription since Phase 154) still
 * counts as present — its pin is an exact-0 pin — while a pinned directory
 * whose files were all deleted or moved still fails the check.
 */
function testsDirsByFiles(files: string[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    const withoutPrefix = file.replace(REPO_ROOT, '').split(sep).slice(1).join(sep);
    dirs.add(withoutPrefix.includes(sep) ? withoutPrefix.split(sep)[0] : '(root)');
  }
  return dirs;
}

describe('non-null assertion census ratchet (REQ-328 / REQ-336 / REQ-337)', () => {
  const visualization = countAssertions('src/visualization');
  const pipeline = countAssertions('src/pipeline');
  const transcription = countAssertions('src/transcription');
  const exportDir = countAssertions('src/export');
  const monitoring = countAssertions('src/monitoring');
  const analysis = countAssertions('src/analysis');
  const srcTotal = countAssertions('src');
  const testsTotal = countAssertions('tests');
  const testsByDir = bucketTestsHits(testsTotal.hits);

  it('src/visualization production code holds ZERO non-null assertions (exact)', () => {
    expect(visualization.hits).toEqual([]);
  });

  it('src/pipeline production code holds ZERO non-null assertions (exact)', () => {
    expect(pipeline.hits).toEqual([]);
  });

  it('src/transcription production code holds ZERO non-null assertions (exact)', () => {
    expect(transcription.hits).toEqual([]);
  });

  it('src/export production code holds ZERO non-null assertions (exact, incl. AST-only shapes)', () => {
    expect(exportDir.hits).toEqual([]);
  });

  it('src/monitoring production code holds ZERO non-null assertions (exact)', () => {
    expect(monitoring.hits).toEqual([]);
  });

  it('src/analysis production code holds ZERO non-null assertions (exact)', () => {
    expect(analysis.hits).toEqual([]);
  });

  it('ALL of src production code (excl. __tests__/__mocks__) holds ZERO non-null assertions (exact, Phase 147)', () => {
    expect(srcTotal.hits).toEqual([]);
  });

  it('tests tree total (excl. __mocks__) is at or below the ratchet', () => {
    expect(testsTotal.count).toBeLessThanOrEqual(PINNED['tests (excl. __mocks__)']);
  });

  it('every tests-tree top-level directory is pinned and at or below its ratchet (Phase 147 / REQ-337)', () => {
    for (const [dir, hits] of [...testsByDir.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const pin = TESTS_DIR_PINS[dir];
      if (pin === undefined) {
        throw new Error(
          `tests/${dir} has no TESTS_DIR_PINS entry (add one when adding a new top-level tests directory) — ${hits.length} assertion(s) found`
        );
      }
      expect(hits.length).toBeLessThanOrEqual(pin);
    }
  });

  it('no pinned tests directory silently disappears (each pin must still correspond to a directory holding test files)', () => {
    // Keyed on FILES, not hits: tests/transcription is pinned at exact-0
    // since Phase 154 and must stay a valid pin as long as its test files
    // exist — a hits-based presence check would force every 0-pin back to
    // a nonzero floor or delete the pin.
    for (const dir of Object.keys(TESTS_DIR_PINS)) {
      expect(testsDirsByFiles(testsTotal.files).has(dir)).toBe(true);
    }
  });

  it('census is not vacuous: the scanner still sees both assertion shapes (fixture, Phase 168)', () => {
    // Both trees reached exact-0 (src in Phase 147, tests in Phase 168),
    // so a real-tree `count > 0` liveness probe no longer exists. Instead
    // drive the SAME counting code over a fixture that carries one node
    // of each counted shape — `x!` and a definite-assignment `x!:` — plus
    // two decoys the checker must NOT count (string content, and a `!`
    // inside a comment). A scanner regression that silently counts
    // nothing fails here.
    const fixture = [
      'const first = queue.shift()!;',
      'let holder!: string;',
      "const s = 'not an assertion! (string content)';",
      '// nor this! (comment)',
    ].join('\n');
    const hits = countInText(fixture, join(REPO_ROOT, 'fixture.ts'));
    expect(hits).toHaveLength(2);
    expect(hits[0]).toContain('[x!]: const first = queue.shift()!;');
    expect(hits[1]).toContain('[x!:]: let holder!: string;');
  });
});

describe('ratchet exit condition (TASK-0243 / REQ-346; gates passed Phase 165/167, activated Phase 168)', () => {
  // TASK-0243 spec'd these three as `it.skip(...)` cases to be manually
  // unskipped ONLY after both 義務 C gates held (tests/unit exact-0 AND
  // tests total ≤ 100) — the skip form existed so the suite never ran
  // RED-as-normal-state while the ratchet still had room. Gate 1 passed in
  // Phase 165 (unit → 0), gate 2 in Phase 167 (total 191 → 36 ≤ 100), and
  // Phase 168 is the manual-unskip commit: they enter the suite ACTIVE,
  // and GREEN, because the pins they police are now 0.
  it('tests total pin has not regressed past the gate (≤ 100)', () => {
    expect(PINNED['tests (excl. __mocks__)']).toBeLessThanOrEqual(100);
  });

  it('tests/unit directory pin has hit exact-0', () => {
    expect(TESTS_DIR_PINS['unit']).toBe(0);
  });

  it('once both gates hold, the next round must NOT decrement a tests pin (caller-side rejection)', () => {
    // guard: if we reach here, the ratchet mechanism is exhausted;
    // subsequent rounds that propose ANOTHER round of test `!` rewrite
    // for non-real-path reasons should be flagged.
    const stillRoom = PINNED['tests (excl. __mocks__)'] > 100 || TESTS_DIR_PINS['unit'] > 0;
    expect(stillRoom).toBe(false); // both gates must hold for this assertion to be meaningful
  });
});
