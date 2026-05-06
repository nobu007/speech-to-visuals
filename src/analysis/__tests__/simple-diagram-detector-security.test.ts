/**
 * Tests for ISS-013: ReDoS vulnerability fix in simple-diagram-detector.ts
 * Verifies that special regex characters in keywords are properly escaped.
 */
import { SimpleDiagramDetector } from '../simple-diagram-detector';

describe('SimpleDiagramDetector - ReDoS prevention (ISS-013)', () => {
  let detector: SimpleDiagramDetector;

  beforeEach(() => {
    detector = new SimpleDiagramDetector();
  });

  test('should not throw on text containing regex special characters', async () => {
    const result = await detector.analyze({
      text: 'flow process with a(b and c+d and e*f and g?h in it',
      startMs: 0,
      endMs: 5000,
    });
    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
  });

  test('should handle normal text and still detect diagram type', async () => {
    const result = await detector.analyze({
      text: 'the process flows from input to processing to output step by step',
      startMs: 0,
      endMs: 5000,
    });
    expect(result).toBeDefined();
    expect(result.type).toBe('flow');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  test('should complete quickly even with special-char-heavy text', async () => {
    const specialText = 'text with (a+b)*c [0-9]+ {n,m} ^end$ |or\\b ack';
    const start = Date.now();
    const result = await detector.analyze({
      text: specialText,
      startMs: 0,
      endMs: 5000,
    });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    // Should complete well under 1 second (ReDoS would hang for much longer)
    expect(elapsed).toBeLessThan(1000);
  });
});
