/**
 * TASK-0049: Batch Processing Integration Tests
 *
 * Integration tests for the BatchJobManager's concurrency behaviour,
 * queuing, progress tracking, cancellation, and full lifecycle.
 */

import {
  BatchJobManager,
  JobState,
  BatchJobStatus,
  JobProgress,
} from '@/api/routes/batch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal file entry for batch job creation. */
function makeFile(index: number) {
  return { name: `file-${index}.wav`, path: `/audio/file-${index}.wav` };
}

/** Create an array of N file entries. */
function makeFiles(count: number) {
  return Array.from({ length: count }, (_, i) => makeFile(i));
}

/**
 * Fail-loud accessors over the `| null` returns of BatchJobManager: the
 * old `!` postfixes only silenced the compiler, so an absent job used to
 * surface as `Cannot read properties of null` mid-assertion. The helpers
 * keep the RED verdict and name the jobId instead.
 */
function requireJobStatus(manager: BatchJobManager, jobId: string): BatchJobStatus {
  const status = manager.getJobStatus(jobId);
  if (status === null) {
    throw new Error(`job ${jobId} has no status`);
  }
  return status;
}

function requireCancelToken(manager: BatchJobManager, jobId: string): { cancelled: boolean } {
  const token = manager.getCancelToken(jobId);
  if (token === null) {
    throw new Error(`job ${jobId} has no cancel token`);
  }
  return token;
}

function requireStartedId(startedId: string | null): string {
  if (startedId === null) {
    throw new Error('startNextQueuedJob() returned null');
  }
  return startedId;
}

// ===========================================================================
// TEST SUITES
// ===========================================================================

describe('Batch Processing Integration', () => {
  let manager: BatchJobManager;

  beforeEach(() => {
    manager = new BatchJobManager();
  });

  // -------------------------------------------------------------------------
  // 1. 3 parallel job execution
  // -------------------------------------------------------------------------
  test('3ジョブ同時実行の正常動作', async () => {
    // Create 3 jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const jobId = manager.createJob(makeFiles(5));
      jobIds.push(jobId);
    }

    // All should start in "queued" state
    for (const jobId of jobIds) {
      expect(requireJobStatus(manager, jobId).status).toBe('queued');
    }

    // Start all 3 -- they should all transition to "processing"
    const started: string[] = [];
    for (let i = 0; i < 3; i++) {
      started.push(requireStartedId(manager.startNextQueuedJob()));
    }

    expect(started).toHaveLength(3);
    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(0);

    // Verify each job is in the correct state with startedAt timestamp
    for (const jobId of started) {
      const status = requireJobStatus(manager, jobId);
      expect(status.status).toBe('processing');
      expect(status.startedAt).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // 2. 4th job gets queued
  // -------------------------------------------------------------------------
  test('4つ目のジョブが待機状態になること', async () => {
    // Create 4 jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      jobIds.push(manager.createJob(makeFiles(3)));
    }

    // Start 3 of them (max concurrency)
    for (let i = 0; i < 3; i++) {
      manager.startNextQueuedJob();
    }

    // Attempt to start the 4th -- should return null
    const fourthStart = manager.startNextQueuedJob();
    expect(fourthStart).toBeNull();

    // 4th job should still be queued
    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(1);

    const fourthJobStatus = requireJobStatus(manager, jobIds[3]);
    expect(fourthJobStatus.status).toBe('queued');
    expect(fourthJobStatus.startedAt).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // 3. Queued job starts when running job completes
  // -------------------------------------------------------------------------
  test('ジョブ完了時に待機ジョブが開始されること', async () => {
    // Create 4 jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      jobIds.push(manager.createJob(makeFiles(3)));
    }

    // Start the first 3
    for (let i = 0; i < 3; i++) {
      manager.startNextQueuedJob();
    }

    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(1);

    // Complete the first running job
    manager.updateJobStatus(jobIds[0], {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: { total: 3, completed: 3, failed: 0, percentage: 100 },
    });

    expect(manager.getRunningCount()).toBe(2);

    // Now startNextQueuedJob should pick up the 4th job
    const startedId = manager.startNextQueuedJob();
    expect(startedId).toBe(jobIds[3]);

    const fourthStatus = requireJobStatus(manager, jobIds[3]);
    expect(fourthStatus.status).toBe('processing');
    expect(fourthStatus.startedAt).toBeDefined();

    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 4. Batch progress tracking
  // -------------------------------------------------------------------------
  test('バッチ全体の進捗追跡が正確であること', async () => {
    const files = makeFiles(10);
    const jobId = manager.createJob(files);

    // Initial progress
    const initialStatus = requireJobStatus(manager, jobId);
    expect(initialStatus.progress.total).toBe(10);
    expect(initialStatus.progress.completed).toBe(0);
    expect(initialStatus.progress.failed).toBe(0);
    expect(initialStatus.progress.percentage).toBe(0);

    // Start the job
    manager.startNextQueuedJob();
    expect(requireJobStatus(manager, jobId).status).toBe('processing');

    // Simulate partial progress: 5 completed, 1 failed
    manager.updateJobStatus(jobId, {
      progress: { total: 10, completed: 5, failed: 1, percentage: 50 },
    });

    const midStatus = requireJobStatus(manager, jobId);
    expect(midStatus.progress.completed).toBe(5);
    expect(midStatus.progress.failed).toBe(1);
    expect(midStatus.progress.percentage).toBe(50);

    // Complete the job
    manager.updateJobStatus(jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: { total: 10, completed: 9, failed: 1, percentage: 100 },
    });

    const finalStatus = requireJobStatus(manager, jobId);
    expect(finalStatus.status).toBe('completed');
    expect(finalStatus.progress.completed).toBe(9);
    expect(finalStatus.progress.failed).toBe(1);
    expect(finalStatus.progress.percentage).toBe(100);
    expect(finalStatus.completedAt).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 5. Batch job cancellation doesn't affect parallel jobs
  // -------------------------------------------------------------------------
  test('バッチジョブのキャンセルが並列処理に影響しないこと', async () => {
    // Create and start 3 jobs
    const jobIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      jobIds.push(manager.createJob(makeFiles(5)));
    }
    for (let i = 0; i < 3; i++) {
      manager.startNextQueuedJob();
    }

    expect(manager.getRunningCount()).toBe(3);

    // Cancel the second job
    const cancelResult = manager.cancelJob(jobIds[1]);
    expect(cancelResult).toBe(true);

    // Verify the cancelled job state
    const cancelledStatus = requireJobStatus(manager, jobIds[1]);
    expect(cancelledStatus.status).toBe('cancelled');
    expect(cancelledStatus.completedAt).toBeDefined();

    // Verify cancel token is set
    expect(requireCancelToken(manager, jobIds[1]).cancelled).toBe(true);

    // The other two jobs should remain unaffected
    const job0Status = requireJobStatus(manager, jobIds[0]);
    const job2Status = requireJobStatus(manager, jobIds[2]);
    expect(job0Status.status).toBe('processing');
    expect(job2Status.status).toBe('processing');

    // Cancel tokens for other jobs should not be set
    expect(requireCancelToken(manager, jobIds[0]).cancelled).toBe(false);
    expect(requireCancelToken(manager, jobIds[2]).cancelled).toBe(false);

    // Running count should decrease by 1
    expect(manager.getRunningCount()).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 6. Full batch lifecycle
  // -------------------------------------------------------------------------
  test('バッチジョブのフルライフサイクル', async () => {
    // --- Phase 1: Create jobs ---
    const job1Id = manager.createJob(makeFiles(4), 'presentation', { lang: 'ja' });
    const job2Id = manager.createJob(makeFiles(6));
    const job3Id = manager.createJob(makeFiles(8));
    const job4Id = manager.createJob(makeFiles(2));

    // Verify initial state
    expect(manager.getQueuedCount()).toBe(4);
    expect(manager.getRunningCount()).toBe(0);

    // Verify preset and options are stored
    const job1Initial = requireJobStatus(manager, job1Id);
    expect(job1Initial.preset).toBe('presentation');
    expect(job1Initial.options).toEqual({ lang: 'ja' });
    expect(job1Initial.progress.total).toBe(4);

    // --- Phase 2: Start first 3 jobs ---
    manager.startNextQueuedJob(); // job1 -> processing
    manager.startNextQueuedJob(); // job2 -> processing
    manager.startNextQueuedJob(); // job3 -> processing

    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(1);

    // 4th cannot start yet
    expect(manager.startNextQueuedJob()).toBeNull();

    // --- Phase 3: Cancel job2 ---
    const cancelResult = manager.cancelJob(job2Id);
    expect(cancelResult).toBe(true);
    expect(manager.getRunningCount()).toBe(2);
    expect(manager.getQueuedCount()).toBe(1);

    // Cancelling an already-cancelled job should return 'already_terminal'
    const secondCancel = manager.cancelJob(job2Id);
    expect(secondCancel).toBe('already_terminal');

    // --- Phase 4: Queued job (job4) starts now that a slot is free ---
    const startedId = manager.startNextQueuedJob();
    expect(startedId).toBe(job4Id);
    expect(manager.getRunningCount()).toBe(3);
    expect(manager.getQueuedCount()).toBe(0);

    // --- Phase 5: Complete job1 with partial failures ---
    manager.updateJobStatus(job1Id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: { total: 4, completed: 3, failed: 1, percentage: 100 },
    });
    expect(requireJobStatus(manager, job1Id).status).toBe('completed');
    expect(requireJobStatus(manager, job1Id).progress.failed).toBe(1);
    expect(manager.getRunningCount()).toBe(2);

    // --- Phase 6: Fail job3 ---
    manager.updateJobStatus(job3Id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
    });
    expect(requireJobStatus(manager, job3Id).status).toBe('failed');
    expect(manager.getRunningCount()).toBe(1);

    // Cannot cancel a failed job
    const cancelFailed = manager.cancelJob(job3Id);
    expect(cancelFailed).toBe('already_terminal');

    // --- Phase 7: Complete job4 ---
    manager.updateJobStatus(job4Id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      progress: { total: 2, completed: 2, failed: 0, percentage: 100 },
    });
    expect(manager.getRunningCount()).toBe(0);

    // --- Phase 8: Verify final state ---
    // Non-existent job returns null
    expect(manager.getJobStatus('non-existent-id')).toBeNull();

    // Cancelling a non-existent job returns 'not_found'
    expect(manager.cancelJob('non-existent-id')).toBe('not_found');

    // All 4 jobs should still be tracked in the manager
    const allStatuses: BatchJobStatus[] = [];
    for (const id of [job1Id, job2Id, job3Id, job4Id]) {
      allStatuses.push(requireJobStatus(manager, id));
    }

    const states = allStatuses.map((s) => s.status);
    expect(states).toContain('completed');
    expect(states).toContain('cancelled');
    expect(states).toContain('failed');

    // No jobs should be queued or running
    expect(manager.getQueuedCount()).toBe(0);
    expect(manager.getRunningCount()).toBe(0);
  });
});
