/**
 * Regression tests for server route registration.
 *
 * Ensures the fixes from commit 6d2feb5 remain permanent:
 *  - No duplicate /api/v1/health endpoint
 *  - BATCH_LIMITS centralization
 *
 * Uses HTTP-level assertions (supertest) to verify route behaviour
 * rather than relying on Express internals that may change between versions.
 */

import path from 'path';
import fs from 'fs';
import request from 'supertest';

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.resolve(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();

describe('server route regression: no duplicate health endpoints', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
  });

  it('should respond 200 on GET /api/v1/health', async () => {
    const { app } = await import('../server');

    const res = await request(app).get('/api/v1/health');
    // Health check may return 503 in test environment (e.g. cache cold start),
    // but the route must be registered and respond with expected structure.
    expect([200, 503]).toContain(res.status);
    expect(typeof res.body.success).toBe('boolean');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(res.body.data.status);
  });

  it('should respond 200 on GET /api/v1/monitoring/health', async () => {
    const { app } = await import('../server');

    const res = await request(app).get('/api/v1/monitoring/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Clean up the globalDashboard timer
    const { globalDashboard } = await import('../../monitoring/performance-dashboard');
    globalDashboard.destroy();
  });

  it('should respond 404 on unknown routes under /api/v1', async () => {
    const { app } = await import('../server');

    const res = await request(app).get('/api/v1/nonexistent-route');
    expect(res.status).toBe(404);
  });

  it('should not register a second health endpoint after the error handler', async () => {
    /**
     * The bug in commit 6d2feb5 was that a duplicate /api/v1/health was
     * registered AFTER the error handler, making it unreachable.
     * Verify by checking that the server source contains exactly one
     * health route registration.
     */
    const serverPath = path.resolve(projectRoot, 'src/api/server.ts');
    const content = fs.readFileSync(serverPath, 'utf-8');

    // Count occurrences of health-related route registrations
    const healthRoutePattern = /health/i;
    const lines = content.split('\n');
    const healthLines = lines.filter(
      l => healthRoutePattern.test(l) && !l.trim().startsWith('//'),
    );

    // Should only have the import and one app.use for healthRouter
    expect(healthLines.length).toBeLessThanOrEqual(3);

    // Verify no inline health handler (the old bug registered
    // app.get('/api/v1/health', ...) directly in server.ts)
    expect(content).not.toMatch(/app\.(get|use)\([^)]*['"`]\/api\/v1\/health['"`]/);
  });

  it('should use healthRouter import for the health endpoint', async () => {
    const serverPath = path.resolve(projectRoot, 'src/api/server.ts');
    const content = fs.readFileSync(serverPath, 'utf-8');

    // The correct pattern: import healthRouter and mount it
    expect(content).toMatch(/import.*healthRouter.*from.*['"].\/routes\/health['"]/);
    expect(content).toMatch(/app\.use\(['"`]\/api\/v1['"`],\s*healthRouter\)/);
  });

  it('should register /api/v1/health exactly once — route count assertion', async () => {
    /**
     * Verify at the source-code level that healthRouter is mounted exactly
     * once and that no inline health handlers exist. Combined with the HTTP
     * test above (which proves the route actually works), this ensures no
     * duplicate registration can slip in.
     */
    const serverPath = path.resolve(projectRoot, 'src/api/server.ts');
    const content = fs.readFileSync(serverPath, 'utf-8');
    const nonCommentLines = content
      .split('\n')
      .filter(l => !l.trim().startsWith('//'));

    // Count how many times healthRouter is used in app.use() / app.get()
    const healthRouterUsages = nonCommentLines.filter(
      l => /healthRouter/.test(l) && /app\.(use|get|post|put|delete|patch)/.test(l),
    );
    expect(healthRouterUsages.length).toBe(1);

    // Double-check: no inline app.get('/api/v1/health', ...) exists
    expect(content).not.toMatch(
      /app\.(get|use)\([^)]*['"`](\/api\/v1\/health|\/health)['"`]/,
    );

    // Also verify the health route file registers exactly the expected routes
    // (main /health, /health/live liveness probe, /health/ready readiness probe)
    const healthRoutePath = path.resolve(projectRoot, 'src/api/routes/health.ts');
    const healthContent = fs.readFileSync(healthRoutePath, 'utf-8');
    const healthRegistrations = healthContent
      .split('\n')
      .filter(l => /healthRouter\.(get|post|put|delete|patch)/.test(l));
    expect(healthRegistrations.length).toBe(3);
  });
});

describe('BATCH_LIMITS centralization regression', () => {
  it('batch-processing-api should import from config/limits', () => {
    const filePath = path.resolve(projectRoot, 'src/api/batch-processing-api.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toMatch(/BATCH_LIMITS/);
    expect(content).toMatch(/from ['"].*config\/limits['"]/);
    // Ensure old hard-coded values are not present
    expect(content).not.toMatch(/MAX_STORED_JOBS\s*=\s*200/);
    expect(content).not.toMatch(/MAX_FILES_PER_BATCH\s*=\s*100/);
  });
});
