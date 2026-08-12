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
import { describe, it, expect, afterEach } from '@jest/globals';
import { readFileSync, mkdtempSync, writeFileSync, copyFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  generateEdgeUntrustedJson,
  verifyEdgeUntrustedJson,
  writeEdgeUntrustedJson,
} from '../../scripts/generate-edge-untrusted-json';

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

// --- verifyEdgeUntrustedJson drift detector (the hook's --check path) ------
//
// The pre-commit/pre-push hooks call `npm run verify:edge`, which runs the
// codegen in --check mode — `verifyEdgeUntrustedJson()`: regenerate the Edge
// copy IN MEMORY from the core and compare against the on-disk file, writing
// nothing. This block grounds that drift detector with a real RED→GREEN pair
// (steering feedback: introduce a violation → guard RED → fix → GREEN) over a
// throwaway repo-root so the witness cannot touch the working tree.
//
//   RED  : a drifted Edge copy  → verifyEdgeUntrustedJson().ok === false
//   GREEN: writeEdgeUntrustedJson() (regenerate) → .ok === true
//
// plus the missing-file case (Edge copy absent) and a no-write guarantee
// (the verify path must NOT create the file).

describe('TC-313 — verifyEdgeUntrustedJson drift detector (hook --check path)', () => {
  const CORE_REL = 'src/analysis/untrusted-json-core.ts';
  const EDGE_REL = 'supabase/functions/_shared/untrusted-json.ts';
  const realCorePath = path.join(REPO_ROOT, CORE_REL);

  let sandbox: string;
  // Build a throwaway repo-root that contains ONLY the core source (so the
  // generator can read it) and whatever Edge copy the test stages.
  function makeSandbox(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'edge-verify-'));
    mkdirSync(path.join(root, 'src', 'analysis'), { recursive: true });
    mkdirSync(path.join(root, 'supabase', 'functions', '_shared'), { recursive: true });
    copyFileSync(realCorePath, path.join(root, CORE_REL));
    return root;
  }

  afterEach(() => {
    if (sandbox && existsSync(sandbox)) {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('GREEN baseline: a freshly-generated Edge copy verifies as in-sync', () => {
    sandbox = makeSandbox();
    writeEdgeUntrustedJson(sandbox); // regenerate the canonical copy
    const result = verifyEdgeUntrustedJson(sandbox);
    expect(result.ok).toBe(true);
    expect(result.missing).toBe(false);
  });

  it('RED→GREEN drift pair: a drifted Edge copy fails, regenerate makes it pass', () => {
    sandbox = makeSandbox();
    // Start from the canonical copy, then introduce drift the way a careless
    // hand-edit or a stale regeneration would: append a stray line.
    writeEdgeUntrustedJson(sandbox);
    const edgePath = path.join(sandbox, EDGE_REL);
    writeFileSync(edgePath, readFileSync(edgePath, 'utf8') + '\n// accidental drift\n');

    // RED: the on-disk file no longer matches the freshly-generated output.
    const drifted = verifyEdgeUntrustedJson(sandbox);
    expect(drifted.ok).toBe(false);
    expect(drifted.missing).toBe(false);
    expect(drifted.actual).not.toBe(drifted.expected);

    // GREEN: regenerating the Edge copy restores byte-identity with the core.
    writeEdgeUntrustedJson(sandbox);
    const restored = verifyEdgeUntrustedJson(sandbox);
    expect(restored.ok).toBe(true);
    expect(restored.actual).toBe(restored.expected);
  });

  it('missing Edge copy is reported as drift (ok=false, missing=true)', () => {
    sandbox = makeSandbox();
    // No Edge copy staged at all — e.g. a fresh checkout that never ran sync:edge.
    const result = verifyEdgeUntrustedJson(sandbox);
    expect(result.ok).toBe(false);
    expect(result.missing).toBe(true);
  });

  it('verify is a pure read: it never writes the Edge copy to the sandbox', () => {
    sandbox = makeSandbox();
    const edgePath = path.join(sandbox, EDGE_REL);
    expect(existsSync(edgePath)).toBe(false);

    verifyEdgeUntrustedJson(sandbox);

    // The hook relies on --check NEVER mutating the working tree; if it did,
    // a clean-but-missing checkout would get a surprise file written by the
    // commit boundary. Assert the file is still absent after verify.
    expect(existsSync(edgePath)).toBe(false);
  });
});

// --- prebuild regeneration wiring (REQ-2148 / TC-2147-01 "CI regenerates") --
//
// REQ-2148 asked for the Edge copy to be a build-time artifact that CI
// *regenerates and verifies*, not merely a committed file policed by a drift
// check. The `edge-sanitizer-sync` CI job + the hooks above are the "verifies"
// half (the --check drift detector). The "regenerates" half is a `prebuild` npm
// lifecycle hook that re-runs the generator before every `npm run build`, so the
// CI `build` job (and any local build) emits a fresh copy from the core rather
// than shipping whatever was last hand-committed. This is the unblocked path to
// "CI regenerates and verifies" — the truly ideal collapse (publish the core to
// a version-pinned Deno URL and `https://`-import it, deleting the copy) stays
// blocked on CI network-import stabilization.
//
// This anchor fails if that hook is removed or pointed at the verify (--check)
// form instead of the regenerate (write) form — closing the "behavioral tests
// prove WORKS not REMAINS" gap (TC-302 / 10e) a runtime-only check would leave.

describe('TC-313 — build path regenerates the Edge copy (prebuild wiring, REQ-2148)', () => {
  function readScripts(): Record<string, string> {
    const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts ?? {};
  }

  it('npm run build wires a prebuild hook that regenerates the Edge copy from core', () => {
    const { prebuild } = readScripts();
    // A prebuild lifecycle hook must exist so the CI build job regenerates the
    // copy before vite builds — the "CI regenerates" half of REQ-2148.
    expect(typeof prebuild).toBe('string');
    // It must invoke the regenerator target (sync:edge), as a real command token.
    expect(prebuild).toMatch(/(^|\s)sync:edge\b/);
    // And it must NOT be the verify (--check) form — prebuild must WRITE the
    // artifact, otherwise the build ships a stale copy.
    expect(prebuild).not.toMatch(/--check/);
  });

  it('prebuild target (sync:edge) is the codegen generator in WRITE form, closing the loop', () => {
    const scripts = readScripts();
    // sync:edge must run the generator script this guard already proves correct
    // above — so the chain prebuild → sync:edge → generateEdgeUntrustedJson is
    // one unbroken regeneration path, not a stub.
    expect(scripts['sync:edge']).toMatch(/generate-edge-untrusted-json\.ts/);
    expect(scripts['sync:edge']).not.toMatch(/--check|--verify|\bcheck\b/);
  });
});
