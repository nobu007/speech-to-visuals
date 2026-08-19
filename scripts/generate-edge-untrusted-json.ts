/**
 * Codegen: emit the Supabase Edge sanitizer copy from the single source of
 * truth `src/analysis/untrusted-json-core.ts`.
 *
 *   Usage:  npm run sync:edge        (or: tsx scripts/generate-edge-untrusted-json.ts)
 *           npm run verify:edge      (or: tsx scripts/generate-edge-untrusted-json.ts --check)
 *
 * `--check` is the pure drift detector the git hooks call: it compares the
 * on-disk Edge copy against the freshly-generated output, writes nothing,
 * and exits non-zero on drift. The hook therefore fires ONLY on real drift,
 * with no dependency on the jest/ts-jest runtime.
 *
 * WHY
 * ----
 * The Deno runtime that hosts Supabase Edge Functions cannot import the client
 * `src/` tree, so the Edge function needs a physical copy of the untrusted-JSON
 * sanitizer. We used to hand-maintain two copies and police their lockstep with
 * tests/guards/untrusted-json-deno-parity.test.ts (TC-312). This script removes
 * the human from that loop: the Edge copy is now GENERATED from the one source
 * module, so the two cannot drift.
 *
 * The companion guard tests/guards/edge-untrusted-json-sync.test.ts (TC-313)
 * fails if the committed Edge file ever differs from this script's output — so
 * editing the core without re-running this script, or hand-editing the Edge
 * copy, breaks CI. The behavioral parity test (TC-312) stays in place as the
 * witness that the generation did not silently change behavior.
 *
 * FURTHER COLLAPSE — when CI can resolve network imports, publish the core
 * module to a version-pinned Deno URL (jsr.io / deno.land/x) and import it via
 * `https://` from the Edge function; this generated copy can then be deleted.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REL_CORE = 'src/analysis/untrusted-json-core.ts';
const REL_EDGE = 'supabase/functions/_shared/untrusted-json.ts';

/**
 * Build the exact contents of `supabase/functions/_shared/untrusted-json.ts`
 * from the committed core module. Pure (no writes) so the sync guard can call
 * it and compare against the on-disk file.
 *
 * @param repoRoot Absolute path to the repository root (defaults to cwd).
 */
export function generateEdgeUntrustedJson(repoRoot: string = process.cwd()): string {
  const coreSource = readFileSync(path.join(repoRoot, REL_CORE), 'utf8');
  return `${GENERATED_BANNER}\n${coreSource.trimEnd()}\n`;
}

/**
 * Write the generated Edge copy to its canonical path.
 *
 * @returns the absolute path written.
 */
export function writeEdgeUntrustedJson(repoRoot: string = process.cwd()): string {
  const outPath = path.join(repoRoot, REL_EDGE);
  writeFileSync(outPath, generateEdgeUntrustedJson(repoRoot));
  return outPath;
}

/**
 * Verify the on-disk Edge copy matches the freshly-generated output WITHOUT
 * writing anything. Pure drift detector: returns `{ ok: true }` when the
 * committed copy is a faithful regeneration of the core source, `{ ok: false }`
 * (with the expected/actual strings) when it has drifted, and `{ ok: false,
 * missing: true }` when the Edge copy does not exist yet.
 *
 * Why this exists separately from `writeEdgeUntrustedJson`. The pre-commit /
 * pre-push hooks need a drift check that (a) fires ONLY on real drift and
 * (b) never mutates the working tree or depends on the jest/ts-jest runtime.
 * Comparing the pure generator output against the on-disk file satisfies both:
 * no subprocess, no test harness, no working-tree side effects — exactly the
 * "true drift safety-net" the steering feedback asked the hooks to become.
 *
 * @param repoRoot Absolute path to the repository root (defaults to cwd).
 */
export function verifyEdgeUntrustedJson(
  repoRoot: string = process.cwd(),
): { ok: boolean; missing: boolean; expected: string; actual: string } {
  const expected = generateEdgeUntrustedJson(repoRoot);
  let actual = '';
  let missing = false;
  try {
    actual = readFileSync(path.join(repoRoot, REL_EDGE), 'utf8');
  } catch {
    missing = true;
  }
  return { ok: !missing && actual === expected, missing, expected, actual };
}

const GENERATED_BANNER = `/**
 * ⚠️  GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * This Deno module is generated from the single source of truth
 * \`src/analysis/untrusted-json-core.ts\` by
 * \`scripts/generate-edge-untrusted-json.ts\`. To change it, edit the core
 * module and re-run \`npm run sync:edge\`.
 *
 * Why a physical copy exists: Supabase Edge Functions run under Deno and cannot
 * import the client \`src/\` tree (no shared bundler, \`https://\` module
 * resolution), so the sanitizer must be present as a real file here. Generating
 * it from the one source removes the two-hand-maintained-copies hazard that
 * previously required a lockstep guard.
 *
 * Guarantees:
 *   - tests/guards/edge-untrusted-json-sync.test.ts (TC-313) fails if this file
 *     ever drifts from the generator output.
 *   - tests/guards/untrusted-json-deno-parity.test.ts (TC-312) still compares
 *     the client sanitizer against this copy behaviorally — the witness that
 *     generation did not change behavior.
 *
 * Further collapse: once CI can resolve network imports, publish the core
 * module to a version-pinned Deno URL (jsr.io / deno.land/x), import it here via
 * \`https://\`, and delete this generated file.
 */
`;

/**
 * CLI entry point.
 *
 *   tsx scripts/generate-edge-untrusted-json.ts           → write (sync:edge)
 *   tsx scripts/generate-edge-untrusted-json.ts --check   → verify, no write (verify:edge)
 *
 * `--check` is the drift detector the git hooks call: exit 0 when the on-disk
 * Edge copy matches the generated output, exit 1 when it has drifted (with a
 * pointer to `npm run sync:edge`). It performs NO writes, so the hook never
 * mutates the working tree.
 */
function main(): void {
  const args = process.argv.slice(2);
  const checkMode = args.includes('--check') || args.includes('check') || args.includes('--verify');

  if (checkMode) {
    const { ok, missing } = verifyEdgeUntrustedJson();
    if (ok) {
      console.log(`✓ Edge sanitizer in sync with ${REL_CORE}.`);
      return;
    }
    console.error(
      missing
        ? `✗ Edge sanitizer missing — run \`npm run sync:edge\` to generate it.`
        : `✗ Edge sanitizer drifted from ${REL_CORE} — run \`npm run sync:edge\` then re-stage the file.`,
    );
    process.exitCode = 1;
    return;
  }

  const outPath = writeEdgeUntrustedJson();
}

// Run only when invoked directly (tsx/`node`), not when imported by the test.
const invokedAs = process.argv[1];
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  main();
}
