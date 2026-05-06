/**
 * ISS-026: Verify uploadRateLimiter is applied to batch routes
 *
 * Ensures the upload rate limiter middleware is active on /api/v1/batch
 * routes by checking the rate limit headers are present in responses.
 */

import request from 'supertest';

// Import the app with all middleware wired up
import { app } from '@/api/server';

// ===========================================================================
// Tests
// ===========================================================================

describe('ISS-026: Upload rate limiter applied to batch routes', () => {
  it('should include rate limit headers on batch job creation', async () => {
    const res = await request(app)
      .post('/api/v1/batch/jobs')
      .send({ files: [{ name: 'test.wav', path: '/test.wav' }] });

    // Rate limit headers should be present (even on error responses)
    // The standardHeaders option adds RateLimit-* headers
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('should include rate limit headers on batch GET endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/batch/jobs/550e8400-e29b-41d4-a716-446655440000');

    // Even 404 should have rate limit headers since middleware runs first
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
