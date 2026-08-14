/**
 * @jest-environment node
 */
/**
 * JobPriority — structural guard against duplicate type definitions.
 *
 * `JobPriority = 'high' | 'normal' | 'low'` was defined byte-identically in TWO
 * export modules:
 *   - src/export/export-job-queue.ts      (canonical owner: PRIORITY_ORDER,
 *     QueuedExportJob.priority, the QueueMetricsSink interface)
 *   - src/export/export-metrics-collector.ts (the metrics sink that structurally
 *     implements QueueMetricsSink — re-declared the union only because it could
 *     not see the queue's type)
 *
 * The two unions happened to agree today, but they were free to drift: nothing
 * forced the metrics sink to track a new priority tier (e.g. 'urgent') added to
 * the queue, so a `Record<JobPriority, number>` counter in the collector would
 * silently miss the new key while the queue scheduled it — the same shape as the
 * recurring "dup-named export" defect class. metrics-collector now imports
 * JobPriority from export-job-queue (type-only; no runtime cycle, since the
 * queue does not import the collector at module scope).
 *
 * A type check on either module alone proves nothing about the other. This
 * structurally forbids re-DEFINING the `type JobPriority =` union anywhere under
 * src/ except the canonical owner, so the next copy — even a re-typed variant —
 * fails loudly.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';

import type { JobPriority } from '../export-job-queue';

// Anchored to import.meta.url, not process.cwd(): a jest worker's cwd can be
// moved by a module-load side effect (whisper-node chdir — see
// tests/__mocks__/whisper-node.ts) or simply differ under --maxWorkers>1
// (TC-302/313); cwd-relative source reads then flake with ENOENT.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const jobQueueSrc = readFileSync(
  resolve(REPO_ROOT, 'src/export/export-job-queue.ts'),
  'utf8',
);
const metricsSrc = readFileSync(
  resolve(REPO_ROOT, 'src/export/export-metrics-collector.ts'),
  'utf8',
);

/** Strip comments so doc references to the old type don't match. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Matches a JobPriority DEFINITION: `type JobPriority =`. Anchored on the `=`
 * so import forms are exempt:
 *   - `import type { JobPriority }` — `type` is followed by `{`, not JobPriority.
 *   - `import { type JobPriority }` — `JobPriority` is followed by `,`/`}`, not `=`.
 *   - `export type { JobPriority }` (re-export) — followed by `}`, not `=`.
 * Only a real union/alias definition has the `=`.
 */
const JOB_PRIORITY_DEF = /\btype\s+JobPriority\s*=/;

describe('JobPriority — canonical single definition', () => {
  it('export-job-queue owns the exported JobPriority union', () => {
    expect(jobQueueSrc).toMatch(/export\s+type\s+JobPriority\s*=\s*'high'\s*\|\s*'normal'\s*\|\s*'low'/);
  });

  it('the union covers exactly high / normal / low (compile-time anchor)', () => {
    // Record<JobPriority, _> requires EVERY member and forbids extras, so adding
    // or removing a tier is a type error caught by tsc.
    const coverage: Record<JobPriority, true> = { high: true, normal: true, low: true };
    expect(Object.keys(coverage).sort()).toEqual(['high', 'low', 'normal']);
  });
});

describe('JobPriority — metrics collector delegates, does not redefine', () => {
  it('import-job-queue imports JobPriority instead of re-declaring it', () => {
    expect(stripComments(metricsSrc)).toMatch(/import\s+type\s+\{\s*JobPriority\s*\}\s*from\s*['"]\.\/export-job-queue['"]/);
    expect(stripComments(metricsSrc)).not.toMatch(JOB_PRIORITY_DEF);
  });
});

describe('JobPriority — no re-definition anywhere under src/', () => {
  it('exactly one file defines the JobPriority type (the canonical owner)', () => {
    const files = ([
      ...globSync('src/**/*.ts', { cwd: REPO_ROOT }),
      ...globSync('src/**/*.tsx', { cwd: REPO_ROOT }),
    ] as string[]).filter(f => !f.includes('__tests__'));

    const definers = files.filter(
      f => stripComments(readFileSync(resolve(REPO_ROOT, f), 'utf8')).match(JOB_PRIORITY_DEF),
    );

    // The canonical owner is the sole permitted definition site.
    expect(definers).toEqual(['src/export/export-job-queue.ts']);
  });
});
