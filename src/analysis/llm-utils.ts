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
  // Look for content between first { and last } with greedy matching
  const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  } else {
    // Try to find incomplete JSON (missing closing brace)
    const incompleteMatch = cleaned.match(/(\{[\s\S]*)/);
    if (incompleteMatch) {
      // Count braces to determine if we need to add closing braces
      const text = incompleteMatch[0];
      const openBraces = (text.match(/\{/g) || []).length;
      const closeBraces = (text.match(/\}/g) || []).length;
      const missingBraces = openBraces - closeBraces;

      if (missingBraces > 0) {
        cleaned = text + '}'.repeat(missingBraces);
      } else {
        cleaned = text;
      }
    }
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
    let fixed = cleaned
      .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"');      // Replace single quotes with double quotes

    try {
      return JSON.parse(fixed) as T;
    } catch (secondErr) {
      // Strategy 5: Handle incomplete nested structures
      // Add missing closing brackets and braces
      const openCurly = (fixed.match(/\{/g) || []).length;
      const closeCurly = (fixed.match(/\}/g) || []).length;
      const openSquare = (fixed.match(/\[/g) || []).length;
      const closeSquare = (fixed.match(/\]/g) || []).length;

      // Close arrays first, then objects
      if (openSquare > closeSquare) {
        fixed += ']'.repeat(openSquare - closeSquare);
      }
      if (openCurly > closeCurly) {
        fixed += '}'.repeat(openCurly - closeCurly);
      }

      try {
        return JSON.parse(fixed) as T;
      } catch (thirdErr) {
        const preview = cleaned.slice(0, 300).replace(/\n/g, ' ');
        throw new Error(`Failed to parse LLM JSON after all strategies. Preview: ${preview}`);
      }
    }
  }
}

