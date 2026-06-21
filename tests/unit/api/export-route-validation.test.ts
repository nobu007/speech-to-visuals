/**
 * Tests: GET /api/v1/export/artifacts format query parameter validation
 *
 * Verifies that invalid format values are rejected with 400, and valid
 * formats (including omitted format) pass through to the store.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createExportRouter } from '@/api/routes/export';
import type { ExportArtifactStore } from '@/export/export-artifact-store';

// ---------------------------------------------------------------------------
// Mock artifact store
// ---------------------------------------------------------------------------

const mockStore = {
  list: jest.fn().mockReturnValue({ artifacts: [], total: 0, limit: 50, offset: 0 }),
  getMetadata: jest.fn(),
  resolveDownloadUrl: jest.fn(),
  remove: jest.fn(),
  getUsage: jest.fn(),
} as unknown as jest.Mocked<ExportArtifactStore>;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/v1/export', createExportRouter(mockStore));

beforeEach(() => {
  jest.clearAllMocks();
  (mockStore.list as jest.Mock).mockReturnValue({
    artifacts: [],
    total: 0,
    limit: 50,
    offset: 0,
  });
});

// ---------------------------------------------------------------------------
// Format validation tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/export/artifacts - format validation', () => {
  it('rejects invalid format with 400', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=malicious');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Invalid format');
    expect(mockStore.list).not.toHaveBeenCalled();
  });

  it('rejects XSS payload in format parameter', async () => {
    const res = await request(app).get(
      '/api/v1/export/artifacts?format=<script>alert(1)</script>',
    );

    expect(res.status).toBe(400);
    expect(mockStore.list).not.toHaveBeenCalled();
  });

  it('rejects path traversal in format parameter', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=../../../etc/passwd');

    expect(res.status).toBe(400);
    expect(mockStore.list).not.toHaveBeenCalled();
  });

  it('accepts valid format: svg', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=svg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockStore.list).toHaveBeenCalledWith({ format: 'svg', limit: 50, offset: 0 });
  });

  it('accepts valid format: interactive-html', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=interactive-html');

    expect(res.status).toBe(200);
    expect(mockStore.list).toHaveBeenCalledWith({
      format: 'interactive-html',
      limit: 50,
      offset: 0,
    });
  });

  it('accepts valid format: pdf-animated', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=pdf-animated');

    expect(res.status).toBe(200);
  });

  it('accepts valid format: json-lottie', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=json-lottie');

    expect(res.status).toBe(200);
  });

  it('accepts all formats defined in FORMAT_MIME', async () => {
    const validFormats = [
      'mp4',
      'webm',
      'gif',
      'apng',
      'interactive-html',
      'pdf-animated',
      'svg-animated',
      'json-lottie',
      'json',
      'svg',
      'pdf',
      'html',
    ];

    for (const fmt of validFormats) {
      const res = await request(app).get(`/api/v1/export/artifacts?format=${fmt}`);
      expect(res.status).toBe(200);
    }

    expect(mockStore.list).toHaveBeenCalledTimes(validFormats.length);
  });

  it('accepts omitted format (no filter)', async () => {
    const res = await request(app).get('/api/v1/export/artifacts');

    expect(res.status).toBe(200);
    expect(mockStore.list).toHaveBeenCalledWith({ format: undefined, limit: 50, offset: 0 });
  });

  it('rejects empty string format', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=');

    expect(res.status).toBe(400);
    expect(mockStore.list).not.toHaveBeenCalled();
  });

  it('rejects SQL injection attempt in format', async () => {
    const res = await request(app).get("/api/v1/export/artifacts?format=svg' OR '1'='1");

    expect(res.status).toBe(400);
    expect(mockStore.list).not.toHaveBeenCalled();
  });
});
