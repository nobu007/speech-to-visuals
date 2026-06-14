#!/usr/bin/env tsx
/**
 * Monitoring Config Drift Detector — CI Pre-deploy Check
 *
 * Verifies that static deploy configs (alert-rules.yml, grafana-dashboard.json)
 * are in sync with the code-generated models. Catches stale configs before
 * they reach production.
 *
 * Drift scenarios detected:
 *   - Alert rule defined in code but missing from deploy YAML (or vice versa)
 *   - Alert expression / threshold mismatch between code and deploy
 *   - Dashboard panel defined in code but missing from deploy JSON (or vice versa)
 *   - Panel count mismatch
 *
 * Usage:
 *   npx tsx scripts/check-monitoring-drift.ts
 *
 * Exit codes:
 *   0 — no drift detected
 *   1 — drift detected (fix by regenerating deploy configs)
 *   2 — file system error (deploy configs missing)
 */

import { generateAlertRules, getAlertRuleNames } from '../src/monitoring/alert-rules';
import { generateGrafanaDashboard } from '../src/monitoring/grafana-dashboard-model';
import { readFileSync } from 'fs';
import { join } from 'path';

const DEPLOY_DIR = join(process.cwd(), 'deploy', 'monitoring');

interface DriftItem {
  category: string;
  entity: string;
  detail: string;
}

const drifts: DriftItem[] = [];

// ---------------------------------------------------------------------------
// Alert Rules Drift Check
// ---------------------------------------------------------------------------

const expectedAlertNames = new Set(getAlertRuleNames());
const expectedRules = generateAlertRules();
const expectedExprByName = new Map(
  expectedRules.groups.flatMap(g => g.rules.map(r => [r.alert, r.expr] as const)),
);

// Parse deploy YAML for alert names and expressions
const yamlPath = join(DEPLOY_DIR, 'alert-rules.yml');
let yamlContent: string;
try {
  yamlContent = readFileSync(yamlPath, 'utf-8');
} catch {
  console.error(`✗ Cannot read ${yamlPath}`);
  process.exit(2);
}

const deployedAlertNames = new Set<string>();
const deployedExprByName = new Map<string, string>();

for (const line of yamlContent.split('\n')) {
  const nameMatch = line.match(/^\s+- alert:\s*(.+)$/);
  if (nameMatch) {
    deployedAlertNames.add(nameMatch[1].trim());
    continue;
  }
  const exprMatch = line.match(/^\s+expr:\s*(.+)$/);
  if (exprMatch && deployedAlertNames.size > 0) {
    // Attach to the most recently seen alert
    const lastName = [...deployedAlertNames].pop()!;
    deployedExprByName.set(lastName, exprMatch[1].trim());
  }
}

// Alerts in code but not in deploy
for (const name of expectedAlertNames) {
  if (!deployedAlertNames.has(name)) {
    drifts.push({ category: 'alert-rules', entity: name, detail: 'Defined in code but missing from deploy YAML' });
  }
}
// Alerts in deploy but not in code
for (const name of deployedAlertNames) {
  if (!expectedAlertNames.has(name)) {
    drifts.push({ category: 'alert-rules', entity: name, detail: 'In deploy YAML but not in code generator' });
  }
}
// Expression mismatch
for (const name of expectedAlertNames) {
  const expected = expectedExprByName.get(name);
  const deployed = deployedExprByName.get(name);
  if (expected && deployed && expected !== deployed) {
    drifts.push({
      category: 'alert-rules',
      entity: name,
      detail: `Expression mismatch:\n        code:   ${expected}\n        deploy: ${deployed}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Dashboard Drift Check
// ---------------------------------------------------------------------------

const expectedDashboard = generateGrafanaDashboard();
const expectedPanelTitles = new Set(expectedDashboard.panels.map(p => p.title));

const dashboardPath = join(DEPLOY_DIR, 'grafana-dashboard.json');
let dashboardJson: { dashboard: { panels: Array<{ title: string; id: number }> } };
try {
  dashboardJson = JSON.parse(readFileSync(dashboardPath, 'utf-8'));
} catch {
  console.error(`✗ Cannot read ${dashboardPath}`);
  process.exit(2);
}

const deployedPanels = dashboardJson.dashboard.panels;
const deployedPanelTitles = new Set(deployedPanels.map(p => p.title));

for (const title of expectedPanelTitles) {
  if (!deployedPanelTitles.has(title)) {
    drifts.push({ category: 'dashboard', entity: title, detail: 'Panel defined in code but missing from deploy JSON' });
  }
}
for (const title of deployedPanelTitles) {
  if (!expectedPanelTitles.has(title)) {
    drifts.push({ category: 'dashboard', entity: title, detail: 'Panel in deploy JSON but not in code generator' });
  }
}

if (expectedDashboard.panels.length !== deployedPanels.length) {
  drifts.push({
    category: 'dashboard',
    entity: 'panel_count',
    detail: `Code generates ${expectedDashboard.panels.length} panels, deploy JSON has ${deployedPanels.length}`,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('━'.repeat(60));
console.log('  Monitoring Config Drift Detector');
console.log('━'.repeat(60));

if (drifts.length === 0) {
  console.log('  ✓ No drift detected — deploy configs are in sync');
  console.log(`    Alert rules: ${expectedAlertNames.size} matched`);
  console.log(`    Dashboard panels: ${expectedDashboard.panels.length} matched`);
  console.log('━'.repeat(60));
  process.exit(0);
}

console.error(`  ✗ ${drifts.length} drift(s) detected:\n`);
for (const d of drifts) {
  console.error(`    [${d.category}] ${d.entity}`);
  console.error(`      ${d.detail}`);
  console.error();
}
console.error('━'.repeat(60));
console.error('  FAILED — regenerate deploy configs or update code.');
process.exit(1);
