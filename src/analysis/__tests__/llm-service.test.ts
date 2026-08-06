/**
 * TASK-0017: LLMService Tests
 *
 * Test cases:
 * 4. API response parsing (JSON, with markdown code blocks)
 * 6. Response parse error tolerance (malformed JSON, empty response)
 */

import { parseResponse, type AnalysisResult } from '../llm-service';

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('TASK-0017: LLMService parseResponse', () => {
  // -----------------------------------------------------------------------
  // Test case 4: API response parsing
  // -----------------------------------------------------------------------
  describe('Test case 4: API response parsing', () => {
    it('should parse clean JSON response', () => {
      const rawResponse = JSON.stringify({
        entities: [
          { id: 'e1', label: 'Company A', type: 'organization' },
          { id: 'e2', label: 'Company B', type: 'organization' },
        ],
        relations: [
          { from: 'e1', to: 'e2', label: 'acquired', type: 'causal' },
        ],
        diagramType: { type: 'flow', confidence: 0.92 },
        summary: 'Company A acquired Company B.',
      });

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].id).toBe('e1');
      expect(result.entities[0].label).toBe('Company A');
      expect(result.entities[0].type).toBe('organization');

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].from).toBe('e1');
      expect(result.relations[0].to).toBe('e2');
      expect(result.relations[0].label).toBe('acquired');

      expect(result.diagramType.type).toBe('flow');
      expect(result.diagramType.confidence).toBe(0.92);

      expect(result.summary).toBe('Company A acquired Company B.');
    });

    it('should parse JSON wrapped in markdown code block (```json ... ```)', () => {
      const jsonContent = JSON.stringify({
        entities: [
          { id: 'e1', label: 'Node A', type: 'concept' },
        ],
        relations: [],
        diagramType: { type: 'tree', confidence: 0.85 },
        summary: 'Simple node.',
      });

      const rawResponse = '```json\n' + jsonContent + '\n```';

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe('Node A');
      expect(result.diagramType.type).toBe('tree');
    });

    it('should parse JSON wrapped in markdown code block without language tag (``` ... ```)', () => {
      const jsonContent = JSON.stringify({
        entities: [{ id: 'e1', label: 'X', type: 'unknown' }],
        relations: [],
        diagramType: { type: 'flow', confidence: 0.7 },
        summary: '',
      });

      const rawResponse = '```\n' + jsonContent + '\n```';

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe('X');
    });

    it('should parse JSON with surrounding explanatory text', () => {
      const jsonContent = JSON.stringify({
        entities: [
          { id: 'e1', label: 'Alpha', type: 'process' },
          { id: 'e2', label: 'Beta', type: 'process' },
        ],
        relations: [
          { from: 'e1', to: 'e2', label: 'leads to', type: 'sequential' },
        ],
        diagramType: { type: 'flow', confidence: 0.88 },
        summary: 'Alpha leads to Beta.',
      });

      const rawResponse = 'Here is the analysis result:\n' + jsonContent + '\nEnd of result.';

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(2);
      expect(result.relations).toHaveLength(1);
      expect(result.summary).toBe('Alpha leads to Beta.');
    });

    it('should parse all valid diagram types (all 11)', () => {
      const validTypes = [
        'flow', 'flowchart', 'tree', 'timeline', 'matrix', 'cycle',
        'comparison', 'network', 'conceptmap', 'mindmap', 'general',
      ];

      for (const type of validTypes) {
        const rawResponse = JSON.stringify({
          entities: [],
          relations: [],
          diagramType: { type, confidence: 0.9 },
          summary: `Diagram type is ${type}.`,
        });

        const result = parseResponse(rawResponse);
        expect(result.diagramType.type).toBe(type);
      }
    });

    it('should parse response with multiple entities and relations', () => {
      const rawResponse = JSON.stringify({
        entities: [
          { id: 'e1', label: 'Research', type: 'activity' },
          { id: 'e2', label: 'New Technology', type: 'artifact' },
          { id: 'e3', label: 'Commercialization', type: 'process' },
          { id: 'e4', label: 'Products', type: 'artifact' },
        ],
        relations: [
          { from: 'e1', to: 'e2', label: 'develops', type: 'causal' },
          { from: 'e2', to: 'e3', label: 'applied to', type: 'sequential' },
          { from: 'e3', to: 'e4', label: 'transforms into', type: 'transformation' },
        ],
        diagramType: { type: 'flow', confidence: 0.95 },
        summary: 'Research to product pipeline.',
      });

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(4);
      expect(result.relations).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // Test case 6: Response parse error tolerance
  // -----------------------------------------------------------------------
  describe('Test case 6: Response parse error tolerance', () => {
    it('should return defaults for completely invalid JSON', () => {
      const result = parseResponse('this is not json at all');

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.diagramType.type).toBe('flow');
      expect(result.diagramType.confidence).toBe(0);
      expect(result.summary).toBe('');
    });

    it('should return defaults for empty string response', () => {
      const result = parseResponse('');

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.diagramType.confidence).toBe(0);
    });

    it('should return defaults for whitespace-only response', () => {
      const result = parseResponse('   \n\t  ');

      expect(result.entities).toEqual([]);
    });

    it('should NOT throw on null-like input (defensive)', () => {
      // parseResponse expects string, but test defensive behavior
      expect(() => parseResponse('')).not.toThrow();
    });

    it('should handle JSON with missing fields by using defaults', () => {
      const rawResponse = JSON.stringify({
        // No entities field
        // No relations field
        // No diagramType field
        // No summary field
      });

      const result = parseResponse(rawResponse);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.diagramType.type).toBe('flow');
      expect(result.diagramType.confidence).toBe(0.5);
      expect(result.summary).toBe('');
    });

    it('should handle JSON with partial fields (only entities)', () => {
      const rawResponse = JSON.stringify({
        entities: [
          { id: 'e1', label: 'Partial', type: 'thing' },
        ],
      });

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe('Partial');
      expect(result.relations).toEqual([]);
    });

    it('should handle JSON with invalid diagram type by defaulting to flow', () => {
      const rawResponse = JSON.stringify({
        entities: [],
        relations: [],
        diagramType: { type: 'invalid_type', confidence: 0.8 },
        summary: '',
      });

      const result = parseResponse(rawResponse);

      expect(result.diagramType.type).toBe('flow');
      expect(result.diagramType.confidence).toBe(0.5);
    });

    it('should handle entities with missing fields by providing defaults', () => {
      const rawResponse = JSON.stringify({
        entities: [
          { /* missing id, label, type */ },
          { id: 'e2', label: 'Valid Entity' },
        ],
        relations: [],
        diagramType: { type: 'flow', confidence: 0.7 },
        summary: '',
      });

      const result = parseResponse(rawResponse);

      expect(result.entities).toHaveLength(2);
      // First entity gets default id
      expect(result.entities[0].id).toBe('entity_0');
      expect(result.entities[0].label).toBe('');
      // Second entity keeps its values
      expect(result.entities[1].id).toBe('e2');
      expect(result.entities[1].label).toBe('Valid Entity');
    });

    it('should handle relations with missing fields by providing defaults', () => {
      const rawResponse = JSON.stringify({
        entities: [],
        relations: [
          { from: 'e1', to: 'e2' /* missing label and type */ },
        ],
        diagramType: { type: 'flow', confidence: 0.6 },
        summary: '',
      });

      const result = parseResponse(rawResponse);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].from).toBe('e1');
      expect(result.relations[0].to).toBe('e2');
      expect(result.relations[0].label).toBe('');
      expect(result.relations[0].type).toBe('unknown');
    });

    it('should handle truncated JSON with missing closing brace', () => {
      const rawResponse = '{"entities":[{"id":"e1","label":"Test","type":"x"}';

      // Should not throw - returns defaults or best-effort parse
      const result = parseResponse(rawResponse);
      // Either it gets parsed by the brace-fixing strategy or falls back to defaults
      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
    });

    it('should handle confidence values outside 0-1 range by clamping', () => {
      const rawResponse = JSON.stringify({
        entities: [],
        relations: [],
        diagramType: { type: 'flow', confidence: 1.5 },
        summary: '',
      });

      const result = parseResponse(rawResponse);

      expect(result.diagramType.confidence).toBe(1);
    });

    it('should handle negative confidence by clamping to 0', () => {
      const rawResponse = JSON.stringify({
        entities: [],
        relations: [],
        diagramType: { type: 'flow', confidence: -0.5 },
        summary: '',
      });

      const result = parseResponse(rawResponse);

      expect(result.diagramType.confidence).toBe(0);
    });
  });
});
