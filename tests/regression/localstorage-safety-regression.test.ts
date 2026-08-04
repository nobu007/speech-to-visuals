/**
 * Regression guard: No raw localStorage.getItem / localStorage.setItem in
 * production source.
 *
 * Ensures ALL localStorage read and write operations go through the safe
 * wrappers (safeLoadFromStorage / safeSaveToStorage), which provide:
 *   - corruption detection + self-healing (removeItem on bad data)
 *   - type-guard validation
 *   - serialisation safety
 *   - quota / private-mode resilience
 *
 * Allowed exceptions:
 *   - src/utils/safe-storage.ts (the implementation itself)
 *   - localStorage.removeItem / localStorage.clear (safe by nature)
 *   - Test files (__tests__/, *.test.*, *.spec.*)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Files exempt from the localStorage ban. */
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

/** Raw getItem: any localStorage.getItem( call */
const RAW_GETITEM = /localStorage\.getItem\s*\(/;

/** Raw setItem: any localStorage.setItem( call */
const RAW_SETITEM = /localStorage\.setItem\s*\(/;

/** Unsafe write: localStorage.setItem(..., JSON.stringify(...)) */
const UNSAFE_WRITE = /localStorage\.setItem\s*\([^)]*JSON\.stringify/;

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

describe('Regression: localStorage safety — all access must use safe wrappers', () => {
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
        if (INTERMEDIATE_GETITEM.test(lines[i])) {
          violations.push({
            file: relativePath,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }

    // All production reads now go through safeLoadFromStorage.
    // Zero violations expected — no known exceptions remain.
    expect(violations).toHaveLength(0);
  });

  test('no raw localStorage.getItem in production source (use safeLoadFromStorage)', () => {
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
        if (RAW_GETITEM.test(lines[i])) {
          violations.push({
            file: relativePath,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  test('no raw localStorage.setItem in production source (use safeSaveToStorage)', () => {
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
        if (RAW_SETITEM.test(lines[i])) {
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
        `Found ${violations.length} raw localStorage.setItem calls in production code.\n` +
        `Use safeSaveToStorage() from '@/utils/safe-storage' instead.\n${formatted}`,
      );
    }

    expect(violations).toHaveLength(0);
  });

  test('no unsafe localStorage.setItem(JSON.stringify(...)) in production source', () => {
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
        if (UNSAFE_WRITE.test(lines[i])) {
          violations.push({
            file: relativePath,
            line: i + 1,
            content: lines[i].trim(),
          });
        }
      }
    }

    expect(violations).toHaveLength(0);
  });

  test('safe-storage.ts exports both safeLoadFromStorage and safeSaveToStorage', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const safeStoragePath = path.join(projectRoot, 'src', 'utils', 'safe-storage.ts');
    const content = fs.readFileSync(safeStoragePath, 'utf-8');

    expect(content).toContain('export function safeLoadFromStorage');
    expect(content).toContain('export function safeSaveToStorage');
  });
});
