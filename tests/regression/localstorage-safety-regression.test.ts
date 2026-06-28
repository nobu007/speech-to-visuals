/**
 * Regression guard: No raw JSON.parse(localStorage.getItem(...)) in production source.
 *
 * Ensures all localStorage read operations go through safeLoadFromStorage(),
 * which provides corruption detection, type validation, and self-healing.
 *
 * Allowed exceptions:
 *   - src/utils/safe-storage.ts (the implementation itself)
 *   - Non-JSON string reads (e.g. 'first-visit' flag)
 *   - Test files (__tests__/, *.test.*, *.spec.*)
 */

import * as fs from 'fs';
import * as path from 'path';

/** Files exempt from the JSON.parse(localStorage) ban. */
const ALLOWED_FILES = new Set([
  'src/utils/safe-storage.ts',
]);

/** Inline pattern: JSON.parse(localStorage.getItem(...)) */
const INLINE_PATTERN = /JSON\.parse\s*\(\s*localStorage\.getItem\s*\(/;

/**
 * Two-line pattern: const x = localStorage.getItem(...); ... JSON.parse(x)
 * Detects the intermediate-variable variant.
 */
const INTERMEDIATE_GETITEM = /(?:const|let|var)\s+\w+\s*=\s*localStorage\.getItem\s*\(/;

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }

  return results;
}

describe('Regression: localStorage safety — all reads must use safeLoadFromStorage', () => {
  test('no inline JSON.parse(localStorage.getItem(...)) in production source', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const srcDir = path.join(projectRoot, 'src');

    expect(fs.existsSync(srcDir)).toBe(true);

    const sourceFiles = getAllSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(50);

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of sourceFiles) {
      const relativePath = path.relative(projectRoot, file);
      if (ALLOWED_FILES.has(relativePath)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (INLINE_PATTERN.test(lines[i])) {
          violations.push({
            file: relativePath,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const formatted = violations
        .map(v => `  ${v.file}:${v.line} → ${v.content}`)
        .join('\n');
      console.error(
        `Found ${violations.length} unsafe localStorage reads (JSON.parse(localStorage.getItem(...))) in production code.\n` +
        `Use safeLoadFromStorage() from '@/utils/safe-storage' instead.\n${formatted}`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  test('no intermediate-variable localStorage.getItem → JSON.parse in production source', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const srcDir = path.join(projectRoot, 'src');

    const sourceFiles = getAllSourceFiles(srcDir);
    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of sourceFiles) {
      const relativePath = path.relative(projectRoot, file);
      if (ALLOWED_FILES.has(relativePath)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        // Detect: const/let/var x = localStorage.getItem(...)
        // This is allowed for non-JSON string reads (like 'first-visit'),
        // but flag it so reviewers can verify it's not JSON-parsed later.
        if (INTERMEDIATE_GETITEM.test(lines[i])) {
          // Check if this file also contains JSON.parse anywhere
          const hasJsonParse = lines.some(l => l.includes('JSON.parse'));
          if (hasJsonParse) {
            violations.push({
              file: relativePath,
              line: i + 1,
              content: lines[i].trim(),
            });
          }
        }
      }
    }

    // Currently TutorialSystem.tsx reads 'first-visit' as a plain string (not JSON)
    // and uses safeLoadFromStorage for the JSON 'tutorial-progress' key.
    // This is the baseline — new violations indicate a new raw localStorage read.
    const knownAcceptable = violations.filter(v =>
      v.file === 'src/components/TutorialSystem.tsx' &&
      v.content.includes("'first-visit'")
    );
    const newViolations = violations.filter(v =>
      !(v.file === 'src/components/TutorialSystem.tsx' &&
        v.content.includes("'first-visit'"))
    );

    expect(newViolations).toHaveLength(0);
  });

  test('safe-storage.ts exports both safeLoadFromStorage and safeSaveToStorage', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const safeStoragePath = path.join(projectRoot, 'src', 'utils', 'safe-storage.ts');
    const content = fs.readFileSync(safeStoragePath, 'utf-8');

    expect(content).toContain('export function safeLoadFromStorage');
    expect(content).toContain('export function safeSaveToStorage');
  });
});
