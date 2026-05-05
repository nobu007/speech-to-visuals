/**
 * Export Worker tests
 *
 * Tests the processExportPayload function and worker message handling.
 * Workers are tested via their exported processing functions
 * since Vitest runs in Node environment.
 */

import { describe, it, expect } from 'vitest';
import { processExportPayload } from '../export-worker';
import type { ExportWorkerPayload } from '../types';

describe('processExportPayload', () => {
  it('should process valid export payload', () => {
    const payload: ExportWorkerPayload = {
      format: 'mp4',
      data: {
        scenes: [
          { id: 1, frames: 30 },
          { id: 2, frames: 30 },
        ],
      },
      options: { fps: 30, duration: 10, avgFrameSize: 50000 },
    };

    const result = processExportPayload(payload);

    expect(result.outputSize).toBe(30 * 10 * 50000);
    expect(result.duration).toBe(10);
    expect(result.warnings).toEqual([]);
  });

  it('should warn on large frame counts', () => {
    const payload: ExportWorkerPayload = {
      format: 'mp4',
      data: { scenes: [] },
      options: { fps: 120, duration: 30 },
    };

    const result = processExportPayload(payload);

    expect(result.warnings).toContain(
      'Large frame count (3600): consider reducing duration or fps',
    );
  });

  it('should warn on long GIF duration', () => {
    const payload: ExportWorkerPayload = {
      format: 'gif',
      data: { scenes: [] },
      options: { fps: 15, duration: 60 },
    };

    const result = processExportPayload(payload);

    expect(result.warnings).toContain(
      'GIF format for long durations produces very large files',
    );
  });

  it('should handle invalid data gracefully', () => {
    const payload: ExportWorkerPayload = {
      format: 'mp4',
      data: null as unknown as Record<string, unknown>,
      options: {},
    };

    const result = processExportPayload(payload);

    expect(result.warnings).toContain('Invalid export data provided');
  });

  it('should use default fps and duration when not specified', () => {
    const payload: ExportWorkerPayload = {
      format: 'mp4',
      data: { scenes: [] },
      options: {},
    };

    const result = processExportPayload(payload);

    expect(result.duration).toBe(10);
    expect(result.outputSize).toBe(300 * 50000); // 10s * 30fps * 50KB
  });
});
