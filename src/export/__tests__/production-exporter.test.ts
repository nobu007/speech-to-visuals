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
});
