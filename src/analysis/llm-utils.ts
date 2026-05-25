/**
 * Utility helpers for working with LLM responses
 */

import { LLMParsingError } from './analysis-errors';

/**
 * Extract and parse JSON from an LLM text response.
 * - Strips optional triple backtick code fences (``` or ```json)
 * - Removes markdown formatting and extra text
 * - Trims whitespace
 * - Attempts multiple parsing strategies (objects and arrays)
 * - Throws a typed LLMParsingError on JSON.parse failure
 */
export function parseJsonFromLLMText<T = unknown>(rawText: string): T {
  // Input validation
  if (rawText == null) {
    throw new LLMParsingError('parseJsonFromLLMText: input is null or undefined');
  }
  if (typeof rawText !== 'string') {
    throw new LLMParsingError(`parseJsonFromLLMText: expected string, got ${typeof rawText}`);
  }

  // Strategy 1: Standard cleaning
  let cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (cleaned.length === 0) {
    throw new LLMParsingError('parseJsonFromLLMText: input is empty after cleaning');
  }

  // Strategy 2: Extract JSON from surrounding text
  // When text starts with { or [, use type-aware extraction/repair.
  // Otherwise, extract JSON from surrounding preamble/postamble text.
  if (cleaned.startsWith('{')) {
    // Object-first: try complete match at start, else repair braces
    const objectMatch = cleaned.match(/(\{[\s\S]*\})/);
    if (objectMatch && objectMatch.index === 0) {
      const afterMatch = cleaned.slice(objectMatch[0].length);
      // Check for continuation (comma + more JSON) suggesting incompleteness
      if (/^\s*[,]/.test(afterMatch) || /^\s*[[{]/.test(afterMatch)) {
        cleaned = repairBraces(cleaned);
      } else {
        cleaned = objectMatch[0];
      }
    } else {
      cleaned = repairBraces(cleaned);
    }
  } else if (cleaned.startsWith('[')) {
    // Array-first: try complete match at start, else repair brackets
    const arrayMatch = cleaned.match(/(\[[\s\S]*\])/);
    if (arrayMatch && arrayMatch.index === 0) {
      const afterMatch = cleaned.slice(arrayMatch[0].length);
      // Check for continuation suggesting incompleteness
      if (/^\s*[,]/.test(afterMatch) || /^\s*[[{]/.test(afterMatch)) {
        cleaned = repairBrackets(cleaned);
      } else {
        cleaned = arrayMatch[0];
      }
    } else {
      cleaned = repairBrackets(cleaned);
    }
  } else {
    // Text has surrounding content - extract JSON from it
    const objectMatch = cleaned.match(/(\{[\s\S]*\})/);
    const arrayMatch = cleaned.match(/(\[[\s\S]*\])/);

    if (objectMatch && arrayMatch) {
      const objIndex = cleaned.indexOf(objectMatch[0]);
      const arrIndex = cleaned.indexOf(arrayMatch[0]);
      cleaned = objIndex <= arrIndex ? objectMatch[0] : arrayMatch[0];
    } else if (objectMatch) {
      cleaned = objectMatch[0];
    } else if (arrayMatch) {
      cleaned = arrayMatch[0];
    } else {
      // Try incomplete JSON surrounded by text
      const incompleteObject = cleaned.match(/(\{[\s\S]*)/);
      const incompleteArray = cleaned.match(/(\[[\s\S]*)/);

      if (incompleteObject && incompleteArray) {
        const objIdx = cleaned.indexOf(incompleteObject[0]);
        const arrIdx = cleaned.indexOf(incompleteArray[0]);
        cleaned = objIdx <= arrIdx
          ? repairBraces(incompleteObject[0])
          : repairBrackets(incompleteArray[0]);
      } else if (incompleteObject) {
        cleaned = repairBraces(incompleteObject[0]);
      } else if (incompleteArray) {
        cleaned = repairBrackets(incompleteArray[0]);
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
        throw new LLMParsingError(
          `Failed to parse LLM JSON after all strategies. Preview: ${preview}`,
          { preview },
        );
      }
    }
  }
}

/**
 * Add missing closing braces to an incomplete JSON object string
 */
function repairBraces(text: string): string {
  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  const missing = openBraces - closeBraces;
  return missing > 0 ? text + '}'.repeat(missing) : text;
}

/**
 * Add missing closing brackets to an incomplete JSON array string
 */
function repairBrackets(text: string): string {
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;
  const missing = openBrackets - closeBrackets;
  return missing > 0 ? text + ']'.repeat(missing) : text;
}

