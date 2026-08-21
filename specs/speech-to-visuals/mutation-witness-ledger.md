# Mutation witness ledger（変異 witness 台帳）

**目的**: specs 各所の「mutation-verified: n RED」主張を、対象 mutant の一覧と
実行結果（RED 数・コマンド・[EVIDENCE] 行）とともに committed な log として残し、
judge が再実行なしに主張を検証できるようにする（AI Hub steering・Phase 141 / REQ-330）。

**再実行プロトコル**: 各エントリの mutant を適用（target 行の記載どおり 1 行改変）→
`command` を実行 → `observed` の RED 数と一致することを確認 → revert。
`[EVIDENCE]` 行は `npm run evidence -- --label=<id> <command>` が発行した実測行の写し
（REQ-326 の出典形式・TC-323 で pin 済みの形状）。

**監査**: tests/guards/mutation-witness-ledger.test.ts が (1) 各エントリの target
ファイルの実在、(2) 必須フィールド（target/mutation/command/observed/date/claim）、
(3) エントリ数 ratchet（≥ PINNED）を検証する。

---

## MW-001 — statusCodeClass 境界 `<500`（TC-205-04）

- **claim**: acceptance-criteria.md REQ-205 TC-205-04「境界 `<500` を `<600` に退行させると TC-205-04 のみ RED」
- **target**: `src/monitoring/http-metrics-collector.ts:43`
- **mutation**: `if (code < 500) return '4xx';` → `if (code < 600) return '4xx';`
- **command**: `npx jest --config jest.config.cjs tests/unit/monitoring/http-metrics-collector.test.ts`
- **observed** (2026-08-19 再実行): `Tests: 1 failed, 15 passed, 16 total` — RED は TC-205-04 のみ。**主張どおり**
- **[EVIDENCE]**: `[EVIDENCE] started=2026-08-19T23:59:15+09:00 ended=2026-08-19T23:59:24+09:00 exit=1 elapsed_s=8.77 cmd=npm test -- --testPathPatterns tests/unit/monitoring/http-metrics-collector.test.ts commit=c2381ad9 branch=ai/instruction-speech-to-visuals-20260819-144044-214853`

## MW-002 — Prometheus route prefix 传递（TC-214-02）

- **claim**: acceptance-criteria.md REQ-206 TC-214-02「ルートの prefix 传递を外すと TC-214-02 のみ RED」
- **target**: `src/api/routes/monitoring.ts:258`
- **mutation**: `parsed.data.prefix ? { prefix: parsed.data.prefix } : undefined,` → `undefined,`
- **command**: `npx jest --config jest.config.cjs tests/unit/api/routes/monitoring-phase84-85.test.ts`
- **observed** (2026-08-19 再実行): `Tests: 1 failed, 38 passed, 39 total` — RED は `REQ-214: Prometheus export E2E completeness › TC-214-02: /prometheus honors ?prefix= like /dashboard and /alerts do` のみ。**主張どおり**
- **[EVIDENCE]**: `[EVIDENCE] started=2026-08-19T23:59:37+09:00 ended=2026-08-19T23:59:52+09:00 exit=1 elapsed_s=15.24 cmd=npx jest --config jest.config.cjs tests/unit/api/routes/monitoring-phase84-85.test.ts commit=c2381ad9 branch=ai/instruction-speech-to-visuals-20260819-144044-214853`

## MW-003 — /alerts route prefix 传递（補助・REQ-211/216 pin の実在証明）

- **claim**: （新規・Phase 141）TC-214-02 と対称の /alerts 側 prefix pin の実行証明
- **target**: `src/api/routes/monitoring.ts:311`
- **mutation**: `if (parsed.data.prefix) options.metricPrefix = parsed.data.prefix;` → `if (false) options.metricPrefix = parsed.data.prefix;`
- **command**: `npx jest --config jest.config.cjs tests/unit/api/routes/monitoring-phase84-85.test.ts`
- **observed** (2026-08-19 再実行): `Tests: 2 failed, 37 passed, 39 total` — RED は `REQ-211: GET /api/v1/monitoring/alerts › accepts prefix query parameter` と `REQ-216: … GET /alerts validation › accepts valid prefix`。**/alerts の prefix も 2 pin で alive**
- **[EVIDENCE]**: 直近の同等実行（2026-08-19・MW-002 と同一 suite）: `Tests: 2 failed, 37 passed, 39 total`（evidence runner ラップ前の直接実行。RED テスト名は本文記載のとおり特定済み）

## MW-004 — maxRetries fallback `??`（TC-304-04）

- **claim**: interview-record A134/REQ-304 TC-304-04「フォールバックサイトの `??` を `||` に一時退行させると zero-passthrough test のみ RED」
- **target**: `src/analysis/llm-service.ts:302`
- **mutation**: `request.options?.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries` → `request.options?.maxRetries || DEFAULT_RETRY_OPTIONS.maxRetries`
- **command**: `npx jest --config jest.config.cjs tests/analysis/llm-service-max-retries-zero.test.ts`
- **observed** (2026-08-19 再実行): `Tests: 1 failed, 1 passed, 2 total` — RED は `explicit maxRetries: 0 makes ZERO API calls and fails immediately (zero is a legit value)` のみ。**主張どおり**
- **[EVIDENCE]**: `[EVIDENCE] started=2026-08-19T23:59:56+09:00 ended=2026-08-20T00:00:20+09:00 exit=1 elapsed_s=24.59 cmd=npx jest --config jest.config.cjs tests/analysis/llm-service-max-retries-zero.test.ts commit=c2381ad9 branch=ai/instruction-speech-to-visuals-20260819-144044-214853`

## MW-005 — non-null assertion census ratchet（REQ-328・Phase 141 新設 guard）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「 injecting `const v = queue.shift()!;` … turns the visualization pin RED」
- **target**: `src/visualization/advanced-layouts.ts`（ファイル末尾）
- **mutation**: 末尾に `const CENSUS_MUTANT: string | undefined = process.env.X; const CENSUS_MUTANT_V: string = CENSUS_MUTANT!;` を追加
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-19): `Tests: 2 failed, 2 passed, 4 total` — RED は visualization exact pin と src ratchet の 2 件。revert 後 `4 passed`

## MW-006 — storage key parity guard（REQ-329・Phase 141 新設 guard）

- **claim**: tests/guards/storage-key-parity.test.ts ヘッダ「changing TutorialSystem's save key turns the parity check RED」
- **target**: `src/components/TutorialSystem.tsx:228`
- **mutation**: `safeSaveToStorage('tutorial-progress'` → `safeSaveToStorage('tutorial-progress-x'`
- **command**: `npx jest --config jest.config.cjs tests/guards/storage-key-parity.test.ts`
- **observed** (2026-08-19): `Tests: 3 failed, 1 passed, 4 total` — RED は dead-read 検出・pinned loaded set・pinned saved set の 3 件。revert 後 `4 passed`

## MW-007 — non-null assertion census ratchet・src/pipeline pin（REQ-331・Phase 142 新設 exact pin）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「replacing `const sceneCount = scenes.length;` in src/pipeline/quality-estimators.ts … turns BOTH the pipeline exact pin and the src ratchet (64 → 65) RED」
- **target**: `src/pipeline/quality-estimators.ts:57`
- **mutation**: `const sceneCount = scenes.length;` → `const sceneCount = (scenes as unknown as { length: number })!.length;`
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 3 passed, 5 total` — RED は pipeline exact pin（hits 3 行検出）と src ratchet（`Expected: <= 64 / Received: 65`）の 2 件。revert 後 `5 passed`

## MW-008 — non-null assertion census ratchet・src/transcription pin（REQ-332・Phase 143 新設 exact pin）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「replacing `sum + sanitizeFinite(segment.confidence), 0);` in src/transcription/streaming-transcriber.ts … turns BOTH the transcription exact pin and the src ratchet (47 → 48) RED」
- **target**: `src/transcription/streaming-transcriber.ts:506`
- **mutation**: `sum + sanitizeFinite(segment.confidence), 0);` → `sum + ((segment as { confidence: number })!.confidence), 0);`
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 4 passed, 6 total` — RED は transcription exact pin（`streaming-transcriber.ts:506` の mutant 行を hits として検出）と src ratchet（`Expected: <= 47 / Received: 48`）の 2 件。revert 後 `6 passed`

## MW-009 — non-null assertion census ratchet・src/export pin（REQ-333・Phase 144 新設 exact pin）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「replacing `Number(job.startedAt) - job.enqueuedAt;` in src/export/export-job-queue.ts … turns BOTH the export exact pin and the src ratchet (37 → 38) RED」
- **target**: `src/export/export-job-queue.ts:220`
- **mutation**: `Number(job.startedAt) - job.enqueuedAt` → `(job as { startedAt: number }).startedAt! - job.enqueuedAt`
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 5 passed, 7 total` — RED は export exact pin と src ratchet（37 → 38）の 2 件。revert 後 `7 passed`

## MW-010 — non-null assertion census ratchet・src/monitoring pin（REQ-334・Phase 145 新設 exact pin）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「replacing `let history = this.metrics.get(metric);` in src/monitoring/real-time-performance-monitor.ts … turns BOTH the monitoring exact pin and the src ratchet (30 → 31) RED」
- **target**: `src/monitoring/real-time-performance-monitor.ts:209`
- **mutation**: `let history = this.metrics.get(metric);` → `let history = this.metrics.get(metric)!;`（Phase 145 が除去した get-or-create 前提の presence assertion の再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 6 passed, 8 total` — RED は monitoring exact pin（`real-time-performance-monitor.ts:209` の mutant 行を hits として検出）と src ratchet（`Expected: <= 30 / Received: 31`）の 2 件。revert 後 `8 passed`

## MW-011 — non-null assertion census ratchet・src/analysis pin（REQ-335・Phase 146 新設 exact pin）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「replacing `const prev = result.pop();` in src/analysis/scene-segmenter.ts with `const prev = result.pop()!;` (the exact pre-Phase-146 shape) turns BOTH the analysis exact pin and the src ratchet (24 → 25) RED」
- **target**: `src/analysis/scene-segmenter.ts:939`
- **mutation**: `const prev = result.pop();` → `const prev = result.pop()!;`（Phase 146 が除去した while-guard 前提の presence assertion の再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 7 passed, 9 total` — RED は analysis exact pin（`scene-segmenter.ts:939` の mutant 行を hits として検出）と src ratchet（`Expected: <= 24 / Received: 25`）の 2 件。revert 後 `9 passed`

## MW-012 — non-null assertion census ratchet・AST checker での analysis pin 連続性（REQ-336・Phase 147 checker 置換後の再検証）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-applying the MW-011 mutation under the AST checker still turns BOTH the analysis exact pin and the new whole-src exact pin RED」
- **target**: `src/analysis/scene-segmenter.ts:939`
- **mutation**: `const prev = result.pop();` → `const prev = result.pop()!;`（MW-011 と同一 mutant を checker 置換（line-regex → TypeScript AST）後の guard に適用）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は analysis exact pin と新設の src 全体 exact pin の 2 件（両方が `scene-segmenter.ts:939 [x!]` の mutant 行を hits として検出）。revert 後 `11 passed`。checker を AST に置換しても検出力が連続していることの実証

## MW-013 — AST checker が旧 line-regex の検出不能形状（`!(`）を閉じた実証（REQ-336・Phase 147・Phase 144 の見落としの再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting the historical miss — `nextJob.resolve!({` in src/export/enhanced-export-engine.ts `processNextInQueue` — turns BOTH the export exact pin and the whole-src exact pin RED, while the pre-Phase-147 line regex reports ZERO hits on the same mutant (the `!(` shape was outside its continuation class): proof the checker upgrade closed a real detection gap, not just a metric restatement」
- **target**: `src/export/enhanced-export-engine.ts:1185`
- **mutation**: `resolve({` → `nextJob.resolve!({`（Phase 147 が除去した `.catch` closure 内 presence assertion の再注入。Phase 144 は src/export を「10 件 → 0」としたが、この `!(` 形状は当時の line-regex の continuation class `[\s.,;:)\]}+*/?=<>&|{]` に `(` が無いたず検出されず、AST checker 化で初めて発見・除去された）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は export exact pin と src 全体 exact pin の 2 件（両方が `enhanced-export-engine.ts:1185 [x!]` を検出）。**さらに旧 line-regex checker を同じ mutant ファイルに適用すると 0 hits**（`!(` が continuation class 外のため）— checker upgrade が計量の言い換えでなく実検出ギャップを閉じたことの実証。revert 後 `11 passed`

---

## MW-014 — tests/unit ratchet の単調減少強制（REQ-338・Phase 148・Phase 148 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-148 rewrite — `expect(rule.expr)` back to `expect(rule!.expr)` in tests/unit/monitoring/alert-rules.test.ts — turns BOTH the tests/unit directory ratchet (377 → 378) and the tests-total ratchet (1002 → 1003) RED: the monotone decrease is enforced, not aspirational」
- **target**: `tests/unit/monitoring/alert-rules.test.ts`（Phase 148 置換後の `expect(rule.expr).toContain('> 0.05');` 行）
- **mutation**: `expect(rule.expr).toContain('> 0.05');` → `expect(rule!.expr).toContain('> 0.05');`（Phase 148 が fail-loud helper `requireAlertRule` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests/unit ディレクトリ ratchet（378 > 377）と tests 合計 ratchet（1003 > 1002）の 2 件。Phase 148 の減少（unit 471 → 377・総 1096 → 1002）が ratchet で強制されている実証。revert 後 `11 passed`

---

## MW-015 — tests/unit ratchet の単調減少強制ラウンド 2（REQ-339・Phase 149・Phase 149 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-149 rewrite — `expect(metrics.layoutQualityScore)` back to `expect(result.metrics!.layoutQualityScore)` in tests/unit/pipeline/pipeline-orchestrator.test.ts — turns BOTH the tests/unit directory ratchet (274 → 275) and the tests-total ratchet (899 → 900) RED」
- **target**: `tests/unit/pipeline/pipeline-orchestrator.test.ts:723`（Phase 149 置換後の `expect(requireDefined(result.metrics, 'result.metrics').layoutQualityScore).toBeGreaterThan(0);` 行）
- **mutation**: `expect(requireDefined(result.metrics, 'result.metrics').layoutQualityScore).toBeGreaterThan(0);` → `expect(result.metrics!.layoutQualityScore).toBeGreaterThan(0);`（Phase 149 が fail-loud helper `requireDefined` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests 合計 ratchet（`Expected: <= 899 / Received: 900`）と tests/unit ディレクトリ ratchet（`Expected: <= 274 / Received: 275`）の 2 件。Phase 149 の減少（unit 377 → 274・総 1002 → 899）が ratchet で強制されている実証。revert 後 census + ledger 監査 2 suite 41 tests GREEN

---

## MW-016 — tests/unit ratchet の単調減少強制ラウンド 3（REQ-340・Phase 150・Phase 150 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-150 rewrite — `expect(requirePlayer().play)` back to `expect(capturedPlayerRef!.play)` in tests/unit/components/VideoPreview.test.tsx — turns BOTH the tests/unit directory ratchet (169 → 170) and the tests-total ratchet (794 → 795) RED」
- **target**: `tests/unit/components/VideoPreview.test.tsx`（Phase 150 置換後の `expect(requirePlayer().play).toHaveBeenCalled();` 行）
- **mutation**: `expect(requirePlayer().play).toHaveBeenCalled();` → `expect(capturedPlayerRef!.play).toHaveBeenCalled();`（Phase 150 が fail-loud helper `requirePlayer` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests 合計 ratchet（`Expected: <= 794 / Received: 795`）と tests/unit ディレクトリ ratchet（`Expected: <= 169 / Received: 170`）の 2 件。Phase 150 の減少（unit 274 → 169・総 899 → 794）が ratchet で強制されている実証。revert 後 `11 passed`

---

## MW-017 — tests/unit ratchet の単調減少強制ラウンド 4（REQ-341・Phase 151・Phase 151 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-151 rewrite — `expect(latest.processingTime)` back to `expect(latest!.processingTime)` in tests/unit/pipeline/pipeline-quality-monitor.test.ts — turns BOTH the tests/unit directory ratchet (103 → 104) and the tests-total ratchet (728 → 729) RED」
- **target**: `tests/unit/pipeline/pipeline-quality-monitor.test.ts`（Phase 151 置換後の `expect(latest.processingTime).toBe(5000);` 行）
- **mutation**: `expect(latest.processingTime).toBe(5000);` → `expect(latest!.processingTime).toBe(5000);`（Phase 151 が fail-loud helper `requireDefined` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests 合計 ratchet（`Expected: <= 728 / Received: 729`）と tests/unit ディレクトリ ratchet（`Expected: <= 103 / Received: 104`）の 2 件。Phase 151 の減少（unit 169 → 103・総 794 → 728）が ratchet で強制されている実証。revert 後 `11 passed`

---

## MW-018 — tests ratchet の単調減少強制ラウンド 5（REQ-342・Phase 152・Phase 152 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-152 rewrite — `const centerA = centerXOf(nodeA);` back to `const centerA = nodeA.x + nodeA.width! / 2;` in tests/visualization/strategies/flow-strategy.test.ts — turns BOTH the tests/visualization directory ratchet (107 → 108) and the tests-total ratchet (538 → 539) RED」
- **target**: `tests/visualization/strategies/flow-strategy.test.ts`（Phase 152 置換後の `const centerA = centerXOf(nodeA);` 行）
- **mutation**: `const centerA = centerXOf(nodeA);` → `const centerA = nodeA.x + nodeA.width! / 2;`（Phase 152 が helper `centerXOf`（`?? Number.NaN` 保存）で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests 合計 ratchet（`Expected: <= 538 / Received: 539`）と tests/visualization ディレクトリ ratchet（`Expected: <= 107 / Received: 108`）の 2 件。Phase 152 の減少（visualization 184 → 107・総 728 → 538）が ratchet で強制されている実証。revert 後 census guard `11 passed`

---

## MW-019 — tests ratchet の単調減少強制ラウンド 6（REQ-343・Phase 153・Phase 153 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-153 rewrite — `expect(requireOpportunity(report, 'Processing Speed').priority)` back to `expect(opp!.priority)` in tests/pipeline/improvement-detector.test.ts — turns BOTH the tests/pipeline directory ratchet (20 → 21) and the tests-total ratchet (428 → 429) RED」
- **target**: `tests/pipeline/improvement-detector.test.ts`（Phase 153 置換後の `expect(requireOpportunity(report, 'Processing Speed').priority).toBe('medium');` 行）
- **mutation**: `expect(requireOpportunity(report, 'Processing Speed').priority).toBe('medium');` → `expect(opp!.priority).toBe('medium');`（Phase 153 が fail-loud helper `requireOpportunity(report, area)` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): `Tests: 2 failed, 9 passed, 11 total` — RED は tests 合計 ratchet（429 > 428 超過）と tests/pipeline ディレクトリ ratchet（21 > 20 超過）の 2 件。Phase 153 の減少（pipeline 45 → 20・総 538 → 428）が ratchet で強制されている実証。revert 後 census guard `11 passed`

---

## MW-020 — tests ratchet の単調減少強制ラウンド 7・初の exact-0 ディレクトリ pin（REQ-344・Phase 154・Phase 154 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-154 rewrite — `fireHandler(mockRecognitionInstance.onerror, …)` back to `mockRecognitionInstance.onerror!({ error: 'network', … })` in tests/transcription/browser-transcriber.test.ts — turns BOTH the tests/transcription exact-0 directory ratchet (0 → 1) and the tests-total ratchet (338 → 339) RED: the first exact-0 directory pin is enforced, not aspirational」
- **target**: `tests/transcription/browser-transcriber.test.ts`（Phase 154 置換後の `fireHandler(mockRecognitionInstance.onerror, { error: 'network', message: 'Network error' });` 行）
- **mutation**: `fireHandler(mockRecognitionInstance.onerror, { error: 'network', message: 'Network error' });` → `mockRecognitionInstance.onerror!({ error: 'network', message: 'Network error' });`（Phase 154 が fail-loud helper `fireHandler` で除去した checker 抑制の 1 node 再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): RED は tests 合計 ratchet（`Expected: <= 338 / Received: 339`）と tests/transcription ディレクトリ ratchet（`Expected: <= 0 / Received: 1`）の 2 件 — transcription は Phase 154 で初めて **exact-0** に pin されたディレクトリで、新規 1 node も許容しないことが実証された。revert 後 census guard `11 passed`。同一 run で hollow-pin check の新失敗形も別途 RED 検証済み（`'nonexistent-dir': 0` の架空 pin → `Expected: true / Received: false`）。

## MW-021 — tests ratchet の単調減少強制ラウンド 8・node≥7 全数 12 ファイル置換（REQ-345・Phase 155・Phase 155 rewrite への `!` 再注入）

- **claim**: tests/guards/non-null-assertion-census.test.ts ヘッダ「re-injecting ONE `!` into the Phase-155 rewrite — `expect(longNode.w ?? Number.NaN)` back to `expect(longNode.w!)` in tests/visualization/strategies/dagre-layout-strategy.test.ts — turns BOTH the tests/visualization directory ratchet (54 → 55) and the tests-total ratchet (252 → 253) RED」
- **target**: `tests/visualization/strategies/dagre-layout-strategy.test.ts`（Phase 155 置換後の `expect(longNode.w ?? Number.NaN).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);` 行）
- **mutation**: `expect(longNode.w ?? Number.NaN).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);` → `expect(longNode.w!).toBeGreaterThanOrEqual(shortNode.w ?? Number.NaN);`（Phase 155 が optional `w` 読み取りに正規化した 1 node の checker 抑制再注入）
- **command**: `npx jest --config jest.config.cjs tests/guards/non-null-assertion-census.test.ts`
- **observed** (2026-08-20): RED は tests 合計 ratchet（`Expected: <= 252 / Received: 253`）と tests/visualization ディレクトリ ratchet（`Expected: <= 54 / Received: 55`）の 2 件。revert 後 census guard `11 passed`。ラウンド 8 は残存ファイル降順上位の機械閾値 **node≥7 全数**（12 ファイル / 86 node → 0・5 ディレクトリ横断）で選定し、pin は unit 103→61・integration 71→50・visualization 61→54・guards 60→51・analysis 13→6・総 338→252 に縮小。

## MW-022 — HealthCheckService.checkMemoryHealth の欠損 heapUsed/heapTotal NaN-routing 修正（REQ-347・Phase 156・fail-loud 経路投入への保証）

- **claim**: `src/monitoring/health-check-service.ts` の `checkMemoryHealth()` は `getMemoryUsage()` の戻り値型契約を暗黙に信じ、`memoryUsage.heapUsed` / `memoryUsage.heapTotal` を素読みして `bytesToMb(undefined)` / `heapUsagePercent(undefined, undefined)` に渡していた。@stv/core/utils/memory-usage のブラウザ経路は両フィールドを omit する場合があり（tests/unit/utils/memory-usage.test.ts:73 の "browser unavailable" 経路が `{ heapUsed: 0, heapTotal: 0 }` を返すのとは別系統・実プロセスの cross-process shape は `undefined`）、結果として `NaN` が入り `NaN < 70` ≡ false が else 枝に流れ込み「Memory usage is critical (NaN.0%)」と虚偽の critical を返す silent corruption。修正は catch ブロックの契約と mirror した typeof number ガードを追加し、`'Memory monitoring unavailable: backend omitted heapUsed/heapTotal'` を返すことで **silent NaN-routing を fail-loud 化**。MW-022 の mutation は「メモリ欠損ケースが critical を報告する」動作の保存を保証する。
- **target**: `src/monitoring/health-check-service.ts:154`（修正前 — `const heapUsedMB = bytesToMb(memoryUsage.heapUsed);` 直前行）のガードを mutation 「`typeof memoryUsage.heapUsed !== 'number' || typeof memoryUsage.heapTotal !== 'number'` の OR を `&&` に反転」または「`!== 'number'` を `=== 'number'` に反転」して欠損時のみ path を通過させる
- **mutation**: `if (typeof memoryUsage.heapUsed !== 'number' || typeof memoryUsage.heapTotal !== 'number')` → `if (typeof memoryUsage.heapUsed === 'number' && typeof memoryUsage.heapTotal === 'number')`（= 両方が number のとき degraded を返す — REQ-347 の本質と真逆のセマンティクス）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service.test'`
- **observed** (2026-08-20): 修正後のベースライン run は `Tests: 42 passed, 42 total`（`should report degraded with the omit-fields message when heapUsed/heapTotal are missing (REQ-347)` + `should report degraded with the omit-fields message when only heapUsed is missing (REQ-347)` の 2 tests を含む）。mutation 適用（`!==` → `===`・OR → AND）後の run は `Tests: 7 failed, 35 passed, 42 total` — 新規 2 tests が **target RED** を返し（`expected 'healthy' to be 'degraded'` の形）、既存の number-valid テスト 5 件も「妥当な数値入力が depleted 判定に転落」する形で **cascade RED** になる。両者が真のセマンティクス保存（=欠損時のみ degraded・妥当入力時は healthy/degraded/unhealthy の数値判定）を **実証する**。revert で 42/42 GREEN 復元。ledger 監査 pin が **≥21 → ≥22** に引き上げ。

## MW-023 — HealthCheckService.checkCacheHealth の non-finite/omitted hitRate NaN-routing 修正（REQ-348・Phase 157・self-referential rate formula 拡張の fail-loud 化）

- **claim**: `src/monitoring/health-check-service.ts` の `checkCacheHealth()` は `globalCache.getStats()` の戻り値型契約を暗黙に信じ、`stats.hitRate` / `stats.totalEntries` を素読みして `Math.round(stats.hitRate * stats.totalEntries)` に渡していた。`intelligent-cache.ts` の `updateHitRate` 経路は Phase 142 (commit 2428e472) で self-referential rate/proportion formula 修正済みだが、`getStats()` 経由の `totalHits` / `totalMisses` 累積カウントが populate されない path があり、`??` フォールバックが `hitRate`(比率, 0-1) を count 代わりに掛けて round する。`hitRate = undefined` / `hitRate = NaN` / `totalEntries = undefined` のいずれかが backend omit / non-finite で発生すると、`Math.round(undefined * N) = NaN` または `Math.round(NaN * N) = NaN` に流れ込み、`NaN / (NaN + NaN) = NaN` → `|| 0` で `0%` → "Cache is ineffective (0% hit rate)" → **unhealthy** を返し、`generateRecommendations` が "CRITICAL: Cache is ineffective - review caching strategy" を unknown observation window で emit する silent corruption（memory の recurring-bug-classes.md "Self-referential rate/proportion formula" の延長線上の live instance）。修正は MW-022 と同型の typeof/Number.isFinite ガードを追加し、`'Cache monitoring unavailable: backend returned non-finite or omitted metrics'` を返すことで **silent NaN-routing を fail-loud 化**。
- **target**: `src/monitoring/health-check-service.ts:244`（修正後 — `try { stats = globalCache.getStats(); } catch …` 直後のガードブロック）
- **mutation**: ガード `if (typeof stats.hitRate !== 'number' || typeof stats.totalEntries !== 'number' || !Number.isFinite(stats.hitRate) || !Number.isFinite(stats.totalEntries))` の 4 条件それぞれのオペランドを反転 — つまり `typeof stats.hitRate === 'number'` ・`typeof stats.totalEntries === 'number'` ・`Number.isFinite(stats.hitRate)` ・`Number.isFinite(stats.totalEntries)` のときに degraded を返す（= finite/defined な cache hitRate で degraded になり、修正前の silent corruption セマンティクスと真逆）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20): 修正後のベースライン run は `Tests: 52 passed, 52 total`（MW-023 で追加した `should report degraded when stats.hitRate is non-finite (NaN) (REQ-348)` + `should report degraded when stats.hitRate/totalEntries are omitted (REQ-348)` の 2 tests を含む。defaultCacheStats には `hitRate: 0.6, totalEntries: 1000` を追加し、production-realistic な finite 入力を再現）。mutation 適用（4 条件すべて反転）後の run は `Tests: 7 failed, 45 passed, 52 total` — 新規 2 tests が **target RED** を返し（`expected 'healthy' to be 'degraded'` の形 — `hitRate=0.6` で healthy 判定される path を mutation が degraded に routing）、既存の正常系テスト 5 件も「healthy な finite hitRate が depleted 判定に転落」する形で **cascade RED** になる。両者が真のセマンティクス保存（=欠損/non-finite 時のみ degraded・妥当入力時は healthy/degraded/unhealthy の数値判定）を **実証する**。revert で 52/52 GREEN 復元。ledger 監査 46/46 GREEN 継続（MW-023 追加後も pin ≥21 通過）。

## MW-024 — HealthCheckService.checkPipelineHealth の欠損/non-finite successRate/avgProcessingTime NaN-routing 修正（REQ-349・Phase 158・TASK-0245 履行・fail-loud 経路投入への保証）

- **claim**: `src/monitoring/health-check-service.ts` の `checkPipelineHealth()` は `realTimeMonitor.getSnapshot()` 戻り値の `pipeline.successRate` / `pipeline.avgProcessingTime` を素読きし、`undefined > 0.95` / `NaN < 60000` がともに FALSE に化けて else 枝に流れ込み `(undefined * 100).toFixed(1)` = `"NaN%"` を含む fabricated unhealthy "Pipeline is experiencing issues (NaN.0% success rate)" を返す silent corruption（generateRecommendations が unknown observation window で CRITICAL 相当を emit）。修正は MW-022/023 と同型の typeof + Number.isFinite ガードを `try { snapshot = … } catch` 直後に前置し、`'Pipeline monitoring unavailable: backend omitted successRate/avgProcessingTime'` を返す degraded path で **silent NaN-routing を fail-loud 化**（commit 2ae7719a / TASK-0245）。
- **target**: `src/monitoring/health-check-service.ts:362`（修正後 — `if (!isFiniteMetric(successRate) || !isFiniteMetric(avgProcessingTime))` ガード。Phase 158 当時は inline `typeof !== 'number' || !Number.isFinite` 4 条件 OR、Phase 160 で isFiniteMetric 述語に統合）
- **mutation**: ガードを `if (isFiniteMetric(successRate) && isFiniteMetric(avgProcessingTime))` に反転（= 両メトリクスが finite/defined のときだけ degraded を返す — 修正前の silent corruption セマンティクスと真逆）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 158 実施時): ベースライン `Tests: 46 passed, 46 total` → mutation 適用後 `Tests: 2 failed, 44 passed, 46 total`（target RED 2 件のみ・cascade なし — TASK-0245.md §MW-024 記録・revert で 46/46 GREEN 復元）。**再実行** (2026-08-20・Phase 161・REQ-350/351 テスト追加後の 58-test baseline): mutation 適用後 `Tests: 11 failed, 47 passed, 58 total` — pipeline describe の NaN/omit 2 tests が target RED、pipeline 正常系 + overall status 計算（healthy all / degraded any）など finite 入力が degraded 判定に転落する cascade RED。revert で 58/58 GREEN 復元。**本エントリは Phase 161 の ledger 補填**（Phase 158 時点で specs 本文に MW-024 を記載しながら台帳登録を怠っていた債務の解消）。

## MW-025 — HealthCheckService.checkLLMHealth の欠損/non-finite cacheHitRate NaN-routing 修正（REQ-350・Phase 159・TASK-0246 履行・fail-loud 経路投入への保証）

- **claim**: `src/monitoring/health-check-service.ts` の `checkLLMHealth()` は `realTimeMonitor.getSnapshot().llm.cacheHitRate` を素読きし、`undefined > 0.4` / `NaN > 0.2` がともに FALSE に化けて else 枝に流れ込み "Llm integration may have issues (NaN% cache hit rate)" の fabricated unhealthy を上流 dashboard / generateRecommendations（CRITICAL recommendation）へ伝播させる silent corruption。修正は catch ブロック契約と同一の fail-loud guard（typeof + Number.isFinite）を前置し、`'LLM integration unavailable: backend omitted/non-finite cacheHitRate'` を返す degraded path を投入（commit 6d7a34e5 / TASK-0246 相当 — TASK ファイルは Phase 161 に補填）。
- **target**: `src/monitoring/health-check-service.ts:443`（修正後 — `if (!isFiniteMetric(cacheHitRate))` ガード。Phase 159 当時は inline、Phase 160 で isFiniteMetric 述語に統合）
- **mutation**: ガードを `if (isFiniteMetric(cacheHitRate))` に反転（= cacheHitRate が finite/defined のときだけ degraded を返す — 修正前と真逆）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 159 実施時): commit 6d7a34e5 記録 — ベースライン 48/48 GREEN、mutation 反転で新規 2 tests RED cascade、revert で GREEN 復元（件数記録が不完全なため Phase 161 で再実測）。**再実行** (2026-08-20・Phase 161・58-test baseline): mutation 適用後 `Tests: 8 failed, 50 passed, 58 total` — LLM describe の NaN/omit 2 tests が target RED（`cacheHitRate = 0.6` 等の finite 入力が degraded 判定に転落し message も不一致）、LLM 正常系（healthy/degraded 0.3/unhealthy 0.1/totalRequests 0）+ overall status 計算 2 件が cascade RED。revert で 58/58 GREEN 復元。**本エントリは Phase 161 の ledger 補填**。

## MW-026 — HealthCheckService の 4 checkXxxHealth ガード重複の isFiniteMetric<T> 述語への統合（Phase 160・REQ-347〜350 ガードの single chokepoint 化への保証）

- **claim**: Phase 156〜159 (REQ-347〜350) で checkCacheHealth / checkPipelineHealth / checkLLMHealth の 3 サイトに投入した `typeof x !== 'number' || !Number.isFinite(x)` ガードは同一パターンの重複だった。Phase 160 はこれを共通述語 `isFiniteMetric(value: unknown): value is number` に統合し（checkMemoryHealth は backend 契約上 NaN 到達経路が無いため typeof 単発を意図的に維持 — helper docstring NOTE で明示）、`value is number` narrowing で arithmetic 直前の型再検査を除去した pure refactor。MW-026 の mutation は「述語反転が 3（当時）→ 4（REQ-351 追加後）サイトすべてのガードを同時に崩す」ことを実証し、統合 chokepoint が全 fail-loud 契約の single point of truth であることを保証する（commit f441e8d3）。
- **target**: `src/monitoring/health-check-service.ts:49`（`function isFiniteMetric(value: unknown): value is number` 本体）
- **mutation**: `return typeof value === 'number' && Number.isFinite(value);` → `return !(typeof value === 'number' && Number.isFinite(value));`（述語の真値反転 — 型述語の semantics は保ったまま全消費サイトのガード発火条件を反転）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 161 再実行・58-test baseline): mutation 適用後 `Tests: 20 failed, 38 passed, 58 total` — cache/pipeline/LLM/errorRecovery の 4 ガードサイトが一斉に反転し、各 describe の NaN/omit target RED（REQ-348 2 + REQ-349 2 + REQ-350 2 + REQ-351 2 = 8）と、finite 入力が一斉に degraded 判定に転落する cascade RED 12 が同時発生。単一述語の統合が全 fail-loud 契約を担う chokepoint であることを **実証**（サイト個別の mutation 8〜11 failed を大きく上回る一斉 RED）。revert で 58/58 GREEN 復元。**本エントリは Phase 161 の ledger 補填**（Phase 160 commit が MW-026 を名指ししながら台帳登録していなかった債務の解消）。

## MW-027 — HealthCheckService.checkErrorRecoveryHealth の欠損/non-finite errorRate/recoverySuccessRate NaN-routing 修正（REQ-351・Phase 161・TASK-0247 履行・fail-loud 経路投入への保証）

- **claim**: `src/monitoring/health-check-service.ts` の `checkErrorRecoveryHealth()` は本 service 最後の未ガード metric read として `realTimeMonitor.getSnapshot().errors` の `errorRate` / `recoverySuccessRate` を素読きしていた。`errorRate < WARNING && recoveryRate > 0.80` と `errorRate < CRITICAL || recoveryRate > 0.50` の閾値チェーンは NaN/undefined オペランド比較で FALSE に化け、else-if / else 枝へ流れ込んで "Error recovery is degraded (NaN% error rate, 90.0% recovery rate)" の fabricated verdict を上流へ伝播させる silent corruption（修正前実測: RED 検証で `"Error recovery is degraded (NaN% error rate, 90.0% recovery rate)"` / `"(2.0% error rate, NaN% recovery rate)"` を確認）。修正は isFiniteMetric 述語で REQ-347〜350 と同型のガードを前置し、`'Error recovery unavailable: backend omitted/non-finite errorRate/recoverySuccessRate'` を返す degraded path で **silent NaN-routing を fail-loud 化**（commit 136e5f65 / TASK-0247）。
- **target**: `src/monitoring/health-check-service.ts:521`（修正後 — `if (!isFiniteMetric(errorRate) || !isFiniteMetric(recoveryRate))` ガード）
- **mutation**: ガードを `if (isFiniteMetric(errorRate) && isFiniteMetric(recoveryRate))` に反転（= 両メトリクスが finite/defined のときだけ degraded を返す — 修正前と真逆のセマンティクス）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 161 実施時): ベースライン `Tests: 58 passed, 58 total`（REQ-351 の `should report degraded when errors.errorRate is non-finite (NaN)` + `should report degraded when errors.recoverySuccessRate is omitted` の 2 tests を含む）。mutation 適用後 `Tests: 7 failed, 51 passed, 58 total` — 新規 2 tests が **target RED**（finite でない入力が numeric logic に流れ fabricated verdict になる）、error recovery 正常系 3 件（healthy/degraded 0.10/unhealthy 0.20）+ overall status 計算 2 件が「妥当な finite 入力が fail-loud 判定に転落」する **cascade RED**。MW-022/023 と同一 signature（7 failed）であり真のセマンティクス保存を実証。revert で 58/58 GREEN 復元。ledger 監査 pin **≥21 → ≥27** に引き上げ（MW-024〜027 補填で 23 → 27 エントリ）。

---

## MW-028 — HealthCheckService.generateRecommendations memory 推奨ゲートの non-finite memoryUsagePercent silent-suppress 修正（REQ-352・Phase 162・checkXxxHealth 横展開・recommendation 層の fail-loud 化）

- **claim**: `src/monitoring/health-check-service.ts` の `generateRecommendations()` は REQ-347〜351 が閉じた *verdict* 経路とは別に、`performHealthCheck` が `realTimeMonitor.getSnapshot()` から取得した `metrics.system.memoryUsagePercent` を素読みして `metrics.system.memoryUsagePercent > 85` の CRITICAL escalation ゲートに使っていた。REQ-347 が documented した browser-path memory 欠損（`getMemoryUsage()` が heapUsed/heapTotal を omit）は snapshot 経路でも到達し、`getSnapshot()` の `roundTo(heapUsagePercent(undefined, undefined), 2)` = NaN（実測: stv-core metrics-utils は NaN を roundTo で素通し）を生む。`NaN > 85` は FALSE に化けるため、memory check が degraded/unhealthy のときでも "CRITICAL: Memory usage is very high - immediate action required" が **「高くない」と区別不可能なまま silently suppress** される（偽 verdict の対極 = 偽 calm。推奨層の silent corruption）。修正は isFiniteMetric ガードで finite のときのみ閾値評価し、non-finite のときは warn log + `'WARNING: Memory usage metric unavailable - criticality could not be assessed'` recommendation で fail-loud 化。
- **target**: `src/monitoring/health-check-service.ts:655`（修正後 — `if (isFiniteMetric(metrics.system.memoryUsagePercent)) {`）
- **mutation**: ガードを `if (!isFiniteMetric(metrics.system.memoryUsagePercent))` に反転（= non-finite のとき閾値評価・finite のとき WARNING note — 修正前の silent-suppress セマンティクスと真逆）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 162 実施時): ベースライン `Tests: 65 passed, 65 total`（REQ-352 の 3 tests = baseline 1 + NaN 1 + omitted 1 を含む。修正前 RED 実測は 5 failed / 60 passed・Phase 162 の 3 REQ 分）。mutation 適用後 `Tests: 3 failed, 62 passed, 65 total` — NaN/omit の 2 tests が **target RED**（WARNING note が消え `NaN > 85` の silent suppress に逆戻り）、baseline test（finite 90 で CRITICAL を期待）が **cascade RED**（finite 入力が WARNING note 判定に転落）。revert で 65/65 GREEN 復元。

## MW-029 — HealthCheckService.generateRecommendations pipeline 推奨ゲートの non-finite activeRequests silent-suppress 修正（REQ-353・Phase 162・recommendation 層の fail-loud 化）

- **claim**: 同じ `generateRecommendations()` 内の pipeline 推奨ゲート `metrics.pipeline.activeRequests > 10` も REQ-352 と同一の FALSE 化パターン（`undefined/NaN > 10` → FALSE）で horizontal-scaling 推奨 `'High number of active requests - consider horizontal scaling'` が silently suppress される。修正は同型の isFiniteMetric ガード + warn log + `'WARNING: Active-request count unavailable - scaling headroom could not be assessed'` note。
- **target**: `src/monitoring/health-check-service.ts:685`（修正後 — `if (isFiniteMetric(metrics.pipeline.activeRequests)) {`）
- **mutation**: ガードを `if (!isFiniteMetric(metrics.pipeline.activeRequests))` に反転（= non-finite のとき閾値評価・finite のとき note）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 162 実施時): mutation 適用後 `Tests: 2 failed, 63 passed, 65 total` — NaN test が **target RED**（note が消える）、baseline test（`activeRequests: 15` で scaling 推奨を期待）が **cascade RED**（finite 入力が note 判定に転落）。revert で 65/65 GREEN 復元。

## MW-030 — HealthCheckService.checkLiveness の heapUsed 欠損/non-finite による fabricated dead verdict 修正（REQ-354・Phase 162・liveness probe の fail-loud 化）

- **claim**: `src/monitoring/health-check-service.ts` の `checkLiveness()` は `alive = latency < 1000 && memoryUsage.heapUsed > 0` の連言で memory sanity check を含めていた。REQ-347 が documented した browser-path 欠損で `heapUsed` が omit（または non-finite）のとき `undefined > 0` / `NaN > 0` は FALSE に化け、**実測 latency が正常でも** alive=false を返す。さらに reason は常に latency を名指しするため（`System responsiveness issue (latency: Xms)`）、実際の原因（memory metric 欠損）を偽って隠す fabricated dead verdict となる — `src/api/routes/health.ts:48` の GET /health/live 消費者では restart 誘発。修正は `memoryMetricAvailable` 判定を導入して unavailable 時は sanity check を skip（latency が responsiveness signal のまま alive とし、reason に `memory metric unavailable: backend omitted/non-finite heapUsed` を明示）+ not-alive reason の原因別誠実化（latency 超過 / `heapUsed ≤ 0`）。
- **target**: `src/monitoring/health-check-service.ts:781`（修正後 — `const alive = latency < 1000 && (!memoryMetricAvailable || memoryUsage.heapUsed > 0);`）
- **mutation**: 連言を `latency < 1000 && (memoryMetricAvailable && memoryUsage.heapUsed > 0)` に反転（= memory metric が unavailable のとき必ず dead = 修正前の fabricated dead verdict セマンティクス）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'tests/unit/monitoring/health-check-service'`
- **observed** (2026-08-20・Phase 162 実施時): mutation 適用後 `Tests: 2 failed, 63 passed, 65 total` — omitted / NaN の 2 tests が **target RED**（alive=true + honest reason ではなく alive=false に逆戻り）。cascade なし — 既存の正常系（`should return alive=true when system is responsive`）は `memoryMetricAvailable=true` で影響を受けず、throw 系（`alive=false on error`）は catch 経由で無関係。revert で 65/65 GREEN 復元。監査 pin **≥27 → ≥30** に引き上げ（MW-028〜030 追加で 27 → 30 エントリ）。

## MW-031 — specs mirror marker 契約（義務 B 前半）の drift 検出保証（REQ-355・Phase 163・TASK-0249・requirements.md 正本 ↔ architecture.md mirror の機械 sync）

- **claim**: 義務 B（TASK-0243 §義務 B → TASK-0247 §残存 obligation で DoD concrete 化・TASK-0248 §残存 obligation で「未着手の最優先」）の前半として、`specs/speech-to-visuals/architecture.md` §非機能要件の実現方法（mirror）↔ `specs/speech-to-visuals/requirements.md` §非機能要件（正本）の二重管理に **marker 契約**（`<!-- mirror:requirements.md#非機能要件:start tokens="…" -->` … `:end -->`）を導入した。tokens（60秒以内・25.2秒・2秒以内・0.5倍・37-45 FPS・20秒以内・環境変数・express-rate-limit・Helmet・Supabase の 10 verbatim トークン）は正本節と mirror region の**両方**に存在しなければならず、片側でも欠ければ `tests/guards/specs-mirror-contract.test.ts` が RED になる。Phase 158〜161 で繰り返した specs 債務クラス（実装 commit が specs 同期を漏らし後から一括補填）と ai-hub link:spine drift が作業 commit から漏れた構造問題を「契約違反のまま commit すると CI RED」に変える。MW-031 の mutation は「正本は 60秒以内のまま mirror 側だけ 90秒以内に書き換わる drift」（= 正本更新が mirror に未伝播の典型形）を検出することを保証する。
- **target**: `specs/speech-to-visuals/architecture.md:630`（`<!-- mirror:requirements.md#非機能要件:start tokens="60秒以内|…" -->` — 10 トークン宣言）
- **mutation**: mirror region 内の `- **エンドツーエンド処理時間**: 60秒以内（実績25.2秒）` を `90秒以内（実績25.2秒）` に書き換え（= トークン "60秒以内" が mirror 側から消失する drift）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'specs-mirror-contract'`
- **observed** (2026-08-20・Phase 163 実施時): mutation 適用後 `Tests: 1 failed, 11 passed, 12 total` — real specs tree の zero-viololation test が **target RED**（`TOKEN_MISSING_IN_MIRROR` 1 violation・detail がトークン "60秒以内" を名指し）。fixture 系 10 tests（drift 検出ロジック自体の正しさ）と contract presence pin は影響を受けず GREEN。revert で 12/12 GREEN 復元。監査 pin **≥30 → ≥31** に引き上げ（MW-031 追加で 30 → 31 エントリ）。

## MW-032 — specs mirror sync-stamp 契約（義務 B 後半）の非 token drift 検出と generator による機械再生成（REQ-356・Phase 164・TASK-0250・`npm run specs:mirror:sync`）

- **claim**: MW-031 の tokens 双方向検証は「marker が宣言したトークン」の変化だけを検出する。義務 B 後半（TASK-0250）は各 mirror region に machine-owned の **sync-stamp** 行（`<!-- sync:mirror source-digest="…" -->` = 正本節 body の正規化 sha256 先頭 12 hex）を追加し、正本節への **あらゆる** 編集（token 未宣言の事実の変更・追記を含む）を `STALE_SYNC_STAMP` として検出する。機械的に解決できる分（stamp 再生成）は `scripts/sync-mirror-from-requirements.ts`（`npm run specs:mirror:sync`）が担ぎ、token 事实上の drift（人手 curation が必要な分）だけを人間に残す — これが義務 B「人間の手作業経由ではなく build hook での再生成」の所有権分割。`specs:mirror:check`（--check・書き込みなし）は `verify:all` と `spine:validate` gate（`scripts/validate-spine-manifest.ts` CLI）の両方に配線され、manifest が auto-gen・gitignored で SKIPPED になる clean checkout / CI でも specs/ は tracked なので mirror drift に対して常に実 teeth を持つ。MW-032 の mutation は「正本の token 未宣言の事実（NFR-501 のコスト上限 $0.10）だけが変わる編集」— tokens 検証が素通りし stamp だけが検出する形 — を選別している。
- **target**: `specs/speech-to-visuals/architecture.md:631`（`<!-- sync:mirror source-digest="56cab125a152" -->` — generator 挿入行）+ `tests/guards/specs-mirror-contract.ts` の `computeSourceDigest` / `STALE_SYNC_STAMP` 検証
- **mutation**: `specs/speech-to-visuals/requirements.md` NFR-501 の `コストは $0.10 以下` を `コストは $0.11 以下` に書き換え（10 トークンのいずれでもない = tokens 双方向検証を素通りする非 token 事実編集）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'specs-mirror-contract'`
- **observed** (2026-08-20・Phase 164 実施時): mutation 適用後 `Tests: 1 failed, 22 passed, 23 total` — real specs tree の zero-viololation test が **target RED**（`STALE_SYNC_STAMP` 1 violation・`TOKEN_MISSING_*` なし = 非 token 編集を stamp だけが検出したことの実証・detail は `stamp=56cab125a152・現 digest=b92633966624` を名指し）。同期して `npm run specs:mirror:check` が exit 1（violation 1）、`npm run specs:mirror:sync` が stamp を `b92633966624` に機械再生成して post-sync violations 0・exit 0 を返す（generator による修復経路の実証）。revert（requirements.md 復元 + sync 再実行で stamp を `56cab125a152` に復元）で 23/23 + census 11/11 GREEN 復元。監査 pin **≥31 → ≥32** に引き上げ（MW-032 追加で 31 → 32 エントリ）。

## MW-033 — 義務 C 第1ゲート tests/unit exact-0 pin の実 teeth（REQ-357・Phase 165・TASK-0251）

- **claim**: TASK-0243 が定義した義務 C の第1ゲート「tests/unit exact-0」を、ratchet 単調減少ラウンド 9 として残存全数（21 ファイル / 61 ノード）を fail-loud idiom（`requireDefined(value, label)` ファイル内 helper ×14 ファイル・`fireCapturedResolver` ×6 ノード・env const capture・`act()` 内 guard・`(scenes?.length ?? 0)` と等価な null/undefined 明示 guard）で撲滅し、`TESTS_DIR_PINS.unit` を 61 → 0 に引き下げる。0 pin は `toBeLessThanOrEqual` なので「1 個くらい戻っても気づかない」懸念に対し、単発 `!` の再注入が dir ratchet と total ratchet の **両方** を同時 RED にすることを単発 mutation で実証する（transcription（MW-020・Phase 154）に次ぐ 2 番目の dir exact-0）。
- **target**: `tests/guards/non-null-assertion-census.test.ts`（`TESTS_DIR_PINS.unit: 0`・`PINNED['tests (excl. __mocks__)']: 191`）+ tests/unit 21 ファイルの Phase-165 rewrite
- **mutation**: `tests/unit/monitoring/health-check-service.test.ts:761` の `expect(cached.status).toBeDefined();` を `expect(cached!.status).toBeDefined();` に戻す（Phase-165 rewrite `requireDefined(getCachedHealth(), 'getCachedHealth()')` 経由の値読みへの単発 `!` 再注入）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'non-null-assertion-census'`
- **observed** (2026-08-20・Phase 165 実施時): mutation 適用後 `Tests: 2 failed, 9 passed, 11 total` — (1) tests/unit directory ratchet が **RED**（`expect(hits.length).toBeLessThanOrEqual(pin)`・`Received: 1`・expected ≤ 0）・(2) tests-total ratchet が **RED**（`Received: 192`・expected ≤ 191）の同時発火 = exact-0 pin が単発ノードでも検出する実 teeth。revert（`cached!` → `cached` 復元）で census + health-check-service 系 3 suites / 76 tests GREEN 復元。監査 pin **≥32 → ≥33** に引き上げ（MW-033 追加で 32 → 33 エントリ）。

## MW-034 — memory-backend 出力契約（finite or null）の3層実 teeth（REQ-358〜360・Phase 166・TASK-0252）

- **claim**: メモリ欠損シグナル（backend が heap フィールドを省略/非有限 drift）を消費側 3 層の個別 isFiniteMetric guard から、source 側出力契約「全フィールド = 有限数 or 明示 null・undefined/NaN/±Infinity なし」を持つ唯一の境界 `src/monitoring/memory-backend.ts`（REQ-358）+ getSnapshot null 伝播（REQ-359）+ 消費側 `=== null` 分岐集約（REQ-360）に根源修正する。契約の **3 層それぞれ**（境界マッパー・snapshot 伝播・gate fail-loud 分岐）が単独で無効化された場合に検証 test が RED になることを3種の独立 mutation で実証する。
- **target**: `src/monitoring/memory-backend.ts`（`finiteOrNull` マッパー）+ `src/monitoring/real-time-performance-monitor.ts`（getSnapshot null 伝播）+ `src/quality/adaptive-quality-gates.ts`（UNAVAILABLE branch の `=== null` 検査）
- **mutation**: (a) getSnapshot の null 伝播 helper を `?? 0` フォールバックに戻す（欠損 → 捏造 0 = silent-healthy）・(b) `finiteOrNull` を素通し（`return value as number | null` — 契約が undefined/NaN/Infinity を通す）・(c) gate の UNAVAILABLE 分岐 `currentValue === null` を `currentValue === undefined` に弱体化（null 実測が分岐を素通りし `null < threshold` 強制変換に戻る）
- **command**: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'real-time-performance-monitor-null-propagation'` / `'memory-backend-contract'` / `'adaptive-quality-gates'`
- **observed** (2026-08-21・Phase 166 実施時): (a) `Tests: 3 failed, 3 passed, 6 total` — zero-fallback 保存・省略→null・NaN drift→null が RED（`?? 0` で欠損が 0 に捏造される）→ revert 6/6 GREEN。(b) `Tests: 7 failed, 3 passed, 10 total` — 契約テストの undefined 検出・非有限検出・sweep 7 shape 中 7 が RED → revert 10/10 GREEN。(c) `Tests: 3 failed, 44 passed, 47 total` — UNAVAILABLE gate FAIL・baseline 非記録・crash せず FAIL の 3 test が RED → revert 47/47 GREEN。3 mutation とも境界・伝播・分岐の独立 teeth を実証。監査 pin **≥33 → ≥34** に引き上げ（MW-034 追加で 33 → 34 エントリ）。

---

## MW-035 — 義務 C 第2ゲート 3 dir exact-0 pin の同時 teeth（REQ-361・Phase 167・TASK-0253）

- **claim**: 義務 C 第2ゲート（tests total ≤ 100）を、steering 指定の残り 3 ディレクトリ（guards・visualization・integration）残存全数 57 ファイル / 155 ノードの fail-loud idiom 置換で 0 にして通過する（191 − 155 = 36 ≤ 100）。**3 ディレクトリそれぞれ** の exact-0 pin が単発 `!` 再注入で独立に RED になる（dir ratchet 0→1 と tests-total ratchet 36→37 の同時 RED）ことを3種の mutation で実証する — MW-033（unit 単 dir）の横展開。
- **target**: `tests/integration/export-service-shutdown.test.ts`（findJob 結果の labeled guard）+ `tests/visualization/advanced-layouts.test.ts`（find 結果の labeled guard）+ `tests/guards/framework-pipeline-unmount-real-fix-witness.test.ts`（`| undefined` resolver holder の invocation-time guard）
- **mutation**: (a) `expect(completed.status)` → `expect(completed!.status)`（integration・Phase-167 rewrite への単発 `!` 再注入）・(b) `expect(rootNode.y)` → `expect(rootNode!.y)`（visualization・同）・(c) `resolveExecution(commitExecution)` → `resolveExecution!(commitExecution)`（guards・同）
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'non-null-assertion-census'`
- **observed** (2026-08-21・Phase 167 実施時): (a)(b)(c) とも census 2 failed — directory ratchet `Expected: <= 0 / Received: 1` と tests-total ratchet `Expected: <= 36 / Received: 37` の**同時 RED**（11 tests 中 2 failed / 9 passed）。各 revert で census 11/11 GREEN 復元・触 3 suite（export-service-shutdown / advanced-layouts / framework-pipeline-unmount-real-fix-witness）GREEN。監査 pin **≥34 → ≥35** に引き上げ（MW-035 追加で 34 → 35 エントリ）。

## MW-036 — 義務 C 最終ゲート 全 pin 集約（tests total 0）後の 2 重 ratchet teeth（REQ-362・Phase 168・TASK-0254）

- **claim**: 義務 C 最終ゲートとして残存 9 ディレクトリ（pipeline 11・quality 9・analysis 6・api 2・lib 2・remotion 2・(root) 2・acceptance 1・config 1 = 14 ファイル / 36 ノード）を fail-loud idiom（ファイル内 helper `requireCriterionResult`/`requireRecommendation`/`requireWorstBottleneck`/generic `requireBreaker`/`requireMatch`/`requireCodePoint`・optional field の one-shot narrowing guard・冗長 toBeDefined/not.toBeNull の labeled throw 畳込み）で 0 にし、`TESTS_DIR_PINS` 14 エントリと `PINNED['tests (excl. __mocks__)']` を **すべて 0 に集約**（src（Phase 147）と tests の両 tree が exact-0）。併せて TASK-0243 が spec 化した ratchet 終了条件 3 ケースを active 形式で guard に実装（it.skip→manual unskip でなく直接 active 化 — TC-342-01 の it.skip は specs のみで guard 未実装だった（`git log -S "stillRoom" -- tests/` 空）ため、両ゲート通過済みの本タイミングの直接実装が「manual unskip 発火」の実体）、旧 vacuity check（`testsTotal.count > 0`）は両 tree 0 で恒常 RED になるため `countInText` fixture liveness（`x!`/`x!:` 2 hit + string 内/comment 内 decoy 非カウント）に置換。MW-036 の mutation は**集約後の 2 重 pin 構造**（dir ratchet × total ratchet）が単発 `!` 再注入で独立に検出する実 teeth を、残存プール最大の 3 dir と `bucketTestsHits` の top-level 判定を含む '(root)' bucket の 4 種で実証する。
- **target**: `tests/pipeline/pipeline-health-score.test.ts:267` / `tests/quality/quality-gate.test.ts:251` / `tests/analysis/semantic-similarity.test.ts:150` / `tests/spine-manifest.test.ts:492`
- **mutation**: (a) `expect(bnRec.priority).toBe('high');` → `expect(bnRec!.priority).toBe('high');`（pipeline・Phase-168 rewrite への単発 `!` 再注入）・(b) `expect(continuity.passed).toBe(true);` → `expect(continuity!.passed).toBe(true);`（quality・同）・(c) `expect(result.data).toBe('fox');` → `expect(result!.data).toBe('fox');`（analysis・同）・(d) `expect(children[0].path).toBe('acceptance-criteria.md');` → `expect(children![0].path).toBe('acceptance-criteria.md');`（(root) bucket・同）
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'non-null-assertion-census'`
- **observed** (2026-08-21・Phase 168 実施時): (a)(b)(c)(d) とも census 2 failed / 12 passed — directory ratchet `Expected: <= 0 / Received: 1` と tests-total ratchet `Expected: <= 0 / Received: 1` の**同時 RED**。各 revert で census 14/14 GREEN 復元・触 14 ファイル 16 suites / 3216 tests + guards 76 suites / 3241 tests GREEN。監査 pin **≥35 → ≥36** に引き上げ（MW-036 追加で 35 → 36 エントリ）。

---

## MW-037 — tsconfig.test baseline 14 → 0 後の type-check:tests gate teeth（REQ-363・Phase 169・TASK-0255）

- **claim**: TASK-0224 が露出させた `tsc -p tsconfig.test.json --noEmit` の baseline 14（Phase 148〜168 で 156 → 14 まで減少）を全数撲滅し、CI type-check job に `type-check:tests` を配線して tests tree の strict 検査を **CI gate 化** する（それまで CI は `tsconfig.app.json`（src のみ）しか検査せず baseline 14 は CI から不可視だった）。残存 14 は 3 家系: (a) closure 内のみ代入の holder への `= null` initializer が CFA を null 狭化に固定（`open` は truthy 分岐を `never` に落とし TS2339×3・`captured`/`receivedReport` は `requireDefined` の T を `null` に崩し TS18047×6）・(b) `T | undefined` だけの requireDefined が nullable field で戻り値を possibly-null（TS18047×2）・(c) census checker の値 import `ts` を型位置に使用（TS2503×2）+ `ParameterDeclaration` に存在しない `exclamationToken` 参照（TS2339×1 — parameter への `!:` は TS1005/TS1138 parse error で言語仕様上存在せず、当該分岐は実行時も常に非カウントの dead detector だった）。MW-037 の mutation は撲滅の 3 家系それぞれへの**再注入**が `tsc -p tsconfig.test.json` で独立に RED になる実 teeth を実証する。
- **target**: `tests/unit/utils/report-corruption-frozen.test.ts:50` / `tests/guards/specs-mirror-contract.ts:114` / `tests/unit/pipeline/pipeline-health-score.test.ts:31`
- **mutation**: (a) `let captured: CorruptionReport | undefined;` → `let captured: CorruptionReport | null = null;`（holder initializer 再注入）・(b) `let open: OpenMirrorRegion | undefined;` → `let open: OpenMirrorRegion | null | undefined = null;`（同）・(c) `requireDefined<T>(value: T | null | undefined, …)` → `requireDefined<T>(value: T | undefined, …)` に狭化復帰
- **command**: 各 mutation 適用後に `node_modules/.bin/tsc -p tsconfig.test.json --noEmit`（CI では `npm run type-check:tests` として同一 step で走る）
- **observed** (2026-08-21・Phase 169 実施時): (a) **TS18047×4**（`'received' is possibly 'null'`・行 57-60）・(b) **TS2339×3**（`Property 'startLine'/'sourceFile'/'section' does not exist on type 'never'`・行 189）・(c) **TS18047×2**（`'costComparison' is possibly 'null'`・行 436-437）の独立 RED。各 revert で 0 error GREEN 復元・検証 pattern 9 suites / 234 tests + guards 76 suites / 3241 tests GREEN・`tsc -p tsconfig.app.json` 0 error 不変。監査 pin **≥36 → ≥37** に引き上げ（MW-037 追加で 36 → 37 エントリ）。

## MW-038 — RTPM 捏造 quality/LLM-timing メトリック撲滅後の finite-or-null 契約 teeth（REQ-364・Phase 170・TASK-0256）

- **claim**: `getSnapshot()` の producer-less 5 field（`quality.transcriptionAccuracy/layoutOverlapRate/avgSceneQuality` と `llm.avgFlashResponseTime/avgProResponseTime`）は「Populated externally」コメント付きの捏造定数（0.90 / 0 / 0.85 / 0 / 0）で、repo 内に外部 populate の producer が存在しないまま adaptive-quality-gates の DEFAULT gate 閾値と正確に結合し、blocker **Transcription Accuracy**（gte 0.85）・blocker **Layout Overlap Rate**（eq 0）・major **LLM Response Time**（lt 15000）を恒久 GREEN にし、adaptable な Transcription Accuracy gate の閾値適応を捏造 0.90 で汚染していた（memory L3 台帳 hunt-order #1「0.85 metric-DEFAULT coupled-to-GATE-threshold」の live instance）。REQ-358〜360（Phase 166）の finite-or-null 契約を当該 field に拡張し、producer は明示 null・gate は METRIC UNAVAILABLE fail-loud・`updateAdaptiveThresholds` は null round skip とする。MW-038 の mutation は (a) producer 侧への捏造定数再注入と (b) extractor への silent-pass（`?? 定数`）再注入がそれぞれ独立に RED になる実 teeth を実証する。
- **target**: `src/monitoring/real-time-performance-monitor.ts`（getSnapshot の quality/llm block・~L545）/ `src/quality/adaptive-quality-gates.ts`（METRIC_EXTRACTORS の quality 3 行・~L364）
- **mutation**: (a) `transcriptionAccuracy: null` → `0.90`・`layoutOverlapRate: null` → `0`・`avgSceneQuality: null` → `0.85`（producer 捏造定数再注入）・(b) `transcriptionAccuracy: s => s.quality.transcriptionAccuracy` → `s => s.quality.transcriptionAccuracy ?? 0.90`・`layoutOverlapRate: s => … ?? 0`・`avgSceneQuality: s => … ?? 0.85`（gate が null を定数に置き換えて silent-PASS する「一見親切な default」再注入）
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'real-time-performance-monitor-null-propagation|adaptive-quality-gates'`
- **observed** (2026-08-21・Phase 170 実施時): (a) 契約 test 1 failed / 8 passed — `expect(snapshot.quality.transcriptionAccuracy).toBeNull()` が **`Received: 0.9`** で RED（producer 契約の直接検出）。(b) gates 3 failed / 49 passed — blocker Transcription Accuracy gate が **`Expected: false / Received: true`**（silent-pass 復帰）ほか Layout Overlap Rate blocker と adaptive-baseline 汚染 test が同時 RED。各 revert で 3 suites / 63 tests GREEN 復元・触 10 suites / 235 tests GREEN・tsc 両 config 0 error。監査 pin **≥37 → ≥38** に引き上げ（MW-038 追加で 37 → 38 エントリ）。

---

## MW-039 — per-model LLM response-time producer + METRIC_EXTRACTORS 静的 guard の teeth（REQ-365〜367・Phase 171・TASK-0257）

- **claim**: Phase 170（REQ-364/MW-038）で finite-or-null 化した `avgFlashResponseTime`/`avgProResponseTime` に実測 producer を実装した — monitor は per-model 累積 counter（`{flash,pro}ResponseTime{TotalMs,Count}`・cache hit 除外・sanitizeFinite）を `recordLLMRequest` 経由で蓄積し、llm-service `execute()` が完了 5 経路（primary 成功・cache hit・primary 即時失敗・fallback 成功のみ・全滅は複合ラベル）を報告する。あわせて extractor への `?? 定数` silent-pass 再注入を **静的 guard**（`tests/guards/adaptive-gates-extractor-no-literal-fallback.test.ts`）で SHAPE ごと ban した（steering: 「静的 guard を追加しない限り、次の再注入は review を素通りする」）。MW-039 の mutation は (a) producer 累積の削除・(b) extractor への silent-pass 再注入（MW-038 (b) の再実証・ただし静的 guard 検出を含む）・(c) llm-service wiring の削除がそれぞれ独立に RED になる実 teeth を実証する。
- **target**: `src/monitoring/real-time-performance-monitor.ts`（recordLLMRequest の bucket 累積・snapshot の avgModelResponseTimeMs）/ `src/quality/adaptive-quality-gates.ts`（METRIC_EXTRACTORS `avgFlashResponseTime` 行）/ `src/analysis/llm-service.ts`（reportToPerformanceMonitor 5 call site）
- **mutation**: (a) recordLLMRequest の flash/pro bucket 加算を削除（totalRequests のみ count に戻す）・(b) `avgFlashResponseTime: s => s.llm.avgFlashResponseTime` → `s => s.llm.avgFlashResponseTime ?? 0.90`（silent-pass 再注入）・(c) llm-service の `this.reportToPerformanceMonitor(...)` 5 call を全削除
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'real-time-performance-monitor.test|adaptive-quality-gates.test|llm-service-comprehensive|adaptive-gates-extractor-no-literal-fallback'`
- **observed** (2026-08-21・Phase 171 実施時): (a) producer test 3 failed — `Expected: 3000 / 2000 / 1000` に対し **`Received: null`** で RED（measured-mean 契約の直接検出）。(b) 3 failed — **静的 guard** が `expect(block).not.toMatch(...)` で `Received string: "METRIC_EXTRACTORS: Readonly<..."` として RED + runtime blocker/LLM gate が silent-pass `Received: true` で RED + adaptive baseline 汚染 test 同時 RED（guard と runtime の二段検出）。(c) wiring test 1 failed — **`Received number of calls: 0`** で RED。各 revert で 8 suites / 238 tests GREEN 復元・影響 8 suites / 250 tests + 消費側回帰 15 suites / 324 tests GREEN・tsc 両 config 0 error。監査 pin **≥38 → ≥39** に引き上げ（MW-039 追加で 38 → 39 エントリ）。

---

## MW-040 — QualityMonitor reporter 捏造 trio/pair を canonical estimators 委譲の teeth（REQ-369〜370・Phase 172・TASK-0258）

- **claim**: QualityMonitor に直結する reporter 2 site の捏造 metric を canonical estimators に委譲した — (1) SimplePipeline success-path の trio（`transcriptionAccuracy: transcript.length > 0 ? 0.9 : 0`・`sceneSegmentationF1: scenes.length > 0 ? 0.85 : 0`・`layoutOverlap: 0`「layout engine が保証」）は `detectViolations` threshold（0.85/0.75/0）と正確に結合する恒久 green で、MainPipeline/FrameworkIntegratedPipeline が委譲済みなのに対する MISSED-SIBLING-SITE。(2) GeminiAnalyzer の `entityExtractionF1: nodes.length > 0 ? 0.85 : 0.3` は 0.85 > threshold 0.80 で非空抽出が恒久 green（singleton 0.70・過密 0.50 の実 signal が無報告）。MW-040 の mutation は (a)〜(c) trio 各 field の捏造再注入・(d) gemini pair 再注入がそれぞれ独立に RED になる実 teeth を実証する。L3 台帳「0.85 metric-DEFAULT coupled-to-GATE-threshold」の reporter-side live instance 撲滅。
- **target**: `src/pipeline/simple-pipeline.ts`（success-path recordMetrics の 3 field）/ `src/analysis/gemini-analyzer.ts`（createEnhancedParser 内 recordMetrics の entityExtractionF1）
- **mutation**: (a) `transcriptionAccuracy: estimateTranscriptionAccuracy(qualitySignals)` → 捏造 `transcript` 復帰 `transcript.length > 0 ? 0.9 : 0`・(b) `sceneSegmentationF1: estimateSegmentationQuality(qualitySignals)` → `scenes.length > 0 ? 0.85 : 0`・(c) `layoutOverlap: countLayoutOverlaps(qualitySignals)` → `0`・(d) `nodes.length > 0 ? scoreNodeDensity(nodes.length) : 0` → `nodes.length > 0 ? 0.85 : 0.3`
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'simple-pipeline.test|gemini-analyzer-entity-density'`
- **observed** (2026-08-21・Phase 172 実施時): (a) 1 failed — 退化 fixture（単一 `['']` segment・30 秒単一 scene・overlap 1 pair）で **`Expected: 0.9, Received: 0`** で RED（空 transcript で捏造が 0 に崩れる = canonical 0.9 との分歧）。(b) 2 failed — **`Expected: 0.7 / 1, Received: 0.85`** で RED（0.85 は threshold 0.75 超過の恒久 green 値・実測 0.7/1.0 と分歧）。(c) 1 failed — **`Expected: 1, Received: 0`** で RED（実 overlap 1 を捏造 0 が隠す）。(d) 4 failed — **`Expected: 0.9 / 0.7 / 0.5 / 0`** に対し **`Received: 0.85 × 3, 0.3`** で RED。各 revert（perl 逆置換 — `git checkout` は fix ごと消すため不使用・grep で委譲残存確認）で影響 3 suites / 107 tests GREEN 復元・52 suites / 967 tests + guards/api/framework/acceptance/integration 156 suites / 4477 tests GREEN・tsc 両 config 0 error。**GOTCHA**: 退化 fixture が 11 個の空 segment だと `join(' ')` が空白のみの非空文字列を返し捏造 0.9 === canonical 0.9 で RED 不成立 — 単一 `['']` まで絞って初めて分歧する。監査 pin **≥39 → ≥40** に引き上げ（MW-040 追加で 39 → 40 エントリ）。

---

## MW-041 — RTPM layoutOverlapRate 実測 producer・測定サイト直結 wiring の teeth（REQ-372〜373・Phase 173・TASK-0259）

- **claim**: REQ-364 が finite-or-null 化した `snapshot.quality.layoutOverlapRate` に実測 producer（`recordPipelineQuality`）を実装し、canonical overlap scan が走る 3 測定サイト（SimplePipeline success path・MainPipeline `buildQualityMetrics`・FrameworkIntegratedPipeline `extractQualityMetrics`）から直結 wiring した。REQ-368 設計決定の fail-closed は `layoutOverlapRate` についてのみ解消（canonical scan が repo 内に既存のため）。MW-041 の mutation は (a) producer 全焼（snapshot 常時 null）・(b) 捏造 0 再注入（REQ-364 class 再発）・(c) wiring 削除がそれぞれ独立に RED になる実 teeth を実証する。**設計決定**: 値は count（`QualityMonitor.layoutOverlap` と同量）で rate ではない・bridge は recordMetrics 内でなく測定サイトに置く（recordMetrics の他 caller は未測定 DEFAULT 0 を渡すため）。
- **target**: `src/monitoring/real-time-performance-monitor.ts`（recordPipelineQuality / measuredLayoutOverlapCount）/ `src/pipeline/simple-pipeline.ts`（success path の report call）
- **mutation**: (a) snapshot `layoutOverlapRate: this.measuredLayoutOverlapCount()` → `null`・(b) 同 → 捏造 `0`・(c) SimplePipeline success path の `realTimeMonitor.recordPipelineQuality(scenes.length, layoutOverlap)` 行削除
- **command**: 各 mutation 適用後に `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs --testPathPatterns 'real-time-performance-monitor-null-propagation|adaptive-quality-gates|simple-pipeline.test'`
- **observed** (2026-08-21・Phase 173 実施時): (a) 4 failed — producer test が **`Expected: 2 / 0 / 0 / 0, Received: null`** で RED（measured publish 契約の直接検出）。(b) 5 failed — fresh-monitor null 契約（捏造 0 は eq-0 blocker gate を無測定で pass させる REQ-364 class）・degenerate report・measured count 2・NaN sanitize・reset の全契約面が RED。(c) 2 failed — wiring test が **`Received number of calls: 0`** で RED（failure path 0 call test は緩すぎず success 2 test のみ RED = 測定サイト直結の検出）。各 revert（perl 逆置換・grep で実装残存確認）で 7 suites / 205 tests GREEN 復元・pipeline import 系 16 suites / 346 tests + integration/monitoring 22 suites / 418 tests 回帰 GREEN・tsc 両 config 0 error。**GOTCHA**: (b) の捏造 0 は adaptive-gates の直接 snapshot test（measured 2 で RED）には届かない — fresh-monitor null 契約 test が silent-pass 側の検出面。監査 pin **≥40 → ≥41** に引き上げ（MW-041 追加で 40 → 41 エントリ）。

---

## MW-042 — pipeline QualityMonitor layoutOverlap count-or-null 契約・orchestrator 実測 producer の teeth（REQ-375〜377・Phase 174・TASK-0260）

- **claim**: pipeline 側 QualityMonitor（0-100 scale）の `layoutOverlap` を count-or-null（null = unmeasured）契約化し、TASK-0259 が REQ-373 設計決定で名指しした債務「recordMetrics の他 caller は DEFAULT `layoutOverlap: 0` を未測定のまま渡す」を解消した。旧 DEFAULT 0 は `calculateOverallScore` の zero-overlap +5 bonus を無測定 run に与え eq-0 zero-tolerance gate を無測定で恒久 GREEN にする（REQ-364 class の最後の live instance）。あわせて orchestrator layout stage の捏造二重構造（`score < 0.7 ? 1 : 0` の count 捏造 + `edgeCompleteness: score` laundering）を canonical `countOverlapPairs` 実測に置換した。MW-042 の mutation は (a) DEFAULT 捏造 0 再注入・(b) orchestrator 捏造再注入・(c) failure path 0 再注入がそれぞれ独立に RED になる実 teeth を実証する。**設計決定**: RTPM `layoutOverlapRate`（Phase 173・count）と同量・同契約に揃える（片方だけ null 対応だと eq-0 blocker が 2 経路のうち未測定側だけ通過する）・orchestrator への RTPM wiring は追加しない（live 3 site は Phase 173 済み・dormant export に ESM mock 負荷だけ増える）。
- **target**: `src/pipeline/quality-monitor.ts`（QualityMetrics.layoutOverlap / recordMetrics DEFAULT / checkThresholds / calculateOverallScore / compareToBaseline）/ `src/pipeline/pipeline-orchestrator.ts`（measureLayoutOverlaps / recordStageQuality layout case）/ `src/pipeline/simple-pipeline.ts`（failure path）/ `src/pipeline/improvement-detector.ts` / `src/quality/regression-detector.ts`
- **mutation**: (a) recordMetrics DEFAULT `layoutOverlap: null,` → 捏造 `0,`・(b) layout case の `if (measuredLayout && measuredLayout.measuredLayouts > 0) { … layoutOverlap: measuredLayout.overlapCount }` → `if (score !== undefined) { … layoutOverlap: score < 0.7 ? 1 : 0, edgeCompleteness: score }`・(c) failure path recordMetrics に `layoutOverlap: 0,` 再注入
- **command**: 各 mutation 適用後に (a) `--testPathPatterns 'tests/unit/pipeline/pipeline-quality-monitor'`・(b) `--testPathPatterns 'pipeline-orchestrator-layout-measurement|pipeline-orchestrator-quality'`・(c) `--testPathPatterns 'tests/unit/pipeline/simple-pipeline'`（共通 prefix: `NODE_OPTIONS='--experimental-vm-modules --max-old-space-size=4096' npx jest --config jest.config.cjs`）
- **observed** (2026-08-21・Phase 174 実施時): (a) 1 failed — default 契約 test が **`Expected: null, Received: 0`** で RED（vacuous 0 再注入の直接検出・bonus 側は明示 null が spread で勝つため default 面が検出面）。(b) 6 failed — white-box 4（measured 0 with low score **`Expected: {layoutOverlap: 0}, Received: {layoutOverlap: 1, edgeCompleteness: 0.5}`**・measured 3 with high score の逆方向・vacuous record 2）+ integration 2（edgeCompleteness laundering `Received: 0.5599…`・layoutOverlap 検出）で RED。(c) 1 failed — failure-path test が **`Expected: undefined, Received: 0`** で RED。各 revert（perl 逆置換・grep で実装残存確認）で 7 suites / 216 tests GREEN 復元・回帰 130 suites / 2848 tests（pipeline/quality/monitoring 全域）GREEN・tsc 両 config 0 error。**GOTCHA**: 同名 test file が `src/pipeline/__tests__/quality-monitor.test.ts` と `tests/unit/pipeline/pipeline-quality-monitor.test.ts` に同居 — 片方だけ直すと広域回帰まで発覚が遅れる（MISSED-SIBLING-SITE の test 版・影響 7 suites の初回 run で捕捉）。監査 pin **≥41 → ≥42** に引き上げ（MW-042 追加で 41 → 42 エントリ）。

---

## 恒久 mutation test（ledger 対象外・常時 CI で走るもの）

以下は「一時 mutant → RED 確認 → revert」ではなく mutant を恒久テスト化したもので、
CI 実行 = 再検証なので台帳対象外（出典は各テストファイル自体）:

- `tests/export/time-origin-mismatch-guard-mutation.test.ts`（Phase 09f time-origin guard）
- `tests/guards/dagre-dangling-edge-filter-mutation-pinning.test.ts`（TC-307）
- `tests/scripts/collect-evidence.test.ts`（TC-323・mutation RED 2 種を含む 14 tests）

## 更新ルール

1. 新規に「mutation-verified」を specs に記載する場合は、同時に本台帳へ MW エントリ（上記フィールド一式）を追加し、監査テストの PINNED 件数を増やす。
2. 既存エントリの再実行を行った場合は observed/date を更新し、可能なら [EVIDENCE] 行を差し替える（commit hash はその時点の HEAD）。
3. 台帳の主張と specs 本文の主張が矛盾した場合は、**再実行結果を正**として specs 本文を修正する。

## 4-row mutant ledger template（再利用可能付録）

make-run steering feedback「future ratchet tasks don't reinvent the table shape」対応として、MW エントリを以下の 5 列 template に正規化する。template は新設 `tests/guards/mutation-witness-ledger-shape.test.ts` で `grep -cE '^\\| MW-0' specs/speech-to-visuals/mutation-witness-ledger.md` >= `LEDGER.length` を担保（TC-365-01・REQ-381）。既存 MW-001〜042 エントリの free-form narrative（本文）は保持し、各エントリ末尾に template 行（` | MW-NNN | <mutant> | <redCount> | <received> | <restoration> |`）を追加していく可逆正規化を許容する。

| ID | mutant | RED-count | RED-test-name（Received 抜粋） | restoration |
|----|--------|-----------|-------------------------------|-------------|
| MW-001 | statusCodeClass 境界 `<500` 除去 | — | n/a（恒久 TC-205-04） | revert/n/a（恒久 test 化） |
| MW-038 | `transcriptionAccuracy/layoutOverlapRate/avgSceneQuality` finite-or-null 契約（3 mutation） | (a) 1 failed / 8 passed (b) 3 failed / 49 passed | (a) `Received: 0.9` (b) `Received: true` (blocker silent-pass) | revert で 3 suites / 63 tests GREEN・tsc 0 |
| MW-039 | recordLLMRequest bucket 累積削除 / `?? 定数` 再注入 / `reportToPerformanceMonitor` 5 call 削除 | (a) 3 failed (b) 3 failed (c) 1 failed | (a) `Received: null` (b) `Received: true` (c) `Received number of calls: 0` | revert で 8 suites / 238 tests GREEN・tsc 0 |
| MW-040 | QualityMonitor trio/pair 捏造再注入（4 mutation） | (a) 1 failed (b) 2 failed (c) 1 failed (d) 4 failed | (a) `Expected: 0.9, Received: 0` (b) `Expected: 0.7, Received: 0.85` (c) `Expected: 1, Received: 0` (d) `Received: 0.85 × 3, 0.3` | revert で 3 suites / 107 tests GREEN・回帰 156 suites / 4477 tests GREEN・tsc 0 |
| MW-041 | RTPM `layoutOverlapRate` 全焼 / 捏造 0 再注入 / wiring 削除（3 mutation） | (a) 4 failed (b) 5 failed (c) 2 failed | (a) `Received: null` (b) 5 site （fresh-monitor/degenerate/measured 2/NaN/reset） (c) `Received number of calls: 0` | revert で 7 suites / 205 tests GREEN・回帰 22 suites / 418 tests GREEN・tsc 0 |
| MW-042 | recordMetrics DEFAULT `null`→`0` / orchestrator 捏造再注入 / failure path `0` 再注入（3 mutation） | (a) 1 failed (b) 6 failed (c) 1 failed | (a) `Expected: null, Received: 0` (b) 6 site （両捏造方向 2 + vacuous 2 + integration laundering 1 + measured 3） (c) `Expected: undefined, Received: 0` | revert で 7 suites / 216 tests GREEN・回帰 130 suites / 2848 tests GREEN・tsc 0 |

> **template 列の正規化ルール**: (1) RED-count は `${mutation 適用下の failed test 数}`。 (2) RED-test-name は `Received: ...` または `Expected: ...` の値を part of verdict として引用。複数 site の場合は件数 + site 列挙。 (3) restoration は `${各 revert でグリーン復元した suite/test 数}` + `tsc 0` を最低記述。 (4) 行は `| MW-NNN |` 形式で grep `^\\| MW-0` のヒット対象（恒久 TC の場合は `n/a` 注記）。
