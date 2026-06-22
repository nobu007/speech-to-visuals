/**
 * Tests for resolution bounds validation in the pipeline render route.
 *
 * Verifies that extremely large resolution values are rejected to prevent
 * resource exhaustion (e.g., 99999x99999 would allocate huge buffers).
 */
import { describe, it, expect } from '@jest/globals';
import { PIPELINE_LIMITS } from '../../config/limits';

// Replicate the Zod schema from pipeline.ts to test validation in isolation
import { z } from 'zod';

const RESOLUTION_REGEX = /^\d{1,5}x\d{1,5}$/;

const ResolutionSchema = z.string().max(50).regex(RESOLUTION_REGEX, 'resolution must be in WIDTHxHEIGHT format (e.g. 1920x1080)').refine(
  (val) => {
    const [w, h] = val.split('x').map(Number);
    return w <= PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION && h <= PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION;
  },
  `resolution dimensions must not exceed ${PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION}px`,
).optional();

describe('Pipeline resolution validation', () => {
  it('should accept standard 1080p resolution', () => {
    const result = ResolutionSchema.safeParse('1920x1080');
    expect(result.success).toBe(true);
  });

  it('should accept standard 720p resolution', () => {
    const result = ResolutionSchema.safeParse('1280x720');
    expect(result.success).toBe(true);
  });

  it('should accept 4K resolution', () => {
    const result = ResolutionSchema.safeParse('3840x2160');
    expect(result.success).toBe(true);
  });

  it('should accept 8K resolution (boundary)', () => {
    const result = ResolutionSchema.safeParse('7680x4320');
    expect(result.success).toBe(true);
  });

  it('should accept square resolution within bounds', () => {
    const result = ResolutionSchema.safeParse('1080x1080');
    expect(result.success).toBe(true);
  });

  it('should reject resolution exceeding max dimension (width)', () => {
    const result = ResolutionSchema.safeParse('99999x1080');
    expect(result.success).toBe(false);
  });

  it('should reject resolution exceeding max dimension (height)', () => {
    const result = ResolutionSchema.safeParse('1920x99999');
    expect(result.success).toBe(false);
  });

  it('should reject resolution exceeding max dimension (both)', () => {
    const result = ResolutionSchema.safeParse('99999x99999');
    expect(result.success).toBe(false);
  });

  it('should reject resolution just above 8K boundary', () => {
    const over = PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION + 1;
    const result = ResolutionSchema.safeParse(`${over}x1080`);
    expect(result.success).toBe(false);
  });

  it('should reject malformed resolution (no x)', () => {
    const result = ResolutionSchema.safeParse('19201080');
    expect(result.success).toBe(false);
  });

  it('should reject malformed resolution (letters)', () => {
    const result = ResolutionSchema.safeParse('1920xabc');
    expect(result.success).toBe(false);
  });

  it('should accept undefined (optional field)', () => {
    const result = ResolutionSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});
