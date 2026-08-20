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
