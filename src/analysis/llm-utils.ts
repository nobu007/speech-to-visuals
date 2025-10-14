/**
 * Utility helpers for working with LLM responses
 */

/**
 * Extract and parse JSON from an LLM text response.
 * - Strips optional triple backtick code fences (``` or ```json)
 * - Trims whitespace
 * - Throws a descriptive error on JSON.parse failure
 */
export function parseJsonFromLLMText<T = unknown>(rawText: string): T {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const preview = cleaned.slice(0, 200).replace(/\n/g, ' ');
    throw new Error(`Failed to parse LLM JSON. Preview: ${preview}`);
  }
}

