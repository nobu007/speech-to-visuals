/**
 * HTTP integration tests for adversarial resolution inputs.
 *
 * Unlike the unit-level Zod schema tests in pipeline-resolution-validation.test.ts,
 * these tests exercise the full HTTP request path: body parsing → Zod validation →
 * error response. This verifies that adversarial resolution values are rejected
 * at the HTTP layer, not just at the schema level.
 */
import express from 'express';
import request from 'supertest';
import { createPipelineRouter, PipelineStateManager } from '../pipeline';
import { PIPELINE_LIMITS } from '@stv/core/config/limits';

function createApp() {
  const app = express();
  app.use(express.json());
  const noopLimiter: express.RequestHandler = (_req, _res, next) => next();
  app.use('/api', createPipelineRouter(new PipelineStateManager(), noopLimiter));
  return app;
}

describe('POST /api/render resolution bounds — HTTP integration', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  // -------------------------------------------------------------------------
  // Valid resolutions (should succeed)
  // -------------------------------------------------------------------------

  it('should accept 1920x1080 at HTTP layer', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920x1080' } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should accept 8K boundary 7680x4320', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '7680x4320' } });

    expect(res.status).toBe(200);
  });

  it('should accept exact max dimension 8640x8640', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '8640x8640' } });

    expect(res.status).toBe(200);
  });

  it('should accept 1x1 (minimum valid)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1x1' } });

    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Adversarial: oversized dimensions (resource exhaustion attempts)
  // -------------------------------------------------------------------------

  it('should reject 99999x1080 (width exceeds max)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '99999x1080' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('8640');
  });

  it('should reject 1920x99999 (height exceeds max)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920x99999' } });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('8640');
  });

  it('should reject 99999x99999 (both exceed max)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '99999x99999' } });

    expect(res.status).toBe(400);
  });

  it('should reject 8641x1080 (one pixel over boundary)', async () => {
    const over = PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION + 1;
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: `${over}x1080` } });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('8640');
  });

  it('should reject 1080x8641 (one pixel over boundary height)', async () => {
    const over = PIPELINE_LIMITS.MAX_RESOLUTION_DIMENSION + 1;
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: `1080x${over}` } });

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Adversarial: malformed strings (injection attempts)
  // -------------------------------------------------------------------------

  it('should reject resolution with CRLF injection attempt', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920\r\nx1080' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject resolution with null byte', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920\0x1080' } });

    expect(res.status).toBe(400);
  });

  it('should reject resolution with semicolons (header injection attempt)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920x1080; foo=bar' } });

    expect(res.status).toBe(400);
  });

  it('should reject resolution with spaces', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920 x 1080' } });

    expect(res.status).toBe(400);
  });

  it('should reject resolution with multiple x separators', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1920xx1080' } });

    expect(res.status).toBe(400);
  });

  it('should reject empty string resolution', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '' } });

    expect(res.status).toBe(400);
  });

  it('should reject very long resolution string (potential DoS)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: '1'.repeat(100) + 'x1080' } });

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Adversarial: type confusion
  // -------------------------------------------------------------------------

  it('should reject numeric resolution (type confusion)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: 19201080 } });

    expect(res.status).toBe(400);
  });

  it('should reject array resolution (type confusion)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: ['1920x1080'] } });

    expect(res.status).toBe(400);
  });

  it('should reject object resolution (type confusion)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: { width: 1920, height: 1080 } } });

    expect(res.status).toBe(400);
  });

  it('should reject null resolution (type confusion)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }], options: { resolution: null } });

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Combination attacks: adversarial resolution + other malicious fields
  // -------------------------------------------------------------------------

  it('should reject when both resolution and codec are adversarial', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({
        scenes: [{ id: 1 }],
        options: {
          resolution: '99999x99999',
          codec: 'malware-injection',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject when both resolution and fps are adversarial', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({
        scenes: [{ id: 1 }],
        options: {
          resolution: '99999x99999',
          fps: 99999,
        },
      });

    expect(res.status).toBe(400);
  });

  it('should reject path traversal outputName with adversarial resolution', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({
        scenes: [{ id: 1 }],
        outputName: '../../../etc/passwd',
        options: { resolution: '99999x99999' },
      });

    expect(res.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Boundary: valid resolution alongside other valid options
  // -------------------------------------------------------------------------

  it('should accept valid resolution with valid fps and codec', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({
        scenes: [{ id: 1 }],
        options: { resolution: '3840x2160', fps: 60, codec: 'h265' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should accept request without options.resolution (optional)', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({
        scenes: [{ id: 1 }],
        options: { fps: 30 },
      });

    expect(res.status).toBe(200);
  });

  it('should accept request without options entirely', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }] });

    expect(res.status).toBe(200);
  });
});
