/**
 * Tests for REQ-102: Code Size Automatic Audit
 *
 * Covers:
 * - evaluateAudit: pure function with boundary conditions
 * - readDependencyCount: package.json parsing
 * - collectMetrics: filesystem walking
 * - runAudit: end-to-end integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  evaluateAudit,
  collectMetrics,
  readDependencyCount,
  runAudit,
  SYSTEM_CONSTITUTION_LIMITS,
  type CodeSizeMetrics,
  type CodeSizeLimits,
} from '@stv/core/config/code-size-audit';

// ---------------------------------------------------------------------------
// evaluateAudit — pure function tests
// ---------------------------------------------------------------------------

describe('evaluateAudit', () => {
  const defaultLimits: CodeSizeLimits = { ...SYSTEM_CONSTITUTION_LIMITS };

  function makeMetrics(overrides: Partial<CodeSizeMetrics> = {}): CodeSizeMetrics {
    return {
      fileCount: 100,
      lineCount: 50_000,
      dependencyCount: 80,
      files: [],
      largestFile: { path: 'src/example.ts', lines: 500 },
      ...overrides,
    };
  }

  it('returns compliant when all metrics are within limits', () => {
    const result = evaluateAudit(makeMetrics(), defaultLimits);
    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports warning when file count exceeds limit', () => {
    const result = evaluateAudit(
      makeMetrics({ fileCount: 400 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('File count 400 exceeds limit of 380')]),
    );
  });

  it('reports warning when total lines exceeds limit', () => {
    const result = evaluateAudit(
      makeMetrics({ lineCount: 120_000 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('exceeds limit of 115,000')]),
    );
  });

  it('reports warning when dependency count exceeds limit', () => {
    const result = evaluateAudit(
      makeMetrics({ dependencyCount: 115 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Dependency count 115 exceeds limit of 110')]),
    );
  });

  it('reports warning when a file exceeds per-file line limit', () => {
    const result = evaluateAudit(
      makeMetrics({ largestFile: { path: 'src/big.ts', lines: 2500 } }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('src/big.ts')]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('2500 lines')]),
    );
  });

  it('reports no warning when file is exactly at the per-file limit', () => {
    const result = evaluateAudit(
      makeMetrics({ largestFile: { path: 'src/exact.ts', lines: 2000 } }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('reports no warning when file count is exactly at limit', () => {
    const result = evaluateAudit(
      makeMetrics({ fileCount: 380 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(true);
  });

  it('reports no warning when line count is exactly at limit', () => {
    const result = evaluateAudit(
      makeMetrics({ lineCount: 115_000 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(true);
  });

  it('reports no warning when dependency count is exactly at limit', () => {
    const result = evaluateAudit(
      makeMetrics({ dependencyCount: 110 }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(true);
  });

  it('collects multiple warnings simultaneously', () => {
    const result = evaluateAudit(
      makeMetrics({
        fileCount: 400,
        lineCount: 150_000,
        dependencyCount: 120,
        largestFile: { path: 'src/big.ts', lines: 3000 },
      }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toHaveLength(4);
  });

  it('skips per-file warning when largestFile is null', () => {
    const result = evaluateAudit(
      makeMetrics({ largestFile: null }),
      defaultLimits,
    );
    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('respects custom limits', () => {
    const customLimits: CodeSizeLimits = {
      maxFiles: 50,
      maxLines: 10_000,
      maxLinesPerFile: 100,
      maxDependencies: 20,
    };
    const result = evaluateAudit(makeMetrics(), customLimits);
    expect(result.isCompliant).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.limits).toEqual(customLimits);
  });

  it('uses default limits when none provided', () => {
    const result = evaluateAudit(makeMetrics());
    expect(result.limits).toEqual(SYSTEM_CONSTITUTION_LIMITS);
  });
});

// ---------------------------------------------------------------------------
// readDependencyCount — package.json parsing
// ---------------------------------------------------------------------------

describe('readDependencyCount', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('counts deps and devDeps together', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({
      dependencies: { a: '1.0.0', b: '2.0.0', c: '3.0.0' },
      devDependencies: { d: '1.0.0', e: '2.0.0' },
    }));
    expect(readDependencyCount(pkgPath)).toBe(5);
  });

  it('returns 0 when both sections are missing', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'test' }));
    expect(readDependencyCount(pkgPath)).toBe(0);
  });

  it('handles only dependencies', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({
      dependencies: { a: '1.0.0' },
    }));
    expect(readDependencyCount(pkgPath)).toBe(1);
  });

  it('handles only devDependencies', () => {
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({
      devDependencies: { a: '1.0.0', b: '2.0.0' },
    }));
    expect(readDependencyCount(pkgPath)).toBe(2);
  });

  it('returns 0 for malformed JSON without crashing', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const pkgPath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(pkgPath, '{ this is not valid JSON !!!');
    expect(readDependencyCount(pkgPath)).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse'),
    );
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// collectMetrics — filesystem walking
// ---------------------------------------------------------------------------

describe('collectMetrics', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));

    // Create a small source tree
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src', 'sub'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'line1\nline2\nline3');
    fs.writeFileSync(path.join(tmpDir, 'src', 'sub', 'b.tsx'), 'line1\nline2');
    fs.writeFileSync(path.join(tmpDir, 'src', 'c.js'), '// js file');

    // node_modules should be skipped
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.ts'), 'x\n');

    // .git should be skipped
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.git', 'data.ts'), 'x\n');

    // Non-source files should be ignored
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Hello\n');
    fs.writeFileSync(path.join(tmpDir, 'style.css'), 'body {}\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('counts only source files (.ts, .tsx, .js, .jsx)', () => {
    const metrics = collectMetrics(tmpDir);
    expect(metrics.fileCount).toBe(3);
  });

  it('sums lines across all source files', () => {
    const metrics = collectMetrics(tmpDir);
    // a.ts=3, b.tsx=2, c.js=1 => 6 total
    expect(metrics.lineCount).toBe(6);
  });

  it('defaults to srcOnly=true — only walks src/ directory', () => {
    // Add a file outside src/ to verify it is NOT counted
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'x.ts'), 'test\nline');
    const metrics = collectMetrics(tmpDir);
    expect(metrics.fileCount).toBe(3); // only src/ files
  });

  it('counts files outside src/ when srcOnly is false', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'x.ts'), 'test\nline');
    const metrics = collectMetrics(tmpDir, { srcOnly: false });
    expect(metrics.fileCount).toBe(4); // src/3 + tests/1
  });

  it('excludes tests/ and scripts/ when srcOnly is true', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'tests', 'spec.ts'), 't\n');
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'build.ts'), 'b\n');
    const metrics = collectMetrics(tmpDir, { srcOnly: true });
    const paths = metrics.files.map(f => f.path);
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('tests')]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('scripts')]),
    );
  });

  it('identifies the largest file', () => {
    const metrics = collectMetrics(tmpDir);
    expect(metrics.largestFile).not.toBeNull();
    expect(metrics.largestFile!.lines).toBe(3);
  });

  it('skips node_modules and .git', () => {
    const metrics = collectMetrics(tmpDir);
    const paths = metrics.files.map(f => f.path);
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('node_modules')]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('.git')]),
    );
  });

  it('ignores non-source extensions', () => {
    const metrics = collectMetrics(tmpDir);
    const paths = metrics.files.map(f => f.path);
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('.md')]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([expect.stringContaining('.css')]),
    );
  });

  it('returns empty metrics for empty directory', () => {
    const emptyDir = path.join(tmpDir, 'empty');
    fs.mkdirSync(emptyDir);
    const metrics = collectMetrics(emptyDir);
    expect(metrics.fileCount).toBe(0);
    expect(metrics.lineCount).toBe(0);
    expect(metrics.largestFile).toBeNull();
  });

  it('sets dependencyCount to 0 (filled by runAudit)', () => {
    const metrics = collectMetrics(tmpDir);
    expect(metrics.dependencyCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// V2.8 contract — implementation-only accounting (teeth: CI-fatal breach)
// ---------------------------------------------------------------------------

describe('V2.8 implementation-only accounting', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-v28-'));
    fs.mkdirSync(path.join(tmpDir, 'src', '__tests__'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'l1\nl2\nl3');
    fs.writeFileSync(path.join(tmpDir, 'src', 'b.test.ts'), 'x\n');
    fs.writeFileSync(path.join(tmpDir, 'src', '__tests__', 'c.ts'), 'x\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('implOnly counts implementation files only (tests cannot eat the budget)', () => {
    const metrics = collectMetrics(tmpDir, { implOnly: true });
    expect(metrics.fileCount).toBe(1);
    expect(metrics.lineCount).toBe(3);
  });

  it('runAudit applies caller-supplied V2.8 limits to impl-only metrics', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({}));
    // Ceiling set BELOW the impl baseline (1 file): must be non-compliant —
    // this is the mechanism that makes the V2.8 audit CI-fatal.
    const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'), { maxFiles: 0 }, { implOnly: true });
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('File count 1 exceeds limit of 0')]),
    );
  });

  it('a test-only addition never flips compliance under implOnly accounting', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(tmpDir, 'src', 'more.test.ts'), 'x\n'.repeat(10_000));
    const result = runAudit(
      tmpDir,
      path.join(tmpDir, 'package.json'),
      { maxFiles: 2, maxLines: 10 },
      { implOnly: true },
    );
    expect(result.isCompliant).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runAudit — end-to-end integration
// ---------------------------------------------------------------------------

describe('runAudit', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'a.ts'), 'line1');

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { a: '1' },
      devDependencies: { b: '1' },
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a complete audit result', () => {
    const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'));
    expect(result.metrics.fileCount).toBe(1);
    expect(result.metrics.dependencyCount).toBe(2);
    expect(result.metrics.lineCount).toBe(1);
    expect(result.limits).toEqual(SYSTEM_CONSTITUTION_LIMITS);
  });

  it('accepts custom limits', () => {
    const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'), {
      maxFiles: 0,
    });
    expect(result.isCompliant).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('File count')]),
    );
  });

  it('is compliant for small projects under limits', () => {
    const result = runAudit(tmpDir, path.join(tmpDir, 'package.json'));
    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes srcOnly option through to collectMetrics', () => {
    // Add file outside src/
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts', 'build.ts'), 'b1\nb2\n');

    // srcOnly default (true): only src/a.ts
    const srcOnly = runAudit(tmpDir, path.join(tmpDir, 'package.json'));
    expect(srcOnly.metrics.fileCount).toBe(1);

    // srcOnly false: src/a.ts + scripts/build.ts
    const all = runAudit(
      tmpDir,
      path.join(tmpDir, 'package.json'),
      undefined,
      { srcOnly: false },
    );
    expect(all.metrics.fileCount).toBe(2);
  });
});
