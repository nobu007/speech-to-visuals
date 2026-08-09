/**
 * Tests for ProductionExporter (REQ-252)
 *
 * Covers:
 * - Job lifecycle (create → process → complete)
 * - NaN processingTime fix in finalizeExport metadata
 * - Job cancellation
 * - Statistics reporting
 * - Preset management
 * - Fps validation guard
 */

import { ProductionExporter } from '../production-exporter';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import { BATCH_LIMITS } from '@/config/limits';
import type { EnhancedSceneGraph } from '@/visualization/advanced-visual-engine';

// Minimal valid scene for testing
function createMinimalScene(overrides: Partial<EnhancedSceneGraph> = {}): EnhancedSceneGraph {
  return {
    id: 'test-scene',
    title: 'Test Scene',
    background: { type: 'solid', color: '#ffffff' },
    durationMs: 1000,
    layout: {
      nodes: [
        { id: 'n1', label: 'Node 1', x: 100, y: 100, width: 120, height: 60 },
      ],
      edges: [],
    },
    animations: [],
    ...overrides,
  } as unknown as EnhancedSceneGraph;
}

const baseOptions = {
  width: 1280,
  height: 720,
  fps: 30,
  quality: 'standard' as const,
  format: 'mp4',
};

describe('ProductionExporter', () => {
  describe('createExportJob - validation', () => {
    it('should reject zero fps', async () => {
      const exporter = new ProductionExporter();
      await expect(
        exporter.createExportJob('test', [createMinimalScene()], { ...baseOptions, fps: 0 }),
      ).rejects.toThrow(PipelineConfigError);
    });

    it('should reject negative fps', async () => {
      const exporter = new ProductionExporter();
      await expect(
        exporter.createExportJob('test', [createMinimalScene()], { ...baseOptions, fps: -5 }),
      ).rejects.toThrow(PipelineConfigError);
    });

    it('should accept valid fps and return a job ID', async () => {
      const exporter = new ProductionExporter(2);
      const jobId = await exporter.createExportJob('test', [createMinimalScene()], baseOptions);
      expect(jobId).toMatch(/^export-\d+-[a-f0-9]+$/);
    });
  });

  describe('job lifecycle', () => {
    it('should process a job and reach complete status', async () => {
      const exporter = new ProductionExporter(1);
      const jobId = await exporter.createExportJob(
        'lifecycle-test',
        [createMinimalScene()],
        baseOptions,
      );

      // Poll for completion (max ~5s)
      const deadline = Date.now() + 5000;
      let job = exporter.getJobStatus(jobId);
      while (job && job.status !== 'complete' && job.status !== 'error' && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        job = exporter.getJobStatus(jobId);
      }

      expect(job).not.toBeNull();
      expect(job!.status).toBe('complete');
      expect(job!.progress).toBe(100);
      expect(job!.outputPath).toBeDefined();
      expect(job!.startTime).toBeDefined();
      expect(job!.endTime).toBeDefined();
    }, 10000);

    it('should report valid (non-NaN) processing time in statistics', async () => {
      const exporter = new ProductionExporter(1);
      const jobId = await exporter.createExportJob(
        'stats-test',
        [createMinimalScene()],
        baseOptions,
      );

      // Wait for completion
      const deadline = Date.now() + 5000;
      let job = exporter.getJobStatus(jobId);
      while (job && job.status !== 'complete' && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        job = exporter.getJobStatus(jobId);
      }

      const stats = exporter.getStatistics();
      expect(stats.completed).toBe(1);
      const avgTime = stats.averageProcessingTime as number;
      expect(avgTime).not.toBeNaN();
      expect(avgTime).toBeGreaterThan(0);
    }, 10000);
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', async () => {
      const exporter = new ProductionExporter(1);
      // Fill the active slot first
      await exporter.createExportJob('blocking', [createMinimalScene({ durationMs: 3000 })], baseOptions);
      // Queue a second job
      const jobId2 = await exporter.createExportJob('queued', [createMinimalScene()], baseOptions);

      const cancelled = exporter.cancelJob(jobId2);
      expect(cancelled).toBe(true);

      const job = exporter.getJobStatus(jobId2);
      expect(job!.status).toBe('error');
      expect(job!.error).toBe('Cancelled by user');
    });

    it('should return false for unknown job ID', () => {
      const exporter = new ProductionExporter();
      expect(exporter.cancelJob('nonexistent')).toBe(false);
    });

    it('should return false for already completed job', async () => {
      const exporter = new ProductionExporter(1);
      const jobId = await exporter.createExportJob('to-complete', [createMinimalScene()], baseOptions);

      // Wait for completion
      const deadline = Date.now() + 5000;
      let job = exporter.getJobStatus(jobId);
      while (job && job.status !== 'complete' && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
        job = exporter.getJobStatus(jobId);
      }

      expect(exporter.cancelJob(jobId)).toBe(false);
    }, 10000);
  });

  describe('getStatistics', () => {
    it('should report zero stats for empty exporter', () => {
      const exporter = new ProductionExporter();
      const stats = exporter.getStatistics();
      expect(stats.totalJobs).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });
  });

  describe('presets', () => {
    it('should return available presets', () => {
      const exporter = new ProductionExporter();
      const presets = exporter.getExportPresets();
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.some(p => p.name === 'YouTube HD')).toBe(true);
    });

    it('should create job from preset', async () => {
      const exporter = new ProductionExporter(1);
      const jobId = await exporter.createJobFromPreset('preset-test', [createMinimalScene()], 'Web Optimized');
      expect(jobId).toMatch(/^export-/);
    });

    it('should throw for unknown preset', async () => {
      const exporter = new ProductionExporter();
      await expect(
        exporter.createJobFromPreset('test', [createMinimalScene()], 'Nonexistent Preset'),
      ).rejects.toThrow(PipelineConfigError);
    });
  });

  describe('concurrency', () => {
    it('should respect maxConcurrentJobs limit', async () => {
      const exporter = new ProductionExporter(1);
      // Start first job (fills the 1 slot)
      const id1 = await exporter.createExportJob(
        'long-job',
        [createMinimalScene({ durationMs: 3000 })],
        baseOptions,
      );
      // Queue second job
      const id2 = await exporter.createExportJob(
        'queued-job',
        [createMinimalScene()],
        baseOptions,
      );

      const job2 = exporter.getJobStatus(id2);
      expect(job2!.status).toBe('queued');

      // Stats should show 1 active, 1 queued
      const stats = exporter.getStatistics();
      expect(stats.active).toBe(1);
      expect(stats.queued).toBe(1);

      // Cleanup
      exporter.cancelJob(id1);
      exporter.cancelJob(id2);
    });
  });

  // ---------------------------------------------------------------------------
  // Capacity: the in-memory jobs Map must be pruned (09o)
  // The `productionExporter` singleton never deletes completed jobs, so without
  // pruning the Map grows without bound for status lookups. The sibling
  // JobStore (batch-processing-api.ts) caps via BATCH_LIMITS.MAX_STORED_JOBS;
  // ProductionExporter now mirrors it (terminal-only eviction).
  // ---------------------------------------------------------------------------

  describe('jobs Map capacity (pruneCompletedJobs)', () => {
    it('prunes terminal jobs when the store exceeds MAX_STORED_JOBS', async () => {
      const exporter = new ProductionExporter();
      // Prevent fire-and-forget processing so the test stays deterministic.
      (exporter as unknown as { maxConcurrentJobs: number }).maxConcurrentJobs = 0;
      const jobs = (exporter as unknown as { jobs: Map<string, { status: string }> }).jobs;

      // Seed well over the cap with terminal jobs that would otherwise accumulate forever.
      const seeded = BATCH_LIMITS.MAX_STORED_JOBS + 50;
      for (let i = 0; i < seeded; i++) {
        jobs.set(`seed-complete-${i}`, { status: 'complete' });
      }
      expect(jobs.size).toBe(seeded);

      // Creating one more job runs pruneCompletedJobs() before the insert.
      await exporter.createExportJob('prune-test', [createMinimalScene()], baseOptions);

      // Prune trims back to the cap (oldest terminal jobs evicted), then the new job is inserted.
      expect(jobs.size).toBe(BATCH_LIMITS.MAX_STORED_JOBS + 1);
      expect(jobs.has('seed-complete-0')).toBe(false);   // oldest terminal evicted
      expect(jobs.has('seed-complete-49')).toBe(false);  // 50 evicted total
      expect(jobs.has('seed-complete-50')).toBe(true);   // remainder retained
    });

    it('never prunes non-terminal (queued) jobs even when over the cap', async () => {
      const exporter = new ProductionExporter();
      (exporter as unknown as { maxConcurrentJobs: number }).maxConcurrentJobs = 0;
      const jobs = (exporter as unknown as { jobs: Map<string, { status: string }> }).jobs;

      // Over-cap but ALL non-terminal — the documented stuck-job trade-off:
      // a job a client may still poll must never be dropped.
      const seeded = BATCH_LIMITS.MAX_STORED_JOBS + 5;
      for (let i = 0; i < seeded; i++) {
        jobs.set(`seed-queued-${i}`, { status: 'queued' });
      }

      await exporter.createExportJob('no-prune', [createMinimalScene()], baseOptions);

      // Nothing terminal to reclaim → every queued job retained + the new job.
      expect(jobs.size).toBe(seeded + 1);
      expect(jobs.has('seed-queued-0')).toBe(true);
    });
  });
});
