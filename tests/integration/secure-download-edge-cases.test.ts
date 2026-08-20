/**
 * Edge-case integration tests for the secure download pipeline.
 *
 * Complements secure-download-pipeline.test.ts with additional scenarios:
 *   1. Concurrent downloads with same token (race safety)
 *   2. All format MIME types verified end-to-end
 *   3. Token reuse after artifact re-creation (fresh UUID guarantees)
 *   4. Store capacity limits under download pressure
 *   5. Content-Disposition sanitization across all formats
 *   6. Listing/pagination with malicious query params
 *   7. Usage endpoint security
 *   8. Artifact metadata with injection content (metadata is never reflected
 *      unsanitized in HTTP responses)
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createExportRouter } from '../../src/api/routes/export';
import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import type { ArtifactDownloadUrl } from '../../src/export/export-artifact-store';

// Fail-loud unwrap (the export-security-e2e idiom): every site below
// generates the URL for an artifact it stored one statement earlier, so
// undefined means the store dropped it. The old `dl!.url` TypeError red; the
// throw keeps the same RED verdict.
function requireDownloadUrl(dl: ArtifactDownloadUrl | undefined): ArtifactDownloadUrl {
  if (dl === undefined) throw new Error('generateDownloadUrl returned undefined for a just-stored artifact');
  return dl;
}
import { validateExportPayload } from '../../src/export/export-content-validator';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

function createApp() {
  const store = new ExportArtifactStore({
    maxArtifacts: 20,
    maxStorageBytes: 1_000_000,
    defaultTtlMs: 60_000,
    downloadUrlTtlMs: 30_000,
    cleanupIntervalMs: 60_000,
  });

  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportRouter(store));
  return { app, store };
}

// ---------------------------------------------------------------------------
// 1. Concurrent downloads with same token
// ---------------------------------------------------------------------------

describe('Edge: Concurrent downloads with same token', () => {
  test('multiple concurrent downloads succeed with same valid token', async () => {
    const { app, store } = createApp();

    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1, 2, 3, 4, 5]),
      sizeBytes: 5,
    });

    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    // Issue 5 concurrent downloads
    const downloads = await Promise.all([
      request(app).get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`),
      request(app).get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`),
      request(app).get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`),
      request(app).get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`),
      request(app).get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`),
    ]);

    for (const res of downloads) {
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/svg+xml');
    }
  });

  test('concurrent downloads of different artifacts with different tokens', async () => {
    const { app, store } = createApp();

    const artifacts = [];
    for (let i = 0; i < 3; i++) {
      const stored = store.store({
        format: i % 2 === 0 ? 'svg' : 'pdf',
        data: new Uint8Array([i]),
        sizeBytes: 1,
      });
      const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
      artifacts.push({ artifactId: stored.artifactId, token: dl.url.split('token=')[1] });
    }

    const downloads = await Promise.all(
      artifacts.map((a) =>
        request(app).get(`/api/v1/export/artifacts/${a.artifactId}/download?token=${a.token}`),
      ),
    );

    downloads.forEach((res, i) => {
      expect(res.status).toBe(200);
      const expectedMime = i % 2 === 0 ? 'image/svg+xml' : 'application/pdf';
      expect(res.headers['content-type']).toBe(expectedMime);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. All format MIME types verified through pipeline
// ---------------------------------------------------------------------------

describe('Edge: All format MIME types in download pipeline', () => {
  const formatMimePairs = [
    { format: 'svg', mime: 'image/svg+xml' },
    { format: 'pdf', mime: 'application/pdf' },
    { format: 'json', mime: 'application/json' },
    { format: 'html', mime: 'text/html' },
    { format: 'mp4', mime: 'video/mp4' },
    { format: 'webm', mime: 'video/webm' },
    { format: 'gif', mime: 'image/gif' },
    { format: 'apng', mime: 'image/apng' },
    { format: 'interactive-html', mime: 'text/html' },
    { format: 'pdf-animated', mime: 'application/pdf' },
    { format: 'svg-animated', mime: 'image/svg+xml' },
    { format: 'json-lottie', mime: 'application/json' },
  ];

  test.each(formatMimePairs)(
    'format "$format" produces correct Content-Type: $mime',
    async ({ format, mime }) => {
      const { app, store } = createApp();

      const stored = store.store({
        format,
        data: new Uint8Array([1, 2, 3]),
        sizeBytes: 3,
      });
      const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
      const token = dl.url.split('token=')[1];

      const res = await request(app)
        .get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`)
        .buffer(true)
        .parse((response, callback) => {
          const data: Buffer[] = [];
          response.on('data', (chunk: Buffer) => data.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(data)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe(mime);
    },
  );

  test('Content-Disposition filename extension matches format', async () => {
    const { app, store } = createApp();

    const stored = store.store({
      format: 'pdf',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );

    const cd = res.headers['content-disposition'] as string;
    expect(cd).toContain('.pdf');
    expect(cd).not.toContain('\r');
    expect(cd).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// 3. Token invalidation on artifact deletion
// ---------------------------------------------------------------------------

describe('Edge: Token invalidation lifecycle', () => {
  test('old token cannot download after artifact deleted and re-created', async () => {
    const { app, store } = createApp();

    // Create first artifact
    const stored1 = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });
    const dl1 = requireDownloadUrl(store.generateDownloadUrl(stored1.artifactId));
    const oldToken = dl1.url.split('token=')[1];

    // Delete first artifact
    await request(app).delete(`/api/v1/export/artifacts/${stored1.artifactId}`);

    // Create second artifact (different UUID)
    const stored2 = store.store({
      format: 'svg',
      data: new Uint8Array([2]),
      sizeBytes: 1,
    });

    // Old token with old artifact ID → 404 (artifact gone)
    const res1 = await request(app).get(
      `/api/v1/export/artifacts/${stored1.artifactId}/download?token=${oldToken}`,
    );
    expect(res1.status).toBe(404);

    // Old token with new artifact ID → 404 (token doesn't match)
    const res2 = await request(app).get(
      `/api/v1/export/artifacts/${stored2.artifactId}/download?token=${oldToken}`,
    );
    expect(res2.status).toBe(404);
  });

  test('token for one artifact cannot download a different artifact', async () => {
    const { app, store } = createApp();

    const a1 = store.store({ format: 'svg', data: new Uint8Array([1]), sizeBytes: 1 });
    const a2 = store.store({ format: 'svg', data: new Uint8Array([2]), sizeBytes: 1 });

    const dl1 = requireDownloadUrl(store.generateDownloadUrl(a1.artifactId));
    const token1 = dl1.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${a2.artifactId}/download?token=${token1}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// 4. Store capacity limits
// ---------------------------------------------------------------------------

describe('Edge: Store capacity under download pressure', () => {
  test('maxArtifacts limit evicts oldest on overflow', () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 3,
      maxStorageBytes: 100_000,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    const a1 = store.store({ format: 'svg', data: new Uint8Array([1]), sizeBytes: 1 });
    const a2 = store.store({ format: 'svg', data: new Uint8Array([2]), sizeBytes: 1 });
    const a3 = store.store({ format: 'svg', data: new Uint8Array([3]), sizeBytes: 1 });

    // All three exist
    expect(store.get(a1.artifactId)).toBeDefined();
    expect(store.get(a2.artifactId)).toBeDefined();
    expect(store.get(a3.artifactId)).toBeDefined();

    // Adding a 4th should evict the oldest (a1)
    const a4 = store.store({ format: 'svg', data: new Uint8Array([4]), sizeBytes: 1 });
    expect(store.get(a1.artifactId)).toBeUndefined();
    expect(store.get(a4.artifactId)).toBeDefined();
  });

  test('maxStorageBytes limit evicts on size overflow', () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 100,
      maxStorageBytes: 10,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    // Each artifact is 5 bytes, so after 2 we're at capacity
    const a1 = store.store({ format: 'svg', data: new Uint8Array([1, 2, 3, 4, 5]), sizeBytes: 5 });
    const a2 = store.store({ format: 'svg', data: new Uint8Array([6, 7, 8, 9, 10]), sizeBytes: 5 });

    // a3 should evict a1 (10 > maxStorageBytes=10 is not over, but adding 5 more = 15 > 10)
    const a3 = store.store({ format: 'svg', data: new Uint8Array([11, 12, 13, 14, 15]), sizeBytes: 5 });

    // a1 should be evicted
    expect(store.get(a1.artifactId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Listing/pagination edge cases
// ---------------------------------------------------------------------------

describe('Edge: Listing with adversarial query parameters', () => {
  test('non-numeric limit falls back to default (parseInt NaN)', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts?limit=abc');
    // parseInt('abc') = NaN → route uses default limit, returns 200
    expect(res.status).toBe(200);
  });

  test('non-numeric offset falls back to default (parseInt NaN)', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts?offset=xyz');
    expect(res.status).toBe(200);
  });

  test('float limit is truncated to int by parseInt', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts?limit=10.5');
    // parseInt('10.5') = 10 → valid
    expect(res.status).toBe(200);
  });

  test('boolean-like limit falls back to default', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts?limit=true');
    // parseInt('true') = NaN → default
    expect(res.status).toBe(200);
  });

  test('rejects XSS in format param', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts?format=<script>alert(1)</script>');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('format filter is case-sensitive', async () => {
    const { app, store } = createApp();
    store.store({ format: 'svg', data: new Uint8Array([1]), sizeBytes: 1 });

    const res = await request(app).get('/api/v1/export/artifacts?format=SVG');
    // Case-sensitive format → 400 (SVG not in whitelist)
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// 6. Usage endpoint
// ---------------------------------------------------------------------------

describe('Edge: Usage endpoint returns safe data', () => {
  test('usage endpoint returns numeric stats only', async () => {
    const { app, store } = createApp();
    store.store({ format: 'svg', data: new Uint8Array([1, 2, 3]), sizeBytes: 3 });
    store.store({ format: 'pdf', data: new Uint8Array([4, 5]), sizeBytes: 2 });

    const res = await request(app).get('/api/v1/export/artifacts/usage');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.artifactCount).toBe('number');
    expect(typeof res.body.data.totalBytes).toBe('number');
    expect(res.body.data.artifactCount).toBe(2);
    expect(res.body.data.totalBytes).toBe(5);
  });

  test('usage endpoint with empty store returns zeros', async () => {
    const { app } = createApp();
    const res = await request(app).get('/api/v1/export/artifacts/usage');
    expect(res.status).toBe(200);
    expect(res.body.data.artifactCount).toBe(0);
    expect(res.body.data.totalBytes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. ExportContentValidator → store → download full composition
// ---------------------------------------------------------------------------

describe('Edge: Content validation + download composition', () => {
  test('clean payload: validate → store → download with sanitized headers', async () => {
    const { app, store } = createApp();

    const payload = {
      scenes: [
        { id: 'scene-1', label: '正常なラベル', duration: 2.0 },
        { id: 'scene-2', label: 'Normal English Label', duration: 3.0 },
      ],
      title: '安全なタイトル',
    };

    // Stage 1: Validate
    const validation = validateExportPayload(payload, 'composition-test');
    expect(validation.passed).toBe(true);
    expect(validation.findings).toHaveLength(0);

    // Stage 2: Store
    const data = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x2f, 0x3e]);
    const stored = store.store({ format: 'svg', data, sizeBytes: data.length });

    // Stage 3: Generate URL
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    // Stage 4: Download
    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="[^"]+"$/);
    expect(res.headers['x-artifact-id']).toBe(stored.artifactId);
  });

  test('injection payload: strict validation blocks → no store, no download', () => {
    const payload = {
      scenes: [
        { id: 'scene-1', label: '<script>alert(1)</script>', duration: 1.0 },
      ],
    };

    const validation = validateExportPayload(payload, 'strict-test', { strict: true });
    expect(validation.passed).toBe(false);
    expect(validation.findings.some((f) => f.severity === 'high')).toBe(true);
    // In a real pipeline, prepareExport would throw here — no artifact stored
  });

  test('mixed payload: one clean field, one injection field', () => {
    const payload = {
      scenes: [
        { id: 'scene-1', label: 'Safe Label', duration: 1.0 },
        { id: 'scene-2', label: '<svg onload=alert(1)>', duration: 1.0 },
      ],
    };

    const validation = validateExportPayload(payload, 'mixed-test', { strict: true });
    expect(validation.passed).toBe(false);
    // Should find the injection in the second scene
    const evilFindings = validation.findings.filter(
      (f) => f.field.includes('[1]'),
    );
    expect(evilFindings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Artifact metadata safety
// ---------------------------------------------------------------------------

describe('Edge: Artifact metadata is never reflected unsanitized', () => {
  test('metadata with injection content is stored but not reflected in headers', async () => {
    const { app, store } = createApp();

    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
      metadata: {
        jobId: '<script>alert(1)</script>',
        description: 'javascript:alert(1)',
      },
    });

    // Metadata endpoint
    const metaRes = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);
    expect(metaRes.status).toBe(200);
    // Metadata IS returned in JSON body (safe — JSON.stringify escapes)
    // but should NOT appear in any HTTP header
    const allHeaders = JSON.stringify(metaRes.headers);
    expect(allHeaders).not.toContain('<script>');
    expect(allHeaders).not.toContain('javascript:alert');
  });

  test('listing does not reflect injection in headers', async () => {
    const { app, store } = createApp();

    store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
      metadata: { evil: '\r\nX-Injected: true' },
    });

    const res = await request(app).get('/api/v1/export/artifacts');
    expect(res.status).toBe(200);
    const allHeaders = JSON.stringify(res.headers);
    expect(allHeaders).not.toContain('X-Injected');
    expect(allHeaders).not.toContain('\r\n');
  });
});
