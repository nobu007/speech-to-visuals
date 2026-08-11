/**
 * @jest-environment node
 */
/**
 * edge-untrusted-json-sync.test.ts — TC-313
 *
 * Structural guard: the committed Supabase Edge sanitizer copy
 * (supabase/functions/_shared/untrusted-json.ts) must be byte-identical to the
 * output of scripts/generate-edge-untrusted-json.ts, which generates it from
 * the single source of truth src/analysis/untrusted-json-core.ts.
 *
 * This ELIMINATES the old hazard — two hand-maintained copies kept in lockstep
 * by behavioral parity alone (TC-312). With generation, the Edge file is a
 * build artifact: drift between the client and Edge sanitizers is now
 * structurally impossible, because both derive from the one core module.
 *
 * This test fails if someone edits the core module without re-running
 * `npm run sync:edge`, OR hand-edits the generated Edge copy. TC-312 stays as
 * the behavioral witness that the generation did not change behavior.
 *
 * WHY THIS IS NON-VACUOUS (liveness / bite). The primary assertion is an exact
 * string equality between the on-disk file and the live generator output —
 * there is no regex that could match vacuously; the two are either identical or
 * not. The second assertion independently re-reads the core source and proves
 * the generator's output is literally `banner + verbatim core source`, so a
 * generator that stopped reading the core (or returned a constant) would fail
 * it. Together they guarantee: any real edit to the core surfaces here, and the
 * committed Edge file is always a faithful regeneration.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateEdgeUntrustedJson } from '../../scripts/generate-edge-untrusted-json';

// Resolve from this test file's own location, not process.cwd(): jest ESM
// workers can run with a cwd that is not the repo root, which flaked the bare
// relative / process.cwd() form under --maxWorkers>1.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const EDGE_REL = 'supabase/functions/_shared/untrusted-json.ts';
const CORE_REL = 'src/analysis/untrusted-json-core.ts';

describe('TC-313 — Edge untrusted-json is generated from the single source', () => {
  it('committed Edge copy equals the generator output (run `npm run sync:edge` on core edits)', () => {
    const committed = readFileSync(path.join(REPO_ROOT, EDGE_REL), 'utf8');
    const generated = generateEdgeUntrustedJson(REPO_ROOT);
    expect(committed).toBe(generated);
  });

  it('generator output = GENERATED banner + verbatim core source (transform is a pure read+prepend)', () => {
    // Liveness anchor: re-read the core independently and prove the generator's
    // output is exactly its banner followed by the raw core text. A generator
    // that stopped reading the core, mangled it, or returned a constant would
    // break this equality.
    const coreSource = readFileSync(path.join(REPO_ROOT, CORE_REL), 'utf8');
    const generated = generateEdgeUntrustedJson(REPO_ROOT);
    expect(generated.startsWith('/**\n * ⚠️  GENERATED FILE')).toBe(true);
    expect(generated).toContain(coreSource.trimEnd());
    // The generated artifact must still export the public surface the three
    // Edge functions import (`sanitizeUntrustedJsonValue`).
    expect(generated).toContain('export function sanitizeUntrustedJsonValue');
    expect(generated).toContain('export function parseUntrustedJson');
  });
});
