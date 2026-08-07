/**
 * Structural source-coupling guard for the server export-queue wiring (REQ-294).
 *
 * `src/api/server.ts` constructs the production `ExportJobQueue` and previously
 * passed `{ maxConcurrent: 3, maxQueueSize: 100 }` as bare literals. Those values
 * coincide with `EXPORT_QUEUE_LIMITS.MAX_CONCURRENT` / `MAX_QUEUE_SIZE` in
 * `src/config/limits.ts`, but were not bound to them — a latent-coincident
 * constant-desync seed: changing the canonical limits would silently leave the
 * production server on the old literals while every other consumer (export-job-queue's
 * DEFAULT_OPTIONS) followed the canonical source. Behavioral RED→GREEN is impossible
 * because the literals match, so this test guards the COUPLING at the source-text
 * level: the production wiring MUST import and reference the canonical constants.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EXPORT_QUEUE_LIMITS } from '@/config/limits';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVER_FILE = path.resolve(__dirname, '../server.ts');

describe('REQ-294: server export-queue config is single-sourced', () => {
  test('canonical queue limits hold their documented values', () => {
    // Locking the canonical values makes the "coincide today" desync detectable.
    expect(EXPORT_QUEUE_LIMITS.MAX_CONCURRENT).toBe(3);
    expect(EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE).toBe(100);
  });

  test('server.ts imports EXPORT_QUEUE_LIMITS from config/limits', () => {
    const src = fs.readFileSync(SERVER_FILE, 'utf-8');
    expect(src).toMatch(/import\s*\{[^}]*\bEXPORT_QUEUE_LIMITS\b[^}]*\}\s*from\s*['"][^'']*config\/limits['"]/);
  });

  test('server.ts references the canonical constants in the ExportJobQueue construction', () => {
    const src = fs.readFileSync(SERVER_FILE, 'utf-8');
    const queueConstruction = src.match(/new\s+ExportJobQueue\s*\([^)]*\)/s);
    // Expected: an ExportJobQueue construction exists in server.ts.
    expect(queueConstruction).not.toBeNull();
    const constructionText = queueConstruction?.[0] ?? '';
    expect(constructionText).toContain('EXPORT_QUEUE_LIMITS.MAX_CONCURRENT');
    expect(constructionText).toContain('EXPORT_QUEUE_LIMITS.MAX_QUEUE_SIZE');
  });

  test('server.ts does not re-inline the queue-limit literals (3 / 100) as bare config', () => {
    const src = fs.readFileSync(SERVER_FILE, 'utf-8');
    // The desync seed: hardcoding `{ maxConcurrent: 3, maxQueueSize: 100 }`.
    // A bare `3`/`100` is allowed elsewhere; only the queue-config shape is banned.
    expect(src).not.toMatch(/maxConcurrent\s*:\s*3\b/);
    expect(src).not.toMatch(/maxQueueSize\s*:\s*100\b/);
  });
});
