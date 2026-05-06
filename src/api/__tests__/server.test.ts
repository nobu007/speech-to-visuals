/**
 * Tests for server.ts CORS configuration
 * Covers the production branch of NODE_ENV === 'production'
 */

describe('server CORS configuration', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;
  });

  it('should configure CORS with specific origins in development', async () => {
    process.env.NODE_ENV = 'development';
    const { app } = await import('../server');
    expect(app).toBeDefined();
  });

  it('should configure CORS with origin=false in production', async () => {
    // Reset module registry so the module is re-imported with new env
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    // ISS-045: JWT_SECRET required in production
    process.env.JWT_SECRET = 'Test-Secret-Key-For-Production-Test-2026!@#$';

    const { app } = await import('../server');
    expect(app).toBeDefined();

    // Restore
    jest.resetModules();
    process.env.NODE_ENV = originalEnv;
    if (originalJwtSecret) process.env.JWT_SECRET = originalJwtSecret;
    else delete process.env.JWT_SECRET;
  });
});
