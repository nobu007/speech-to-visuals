/**
 * Tests for parseJsonFromLLMText (llm-utils.ts)
 *
 * Covers all 5 parsing strategies with edge cases:
 *  1. Strategy 1: Standard cleaning (code fences, whitespace)
 *  2. Strategy 2: Extract JSON from surrounding text + incomplete brace repair
 *  3. Strategy 3: Remove LLM preamble patterns
 *  4. Strategy 4: Fix trailing commas + single-quote replacement
 *  5. Strategy 5: Close unclosed brackets/braces
 *  6. Error path: all strategies exhausted
 *  7. Type-parameterised return (generics)
 *  8. Edge cases: empty strings, nested structures, arrays
 */

import { parseJsonFromLLMText } from '@/analysis/llm-utils';

// ---------------------------------------------------------------------------
// Strategy 1: Standard cleaning (code fences + whitespace)
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: code fence stripping', () => {
  it('parses clean JSON string', () => {
    const result = parseJsonFromLLMText('{"key": "value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('strips ```json fence from start', () => {
    const result = parseJsonFromLLMText('```json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('strips plain ``` fence from start', () => {
    const result = parseJsonFromLLMText('```\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('handles uppercase JSON fence', () => {
    const result = parseJsonFromLLMText('```JSON\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('handles mixed-case json fence', () => {
    const result = parseJsonFromLLMText('```Json\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('strips trailing whitespace after opening fence', () => {
    const result = parseJsonFromLLMText('```json   \n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('strips leading/trailing whitespace on bare JSON', () => {
    const result = parseJsonFromLLMText('  \n  {"x": 42}  \n  ');
    expect(result).toEqual({ x: 42 });
  });
});

// ---------------------------------------------------------------------------
// Strategy 2: Extract JSON from surrounding text
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: extract JSON from surrounding text', () => {
  it('extracts JSON from preamble text', () => {
    const input = 'Here is the result:\n{"status": "ok"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ status: 'ok' });
  });

  it('extracts JSON with trailing text after closing brace', () => {
    const input = '{"value": true}\nThis is additional text.';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ value: true });
  });

  it('extracts nested JSON object from surrounding text', () => {
    const input = 'Some preamble\n{"outer": {"inner": 42}}\nSome postamble';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ outer: { inner: 42 } });
  });

  it('handles JSON inside markdown fence with extra text', () => {
    const input = '```json\n{"data": [1, 2, 3]}\n```\nDone.';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ data: [1, 2, 3] });
  });
});

// ---------------------------------------------------------------------------
// Strategy 2 (continued): Incomplete JSON brace repair
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: incomplete JSON brace repair', () => {
  it('adds missing closing brace for single level', () => {
    const input = '{"key": "value"';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('adds multiple missing closing braces for nested objects', () => {
    const input = '{"outer": {"inner": 1}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ outer: { inner: 1 } });
  });

  it('adds 3 missing closing braces for deeply nested objects', () => {
    const input = '{"a": {"b": {"c": 1}}';
    // Missing 1 closing brace (outermost)
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it('does not add braces when all are closed', () => {
    const input = '{"key": "value"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ key: 'value' });
  });
});

// ---------------------------------------------------------------------------
// Strategy 3: Remove LLM preamble patterns
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: LLM preamble removal', () => {
  it('removes "Here is the JSON:" prefix', () => {
    const input = 'Here is the JSON: {"x": 1}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ x: 1 });
  });

  it('removes "The JSON output is:" prefix', () => {
    const input = 'The JSON output is: {"x": 2}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ x: 2 });
  });

  it('removes "JSON:" prefix', () => {
    const input = 'JSON: {"x": 3}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ x: 3 });
  });

  it('removes "Here is the JSON response:" prefix (case-insensitive)', () => {
    const input = 'HERE IS THE JSON RESPONSE: {"y": 5}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ y: 5 });
  });
});

// ---------------------------------------------------------------------------
// Strategy 4: Fix trailing commas + single-quote replacement
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: trailing comma and single-quote fixes', () => {
  it('removes trailing comma before closing brace', () => {
    const input = '{"a": 1, "b": 2,}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('removes trailing comma before closing bracket', () => {
    const input = '{"arr": [1, 2, 3,]}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ arr: [1, 2, 3] });
  });

  it('replaces single quotes with double quotes', () => {
    const input = "{'key': 'value'}";
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('handles trailing comma with whitespace', () => {
    const input = '{"x": 10 ,  }';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ x: 10 });
  });

  it('handles multiple trailing commas in nested structure', () => {
    const input = '{"a": [1,], "b": {"c": 2,},}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: [1], b: { c: 2 } });
  });
});

// ---------------------------------------------------------------------------
// Strategy 4 (extended): Fix missing colon between key and value
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: missing colon repair', () => {
  it('fixes missing colon in simple object', () => {
    const input = '{"key" "value"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('fixes missing colon for multiple key-value pairs', () => {
    const input = '{"a" "1", "b" "2"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('fixes missing colon at end of object (before closing brace)', () => {
    const input = '{"a": 1, "b" "2"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: 1, b: '2' });
  });

  it('fixes missing colon with numeric value', () => {
    const input = '{"count" 42}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ count: 42 });
  });

  it('fixes missing colon with boolean value', () => {
    const input = '{"flag" true}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ flag: true });
  });

  it('does not break valid JSON with colons in values', () => {
    const input = '{"url": "https://example.com", "time": "12:30"}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ url: 'https://example.com', time: '12:30' });
  });

  it('fixes missing colon with scientific notation value (1e5)', () => {
    const input = '{"val" 1e5}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ val: 100000 });
  });

  it('fixes missing colon with uppercase scientific notation (1E5)', () => {
    const input = '{"val" 1E5}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ val: 100000 });
  });

  it('fixes missing colon with negative float exponent (-1.5e3)', () => {
    const input = '{"val" -1.5e3}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ val: -1500 });
  });

  it('fixes missing colon with scientific notation and negative exponent (1.2E-3)', () => {
    const input = '{"val" 1.2E-3}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ val: 0.0012 });
  });

  it('fixes missing colon with scientific notation and plus sign (1e+10)', () => {
    const input = '{"val" 1e+10}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ val: 10000000000 });
  });

  it('fixes missing colon in nested object', () => {
    const input = '{"outer": {"inner" "value"}}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ outer: { inner: 'value' } });
  });
});

// ---------------------------------------------------------------------------
// Strategy 5: Close unclosed brackets/braces
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: unclosed bracket/brace closure', () => {
  it('closes unclosed braces for simple incomplete object', () => {
    const input = '{"arr": [1, 2]';
    // Missing outermost closing brace
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ arr: [1, 2] });
  });

  it('closes multiple missing braces', () => {
    const input = '{"data": {"values": [1, 2, 3]}';
    // Missing outermost closing brace
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ data: { values: [1, 2, 3] } });
  });

  it('closes unclosed nested objects', () => {
    const input = '{"a": {"b": 1}';
    // Missing outermost }
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: { b: 1 } });
  });
});

// ---------------------------------------------------------------------------
// Error path: all strategies exhausted
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: error when unparseable', () => {
  it('throws descriptive error for completely invalid input', () => {
    expect(() => parseJsonFromLLMText('not json at all'))
      .toThrow('Failed to parse LLM JSON after all strategies');
  });

  it('includes preview of cleaned input in error message', () => {
    const input = 'completely unparseable text with no json';
    try {
      parseJsonFromLLMText(input);
      fail('Expected error');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('Preview:');
      expect(message).toContain('completely');
    }
  });

  it('truncates long preview to 300 chars', () => {
    const longInput = 'x'.repeat(500);
    try {
      parseJsonFromLLMText(longInput);
      fail('Expected error');
    } catch (err) {
      const message = (err as Error).message;
      const previewMatch = message.match(/Preview: (.*)$/);
      expect(previewMatch).not.toBeNull();
      // Preview should be <= 300 chars (after newline replacement)
      expect(previewMatch![1].length).toBeLessThanOrEqual(300);
    }
  });

  it('replaces newlines in error preview', () => {
    try {
      parseJsonFromLLMText('invalid\nwith\nnewlines\nno json here');
      fail('Expected error');
    } catch (err) {
      const message = (err as Error).message;
      // Newlines should be replaced with spaces in preview
      expect(message).not.toMatch(/Preview:.*\n/);
    }
  });
});

// ---------------------------------------------------------------------------
// Type-parameterised return (generics)
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: generic type parameter', () => {
  it('returns typed result when type parameter is provided', () => {
    interface MyType { name: string; count: number }
    const result = parseJsonFromLLMText<MyType>('{"name": "test", "count": 5}');
    expect(result.name).toBe('test');
    expect(result.count).toBe(5);
  });

  it('returns typed array result', () => {
    const result = parseJsonFromLLMText<number[]>('[1, 2, 3]');
    expect(result).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: edge cases', () => {
  it('parses empty object', () => {
    const result = parseJsonFromLLMText('{}');
    expect(result).toEqual({});
  });

  it('parses empty array', () => {
    const result = parseJsonFromLLMText('[]');
    expect(result).toEqual([]);
  });

  it('parses JSON with null values', () => {
    const result = parseJsonFromLLMText('{"a": null}');
    expect(result).toEqual({ a: null });
  });

  it('parses JSON with boolean values', () => {
    const result = parseJsonFromLLMText('{"t": true, "f": false}');
    expect(result).toEqual({ t: true, f: false });
  });

  it('parses JSON with numeric values including negatives and floats', () => {
    const result = parseJsonFromLLMText('{"a": -1, "b": 3.14, "c": 0}');
    expect(result).toEqual({ a: -1, b: 3.14, c: 0 });
  });

  it('parses JSON with escaped characters in strings', () => {
    const result = parseJsonFromLLMText('{"path": "C:\\\\Users\\\\test", "quote": "\\"hello\\""');
    expect(result).toEqual({ path: 'C:\\Users\\test', quote: '"hello"' });
  });

  it('parses JSON with unicode characters', () => {
    const result = parseJsonFromLLMText('{"jp": "\u65e5\u672c\u8a9e"}');
    expect(result).toEqual({ jp: '\u65e5\u672c\u8a9e' });
  });

  it('parses top-level bare number', () => {
    const result = parseJsonFromLLMText('42');
    expect(result).toBe(42);
  });

  it('parses deeply nested structure', () => {
    const input = '{"l1": {"l2": {"l3": {"l4": {"value": "deep"}}}}}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ l1: { l2: { l3: { l4: { value: 'deep' } } } } });
  });

  it('parses JSON with only a string value (no surrounding object)', () => {
    // This won't match the {..} regex, so strategy 2 falls through
    // But '"hello"' is valid JSON
    const result = parseJsonFromLLMText('"hello"');
    expect(result).toBe('hello');
  });

  it('parses JSON number', () => {
    const result = parseJsonFromLLMText('42');
    expect(result).toBe(42);
  });

  it('handles multiple code fences gracefully', () => {
    const input = '````json\n{"multi": true}\n````';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ multi: true });
  });

  it('parses complex real-world LLM output', () => {
    const input = `Here is the JSON response:

\`\`\`json
{
  "diagramType": "flow",
  "nodes": [
    {"id": "start", "label": "Start", "type": "terminal"},
    {"id": "process", "label": "Process Data", "type": "process"}
  ],
  "edges": [
    {"from": "start", "to": "process"}
  ]
}
\`\`\`

Hope this helps!`;

    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({
      diagramType: 'flow',
      nodes: [
        { id: 'start', label: 'Start', type: 'terminal' },
        { id: 'process', label: 'Process Data', type: 'process' },
      ],
      edges: [
        { from: 'start', to: 'process' },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Combination strategies
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: combined strategy application', () => {
  it('handles code fence + preamble + trailing comma', () => {
    const input = '```json\nHere is the JSON: {"items": [1, 2, 3,],}\n```';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('handles single quotes + missing closing brace + preamble', () => {
    const input = "JSON: {'key': 'value'";
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('handles fence + incomplete nested + trailing comma', () => {
    const input = '```json\n{"outer": {"inner": [1, 2,],';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ outer: { inner: [1, 2] } });
  });
});

// ---------------------------------------------------------------------------
// Array JSON extraction from surrounding text
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: array extraction from LLM text', () => {
  it('extracts array from preamble text', () => {
    const input = 'Here are the items: [1, 2, 3]';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it('extracts array from preamble with trailing text', () => {
    const input = 'Result: ["a", "b", "c"]\nDone.';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('extracts array of objects from surrounding text', () => {
    const input = '```json\n[{"id": 1}, {"id": 2}]\n```';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('extracts array with trailing comma fix', () => {
    const input = 'Here is the JSON: [1, 2, 3,]';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it('extracts array from fenced code block with preamble', () => {
    const input = 'Here are the nodes:\n```json\n[{"name": "A"}, {"name": "B"}]\n```\nEnd';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([{ name: 'A' }, { name: 'B' }]);
  });
});

// ---------------------------------------------------------------------------
// Incomplete array bracket repair
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: incomplete array bracket repair', () => {
  it('adds missing closing bracket for array', () => {
    const input = '[1, 2, 3';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it('adds multiple missing closing brackets for nested arrays', () => {
    const input = '[[1, 2], [3';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([[1, 2], [3]]);
  });

  it('handles incomplete array with objects inside', () => {
    const input = '[{"a": 1}, {"b": 2}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: input validation', () => {
  it('throws descriptive error for null input', () => {
    expect(() => parseJsonFromLLMText(null as unknown as string))
      .toThrow('input is null or undefined');
  });

  it('throws descriptive error for undefined input', () => {
    expect(() => parseJsonFromLLMText(undefined as unknown as string))
      .toThrow('input is null or undefined');
  });

  it('throws descriptive error for non-string input', () => {
    expect(() => parseJsonFromLLMText(42 as unknown as string))
      .toThrow('expected string, got number');
  });

  it('throws descriptive error for empty string', () => {
    expect(() => parseJsonFromLLMText(''))
      .toThrow('input is empty after cleaning');
  });

  it('throws descriptive error for whitespace-only string', () => {
    expect(() => parseJsonFromLLMText('   \n\t  '))
      .toThrow('input is empty after cleaning');
  });
});

// ---------------------------------------------------------------------------
// Object vs Array priority (closest-to-start wins)
// ---------------------------------------------------------------------------
describe('parseJsonFromLLMText: mixed object/array extraction priority', () => {
  it('extracts array when it appears before object in text', () => {
    const input = 'Items: [1, 2] then config: {"a": 1}';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual([1, 2]);
  });

  it('extracts object when it appears before array in text', () => {
    const input = 'Config: {"a": 1} then items: [1, 2]';
    const result = parseJsonFromLLMText(input);
    expect(result).toEqual({ a: 1 });
  });
});
