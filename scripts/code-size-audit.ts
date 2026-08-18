#!/usr/bin/env tsx
/**
 * REQ-102: Code Size Audit CLI
 *
 * Runs the code-size audit against SYSTEM_CONSTITUTION V2.8 limits and
 * prints a report. Accounting is implementation-only (tests excluded —
 * V2.8), and a breach FAILS the build (exit 1): the limit has teeth.
 *
 * Usage:
 *   npx tsx scripts/code-size-audit.ts [--ci] [--all]
 *   npm run audit:code-size
 *
 * --ci   Additionally emit GitHub Actions annotation format.
 * --all  Audit the full repository instead of src/ only.
 */

import * as path from 'path';
import {
  runAudit,
  type CodeSizeAuditResult,
  type CodeSizeLimits,
} from '@stv/core/config/code-size-audit';

/**
 * SYSTEM_CONSTITUTION V2.8 limits — implementation-only accounting
 * (implOnly: __tests__/ and *.test.* excluded). Baseline at V2.8:
 * 298 impl files / 86,328 impl lines / 106 deps / largest 2,829 lines
 * (src/quality/enhanced-error-recovery.ts — debt, ceiling set to 3,000).
 * Headroom: +22 files / +3,672 lines (~4%).
 *
 * 2026-08 split: enhanced-error-recovery.ts (2,828 lines) decomposed into
 * error-recovery/{types,circuit-breaker,load-balanced-executor,
 * recovery-strategies,notifications}.ts + a 1,646-line orchestrator; the
 * largest impl file is now that orchestrator, so the per-file ceiling drops
 * from 3,000 to 2,000 to keep the debt from re-forming.
 */
const CONSTITUTION_V2_8_LIMITS: CodeSizeLimits = {
  maxFiles: 320,
  maxLines: 90_000,
  maxLinesPerFile: 2_000,
  maxDependencies: 110,
};

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const ciMode = process.argv.includes('--ci');
const auditAll = process.argv.includes('--all');

function formatResult(result: CodeSizeAuditResult): void {
  const { metrics, limits, warnings, isCompliant } = result;

  console.log('\n=== Code Size Audit (SYSTEM_CONSTITUTION V2.8 — implementation-only, CI-fatal) ===\n');

  console.log(`  Files:        ${metrics.fileCount} / ${limits.maxFiles}`);
  console.log(`  Lines:        ${metrics.lineCount.toLocaleString()} / ${limits.maxLines.toLocaleString()}`);
  console.log(`  Dependencies: ${metrics.dependencyCount} / ${limits.maxDependencies}`);

  if (metrics.largestFile) {
    console.log(`  Largest file: ${metrics.largestFile.path} (${metrics.largestFile.lines} lines / ${limits.maxLinesPerFile} limit)`);
  }

  console.log();

  if (isCompliant) {
    console.log('  Status: COMPLIANT — all metrics within limits.\n');
  } else {
    console.log('  Status: NON-COMPLIANT — limit breach fails the build (V2.8 teeth).\n');
    for (const w of warnings) {
      console.log(`  VIOLATION: ${w}`);
    }
    console.log();

    if (ciMode) {
      for (const w of warnings) {
        console.log(`::error::${w}`);
      }
    }
  }
}

// --- Main ---

const result = runAudit(ROOT_DIR, PACKAGE_JSON, CONSTITUTION_V2_8_LIMITS, {
  srcOnly: !auditAll,
  implOnly: true,
});
formatResult(result);

if (!auditAll) {
  console.log('  Scope: src/ implementation files only (tests excluded; use --all for full repository)\n');
}
// V2.8 teeth: a limit breach fails the audit job instead of warning.
process.exit(result.isCompliant ? 0 : 1);
