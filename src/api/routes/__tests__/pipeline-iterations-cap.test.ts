/**
 * Tests for ISS-020: Unbounded iterations array cap in pipeline.ts
 * Verifies that iterations array is capped at MAX_ITERATIONS (500).
 */
import { PipelineStateManager } from '../pipeline';

describe('PipelineStateManager - iterations cap (ISS-020)', () => {
  let manager: PipelineStateManager;

  beforeEach(() => {
    manager = new PipelineStateManager();
  });

  test('should add iterations normally under the limit', () => {
    for (let i = 0; i < 10; i++) {
      manager.addIteration('test-phase', 0.8);
    }
    expect(manager.getIterations()).toHaveLength(10);
  });

  test('should cap iterations and keep the most recent half when limit is exceeded', () => {
    // Add 500 iterations (the max)
    for (let i = 0; i < 500; i++) {
      manager.addIteration('phase-a', 0.5 + (i / 1000));
    }
    expect(manager.getIterations()).toHaveLength(500);

    // Add one more to trigger the cap
    manager.addIteration('phase-b', 0.99);

    const iterations = manager.getIterations();
    // Should have trimmed to 250 (half of 500) then added 1 = 251
    expect(iterations.length).toBe(251);
    // Last iteration should be the one we just added
    expect(iterations[iterations.length - 1].phase).toBe('phase-b');
    expect(iterations[iterations.length - 1].qualityScore).toBe(0.99);
  });

  test('should preserve quality trend after cap', () => {
    // Fill up and trigger cap
    for (let i = 0; i < 501; i++) {
      manager.addIteration('test', 0.9);
    }

    // Quality trend should still work
    const trend = manager.getQualityTrend();
    expect(['improving', 'stable', 'fluctuating']).toContain(trend);
  });

  test('should handle rapid iteration additions', () => {
    // Add many iterations rapidly
    for (let i = 0; i < 1000; i++) {
      manager.addIteration('rapid', i / 1000);
    }

    const iterations = manager.getIterations();
    // After first cap: 500 added -> cap -> 250 + more additions
    // Eventually: 250 (from first cap) + 499 more = triggers cap again
    // The final state should be manageable
    expect(iterations.length).toBeLessThanOrEqual(501);
  });
});
