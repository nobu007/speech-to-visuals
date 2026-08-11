/**
 * Codegen: emit the Supabase Edge sanitizer copy from the single source of
 * truth `src/analysis/untrusted-json-core.ts`.
 *
 *   Usage:  npm run sync:edge        (or: tsx scripts/generate-edge-untrusted-json.ts)
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

function main(): void {
  const outPath = writeEdgeUntrustedJson();
  // eslint-disable-next-line no-console
  console.log(`Generated ${path.relative(process.cwd(), outPath)} from ${REL_CORE}`);
}

// Run only when invoked directly (tsx/`node`), not when imported by the test.
const invokedAs = process.argv[1];
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  main();
}
