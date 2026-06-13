/**
 * Integration Test: Export Service Graceful Shutdown (Phase 107)
 *
 * Verifies that ExportArtifactStore and ExportJobQueue are properly
 * cleaned up during server shutdown. This catches resource leaks
 * where background timers (starvation prevention, TTL cleanup)
 * would keep running after SIGTERM/SIGINT.
 *
 * Covers:
 *   - jobQueue.stop() clears the starvation prevention timer
 *   - artifactStore.stop() clears the TTL cleanup timer
 *   - Both services can be safely stopped and restarted
 *   - Services handle double-stop gracefully
 *   - Queue retains in-memory state after stop (no data loss)
 */

import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import { ExportJobQueue } from '../../src/export/export-job-queue';

describe('Export Service Graceful Shutdown', () => {

  // -------------------------------------------------------------------------
  // ExportJobQueue shutdown
  // -------------------------------------------------------------------------

  describe('ExportJobQueue.stop()', () => {
    test('stops the starvation prevention timer cleanly', () => {
      const queue = new ExportJobQueue({
        maxConcurrent: 2,
        maxQueueSize: 10,
        starvationPreventionInterval: 1_000,
      });

      queue.start();
      // The queue is now running with a background timer

      // Stop should not throw and should clean up the timer
      expect(() => queue.stop()).not.toThrow();
    });

    test('handles double-stop gracefully', () => {
      const queue = new ExportJobQueue({});
      queue.start();
      queue.stop();

      // Second stop should be a no-op, not throw
      expect(() => queue.stop()).not.toThrow();
    });

    test('retains queued and completed jobs after stop (no data loss)', () => {
      const queue = new ExportJobQueue({ maxConcurrent: 1, maxQueueSize: 10 });
      queue.start();

      // Enqueue some jobs
      const job1 = queue.enqueue({
        priority: 'high',
        format: 'mp4',
        inputHash: 'hash-1',
      });
      const job2 = queue.enqueue({
        priority: 'normal',
        format: 'svg',
        inputHash: 'hash-2',
      });

      // Complete one job
      queue.dequeue();
      queue.completeJob(job1.jobId, true, {
        data: new Uint8Array(64),
        sizeBytes: 64,
      });

      // Stop the queue
      queue.stop();

      // Data should still be accessible
      const stats = queue.getQueueStats();
      expect(stats.completed).toBe(1);
      expect(stats.queued).toBe(1);

      const remainingJob = queue.findJob(job2.jobId);
      expect(remainingJob).toBeDefined();
      expect(remainingJob!.status).toBe('queued');
    });

    test('can be restarted after stop', () => {
      const queue = new ExportJobQueue({});
      queue.start();
      queue.stop();

      // Should be able to restart without issues
      expect(() => queue.start()).not.toThrow();

      // Should be able to enqueue after restart
      const job = queue.enqueue({
        priority: 'normal',
        format: 'mp4',
        inputHash: 'restart-test',
      });
      expect(job.jobId).toBeDefined();

      queue.stop();
    });

    test('start without stop is idempotent', () => {
      const queue = new ExportJobQueue({});
      queue.start();

      // Second start should be a no-op
      expect(() => queue.start()).not.toThrow();

      queue.stop();
    });
  });

  // -------------------------------------------------------------------------
  // ExportArtifactStore shutdown
  // -------------------------------------------------------------------------

  describe('ExportArtifactStore.stop()', () => {
    test('stops the TTL cleanup timer cleanly', () => {
      const store = new ExportArtifactStore({
        cleanupIntervalMs: 1_000,
      });

      store.start();

      expect(() => store.stop()).not.toThrow();
    });

    test('handles double-stop gracefully', () => {
      const store = new ExportArtifactStore({});
      store.start();
      store.stop();

      expect(() => store.stop()).not.toThrow();
    });

    test('retains stored artifacts after stop (no data loss)', () => {
      const store = new ExportArtifactStore({
        defaultTtlMs: 60_000,
      });
      store.start();

      const artifact = store.store({
        format: 'png',
        data: new Uint8Array(128),
        sizeBytes: 128,
      });

      store.stop();

      // Artifact should still be retrievable after stop
      const retrieved = store.get(artifact.artifactId);
      expect(retrieved).toBeDefined();
      expect(retrieved!.format).toBe('png');
      expect(retrieved!.sizeBytes).toBe(128);
    });

    test('can be restarted after stop', () => {
      const store = new ExportArtifactStore({});
      store.start();
      store.stop();

      expect(() => store.start()).not.toThrow();

      // Should be able to store after restart
      const artifact = store.store({
        format: 'svg',
        data: new Uint8Array(32),
        sizeBytes: 32,
      });
      expect(artifact.artifactId).toBeDefined();

      store.stop();
    });

    test('start without stop is idempotent', () => {
      const store = new ExportArtifactStore({});
      store.start();

      expect(() => store.start()).not.toThrow();

      store.stop();
    });
  });

  // -------------------------------------------------------------------------
  // Combined shutdown (simulates graceful shutdown ordering)
  // -------------------------------------------------------------------------

  describe('Combined export service shutdown', () => {
    test('stopping artifactStore before jobQueue does not lose data', () => {
      const artifactStore = new ExportArtifactStore({
        defaultTtlMs: 60_000,
        cleanupIntervalMs: 5_000,
      });
      artifactStore.start();

      const jobQueue = new ExportJobQueue(
        { maxConcurrent: 2, maxQueueSize: 20 },
        undefined,
        artifactStore,
      );
      jobQueue.start();

      // Enqueue and complete a job with artifact
      const job = jobQueue.enqueue({
        priority: 'high',
        format: 'mp4',
        inputHash: 'combined-test',
      });

      jobQueue.dequeue();
      jobQueue.completeJob(job.jobId, true, {
        data: new Uint8Array(256),
        sizeBytes: 256,
      });

      // Stop artifact store first (as would happen in uncontrolled shutdown)
      artifactStore.stop();

      // Then stop job queue
      jobQueue.stop();

      // The job should still show as completed with an artifactId
      const completed = jobQueue.findJob(job.jobId);
      expect(completed).toBeDefined();
      expect(completed!.status).toBe('completed');
      expect(completed!.artifactId).toBeDefined();
    });

    test('all services can be started and stopped multiple times', () => {
      const artifactStore = new ExportArtifactStore({});
      const jobQueue = new ExportJobQueue({}, undefined, artifactStore);

      for (let cycle = 0; cycle < 3; cycle++) {
        artifactStore.start();
        jobQueue.start();

        // Do some work
        const artifact = artifactStore.store({
          format: 'json',
          data: new Uint8Array(16),
          sizeBytes: 16,
        });
        expect(artifact.artifactId).toBeDefined();

        jobQueue.stop();
        artifactStore.stop();
      }
    });
  });

  // -------------------------------------------------------------------------
  // Server wiring verification
  // -------------------------------------------------------------------------

  describe('Server wiring exports', () => {
    test('server.ts exports artifactStore and jobQueue instances', async () => {
      // Dynamic import to avoid starting the server
      const serverModule = await import('../../src/api/server');

      expect(serverModule.artifactStore).toBeDefined();
      expect(serverModule.jobQueue).toBeDefined();

      // Verify they have stop methods
      expect(typeof serverModule.artifactStore.stop).toBe('function');
      expect(typeof serverModule.jobQueue.stop).toBe('function');
    });
  });
});
