/**
 * ISS-029: Verify apiRateLimiter is applied to pipeline routes
 *
 * Ensures the API rate limiter middleware is active on /api pipeline
 * routes by checking the rate limit headers are present in responses.
 */

import request from 'supertest';

// Import the app with all middleware wired up
import { app } from '@/api/server';

// ===========================================================================
// Tests
// ===========================================================================

describe('ISS-029: API rate limiter applied to pipeline routes', () => {
  it('should include rate limit headers on POST /api/render', async () => {
    const res = await request(app)
      .post('/api/render')
      .send({ scenes: [{ id: 1 }] });

    // Rate limit headers should be present (apiRateLimiter applied)
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('should include rate limit headers on POST /api/git/commit', async () => {
    const res = await request(app)
      .post('/api/git/commit')
      .send({ message: 'test commit' });

    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('should include rate limit headers on GET /api/iteration-log', async () => {
    const res = await request(app)
      .get('/api/iteration-log');

    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('should include rate limit headers on GET /api/framework/status', async () => {
    const res = await request(app)
      .get('/api/framework/status');

    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
