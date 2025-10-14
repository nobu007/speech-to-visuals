/**
 * Utility helpers for working with LLM responses
 */

/**
 * Extract and parse JSON from an LLM text response.
 * - Strips optional triple backtick code fences (``` or ```json)
 * - Removes markdown formatting and extra text
 * - Trims whitespace
 * - Attempts multiple parsing strategies
 * - Throws a descriptive error on JSON.parse failure
 */
export function parseJsonFromLLMText<T = unknown>(rawText: string): T {
  // Strategy 1: Standard cleaning
  let cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // Strategy 2: Extract JSON from surrounding text
  // Look for content between first { and last }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  // Strategy 3: Remove common LLM text patterns before/after JSON
  cleaned = cleaned
    .replace(/^Here is the JSON.*?:/i, "")
    .replace(/^The JSON.*?:/i, "")
    .replace(/^JSON.*?:/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Strategy 4: Try to fix common JSON issues
    const fixed = cleaned
      .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"');      // Replace single quotes with double quotes

    try {
      return JSON.parse(fixed) as T;
    } catch (secondErr) {
      const preview = cleaned.slice(0, 300).replace(/\n/g, ' ');
      throw new Error(`Failed to parse LLM JSON after all strategies. Preview: ${preview}`);
    }
  }
}

