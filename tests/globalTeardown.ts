/**
 * Global teardown for Jest - ensures all resources are cleaned up
 * to prevent worker process force-exit warnings.
 *
 * Also logs memory usage at teardown to support maxWorkers tuning decisions.
 * The data is emitted to stderr so it doesn't interfere with --json output.
 */
import { flushPendingTimers } from '../src/transcription/__tests__/audio-mock-helpers';

module.exports = async function globalTeardown() {
  // Log memory snapshot for maxWorkers capacity planning
  if (process.env.JEST_MEMORY_LOG === '1') {
    const mem = process.memoryUsage();
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    process.stderr.write(
      `[jest:teardown] heap=${mb(mem.heapUsed)}MB / ${mb(mem.heapTotal)}MB ` +
      `rss=${mb(mem.rss)}MB external=${mb(mem.external)}MB\n`,
    );
  }

  // Allow pending microtasks and timer callbacks to flush before workers exit.
  // See src/transcription/__tests__/audio-mock-helpers.ts for the helper rationale.
  await flushPendingTimers();
};
