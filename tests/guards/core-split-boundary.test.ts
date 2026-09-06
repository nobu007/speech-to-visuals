import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Structural boundary guard for the stv-core split (PR #7, REQ-310/311/312).
 *
 * The shared types/utils/config/lib modules moved to the external package
 * `@stv/core` (github:nobu007/stv-core#v1.0.7). REQ-312 requires the split
 * boundary to be regression-detected by guards in tests/guards. Before this
 * file, the pins were per-concept single-source tests only (~10 of the 26
 * canonical import paths had any structural pin; `@stv/core/config/limits`
 * with 24 importers and `@stv/core/lib/safe-array` with 13 had none) and no
 * guard forbade the migrated directories from reappearing under src/, nor
 * pinned the REQ-311 tag-pin shape in package.json.
 *
 * Layers:
 *   1. REQ-310 — the migrated directories must not be recreated under src/.
 *   2. REQ-310/312 — the set of @stv/core specifiers imported by src/ must
 *      equal the canonical inventory below (a new subpath adoption, a path
 *      rename in @stv/core, or a typo all turn RED until the pin is updated).
 *   3. REQ-312 — every canonical specifier keeps at least one src/ importer:
 *      fully forking a canonical module back into the product repo (rewriting
 *      all its imports to a local path) turns RED.
 *   4. REQ-311 — package.json must depend on the exact GitHub tag pin, never
 *      a floating branch ref or semver range.
 *
 * All checks are source-text based: this guard must run without @stv/core
 * being installed (the product repo's node_modules resolves it only in CI).
 */

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

// REQ-310: these src/ subtrees were migrated into @stv/core and must not be
// re-implemented in the product repository.
const MIGRATED_DIRS = ['src/types', 'src/config', 'src/lib', 'src/utils'];

// REQ-310/312 canonical inventory: every @stv/core specifier that src/ may
// import (measured 2026-08-19: 26 distinct specifiers across 317 files).
// Static literal on purpose — the fingerprint-pin convention forbids
// interpolating a computed count (a shrinking corpus must fail, not pass).
const CANONICAL_STV_CORE_SPECIFIERS: readonly string[] = [
  '@stv/core/config/code-size-audit',
  '@stv/core/config/limits',
  '@stv/core/config/production-config',
  '@stv/core/config/schema',
  '@stv/core/config/validate',
  '@stv/core/lib/capped-array',
  '@stv/core/lib/capped-map',
  '@stv/core/lib/metrics-utils',
  '@stv/core/lib/quality-display-tiers',
  '@stv/core/lib/safe-array',
  '@stv/core/lib/unicode-script-ranges',
  '@stv/core/lib/utils',
  '@stv/core/types',
  '@stv/core/types/diagram',
  '@stv/core/types/pipeline',
  '@stv/core/utils/audio-duration',
  '@stv/core/utils/audio-validation',
  '@stv/core/utils/guards',
  '@stv/core/utils/logger',
  '@stv/core/utils/memory-usage',
  '@stv/core/utils/playback-time',
  '@stv/core/utils/prometheus-label-escape',
  '@stv/core/utils/regex-escape',
  '@stv/core/utils/report-corruption',
  '@stv/core/utils/safe-storage',
  '@stv/core/utils/sanitize',
];

// REQ-311: dependency must stay pinned to an immutable GitHub version tag.
// A version bump is a conscious pin edit here (REQ-311 flow: tag in stv-core
// repo first, then update this pin).
const STV_CORE_TAG_PIN = 'github:nobu007/stv-core#v1.0.7';

/** Matches `from '@stv/core…'`, `from "@stv/core…"`, and dynamic `import('@stv/core…')`. */
const STV_CORE_SPECIFIER_RE = /(?:from\s+|import\s*\()\s*['"](@stv\/core[a-zA-Z0-9/_.-]*)['"]/g;

function listSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectImporters(): Map<string, string[]> {
  const importers = new Map<string, string[]>();
  const srcRoot = path.join(REPO_ROOT, 'src');
  for (const file of listSourceFiles(srcRoot)) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const match of text.matchAll(STV_CORE_SPECIFIER_RE)) {
      const specifier = match[1];
      const rel = path.relative(REPO_ROOT, file);
      const files = importers.get(specifier);
      if (files) {
        if (!files.includes(rel)) files.push(rel);
      } else {
        importers.set(specifier, [rel]);
      }
    }
  }
  return importers;
}

describe('core-split boundary — REQ-310: migrated directories stay gone', () => {
  for (const dir of MIGRATED_DIRS) {
    it(`${dir} must not be recreated under src/ (re-implementation regression)`, () => {
      expect(fs.existsSync(path.join(REPO_ROOT, dir))).toBe(false);
    });
  }
});

describe('core-split boundary — REQ-310/312: canonical @stv/core import inventory', () => {
  it('src/ imports exactly the canonical specifier set (no unknown path, no silent drop)', () => {
    const importers = collectImporters();
    const actual = [...importers.keys()].sort();
    expect(actual).toEqual([...CANONICAL_STV_CORE_SPECIFIERS]);
  });
});

describe('core-split boundary — REQ-312: every canonical module keeps an @stv/core importer', () => {
  const importers = collectImporters();
  for (const specifier of CANONICAL_STV_CORE_SPECIFIERS) {
    it(`${specifier} is still consumed from @stv/core (not fully forked into src/)`, () => {
      expect((importers.get(specifier) ?? []).length).toBeGreaterThan(0);
    });
  }
});

describe('core-split boundary — REQ-311: package.json pins the @stv/core version tag', () => {
  it('dependency is the exact GitHub tag pin (no floating branch ref / semver range)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = pkg.dependencies?.['@stv/core'] ?? pkg.devDependencies?.['@stv/core'];
    expect(declared).toBe(STV_CORE_TAG_PIN);
    expect(declared ?? '').toMatch(/^github:nobu007\/stv-core#v\d+\.\d+\.\d+$/);
  });
});
