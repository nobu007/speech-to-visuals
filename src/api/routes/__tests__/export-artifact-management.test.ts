/**
 * REQ-238~240: Export Artifact Management API Tests (Phase 103)
 *
 * Tests for:
 * - GET    /api/v1/export/artifacts           — List artifacts
 * - GET    /api/v1/export/artifacts/:id        — Get artifact metadata
 * - DELETE /api/v1/export/artifacts/:id        — Delete artifact
 * - GET    /api/v1/export/artifacts/usage      — Usage statistics
 */

import express from 'express';
import request from 'supertest';
import { createExportRouter } from '../export';
import { ExportArtifactStore } from '../../../export/export-artifact-store';

function createApp() {
  const store = new ExportArtifactStore({
    maxArtifacts: 20,
    maxStorageBytes: 100_000,
    defaultTtlMs: 60_000,
    downloadUrlTtlMs: 30_000,
    cleanupIntervalMs: 60_000,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportRouter(store));
  return { app, store };
}

describe('Export Artifact Management API (REQ-238~240)', () => {
  let app: express.Express;
  let store: ExportArtifactStore;

  beforeEach(() => {
    ({ app, store } = createApp());
  });

  // -- GET /artifacts (REQ-238) --------------------------------------------

  describe('GET /api/v1/export/artifacts', () => {
    it('returns empty list when no artifacts exist', async () => {
      const res = await request(app).get('/api/v1/export/artifacts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.artifacts).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('returns all stored artifacts', async () => {
      store.store({ format: 'svg', data: new Uint8Array(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: new Uint8Array(20), sizeBytes: 20 });

      const res = await request(app).get('/api/v1/export/artifacts');

      expect(res.status).toBe(200);
      expect(res.body.data.artifacts).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
    });

    it('filters by format', async () => {
      store.store({ format: 'svg', data: new Uint8Array(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: new Uint8Array(20), sizeBytes: 20 });
      store.store({ format: 'svg', data: new Uint8Array(15), sizeBytes: 15 });

      const res = await request(app).get('/api/v1/export/artifacts?format=svg');

      expect(res.status).toBe(200);
      expect(res.body.data.artifacts).toHaveLength(2);
      expect(res.body.data.artifacts.every((a: any) => a.format === 'svg')).toBe(true);
    });

    it('paginates with limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        store.store({ format: 'svg', data: new Uint8Array(10), sizeBytes: 10 });
      }

      const res = await request(app).get('/api/v1/export/artifacts?limit=2&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.data.artifacts).toHaveLength(2);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.offset).toBe(0);
    });

    it('clamps limit to max 200', async () => {
      const res = await request(app).get('/api/v1/export/artifacts?limit=500');

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(200);
    });

    it('uses defaults when limit/offset are invalid', async () => {
      const res = await request(app).get('/api/v1/export/artifacts?limit=abc&offset=-1');

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(50);
      expect(res.body.data.offset).toBe(0);
    });
  });

  // -- GET /artifacts/usage (REQ-240) --------------------------------------

  describe('GET /api/v1/export/artifacts/usage', () => {
    it('returns usage statistics', async () => {
      store.store({ format: 'svg', data: new Uint8Array(10), sizeBytes: 10 });
      store.store({ format: 'mp4', data: new Uint8Array(20), sizeBytes: 20 });

      const res = await request(app).get('/api/v1/export/artifacts/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.artifactCount).toBe(2);
      expect(res.body.data.totalBytes).toBe(30);
      expect(res.body.data.formatDistribution.svg).toBe(1);
      expect(res.body.data.formatDistribution.mp4).toBe(1);
    });

    it('returns zeros for empty store', async () => {
      const res = await request(app).get('/api/v1/export/artifacts/usage');

      expect(res.status).toBe(200);
      expect(res.body.data.artifactCount).toBe(0);
      expect(res.body.data.totalBytes).toBe(0);
    });
  });

  // -- GET /artifacts/:id (REQ-239) ----------------------------------------

  describe('GET /api/v1/export/artifacts/:artifactId', () => {
    it('returns artifact metadata', async () => {
      const stored = store.store({
        format: 'svg',
        data: new Uint8Array(100),
        sizeBytes: 100,
        metadata: { jobId: 'job-123' },
      });

      const res = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.artifactId).toBe(stored.artifactId);
      expect(res.body.data.format).toBe('svg');
      expect(res.body.data.sizeBytes).toBe(100);
      expect(res.body.data.metadata).toEqual({ jobId: 'job-123' });
      expect(res.body.data.data).toBeUndefined();
    });

    it('returns 404 for non-existent artifact', async () => {
      const res = await request(app).get('/api/v1/export/artifacts/00000000-0000-4000-a000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
    });

    it('returns 400 for invalid artifactId format', async () => {
      const res = await request(app).get('/api/v1/export/artifacts/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // -- DELETE /artifacts/:id (REQ-239) -------------------------------------

  describe('DELETE /api/v1/export/artifacts/:artifactId', () => {
    it('deletes an existing artifact', async () => {
      const stored = store.store({ format: 'svg', data: new Uint8Array(10), sizeBytes: 10 });

      const res = await request(app).delete(`/api/v1/export/artifacts/${stored.artifactId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's gone
      const getRes = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent artifact', async () => {
      const res = await request(app).delete('/api/v1/export/artifacts/00000000-0000-4000-a000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
    });

    it('returns 400 for invalid artifactId format', async () => {
      const res = await request(app).delete('/api/v1/export/artifacts/invalid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
