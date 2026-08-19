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
