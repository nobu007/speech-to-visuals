/**
 * Utility helpers for working with LLM responses
 */

import { LLMParsingError } from './analysis-errors';

/**
 * Keys that are never legitimate in LLM-produced diagram/analysis JSON but are
 * reachable attack surface whenever the parsed object is later spread, deep-
 * merged, or walked by a generic assigner. Keeping one of these as an own
 * property (e.g. `{"__proto__": {...}}` or `{"constructor": {...}}`) can mutate
 * Object.prototype downstream. They are dropped unconditionally at the parse
 * boundary — diagram data has no field by these names.
 */
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Maximum nesting depth the sanitizer will walk before pruning a branch.
 * Diagram/analysis JSON is shallow (response → nodes[] → {position:{x,y}} ≈ 4
 * levels); 128 is far beyond any legitimate payload yet bounds the recursion so
 * a pathologically deep (but parseable) model output cannot overflow the stack
 * inside the sanitizer itself.
 */
const MAX_SANITIZE_DEPTH = 128;

/**
 * Sanitize a value parsed from untrusted (model-generated) JSON.
 *
 * Two attack vectors are neutralized at the trust boundary, pairing with the
 * storage-side finiteness guards (safe-storage.ts) to close the class:
 *
 * 1. Numeric overflow — `JSON.parse('1e400')` yields `Infinity` (typeof ===
 *    'number'), which sails past `typeof x === 'number'` guards and poisons
 *    downstream arithmetic (frame loops, pixel buffers, quality metrics).
 *    Non-finite numbers are replaced with `null`.
 *
 * 2. Prototype pollution — `__proto__` / `constructor` / `prototype` keys are
 *    dropped from every object. (`JSON.parse` itself creates these as own
 *    properties rather than mutating the prototype, but any later spread/merge
 *    of the parsed value re-introduces the hazard; stripping at the boundary is
 *    defense-in-depth with no downside.)
 *
 * The input is otherwise returned unchanged, so legitimate JSON is unaffected.
 */
export function sanitizeUntrustedJsonValue(value: unknown, depth = 0): unknown {
  // Depth guard: prune deeply nested branches to a safe value rather than risk
  // stack exhaustion inside this recursive walk.
  if (depth > MAX_SANITIZE_DEPTH) {
    return null;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      out[i] = sanitizeUntrustedJsonValue(value[i], depth + 1);
    }
    return out;
  }

  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // Object.keys returns own enumerable string keys only — never the inherited
    // prototype chain — so reading `source[key]` here touches no polluted state.
    for (const key of Object.keys(source)) {
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        continue;
      }
      out[key] = sanitizeUntrustedJsonValue(source[key], depth + 1);
    }
    return out;
  }

  // Neutralize Infinity / -Infinity (and NaN, which cannot originate from
  // JSON.parse but is covered defensively) to null.
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }

  return value;
}

/**
 * Parse a JSON string received across a trust boundary — an HTTP response body
 * from a remote service, an API boundary, a disk file not written by this code
 * — and neutralize the two vectors handled by `sanitizeUntrustedJsonValue`
 * (numeric overflow `1e400` → Infinity, and `__proto__`/`constructor`/
 * `prototype` keys) in a single step.
 *
 * Use this for STRUCTURED JSON from a trust boundary (the response is already
 * valid JSON). Use `parseJsonFromLLMText` for free-form LLM text that also
 * needs markdown-fence stripping and repair. This is the structured-JSON
 * companion to that text-mode helper, so every external JSON parse site can
 * aggregate onto the same chokepoint instead of re-deriving the guard.
 *
 * No-op on legitimate JSON. Throws `SyntaxError` on invalid JSON exactly as
 * `JSON.parse` does, so callers' existing parse-failure handling is preserved.
 */
export function parseUntrustedJson(text: string): unknown {
  return sanitizeUntrustedJsonValue(JSON.parse(text));
}

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

  // Strategy 4 helpers. The colon-repair regexes match DOUBLE-quoted
  // keys/values, so they must always run AFTER any single→double quote
  // conversion (when that conversion is applied at all).
  const removeTrailingCommas = (s: string): string =>
    s.replace(/,\s*}/g, '}')  // Remove trailing commas in objects
     .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays

  // Fix a missing colon between a quoted key and its value. Assumes the key
  // and any string value are already double-quoted.
  const fixMissingColons = (s: string): string =>
    s
      // "key" "value" → "key": "value"  (value followed by , ] or })
      .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s+"([^"\\]*(?:\\.[^"\\]*)*)"(\s*[,\]}])/g, '"$1": "$2"$3')
      // "key" "value"  (value at end of nested object, followed by {)
      .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s+"([^"\\]*(?:\\.[^"\\]*)*)"(\s*\{)/g, '"$1": "$2"$3')
      // "key" 42 / true / null → "key": 42  (integers, floats, scientific notation)
      .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s+(true|false|null|-?\d+\.?\d*(?:[eE][+-]?\d+)?|-?\d+(?:[eE][+-]?\d+)?)(\s*[,\]}])/g, '"$1": $2$3')
      // "key" { → "key": {  (nested object)
      .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s+(\{)/g, '"$1": $2')
      // "key" [ → "key": [  (array)
      .replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s+(\[)/g, '"$1": $2');

  // Parse + sanitize untrusted model output in one step so EVERY successful
  // parse path — including the repair fallbacks below — is guarded against
  // numeric overflow (1e400 → Infinity) and prototype-pollution keys.
  // Delegates to parseUntrustedJson so the text-mode and structured-JSON trust
  // boundaries share one sanitized-parse implementation.
  const parseSanitized = parseUntrustedJson;

  try {
    return parseSanitized(cleaned) as T;
  } catch (err) {
    // Strategy 4: Try to fix common JSON issues.
    //
    // Attempt 1 — NON-destructive repairs (trailing commas + missing colons).
    // These never touch a legitimate apostrophe inside a double-quoted value.
    // Trailing commas are a frequent LLM slip and fixing them alone often
    // yields already-valid JSON, so we parse that BEFORE any quote conversion.
    // (Previously the single→double quote pass ran first and CORRUPTED such
    // inputs: `{"label": "User's input"},` was comma-repaired to valid JSON,
    // then `'`→`"` broke it into `"User"s input"` and the parse threw.)
    let fixed = fixMissingColons(removeTrailingCommas(cleaned));
    try {
      return parseSanitized(fixed) as T;
    } catch {
      // Attempt 2 — additionally convert single quotes to double quotes.
      // Required to repair single-quoted JSON (`{'k': 'v'}`), but DESTRUCTIVE
      // for apostrophes inside double-quoted values, so it runs only after the
      // safe attempt fails. Colon repairs run AFTER the conversion so the
      // regexes see double quotes — preserving the original repair capability.
      fixed = fixMissingColons(removeTrailingCommas(cleaned).replace(/'/g, '"'));
      try {
        return parseSanitized(fixed) as T;
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
          return parseSanitized(fixed) as T;
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

