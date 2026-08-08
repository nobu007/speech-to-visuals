import { parseJsonFromLLMText } from '../llm-utils';
import { LLMParsingError } from '../analysis-errors';

describe('parseJsonFromLLMText', () => {
  describe('input validation', () => {
    it('throws LLMParsingError on null input', () => {
      expect(() => parseJsonFromLLMText(null as unknown as string))
        .toThrow(LLMParsingError);
    });

    it('throws LLMParsingError on undefined input', () => {
      expect(() => parseJsonFromLLMText(undefined as unknown as string))
        .toThrow(LLMParsingError);
    });

    it('throws LLMParsingError on non-string input', () => {
      expect(() => parseJsonFromLLMText(42 as unknown as string))
        .toThrow(LLMParsingError);
    });

    it('throws LLMParsingError on empty string', () => {
      expect(() => parseJsonFromLLMText('')).toThrow(LLMParsingError);
    });

    it('throws LLMParsingError on whitespace-only string', () => {
      expect(() => parseJsonFromLLMText('   \n\t  ')).toThrow(LLMParsingError);
    });
  });

  describe('code fence removal', () => {
    it('strips ```json fences', () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'value' });
    });

    it('strips bare ``` fences', () => {
      const input = '```\n{"key": "value"}\n```';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'value' });
    });

    it('strips ```JSON (uppercase) fences', () => {
      const input = '```JSON\n{"key": "value"}\n```';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'value' });
    });
  });

  describe('plain JSON objects', () => {
    it('parses a simple object', () => {
      expect(parseJsonFromLLMText('{"a": 1, "b": 2}')).toEqual({ a: 1, b: 2 });
    });

    it('parses a nested object', () => {
      const input = '{"outer": {"inner": "val"}}';
      expect(parseJsonFromLLMText(input)).toEqual({ outer: { inner: 'val' } });
    });
  });

  describe('plain JSON arrays', () => {
    it('parses a simple array', () => {
      expect(parseJsonFromLLMText('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('parses array of objects', () => {
      const input = '[{"x": 1}, {"y": 2}]';
      expect(parseJsonFromLLMText(input)).toEqual([{ x: 1 }, { y: 2 }]);
    });
  });

  describe('JSON embedded in text', () => {
    it('extracts object from preamble text', () => {
      const input = 'Here is the result: {"key": "val"} done.';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'val' });
    });

    it('extracts array from surrounding text', () => {
      const input = 'Result:\n[1, 2, 3]\nThat is all.';
      expect(parseJsonFromLLMText(input)).toEqual([1, 2, 3]);
    });

    it('prefers earliest JSON when both object and array present', () => {
      const input = 'text {"a": 1} text [1, 2]';
      expect(parseJsonFromLLMText(input)).toEqual({ a: 1 });
    });

    it('prefers earliest JSON when array comes first', () => {
      const input = 'text [1, 2] text {"a": 1}';
      expect(parseJsonFromLLMText(input)).toEqual([1, 2]);
    });
  });

  describe('common LLM text patterns', () => {
    it('strips "Here is the JSON:" prefix', () => {
      const input = 'Here is the JSON: {"key": "val"}';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'val' });
    });

    it('strips "The JSON output:" prefix', () => {
      const input = 'The JSON output: {"key": "val"}';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'val' });
    });

    it('strips "JSON:" prefix', () => {
      const input = 'JSON: {"key": "val"}';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'val' });
    });
  });

  describe('error recovery - trailing commas', () => {
    it('fixes trailing comma in object', () => {
      const input = '{"a": 1, "b": 2,}';
      expect(parseJsonFromLLMText(input)).toEqual({ a: 1, b: 2 });
    });

    it('fixes trailing comma in array', () => {
      const input = '[1, 2, 3,]';
      expect(parseJsonFromLLMText(input)).toEqual([1, 2, 3]);
    });
  });

  describe('error recovery - single quotes', () => {
    it('converts single-quoted keys to double quotes', () => {
      const input = "{'key': 'value'}";
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'value' });
    });
  });

  describe('error recovery - apostrophes inside double-quoted values', () => {
    // Regression: the single→double quote repair pass is DESTRUCTIVE for
    // legitimate apostrophes inside double-quoted values. When a trailing
    // comma (or other NON-destructive repair) alone would yield valid JSON,
    // the destructive pass must not run and corrupt it. These labels model the
    // real failure surface — gemini-analyzer parses LLM diagram JSON whose
    // node/edge labels routinely contain "Don't", "User's", etc.
    it('preserves an apostrophe in a value when a trailing comma is also present', () => {
      const input = '{"nodes": [{"label": "User\'s input"}],}';
      expect(parseJsonFromLLMText(input)).toEqual({
        nodes: [{ label: "User's input" }],
      });
    });

    it('preserves an apostrophe in a value when a missing-colon repair is needed', () => {
      // The non-destructive colon repair (attempt 1) must fix the missing colon
      // WITHOUT converting the apostrophe to a double quote.
      const input = '{"label" "Don\'t repeat yourself"}';
      expect(parseJsonFromLLMText(input)).toEqual({
        label: "Don't repeat yourself",
      });
    });

    it('still repairs genuinely single-quoted JSON without value apostrophes', () => {
      // Capability preserved: single-quoted JSON is still fixed by attempt 2.
      const input = "{'greeting': 'hello world'}";
      expect(parseJsonFromLLMText(input)).toEqual({ greeting: 'hello world' });
    });
  });

  describe('error recovery - incomplete structures', () => {
    it('repairs missing closing brace', () => {
      const input = '{"a": 1';
      expect(parseJsonFromLLMText(input)).toEqual({ a: 1 });
    });

    it('repairs multiple missing closing braces', () => {
      const input = '{"outer": {"inner": "val"';
      expect(parseJsonFromLLMText(input)).toEqual({ outer: { inner: 'val' } });
    });

    it('repairs missing closing bracket', () => {
      const input = '[1, 2, 3';
      expect(parseJsonFromLLMText(input)).toEqual([1, 2, 3]);
    });
  });

  describe('unparseable input', () => {
    it('throws LLMParsingError with preview for completely invalid JSON', () => {
      try {
        parseJsonFromLLMText('this is not json at all');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(LLMParsingError);
        expect((e as LLMParsingError).preview).toBeDefined();
      }
    });

    it('throws LLMParsingError for malformed JSON', () => {
      expect(() => parseJsonFromLLMText('{:}]')).toThrow(LLMParsingError);
    });
  });

  describe('error recovery - missing colon between key and value', () => {
    it('fixes missing colon for string value', () => {
      const input = '{"key" "value"}';
      expect(parseJsonFromLLMText(input)).toEqual({ key: 'value' });
    });

    it('fixes missing colon for numeric value', () => {
      const input = '{"count" 42}';
      expect(parseJsonFromLLMText(input)).toEqual({ count: 42 });
    });

    it('fixes missing colon for boolean value', () => {
      const input = '{"flag" true}';
      expect(parseJsonFromLLMText(input)).toEqual({ flag: true });
    });

    it('fixes missing colon when value is a nested object', () => {
      const input = '{"meta" {"nested": true}}';
      expect(parseJsonFromLLMText(input)).toEqual({ meta: { nested: true } });
    });

    it('fixes missing colon when value is an array', () => {
      const input = '{"items" [1, 2, 3]}';
      expect(parseJsonFromLLMText(input)).toEqual({ items: [1, 2, 3] });
    });

    it('fixes missing colon for null value', () => {
      const input = '{"data" null}';
      expect(parseJsonFromLLMText(input)).toEqual({ data: null });
    });

    it('fixes multiple missing colons in the same object', () => {
      const input = '{"a" "x", "b" 42, "c" true}';
      expect(parseJsonFromLLMText(input)).toEqual({ a: 'x', b: 42, c: true });
    });

    it('fixes missing colon in nested object', () => {
      const input = '{"outer" {"inner" "val"}}';
      expect(parseJsonFromLLMText(input)).toEqual({ outer: { inner: 'val' } });
    });

    it('fixes missing colon for negative number', () => {
      const input = '{"offset" -42}';
      expect(parseJsonFromLLMText(input)).toEqual({ offset: -42 });
    });

    it('fixes missing colon for float number', () => {
      const input = '{"ratio" 3.14}';
      expect(parseJsonFromLLMText(input)).toEqual({ ratio: 3.14 });
    });

    it('fixes missing colon followed by opening brace of nested value', () => {
      const input = '{"config" {"debug" true, "verbose" false}}';
      expect(parseJsonFromLLMText(input)).toEqual({
        config: { debug: true, verbose: false },
      });
    });
  });

  describe('generic type parameter', () => {
    it('supports typed return', () => {
      interface MyShape { name: string; age: number; }
      const result = parseJsonFromLLMText<MyShape>('{"name": "test", "age": 30}');
      expect(result.name).toBe('test');
      expect(result.age).toBe(30);
    });
  });
});
