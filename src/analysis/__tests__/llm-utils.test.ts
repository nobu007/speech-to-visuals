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

  describe('generic type parameter', () => {
    it('supports typed return', () => {
      interface MyShape { name: string; age: number; }
      const result = parseJsonFromLLMText<MyShape>('{"name": "test", "age": 30}');
      expect(result.name).toBe('test');
      expect(result.age).toBe(30);
    });
  });
});
