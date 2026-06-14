#!/usr/bin/env tsx
/**
 * Monitoring Config Validator — CI Pre-deploy Check
 *
 * Validates deploy/monitoring/alert-rules.yml and grafana-dashboard.json
 * before they are shipped, preventing broken monitoring configs from
 * reaching production.
 *
 * Usage:
 *   npx tsx scripts/validate-monitoring-configs.ts
 *
 * Exit codes:
 *   0 — all configs valid
 *   1 — one or more validation errors found
 *   2 — file system error (config files missing)
 */

import { validateMonitoringConfigs } from '../src/monitoring/config-validator';
import { join } from 'path';

const DEPLOY_DIR = join(process.cwd(), 'deploy', 'monitoring');

console.log('━'.repeat(60));
console.log('  Monitoring Config Validator');
console.log('━'.repeat(60));
console.log(`  Target: ${DEPLOY_DIR}`);
console.log();

const result = validateMonitoringConfigs(DEPLOY_DIR);

if (result.errors.length > 0) {
  console.error(`  ✗ ${result.errors.length} validation error(s) found:\n`);
  for (const err of result.errors) {
    const field = err.field ? ` → ${err.field}` : '';
    console.error(`    [${err.file}]${field}`);
    console.error(`      ${err.message}`);
    console.error();
  }
  console.error('━'.repeat(60));
  console.error('  FAILED — fix the errors above before deploying.');
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('  Warnings:');
  for (const w of result.warnings) {
    console.warn(`    ⚠ ${w}`);
  }
  console.warn();
}

console.log('  ✓ All monitoring configs valid');
console.log('    alert-rules.yml: OK');
console.log('    grafana-dashboard.json: OK');
console.log('━'.repeat(60));
process.exit(0);
