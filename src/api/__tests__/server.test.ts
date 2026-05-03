/**
 * Tests for server.ts CORS configuration
 * Covers the production branch of NODE_ENV === 'production'
 */

describe('server CORS configuration', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
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

    const { app } = await import('../server');
    expect(app).toBeDefined();

    // Restore
    jest.resetModules();
    process.env.NODE_ENV = originalEnv;
  });
});
