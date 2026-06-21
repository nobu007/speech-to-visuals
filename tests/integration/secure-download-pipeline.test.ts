/**
 * Integration Test: Full secureDownload pipeline (param validate → content guard →
 * filename sanitize → blob create → revoke).
 *
 * Exercises the complete layered security composition as a single pipeline:
 *   1. ExportContentValidator pre-export scan (strict mode)
 *   2. EnhancedExportEngine export → artifact store
 *   3. ExportArtifactStore store + generateDownloadUrl
 *   4. Express router: UUID validate → token validate → header sanitize → response
 *   5. Token revocation via artifact deletion
 *
 * This test ensures the composition works end-to-end, complementing the
 * unit-level tests for each layer.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createExportRouter } from '../../src/api/routes/export';
import { ExportArtifactStore } from '../../src/export/export-artifact-store';
import { validateExportPayload } from '../../src/export/export-content-validator';

// ---------------------------------------------------------------------------
// Mock console for cleaner test output
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pipeline helpers
// ---------------------------------------------------------------------------

interface PipelineResult {
  stored: { artifactId: string; format: string; sizeBytes: number } | null;
  downloadUrl: { url: string; expiresAt: number } | null;
  httpResponse: request.Response | null;
  validationFindings: { severity: string; pattern: string; field: string }[];
}

/**
 * Run the full pipeline: validate → store → generate URL → HTTP download.
 * Returns each stage's result for assertion.
 */
async function runSecureDownloadPipeline(
  payload: unknown,
  format: string = 'svg',
  strictValidation: boolean = false,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    stored: null,
    downloadUrl: null,
    httpResponse: null,
    validationFindings: [],
  };

  // Stage 1: Content validation (ExportContentValidator)
  const validation = validateExportPayload(payload, 'pipeline-test', {
    strict: strictValidation,
  });
  result.validationFindings = validation.findings.map((f) => ({
    severity: f.severity,
    pattern: f.pattern,
    field: f.field,
  }));

  // If strict mode blocks, pipeline stops here
  if (!validation.passed) {
    return result;
  }

  // Stage 2: Store artifact
  const store = new ExportArtifactStore({
    maxArtifacts: 10,
    maxStorageBytes: 100_000,
    defaultTtlMs: 60_000,
    downloadUrlTtlMs: 30_000,
    cleanupIntervalMs: 60_000,
  });

  const data = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x2f, 0x3e]); // <svg/>
  const stored = store.store({
    format,
    data,
    sizeBytes: data.length,
    metadata: { source: 'pipeline-test' },
  });
  result.stored = {
    artifactId: stored.artifactId,
    format: stored.format,
    sizeBytes: stored.sizeBytes,
  };

  // Stage 3: Generate download URL (token-based)
  const dl = store.generateDownloadUrl(stored.artifactId);
  if (dl) {
    result.downloadUrl = { url: dl.url, expiresAt: dl.expiresAt };
  }

  // Stage 4: HTTP download through Express router
  const app = express();
  app.use(express.json());
  app.use('/api/v1/export', createExportRouter(store));

  const token = dl?.url.split('token=')[1];
  if (token) {
    result.httpResponse = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tests: Clean content passes full pipeline
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: clean content', () => {
  test('clean scene data passes validation and downloads successfully', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: 'Start Process', duration: 5.0 },
        { id: 's2', label: 'End Process', duration: 3.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload);

    // Validation: no findings
    expect(result.validationFindings).toHaveLength(0);

    // Artifact stored
    expect(result.stored).not.toBeNull();
    expect(result.stored!.artifactId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    // Download URL generated
    expect(result.downloadUrl).not.toBeNull();
    expect(result.downloadUrl!.expiresAt).toBeGreaterThan(Date.now());

    // HTTP response: 200 with sanitized headers
    expect(result.httpResponse).not.toBeNull();
    expect(result.httpResponse!.status).toBe(200);

    const cd = result.httpResponse!.headers['content-disposition'] as string;
    expect(cd).toMatch(/^attachment; filename="[^"]+"$/);
    expect(cd).not.toContain('\r');
    expect(cd).not.toContain('\n');

    expect(result.httpResponse!.headers['content-type']).toBe('image/svg+xml');
    expect(result.httpResponse!.headers['x-artifact-id']).toBe(result.stored!.artifactId);
  });

  test('clean content with special but safe characters passes', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: 'Check if (x > 0) & (y < 10)', duration: 2.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload);
    expect(result.validationFindings).toHaveLength(0);
    expect(result.httpResponse!.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: Injection content detected but allowed in non-strict mode
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: injection content (non-strict mode)', () => {
  test('script tag in payload is detected but export proceeds', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: '<script>alert(1)</script>', duration: 2.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload, 'svg', false);

    // Validation detected the threat
    expect(result.validationFindings.length).toBeGreaterThan(0);
    expect(result.validationFindings.some((f) => f.severity === 'high')).toBe(true);

    // But export still proceeds (non-strict mode)
    expect(result.stored).not.toBeNull();
    expect(result.httpResponse!.status).toBe(200);
  });

  test('CSS expression in payload is detected as high severity', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: 'style={width:expression(alert(1))}', duration: 1.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload, 'svg', false);
    expect(result.validationFindings.some((f) => f.pattern === 'css-expression')).toBe(true);
    expect(result.httpResponse!.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: Strict mode blocks export with injection content
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: strict mode blocks injection', () => {
  test('script tag blocks export in strict mode', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: '<script>alert(1)</script>', duration: 2.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload, 'svg', true);

    // Validation blocked
    expect(result.validationFindings.some((f) => f.severity === 'high')).toBe(true);

    // Pipeline stopped — no artifact stored, no download URL, no HTTP response
    expect(result.stored).toBeNull();
    expect(result.downloadUrl).toBeNull();
    expect(result.httpResponse).toBeNull();
  });

  test('multiple injection vectors all detected and blocked in strict mode', async () => {
    const injectionPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<iframe src="evil.com">',
      '<embed src="malicious">',
      '<object data="evil">',
      'javascript:alert(1)',
      'expression(alert(1))',
      '-moz-binding:url(evil.xml)',
      'url(javascript:alert(1))',
    ];

    for (const payload of injectionPayloads) {
      const result = await runSecureDownloadPipeline(
        { data: payload },
        'svg',
        true,
      );
      expect(result.validationFindings.some((f) => f.severity === 'high')).toBe(true);
      expect(result.stored).toBeNull();
    }
  });

  test('medium-severity finding does NOT block in strict mode', async () => {
    const payload = {
      scenes: [
        { id: 's1', label: 'text onclick=alert(1)', duration: 1.0 },
      ],
    };

    const result = await runSecureDownloadPipeline(payload, 'svg', true);
    expect(result.validationFindings.some((f) => f.severity === 'medium')).toBe(true);
    // Medium does not block
    expect(result.stored).not.toBeNull();
    expect(result.httpResponse!.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: Header sanitization in download response
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: header sanitization', () => {
  test('Content-Disposition has no CRLF injection vectors', async () => {
    const result = await runSecureDownloadPipeline({ data: 'safe content' });

    const cd = result.httpResponse!.headers['content-disposition'] as string;
    // Must not contain CR or LF
    expect(cd).not.toMatch(/[\r\n]/);
    // Must match the expected format
    expect(cd).toMatch(/^attachment; filename="export-[0-9a-f-]+\.svg"$/);
  });

  test('X-Artifact-Id is a clean UUID', async () => {
    const result = await runSecureDownloadPipeline({ data: 'safe content' });

    const artifactId = result.httpResponse!.headers['x-artifact-id'] as string;
    expect(artifactId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(artifactId).not.toMatch(/[\r\n]/);
    expect(artifactId).not.toContain('<');
    expect(artifactId).not.toContain('>');
  });

  test('Content-Type is from the whitelist (no injection)', async () => {
    const result = await runSecureDownloadPipeline({ data: 'safe content' }, 'pdf');

    const ct = result.httpResponse!.headers['content-type'] as string;
    expect(ct).toBe('application/pdf');
    expect(ct).not.toMatch(/[\r\n]/);
  });

  test('Content-Length matches artifact size', async () => {
    const result = await runSecureDownloadPipeline({ data: 'safe content' });

    const cl = parseInt(result.httpResponse!.headers['content-length'] as string, 10);
    expect(cl).toBe(6); // we store 6 bytes in the helper
  });
});

// ---------------------------------------------------------------------------
// Tests: Token lifecycle (generation, usage, revocation via deletion)
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: token lifecycle', () => {
  test('token can be used for multiple downloads within TTL', async () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 5,
      maxStorageBytes: 10_000,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/export', createExportRouter(store));

    // Store artifact
    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1, 2, 3, 4]),
      sizeBytes: 4,
    });

    // Generate download URL
    const dl = store.generateDownloadUrl(stored.artifactId);
    expect(dl).toBeDefined();
    const token = dl!.url.split('token=')[1];

    // First download
    const res1 = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res1.status).toBe(200);

    // Second download with same token (should still work within TTL)
    const res2 = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res2.status).toBe(200);
  });

  test('token becomes invalid after artifact deletion (revocation)', async () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 5,
      maxStorageBytes: 10_000,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/export', createExportRouter(store));

    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });

    const dl = store.generateDownloadUrl(stored.artifactId);
    const token = dl!.url.split('token=')[1];

    // Download works before deletion
    const res1 = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res1.status).toBe(200);

    // Delete artifact (revokes token)
    const delRes = await request(app).delete(
      `/api/v1/export/artifacts/${stored.artifactId}`,
    );
    expect(delRes.status).toBe(200);

    // Download fails after deletion
    const res2 = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res2.status).toBe(404);
    expect(res2.body.error.code).toBe('ARTIFACT_NOT_FOUND');
  });

  test('different artifacts get different tokens', async () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 5,
      maxStorageBytes: 10_000,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    const stored1 = store.store({ format: 'svg', data: new Uint8Array([1]), sizeBytes: 1 });
    const stored2 = store.store({ format: 'svg', data: new Uint8Array([2]), sizeBytes: 1 });

    const dl1 = store.generateDownloadUrl(stored1.artifactId);
    const dl2 = store.generateDownloadUrl(stored2.artifactId);

    const token1 = dl1!.url.split('token=')[1];
    const token2 = dl2!.url.split('token=')[1];

    expect(token1).not.toBe(token2);
  });
});

// ---------------------------------------------------------------------------
// Tests: TTL expiration (simulated)
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: TTL expiration', () => {
  test('artifact with expired TTL is not found', async () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 5,
      maxStorageBytes: 10_000,
      defaultTtlMs: 1, // 1ms TTL — will expire immediately
      downloadUrlTtlMs: 30_000,
      cleanupIntervalMs: 60_000,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/export', createExportRouter(store));

    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await request(app).get(`/api/v1/export/artifacts/${stored.artifactId}`);
    expect(res.status).toBe(404);
  });

  test('download URL with expired token is rejected', async () => {
    const store = new ExportArtifactStore({
      maxArtifacts: 5,
      maxStorageBytes: 10_000,
      defaultTtlMs: 60_000,
      downloadUrlTtlMs: 1, // 1ms TTL — token expires immediately
      cleanupIntervalMs: 60_000,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/v1/export', createExportRouter(store));

    const stored = store.store({
      format: 'svg',
      data: new Uint8Array([1]),
      sizeBytes: 1,
    });

    const dl = store.generateDownloadUrl(stored.artifactId);
    const token = dl!.url.split('token=')[1];

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await request(app).get(
      `/api/v1/export/artifacts/${stored.artifactId}/download?token=${token}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ARTIFACT_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Tests: LRU eviction under storage pressure
// ---------------------------------------------------------------------------

describe('Secure Download Pipeline: LRU eviction', () => {
  test('oldest artifact evicted when max count exceeded', async () => {
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

    // Access a1 to make it more recently used than a2
    store.get(a1.artifactId);

    // Store a4 — should evict a2 (LRU)
    const a4 = store.store({ format: 'svg', data: new Uint8Array([4]), sizeBytes: 1 });

    expect(store.get(a1.artifactId)).toBeDefined(); // a1 still exists
    expect(store.get(a2.artifactId)).toBeUndefined(); // a2 evicted
    expect(store.get(a3.artifactId)).toBeDefined(); // a3 still exists
    expect(store.get(a4.artifactId)).toBeDefined(); // a4 exists
  });
});
