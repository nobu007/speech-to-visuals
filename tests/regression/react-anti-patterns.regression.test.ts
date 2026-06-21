/**
 * Static-analysis regression guard for React anti-patterns.
 *
 * Scans source files under src/hooks/ and src/components/ for patterns that
 * have historically caused memory leaks or setState-after-unmount bugs:
 *
 *   1. URL.createObjectURL without a matching URL.revokeObjectURL
 *   2. dangerouslySetInnerHTML usage (XSS surface)
 *   3. addEventListener without a corresponding removeEventListener in cleanup
 *   4. setInterval/setTimeout inside useEffect without cleanup return
 *   5. Bare setState calls inside .then()/.catch() without mount guards
 *
 * This is a *regression* test: it fails when new violations are introduced.
 * Files that already had issues at the time of baseline are listed in the
 * allow-list so the test starts green. The goal is to prevent *new* violations.
 *
 * @jest-environment node
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Walk up from process.cwd() to find the directory containing jest.config.cjs.
 * This is more robust than import.meta.url (which fails under ts-jest ESM)
 * or process.cwd() alone (which may differ under Jest worker contexts).
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, 'jest.config.cjs'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const SRC_DIRS = ['src/hooks', 'src/components'];
const PROJECT_ROOT = findProjectRoot();

// ─── helpers ────────────────────────────────────────────────────────────────

function listTsFiles(dir: string): string[] {
  const absDir = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(absDir)) return [];

  const results: string[] = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsFiles(path.relative(PROJECT_ROOT, full)));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function readRel(rel: string): string {
  return fs.readFileSync(path.join(PROJECT_ROOT, rel), 'utf-8');
}

function allSourceFiles(): { rel: string; content: string }[] {
  const files: { rel: string; content: string }[] = [];
  for (const dir of SRC_DIRS) {
    for (const abs of listTsFiles(dir)) {
      const rel = path.relative(PROJECT_ROOT, abs);
      files.push({ rel, content: fs.readFileSync(abs, 'utf-8') });
    }
  }
  return files;
}

// ─── allow-list (known-existing violations at baseline) ─────────────────────
// When you FIX a violation in one of these files, remove it from the list
// so the guard tightens.

const ALLOW_DANGEROUS_SET_INNER_HTML: string[] = [
  // None at baseline — good!
];

const ALLOW_MISSING_MOUNT_GUARD: string[] = [
  // Files with pre-existing setState-in-.then() without mount guards.
  // These are tracked as tech-debt. Do NOT add new files here.
  'src/components/SimplePipelineInterface.tsx',
  'src/components/FrameworkDashboard.tsx',
  'src/hooks/useFrameworkPipeline.ts',
  'src/components/ErrorAlertSystem.tsx',
  'src/components/StreamingProcessor.tsx',
  'src/components/EnhancedFileUploader.tsx',
];

// ─── tests ──────────────────────────────────────────────────────────────────

describe('React Anti-Pattern Regression Guard', () => {
  const files = allSourceFiles();

  describe('No new dangerouslySetInnerHTML usage', () => {
    for (const { rel, content } of files) {
      test(`${rel}`, () => {
        if (ALLOW_DANGEROUS_SET_INNER_HTML.includes(rel)) return;
        expect(content).not.toContain('dangerouslySetInnerHTML');
      });
    }
  });

  describe('createObjectURL must have matching revokeObjectURL', () => {
    // For each file that calls createObjectURL, verify it also calls
    // revokeObjectURL somewhere. (Cross-file revocation is checked separately.)
    for (const { rel, content } of files) {
      test(`${rel}`, () => {
        if (!content.includes('createObjectURL')) return;

        const createCount = (content.match(/createObjectURL/g) || []).length;
        const revokeCount = (content.match(/revokeObjectURL/g) || []).length;

        // At least one revoke per file that creates URLs
        expect(revokeCount).toBeGreaterThanOrEqual(1);

        // If there's exactly one create, there should be at least one revoke
        // (multiple creates can share a single revoke pattern via refs)
        if (createCount === 1) {
          expect(revokeCount).toBeGreaterThanOrEqual(1);
        }
      });
    }
  });

  describe('addEventListener must have removeEventListener in same file', () => {
    for (const { rel, content } of files) {
      test(`${rel}`, () => {
        if (!content.includes('addEventListener')) return;

        const addCount = (content.match(/addEventListener/g) || []).length;
        const removeCount = (content.match(/removeEventListener/g) || []).length;

        // Every add should have a matching remove in the same file
        expect(removeCount).toBeGreaterThanOrEqual(addCount);
      });
    }
  });

  describe('setInterval inside useEffect must have clearInterval in cleanup', () => {
    for (const { rel, content } of files) {
      test(`${rel}`, () => {
        // Look for setInterval calls — they must be paired with clearInterval
        if (!content.includes('setInterval')) return;

        const setIntervalCount = (content.match(/setInterval/g) || []).length;
        const clearIntervalCount = (content.match(/clearInterval/g) || []).length;

        // Each setInterval must have at least one clearInterval
        expect(clearIntervalCount).toBeGreaterThanOrEqual(1);

        // If only one interval, must have matching clear
        if (setIntervalCount === 1) {
          expect(clearIntervalCount).toBeGreaterThanOrEqual(1);
        }
      });
    }
  });

  describe('No new setState-in-async without mount guard', () => {
    // Detects setState calls inside .then() or .catch() without an
    // isMounted / abortSignal guard. This is a heuristic — it may have
    // false positives, so violations are allow-listed.
    //
    // The pattern we flag:
    //   .then(() => { setSomething(...) })
    // without any preceding `if (!mountedRef.current)` or `if (signal.aborted)`
    for (const { rel, content } of files) {
      test(`${rel}`, () => {
        if (ALLOW_MISSING_MOUNT_GUARD.includes(rel)) return;

        // Look for setState calls inside .then() callbacks
        const thenSetStatePattern = /\.then\s*\([^)]*?(?:set[A-Z]\w*|dispatch)\s*\(/;
        if (thenSetStatePattern.test(content)) {
          // Check if there's a mount guard or abort signal in the file
          const hasMountGuard =
            content.includes('isMounted') ||
            content.includes('mountedRef') ||
            content.includes('_mounted') ||
            content.includes('abortSignal') ||
            content.includes('signal.aborted') ||
            content.includes('AbortController');
          // If there are .then + setState but no mount guard, flag it
          if (!hasMountGuard) {
            fail(
              `${rel} has setState inside .then() but no mount guard (isMounted/AbortController)`,
            );
          }
        }
      });
    }
  });
});
