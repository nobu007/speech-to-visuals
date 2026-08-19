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
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const require = createRequire(import.meta.url);
// `typescript` ships CJS; createRequire keeps the import ESM-safe under
// jest --experimental-vm-modules.
const ts = require('typescript') as typeof import('typescript');

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
 */
const PINNED = {
  'src/visualization (production)': 0,
  'src/pipeline (production)': 0,
  'src/transcription (production)': 0,
  'src/export (production)': 0,
  'src/monitoring (production)': 0,
  'src/analysis (production)': 0,
  'src (production, excl. __tests__/__mocks__)': 0,
  'tests (excl. __mocks__)': 1096,
} as const;

/**
 * Per-top-level-directory ratchets for the tests tree (Phase 147 / REQ-337).
 * `(root)` = test files sitting directly in tests/. A directory that is not
 * pinned here fails the guard — extending the test tree means extending the
 * ratchet consciously, never silently.
 */
const TESTS_DIR_PINS: Record<string, number> = {
  unit: 471,
  integration: 245,
  visualization: 184,
  guards: 72,
  pipeline: 45,
  analysis: 44,
  quality: 17,
  transcription: 8,
  api: 2,
  lib: 2,
  remotion: 2,
  '(root)': 2,
  acceptance: 1,
  config: 1,
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
 * definite-assignment `!:` on a property / variable / parameter declaration.
 * Comments, string content and JSX text are invisible to the parser, so the
 * historical regex false positives are gone by construction.
 */
function countAssertions(rootRel: string): { count: number; hits: string[] } {
  const files = walk(join(REPO_ROOT, rootRel));
  const hits: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf-8');
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, /*setParentNodes*/ false, scriptKind);
    const record = (node: ts.Node, kind: string): void => {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const textOfLine = text.split('\n')[line]?.trim() ?? '';
      hits.push(`${file.replace(REPO_ROOT, '')}:${line + 1} [${kind}]: ${textOfLine.slice(0, 80)}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isNonNullExpression(node)) {
        record(node, 'x!');
      } else if (
        (ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        node.exclamationToken !== undefined
      ) {
        record(node, 'x!:');
      }
      node.forEachChild(visit);
    };
    visit(sourceFile);
  }
  return { count: hits.length, hits };
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

  it('no pinned tests directory silently disappears (each pin must still correspond to a real directory)', () => {
    for (const dir of Object.keys(TESTS_DIR_PINS)) {
      expect(testsByDir.has(dir)).toBe(true);
    }
  });

  it('census is not vacuous: the tests remainder is real (src moved to exact-0 in Phase 147)', () => {
    // 170 (pre-Phase-141 src total) − 67 − 29 − 17 − 10 − 7 − 6 (Phases
    // 141–146) − 22 (Phase 147, incl. the AST-only export node) = 0; the
    // liveness check below only guards against a scanner regression that
    // would silently count nothing. The tests tree is still real: 1096
    // node hits over 14 pinned directories.
    expect(testsTotal.count).toBeGreaterThan(0);
  });
});
