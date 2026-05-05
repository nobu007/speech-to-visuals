/**
 * Jest mock for worker-factories module.
 *
 * The real worker-factories.ts uses import.meta.url for Vite worker URL
 * resolution, which is incompatible with Jest's CJS transform.
 */

export function createExportWorkerFactory(): () => Worker {
  return () => {
    throw new Error('Worker factories are mocked in test environment');
  };
}

export function createLayoutWorkerFactory(): () => Worker {
  return () => {
    throw new Error('Worker factories are mocked in test environment');
  };
}
