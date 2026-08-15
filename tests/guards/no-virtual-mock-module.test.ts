/**
 * @jest-environment node
 */
/**
 * `{ virtual: true }` mock-option ban — structural guard against the
 * jest-worker HANG class.
 *
 * RULE: no test file may pass a third `{ virtual: true }` options argument
 * to `jest.unstable_mockModule()` (or `jest.mock()`). This repo is ESM
 * (`--experimental-vm-modules`); `unstable_mockModule` only accepts
 * `(moduleName, factory)`, and the extra options argument is not validated
 * away — it wedges the ESM module registry at mock-evaluation time. The
 * suite then produces NO output at all: no test starts, no failure is
 * reported, jest hangs until the runner is killed. Both video-generator
 * suites hung this way for 15+ sessions and were hidden behind
 * `--testPathIgnorePatterns="video-generator"`, silently excluding 63 tests
 * from every full-suite run.
 *
 * `virtual: true` was also pointless at every historical site: it exists to
 * mock modules that CANNOT be resolved, and `@/lib/actualVideoRenderer`
 * exists on disk. The correct spelling is the plain two-argument call.
 *
 * The ban covers the option spelling `virtual: true` anywhere in a test
 * file — any argument position, any call shape — because there is no
 * legitimate ESM use for it in this repo.
 *
 * Escape hatch: append `// virtual-mock-exempt:` (with a reason) to the
 * line if a genuine virtual module mock ever becomes necessary.
 *
 * RED-verified: re-adding `}, { virtual: true });` to any
 * `unstable_mockModule` call in a swept file fails this suite.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, globSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd() — cwd-relative reads flake
// under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function listTestFiles(root: string): string[] {
  return globSync(join(REPO_ROOT, root, '**', '*.test.{ts,tsx}')).map((p) =>
    p.slice(REPO_ROOT.length + 1)
  );
}

const roots = ['src', 'tests'];

describe('no virtual-mock options in ESM tests', () => {
  it('every swept test file is free of the option', () => {
    const files = roots.flatMap(listTestFiles);
    expect(files.length).toBeGreaterThan(50); // sweep must actually find files

    const offenders: string[] = [];
    for (const rel of files) {
      const lines = readFileSync(join(REPO_ROOT, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // Comment-only lines are never offenders (freeze-guard convention:
        // comments quote the banned spelling; they cannot execute it).
        const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
        if (!isComment && line.includes('virtual: true') && !line.includes('// virtual-mock-exempt:')) {
          offenders.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
