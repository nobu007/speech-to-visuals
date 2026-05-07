/**
 * Tests for SimplePipeline page component
 * Tests page-level integration and routing
 * Uses node test environment (no DOM rendering)
 */

// Mock the SimplePipelineInterface component
vi.mock('@/components/SimplePipelineInterface', () => {
  return {
    __esModule: true,
    default: () => null,
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

describe('SimplePipeline Page', () => {
  describe('component exports', () => {
    it('should export SimplePipeline page component', async () => {
      const module = await import('../SimplePipeline');
      expect(module.default).toBeDefined();
    });

    it('should be a function component', async () => {
      const module = await import('../SimplePipeline');
      expect(typeof module.default).toBe('function');
    });
  });

  describe('routing integration', () => {
    it('should be importable for route configuration', async () => {
      // Verify the module can be imported without errors
      const SimplePipeline = (await import('../SimplePipeline')).default;
      expect(SimplePipeline).toBeDefined();
    });
  });
});
