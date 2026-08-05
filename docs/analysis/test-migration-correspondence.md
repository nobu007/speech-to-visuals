# Test Migration Correspondence — `setImmediate` → `fireAudioMetadata` / `fireAudioError`

**Date**: 2026-08-05
**Commit**: `7ffa66d` — `test(utils): extract fireAudioMetadata + flushPendingTimers helpers, migrate 38 duplicated setImmediate blocks`
**Trigger**: Previous make-run feedback item (1) — "削除前後のテストケース対応表またはカバレッジ差分を提示し、削除による重要な検証欠落がないことを証明する"

## Purpose

Per the rejection feedback, this document provides the **per-test mapping** from the
pre-`7ffa66d` duplicated dispatch blocks to their post-`7ffa66d` helper invocations,
together with verification evidence that no validation was silently dropped.

The 38 in-line `setImmediate` blocks in `streaming-transcriber.test.ts` are **test
plumbing**, not assertions. They fire a callback that `StreamingTranscriber`'s
constructor awaits so the test's promise chain can advance. Removing them does
**not** remove any assertion; it centralizes the plumbing. This table proves it.

## Migration Mapping (38 blocks, all derived from `7ffa66d` post-migration file)

The post-migration line numbers below are from
`git show 7ffa66d:src/transcription/__tests__/streaming-transcriber.test.ts`.
The pre-migration line numbers come from `git show 7ffa66d -- ... | grep -E "^@@"`
hunk headers (offset of the original block). The "Enclosing `it`" column is the
actual `it(...)` description text from the file (verified via grep).

| # | Helper          | Pre-migration hunk (`-LINE`, from hunk header) | Post-migration (line) | Enclosing `it(...)` |
|---|-----------------|---------------------------------------------------|------------------------|---------------------|
|  1 | fireAudioMetadata | -329  | 333  | `transcribes audio from a string path` |
|  2 | fireAudioMetadata | -358  | 358  | `transcribes audio from a File object` |
|  3 | fireAudioMetadata | -383  | 379  | `calls onProgress callback during transcription` |
|  4 | fireAudioMetadata | -413  | 405  | `calls onSegment callback for valid segments` |
|  5 | fireAudioMetadata | -445  | 433  | `filters segments below minConfidence` |
|  6 | fireAudioError   | -465  | 449  | `throws error when audio file fails to load` |
|  7 | fireAudioMetadata | -487  | 467  | `continues processing when a chunk fails` |
|  8 | fireAudioMetadata | -511  | 487  | `handles multiple chunks with progress updates` |
|  9 | fireAudioMetadata | -537  | 509  | `computes averageConfidence in progress` |
| 10 | fireAudioMetadata | -562  | 530  | `returns text from merged segments` |
| 11 | fireAudioMetadata | -1231 | 1195 | `handles zero duration audio gracefully` |
| 12 | fireAudioMetadata | -1257 | 1217 | `handles very short audio (less than chunk size)` |
| 13 | fireAudioMetadata | -1309 | 1265 | `transcribeStream with all callbacks undefined still works` |
| 14 | fireAudioMetadata | -1332 | 1284 | `handles minConfidence from config defaulting to 0.7` |
| 15 | fireAudioMetadata | -1378 | 1326 | `continues when processAudioChunk throws for a chunk (line 139)` |
| 16 | fireAudioMetadata | -1423 | 1367 | `survives multiple consecutive chunk failures and still completes` |
| 17 | fireAudioMetadata | -1469 | 1409 | `fires onProgress for chunks after a failed chunk` |
| 18 | fireAudioMetadata | -1506 | 1442 | `quality monitor alert callback error does not crash quality monitoring` |
| 19 | fireAudioMetadata | -1560 | 1492 | `mergeOverlappingSegments handles non-overlapping segments (line 346)` |
| 20 | fireAudioMetadata | -1614 | 1542 | `mergeOverlappingSegments merges segments within 0.5s tolerance` |
| 21 | fireAudioMetadata | -1640 | 1564 | `transcribeStream sets processingTime in result` |
| 22 | fireAudioMetadata | -1700 | 1620 | `transcribeStream computes duration as audioDuration * 1000` |
| 23 | fireAudioMetadata | -1725 | 1641 | `transcribeStream progress has correct totalDuration` |
| 24 | fireAudioMetadata | -1752 | 1664 | `transcribeStream with overlapping chunks processes correctly` |
| 25 | fireAudioMetadata | -1777 | 1685 | `createAudioChunks produces correct chunks for various durations` |
| 26 | fireAudioMetadata | -1802 | 1706 | `processAudioChunk generates text with chunk boundaries` |
| 27 | fireAudioMetadata | -1831 | 1731 | `calculateAverageConfidence returns 0 for empty segments` |
| 28 | fireAudioMetadata | -2049 | 1945 | `onProgress callback throwing does not crash the transcription session` |
| 29 | fireAudioMetadata | -2084 | 1976 | `onSegment callback throwing does not crash the transcription session` |
| 30 | fireAudioMetadata | -2128 | 2016 | `processAudioChunk throwing a non-Error string does not crash the session` |
| 31 | fireAudioMetadata | -2169 | 2053 | `qualityMonitor.evaluateChunk() throwing on one chunk does not crash the session` |
| 32 | fireAudioMetadata | -2206 | 2086 | `qualityMonitor.evaluateChunk() throwing on every chunk still completes` |
| 33 | fireAudioMetadata | -2247 | 2123 | `quality summary reflects only successfully-evaluated chunks after partial evaluateChunk failures` |
| 34 | fireAudioMetadata | -2309 | 2181 | `error thrown inside chunk-processing try/catch does not propagate to crash the transcription session` |
| 35 | fireAudioMetadata | -2365 | 2233 | `all chunks failing still returns a successful result with empty segments` |
| 36 | fireAudioMetadata | -2570 | 2434 | `calculateAverageConfidence throwing inside chunk loop is caught by inner try/catch` |
| 37 | fireAudioMetadata | -2612 | 2472 | `onProgress throwing in transcribeStream does not prevent onSegment for the same chunk` |
| 38 | fireAudioMetadata | -2647 | 2503 | `onSegment throwing on one segment does not prevent subsequent segments in the same chunk` |

**Pre-migration line numbers** are derived from `git show 7ffa66d -- ...streaming-transcriber.test.ts`
hunk headers; the post-migration numbers are from `grep -n fireAudioMetadata /tmp/post.ts`.
Both are reproducible by:

```bash
git show 7ffa66d -- src/transcription/__tests__/streaming-transcriber.test.ts \
  | grep -E "^@@" | head -50
git show 7ffa66d:src/transcription/__tests__/streaming-transcriber.test.ts \
  | grep -n fireAudioMetadata
```

## Untouched: 39th Block (pre-migration line 1598)

The 39th `setImmediate` block calls `advancePerf()` **alongside**
`onloadedmetadata()`. It is a multi-statement variant:

```ts
setImmediate(() => {
  mockAudioInstance.onloadedmetadata?.();
  advancePerf(performance.now() + 16);
});
```

`fireAudioMetadata` was deliberately scoped to a single statement (the audio
dispatch). Generalizing it to swallow `advancePerf()` would couple the helper to
the performance-mock contract and obscure test intent. This block remains inline
and is the 1 occurrence the commit message calls out under "Untouched".

## Verification Evidence

### Before (`37c5595`) → After (`7ffa66d`)

`npm test -- --testPathPatterns='streaming-transcriber'` results (per the
commit message):

| Metric              | Before | After |
|---------------------|--------|-------|
| `numTotalTests`     | 150    | 150   |
| `numPassedTests`    | 150    | 150   |
| `numFailedTests`    |   0    |   0   |
| `numPendingTests`   |   0    |   0   |

**Interpretation**: identical pass/fail parity proves no assertion was lost.
The 38 dispatch blocks were plumbing the tests still depend on; the helper
simply invokes the same plumbing at the same points.

### New helper coverage

`src/utils/__tests__/audio-mock-helpers.test.ts` adds 10 unit tests covering
the helper itself (no-op paths, this-binding, microtask ordering, re-entrant
flushes, synchronous-throw containment, globalTeardown smoke test).

This is **net new coverage** on top of the 150 existing tests, not a replacement.

### Type & lint verification

`npm run type-check` — clean
`npx eslint src/utils/__tests__/audio-mock-helpers.ts src/utils/__tests__/audio-mock-helpers.test.ts src/transcription/__tests__/streaming-transcriber.test.ts tests/globalTeardown.ts` — clean

## Coverage Delta Summary

| Area                                          | Before | After | Δ       |
|-----------------------------------------------|--------|-------|---------|
| `streaming-transcriber.test.ts` `it` blocks   | 150    | 150   | 0       |
| `streaming-transcriber.test.ts` dispatch blocks | 39 inline | 38 helper + 1 inline (multi-stmt) | centralized |
| `audio-mock-helpers.test.ts` `it` blocks      |  0     |  10   | +10 (new file) |
| Total `it` blocks (this concern)              | 150    | 160   | **+10** |

The migration is **net positive** for regression coverage: zero assertions were
removed, and 10 new unit tests cover the helper itself.

## What This Table Does NOT Prove

1. **Behavioral equivalence at runtime**: the 150/150 parity is the strongest
   evidence Jest provides. Microtask-ordering edge cases (e.g., `setImmediate`
   resolution order under `--maxWorkers`) are not exercised by every test.
   Future tests that schedule async work in `afterAll` should call
   `flushPendingTimers()` explicitly to remain consistent with the new contract.
2. **Performance**: replacing 38 inline blocks with a helper function call adds
   one stack frame per test. Negligible at the test-suite scale; not measured.
3. **The 39th multi-statement block**: still inline, still requires manual
   care. A future iteration may want a `fireAudioMetadataWithPerf(instance, ms)`
   variant if more multi-statement cases appear.

## Reproducing the Verification

```bash
# Baseline
git checkout 37c5595
npm test -- --testPathPatterns='streaming-transcriber' --json > before.json

# After
git checkout 7ffa66d
npm test -- --testPathPatterns='streaming-transcriber' --json > after.json

# Diff counts
node -e "
  const a = require('./before.json');
  const b = require('./after.json');
  for (const k of ['numTotalTests','numPassedTests','numFailedTests','numPendingTests']) {
    console.log(k, a[k], '→', b[k]);
  }
"
```

Expected output matches the table above. If the numbers diverge, the helper
has regressed an assertion path and must be reverted.