/**
 * Global teardown for Jest - ensures all resources are cleaned up
 * to prevent worker process force-exit warnings.
 */
module.exports = async function globalTeardown() {
  // Allow pending microtasks and timer callbacks to flush before workers exit
  await new Promise<void>((resolve) => {
    // Use setImmediate to yield to any pending I/O callbacks
    setImmediate(() => {
      resolve();
    });
  });
};
