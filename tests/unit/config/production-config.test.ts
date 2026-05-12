/**
 * REQ-066 (ISS-012): Browser-Safe Environment Variable Access Tests
 *
 * Verifies that ProductionConfigManager works safely when process.env is undefined
 * (browser context where Vite does not perform static replacement).
 */


describe('REQ-066: Browser-Safe Environment Variable Access (ISS-012)', () => {
  const originalProcess = global.process;

  afterEach(() => {
    // Restore process after each test
    Object.defineProperty(global, 'process', {
      value: originalProcess,
      writable: true,
      configurable: true,
    });
    // Clear module cache so production-config is re-imported fresh
    jest.resetModules();
  });

  it('TC-066-E01: should use development defaults when process.env is undefined', async () => {
    // Remove process entirely to simulate browser without Vite replacement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).process;

    // Re-import to trigger fresh constructor
    const { productionConfig } = await import('@/config/production-config');

    const config = productionConfig.getConfig();
    expect(config.name).toBe('development');
    expect(config.apiBaseUrl).toBe('http://localhost:3000/api');
  });

  it('TC-066-E02: should load config overrides safely when process.env is undefined', async () => {
    // Remove process entirely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).process;

    // Re-import to trigger fresh constructor (including loadConfigOverrides)
    const { productionConfig } = await import('@/config/production-config');

    // Should still produce a valid config (no crash)
    const config = productionConfig.getConfig();
    expect(config).toBeDefined();
    expect(config.performance).toBeDefined();
    expect(config.performance.maxConcurrentJobs).toBeGreaterThan(0);
  });
});
