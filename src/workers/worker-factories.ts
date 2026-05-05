/**
 * Web Worker Factory Functions
 *
 * Separated from the barrel export to isolate `import.meta` usage,
 * which is incompatible with Jest's CommonJS transform.
 * Import these only in browser/Vite contexts.
 */

/**
 * Create a factory function for export workers.
 * Uses import.meta.url for Vite's worker URL resolution.
 */
export function createExportWorkerFactory(): () => Worker {
  return () => new Worker(
    new URL('./export-worker.ts', import.meta.url),
    { type: 'module' },
  );
}

/**
 * Create a factory function for layout workers.
 * Uses import.meta.url for Vite's worker URL resolution.
 */
export function createLayoutWorkerFactory(): () => Worker {
  return () => new Worker(
    new URL('./layout-worker.ts', import.meta.url),
    { type: 'module' },
  );
}
