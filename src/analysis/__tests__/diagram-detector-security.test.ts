/**
 * Tests for ISS-018: ReDoS vulnerability fix in diagram-detector.ts countOccurrences
 * Verifies that special regex characters in terms are properly escaped.
 */
import { DiagramDetector } from '../diagram-detector';
import type { ContentSegment } from '../types';

function makeSegment(text: string): ContentSegment {
  return {
    startMs: 0,
    endMs: 5000,
    text,
    summary: text.slice(0, 60),
    keyphrases: [],
    confidence: 0.9,
  };
}

describe('DiagramDetector - ReDoS prevention (ISS-018)', () => {
  let detector: DiagramDetector;

  beforeEach(() => {
    detector = new DiagramDetector();
  });

  test('should not hang on text with regex special characters', async () => {
    const maliciousText = 'process (a+b)*c [0-9]+ {n,m} ^end$ |or\\b repeated flow step';
    const segment = makeSegment(maliciousText);

    const start = Date.now();
    const result = await detector.analyze(segment);
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    expect(result.type).toBeDefined();
    expect(elapsed).toBeLessThan(2000);
  });

  test('should still detect diagram types in normal text', async () => {
    const segments = [makeSegment('the system processes input through a flow of steps from start to finish')];
    const result = detector.detect(null, segments);

    expect(result).toBeDefined();
    expect(result.primaryType).toBeDefined();
  });

  test('should handle text with special chars via detect method', () => {
    const segments = [makeSegment('data (info) and [array] with $money + tax * rate')];
    const result = detector.detect(null, segments);

    expect(result).toBeDefined();
    expect(result.primaryType).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
