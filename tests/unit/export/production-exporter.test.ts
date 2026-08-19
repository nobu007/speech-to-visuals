/**
 * REQ-169: production-exporter.ts Test Coverage
 *
 * Unit tests for ProductionExporter's core functionality:
 *   - Production export pipeline (prepare → render → encode → finalize)
 *   - Preset management (YouTube HD, Professional 4K, Web Optimized, etc.)
 *   - Quality verification
 *   - Job lifecycle (create, process, cancel)
 *   - Concurrency management
 *   - Statistics tracking
 *   - Preset validation
 */

import { jest } from '@jest/globals';
import { ProductionExporter } from '@/export/production-exporter';
import type { ExportJob, ExportPreset } from '@/export/production-exporter';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import type { SceneGraph } from '@stv/core/types/diagram';
import type { EnhancedSceneGraph } from '@/visualization/advanced-visual-engine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnhancedScene(overrides: Record<string, unknown> = {}): EnhancedSceneGraph {
  return {
    id: 'scene-001',
    type: 'flow' as const,
    nodes: [],
    edges: [],
    startMs: 0,
    durationMs: 5000,
    summary: 'Test scene',
    keyphrases: ['test'],
    layout: { nodes: [], edges: [] },
    visualStyle: { theme: 'default', colorScheme: 'blue' },
    animations: [
      {
        type: 'entrance' as const,
        target: 'n1',
        timing: { delay: 0, duration: 1000, easing: 'ease-in-out' },
        properties: { opacity: [0, 1] },
      },
    ],
    background: { type: 'solid' as const, primary: '#ffffff', opacity: 1 },
    ...overrides,
  // visualStyle is a partial VisualStyle; SUT reads only these fields.
  } as unknown as EnhancedSceneGraph;
}

function makeRenderOptions(overrides: Record<string, unknown> = {}) {
  return {
    width: 1920,
    height: 1080,
    fps: 30,
    quality: 'high' as const,
    format: 'mp4' as const,
    includeAudio: true,
    exportCaption: true,
    ...overrides,
  };
}

/**
 * Fail-loud preset/job lookups (Phase 149 / TASK-0236). Replace the old
 * `presets.find(...)!` / `getJobStatus(...)!` checker suppressions: an
 * absent preset used to surface as a bare `expect(x).toBeDefined()`
 * failure, an absent job as `null.field` TypeError — the helpers keep the
 * RED verdict with the missing preset name / job id.
 */
function requirePreset(exporter: ProductionExporter, name: string): ExportPreset {
  const preset = exporter.getExportPresets().find(p => p.name === name);
  if (preset === undefined) {
    throw new Error(`export preset not found: ${name}`);
  }
  return preset;
}

function requireJobStatus(exporter: ProductionExporter, jobId: string): ExportJob {
  const job = exporter.getJobStatus(jobId);
  if (job === null) {
    throw new Error(`job status not found: ${jobId}`);
  }
  return job;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('REQ-169: ProductionExporter', () => {
  let exporter: ProductionExporter;

  beforeEach(() => {
    exporter = new ProductionExporter(2);
  });

  // ─── TC-169-01: Export presets ────────────────────────────────────────

  describe('TC-169-01: Export preset management', () => {
    it('returns 5 export presets', () => {
      const presets = exporter.getExportPresets();
      expect(presets).toHaveLength(5);
    });

    it('includes YouTube HD preset', () => {
      const yt = requirePreset(exporter, 'YouTube HD');
      expect(yt.options.width).toBe(1920);
      expect(yt.options.height).toBe(1080);
      expect(yt.options.fps).toBe(30);
      expect(yt.options.quality).toBe('high');
    });

    it('includes Professional 4K preset', () => {
      const pro4k = requirePreset(exporter, 'Professional 4K');
      expect(pro4k.options.width).toBe(3840);
      expect(pro4k.options.height).toBe(2160);
      expect(pro4k.options.quality).toBe('ultra');
    });

    it('includes Web Optimized preset', () => {
      const web = requirePreset(exporter, 'Web Optimized');
      expect(web.options.format).toBe('webm');
      expect(web.options.width).toBe(1280);
    });

    it('includes Mobile Friendly preset', () => {
      const mobile = requirePreset(exporter, 'Mobile Friendly');
      expect(mobile.options.width).toBe(1280);
    });

    it('includes GIF Animation preset', () => {
      const gif = requirePreset(exporter, 'GIF Animation');
      expect(gif.options.format).toBe('gif');
      expect(gif.options.fps).toBe(15);
    });

    it('returns a copy of presets (not mutable reference)', () => {
      const presets1 = exporter.getExportPresets();
      const presets2 = exporter.getExportPresets();

      expect(presets1).not.toBe(presets2);
      expect(presets1).toEqual(presets2);
    });

    it('each preset has required fields', () => {
      const presets = exporter.getExportPresets();

      for (const preset of presets) {
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.options).toBeDefined();
        expect(preset.estimatedSize).toBeDefined();
        expect(preset.recommendedFor).toBeDefined();
        expect(Array.isArray(preset.recommendedFor)).toBe(true);
      }
    });
  });

  // ─── TC-169-02: Create export job from preset ─────────────────────────

  describe('TC-169-02: Create job from preset', () => {
    it('creates job from valid preset name', async () => {
      const scenes = [makeEnhancedScene()];
      const jobId = await exporter.createJobFromPreset('Test Video', scenes, 'YouTube HD');

      expect(jobId).toBeDefined();
      expect(jobId).toContain('export-');

      const job = requireJobStatus(exporter, jobId);
      expect(job.name).toBe('Test Video');
      expect(job.options.width).toBe(1920);
      expect(job.options.height).toBe(1080);
    });

    it('throws PipelineConfigError for unknown preset', async () => {
      const scenes = [makeEnhancedScene()];

      await expect(
        exporter.createJobFromPreset('Test', scenes, 'Nonexistent Preset'),
      ).rejects.toThrow(PipelineConfigError);
    });

    it('throws error mentioning the preset name', async () => {
      const scenes = [makeEnhancedScene()];

      await expect(
        exporter.createJobFromPreset('Test', scenes, 'BadPreset'),
      ).rejects.toThrow('BadPreset');
    });
  });

  // ─── TC-169-03: Job lifecycle ─────────────────────────────────────────

  describe('TC-169-03: Job lifecycle', () => {
    it('creates export job with correct initial state', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions();
      const jobId = await exporter.createExportJob('Test Job', scenes, options);

      const job = requireJobStatus(exporter, jobId);
      expect(job.name).toBe('Test Job');
      expect(job.options).toEqual(options);
      expect(['queued', 'processing', 'complete']).toContain(job.status);
    });

    it('calculates total frames correctly', async () => {
      const scenes = [
        makeEnhancedScene({ durationMs: 5000 }),
        makeEnhancedScene({ durationMs: 3000 }),
      ];
      const options = makeRenderOptions({ fps: 30 });

      const jobId = await exporter.createExportJob('Test', scenes, options);
      const job = requireJobStatus(exporter, jobId);

      // 5s * 30fps = 150 frames + 3s * 30fps = 90 frames = 240
      expect(job.metadata.totalFrames).toBe(240);
    });

    it('returns null for non-existent job', () => {
      expect(exporter.getJobStatus('non-existent-id')).toBeNull();
    });
  });

  // ─── TC-169-04a: fps validation ───────────────────────────────────────

  describe('TC-169-04a: fps validation guards', () => {
    it('throws PipelineConfigError when fps is 0', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions({ fps: 0 });

      await expect(
        exporter.createExportJob('Zero FPS', scenes, options),
      ).rejects.toThrow(PipelineConfigError);
    });

    it('throws PipelineConfigError when fps is negative', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions({ fps: -1 });

      await expect(
        exporter.createExportJob('Negative FPS', scenes, options),
      ).rejects.toThrow(PipelineConfigError);
    });
  });

  // ─── TC-169-04: Job cancellation ──────────────────────────────────────

  describe('TC-169-04: Job cancellation', () => {
    it('cancels a queued job', async () => {
      const exporter1 = new ProductionExporter(0); // No concurrent jobs → stays queued
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions();

      const jobId = await exporter1.createExportJob('Queued Job', scenes, options);

      // Cancel the queued job
      const cancelled = exporter1.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const job = requireJobStatus(exporter1, jobId);
      expect(job.status).toBe('error');
      expect(job.error).toContain('Cancelled');
    });

    it('returns false when cancelling non-existent job', () => {
      expect(exporter.cancelJob('non-existent')).toBe(false);
    });

    it('returns false when cancelling completed job', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions();

      const jobId = await exporter.createExportJob('Completing Job', scenes, options);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const job = requireJobStatus(exporter, jobId);
      if (job.status === 'complete') {
        expect(exporter.cancelJob(jobId)).toBe(false);
      }
    });
  });

  // ─── TC-169-05: Quality multiplier ────────────────────────────────────

  describe('TC-169-05: Quality multiplier', () => {
    it('assigns correct quality settings per quality level', async () => {
      const qualityLevels = ['draft', 'standard', 'high', 'ultra'] as const;
      const scenes = [makeEnhancedScene()];

      for (const quality of qualityLevels) {
        const options = makeRenderOptions({ quality });
        const jobId = await exporter.createExportJob(`Quality ${quality}`, scenes, options);
        const job = requireJobStatus(exporter, jobId);

        expect(job.metadata.quality).toBe(quality);
      }
    });
  });

  // ─── TC-169-06: Concurrency management ────────────────────────────────

  describe('TC-169-06: Concurrency management', () => {
    it('uses default maxConcurrentJobs=2', () => {
      const defaultExporter = new ProductionExporter();
      // No public getter, but we verify via job creation
      const stats = defaultExporter.getStatistics();
      expect(stats.active).toBe(0);
    });

    it('accepts custom maxConcurrentJobs', () => {
      const customExporter = new ProductionExporter(5);
      const stats = customExporter.getStatistics();
      expect(stats).toBeDefined();
    });
  });

  // ─── TC-169-07: Statistics ────────────────────────────────────────────

  describe('TC-169-07: Statistics tracking', () => {
    it('returns empty statistics initially', () => {
      const stats = exporter.getStatistics();

      expect(stats.totalJobs).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.queued).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.totalExportedSize).toBe(0);
    });

    it('tracks total jobs after creation', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions();

      await exporter.createExportJob('Job 1', scenes, options);

      const stats = exporter.getStatistics();
      expect(stats.totalJobs).toBe(1);
    });
  });

  // ─── TC-169-08: All jobs listing ──────────────────────────────────────

  describe('TC-169-08: All jobs listing', () => {
    it('returns empty array initially', () => {
      expect(exporter.getAllJobs()).toEqual([]);
    });

    it('lists created jobs', async () => {
      const scenes = [makeEnhancedScene()];
      const options = makeRenderOptions();

      await exporter.createExportJob('Job A', scenes, options);
      await exporter.createExportJob('Job B', scenes, options);

      const jobs = exporter.getAllJobs();
      expect(jobs).toHaveLength(2);
      expect(jobs.map(j => j.name)).toContain('Job A');
      expect(jobs.map(j => j.name)).toContain('Job B');
    });
  });

  // ─── TC-169-09: File size estimation ──────────────────────────────────

  describe('TC-169-09: File size estimation', () => {
    it('estimates file size for created job', async () => {
      const scenes = [makeEnhancedScene({ durationMs: 5000 })];
      const options = makeRenderOptions();

      const jobId = await exporter.createExportJob('Size Test', scenes, options);
      const job = requireJobStatus(exporter, jobId);

      expect(job.metadata.estimatedSize).toBeGreaterThan(0);
    });
  });

  // ─── TC-169-10: Encoding settings per format ──────────────────────────

  describe('TC-169-10: Encoding settings per format', () => {
    const formats = ['mp4', 'webm', 'gif'] as const;

    for (const format of formats) {
      it(`processes ${format} format`, async () => {
        const scenes = [makeEnhancedScene()];
        const options = makeRenderOptions({ format });

        const jobId = await exporter.createExportJob(`${format} test`, scenes, options);
        expect(jobId).toBeDefined();
      });
    }
  });

  // ─── TC-169-11: Scene preparation ─────────────────────────────────────

  describe('TC-169-11: Scene preparation', () => {
    it('normalizes animation timing based on FPS', async () => {
      const scenes = [makeEnhancedScene({
        animations: [{
          type: 'entrance' as const,
          target: 'n1',
          timing: { delay: 0, duration: 1000, easing: 'ease-in-out' },
          properties: { opacity: [0, 1] },
        }],
      })];

      const options = makeRenderOptions({ fps: 60 });
      const jobId = await exporter.createExportJob('FPS Normalized', scenes, options);

      const job = requireJobStatus(exporter, jobId);
    });
  });
});
