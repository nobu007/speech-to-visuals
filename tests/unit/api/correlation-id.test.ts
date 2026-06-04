/**
 * REQ-200: Correlation ID middleware tests
 *
 * Verifies that the correlationId middleware:
 * - Generates a UUID v4 when no X-Request-ID header is present
 * - Accepts and propagates a valid incoming X-Request-ID
 * - Replaces empty or oversize IDs with a new UUID
 * - Sets X-Request-ID on the response
 */

import request from 'supertest';
import { app } from '@/api/server';

describe('REQ-200: Correlation ID middleware', () => {
  it('generates a UUID when X-Request-ID is absent', async () => {
    const res = await request(app).get('/api/v1/health');

    const id = res.headers['x-request-id'];
    expect(id).toBeDefined();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('accepts and returns a valid incoming X-Request-ID', async () => {
    const customId = 'test-req-123';
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('replaces an empty X-Request-ID with a generated UUID', async () => {
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', '');

    const id = res.headers['x-request-id'];
    expect(id).toBeDefined();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('replaces an oversize X-Request-ID with a generated UUID', async () => {
    const oversize = 'x'.repeat(200);
    const res = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', oversize);

    const id = res.headers['x-request-id'];
    expect(id).toBeDefined();
    // Should NOT be the oversize value
    expect(id).not.toBe(oversize);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
