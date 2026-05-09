#!/usr/bin/env tsx
/**
 * REQ-102: Code Size Audit CLI
 *
 * Runs the code-size audit against SYSTEM_CONSTITUTION V2.4 limits
 * and prints a report. Warnings do not block the build (exit 0).
 *
 * Usage:
 *   npx tsx scripts/code-size-audit.ts [--ci]
 *   npm run audit:code-size
 *
 * --ci  Additionally emit GitHub Actions annotation format.
 */

import * as path from 'path';
import { runAudit, type CodeSizeAuditResult } from '../src/config/code-size-audit';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const ciMode = process.argv.includes('--ci');

function formatResult(result: CodeSizeAuditResult): void {
  const { metrics, limits, warnings, isCompliant } = result;

  console.log('\n=== Code Size Audit (SYSTEM_CONSTITUTION V2.4) ===\n');

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
    console.log('  Status: NON-COMPLIANT — warnings below (build continues).\n');
    for (const w of warnings) {
      console.log(`  WARNING: ${w}`);
    }
    console.log();

    if (ciMode) {
      for (const w of warnings) {
        console.log(`::warning::${w}`);
      }
    }
  }
}

// --- Main ---

const result = runAudit(ROOT_DIR, PACKAGE_JSON);
formatResult(result);
process.exit(0); // Warnings never block the build
