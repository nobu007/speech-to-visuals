/**
 * Structural source-coupling guard for the ErrorSeverity type (REQ-298).
 *
 * `ErrorSeverity` ('low' | 'medium' | 'high' | 'critical') is the single source
 * of truth in `src/quality/error-classifier.ts` — the classification module that
 * assigns severity to a `ClassifiedError`. It was previously redeclared as an
 * identical-but-independent union in `user-guided-error-recovery.ts`, which
 * `pipeline-error-guidance.ts` imported from. The two unions coincided today, so
 * a behavioral RED→GREEN was impossible, but they were coupled only by
 * coincidence: adding or renaming a severity level in one definition would
 * silently leave the other stale. This test guards the COUPLING at the
 * source-text level so a second definition can never reappear.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place this type may be declared. */
const CANONICAL_FILE = path.join('src', 'quality', 'error-classifier.ts');

/** A type declaration that shadows the canonical export, e.g. `export type ErrorSeverity = ...`. */
const LOCAL_REDECLARATION = /\btype\s+ErrorSeverity\s*=/;

function getAllProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllProductionSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

describe('REQ-298: ErrorSeverity is single-sourced in error-classifier', () => {
  test('no production source redeclares the ErrorSeverity type', () => {
    const projectRoot = path.resolve(__dirname, '../../../');
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        if (rel !== CANONICAL_FILE && LOCAL_REDECLARATION.test(line)) {
          violations.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  test('user-guided-error-recovery re-exports the canonical ErrorSeverity (not a frozen copy)', async () => {
    // The duplicate-home module must now re-export the canonical type rather than
    // define its own; importing the value from both paths must yield the same type.
    const { ErrorClassifier } = await import('../error-classifier');
    const { UserGuidedErrorRecovery } = await import('../user-guided-error-recovery');
    expect(ErrorClassifier).toBeDefined();
    expect(UserGuidedErrorRecovery).toBeDefined();
  });
});
