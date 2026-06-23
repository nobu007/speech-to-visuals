/**
 * Regression test: No console.error/warn/log in production source code (REQ-255).
 *
 * Verifies that the ESLint `no-console: error` rule is respected across all
 * production source files. The ONLY legitimate console.* usage is in
 * src/utils/logger.ts (the centralized logger that all modules should use).
 *
 * This test catches regressions where a developer adds console.error directly
 * instead of using logger.error, bypassing the ESLint rule.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Files that are allowed to use console methods directly. */
const ALLOWED_FILES = new Set([
  'src/utils/logger.ts',
]);

/** Pattern that matches console.error, console.warn, console.log, console.info, console.debug calls. */
const CONSOLE_CALL_PATTERN = /console\.(error|warn|log|info|debug)\s*\(/g;

/** Skip lines that are comments. */
const COMMENT_PATTERN = /^\s*(\/\/|\/\*|\*|<!--)/;

function getAllSourceFiles(dir: string, basePath: string = dir): string[] {
  const results: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, dist, __tests__, coverage
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      // Skip .test.ts/.spec.ts directories but not regular src subdirectories
      results.push(...getAllSourceFiles(fullPath, basePath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      // Skip test files
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }

  return results;
}

describe('REQ-255: No console.* calls in production source code', () => {
  test('only logger.ts is permitted to use console methods', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const srcDir = path.join(projectRoot, 'src');

    expect(fs.existsSync(srcDir)).toBe(true);

    const sourceFiles = getAllSourceFiles(srcDir);
    expect(sourceFiles.length).toBeGreaterThan(50); // sanity check

    const violations: { file: string; line: number; content: string }[] = [];

    for (const file of sourceFiles) {
      const relativePath = path.relative(projectRoot, file);

      // Skip the allowed files
      if (ALLOWED_FILES.has(relativePath)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comment lines
        if (COMMENT_PATTERN.test(line)) continue;

        const matches = line.match(CONSOLE_CALL_PATTERN);
        if (matches) {
          violations.push({
            file: relativePath,
            line: i + 1,
            content: line.trim(),
          });
        }
      }
    }

    if (violations.length > 0) {
      const formatted = violations
        .map(v => `  ${v.file}:${v.line} → ${v.content}`)
        .join('\n');
      // eslint-disable-next-line no-console
      console.error(`Found ${violations.length} console.* violations in production code:\n${formatted}`);
    }

    expect(violations).toHaveLength(0);
  });

  test('ESLint config has no-console rule set to error', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const eslintConfigPath = path.join(projectRoot, 'eslint.config.js');
    const content = fs.readFileSync(eslintConfigPath, 'utf-8');

    expect(content).toContain('"no-console"');
    expect(content).toContain('"error"');
  });

  test('ESLint config exempts logger.ts from no-console', () => {
    const projectRoot = path.resolve(__dirname, '../../');
    const eslintConfigPath = path.join(projectRoot, 'eslint.config.js');
    const content = fs.readFileSync(eslintConfigPath, 'utf-8');

    expect(content).toContain('src/utils/logger.ts');
    expect(content).toContain('"no-console": "off"');
  });
});
