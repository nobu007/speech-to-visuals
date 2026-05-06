/**
 * ISS-027: Batch route preset enum validation tests
 *
 * Verifies that the POST /api/v1/batch/jobs endpoint rejects
 * invalid preset values and accepts valid ones.
 */

import { createBatchRouter, BatchJobManager } from '@/api/routes/batch';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/batch', createBatchRouter());
  return app;
}

function makeFiles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `file-${i}.wav`,
    path: `/audio/file-${i}.wav`,
  }));
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ISS-027: Batch preset validation', () => {
  const app = createApp();

  const validPresets = ['fast', 'balanced', 'quality', 'custom'];

  test.each(validPresets)('should accept preset "%s"', async (preset) => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: makeFiles(1), preset });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('queued');
  });

  test('should accept request without preset (optional)', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: makeFiles(1) });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });

  test('should reject invalid preset value', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: makeFiles(1), preset: 'ultra' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('preset');
  });

  test('should reject preset with uppercase value', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: makeFiles(1), preset: 'FAST' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject preset with empty string', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: makeFiles(1), preset: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
