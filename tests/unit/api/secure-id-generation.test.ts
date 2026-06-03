/**
 * ISS-031: Verify ID generation uses crypto.randomUUID() instead of Math.random()
 * ISS-032: Verify deprecated substr() is eliminated from source files
 *
 * Source-level static analysis tests that verify secure coding patterns.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Resolve the project src/ directory.
 * Walk up from process.cwd() to find a directory containing src/api/batch-processing-api.ts.
 */
function findSrcRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const candidate = resolve(dir, 'src', 'api', 'batch-processing-api.ts');
    if (existsSync(candidate)) {
      return resolve(dir, 'src');
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  throw new Error(`Cannot find src/api/batch-processing-api.ts from cwd=${process.cwd()}`);
}

const root = findSrcRoot();

function src(relPath: string): string {
  return readFileSync(resolve(root, relPath), 'utf-8');
}

// ===========================================================================
// ISS-031: Secure ID generation
// ===========================================================================

describe('ISS-031: Secure ID generation', () => {
  const files = [
    ['batch-processing-api.ts', 'api/batch-processing-api.ts'],
    ['main-pipeline.ts', 'pipeline/main-pipeline.ts'],
    ['continuous-learner.ts', 'framework/continuous-learner.ts'],
    ['production-exporter.ts', 'export/production-exporter.ts'],
    ['production-error-handler.ts', 'monitoring/production-error-handler.ts'],
    ['performance-dashboard.ts', 'monitoring/performance-dashboard.ts'],
  ] as const;

  it.each(files)('should import randomUUID from crypto in %s', (_name, relPath) => {
    const content = src(relPath);
    expect(content).toContain("import { randomUUID } from 'crypto'");
  });

  it.each(files)('should NOT use Math.random().toString(36).substr in %s', (_name, relPath) => {
    const content = src(relPath);
    expect(content).not.toContain('Math.random().toString(36).substr');
  });
});

// ===========================================================================
// ISS-032: No deprecated substr()
// ===========================================================================

describe('ISS-032: No deprecated substr() in source files', () => {
  const files = [
    'api/batch-processing-api.ts',
    'pipeline/main-pipeline.ts',
    'framework/continuous-learner.ts',
    'export/production-exporter.ts',
    'monitoring/production-error-handler.ts',
    'monitoring/performance-dashboard.ts',
  ];

  it.each(files)('should have zero .substr() calls in %s', (relPath) => {
    const content = src(relPath);
    expect(content).not.toContain('.substr(');
  });
});
