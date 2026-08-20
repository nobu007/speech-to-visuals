/**
 * @jest-environment node
 */
/**
 * xss-escape-json-for-script-mutation-pinning.test.ts — TC-305
 *
 * Pins the interactive-HTML XSS guard `escapeJsonForScript` at
 * `src/export/enhanced-export-engine.ts:166` (the structured-JSON script-block
 * embedding boundary) against silent regression.
 *
 * THE BUG CLASS. When an exported HTML page embeds JSON inside a `<script>`
 * block, the HTML tokenizer terminates that block on ANY `</script` sequence
 * followed by whitespace, "/", or ">" — NOT only the exact `</script>` token
 * (HTML5 §12.2.6.5). An earlier naive guard `/\<\/script\>/gi` matched the
 * complete token only, so whitespace variants (`</script >`, `</script\t>`,
 * `</script\n>`, `</script/>`) survived and let attacker-controlled text — in
 * this pipeline, transcription-derived labels and summaries — break out of the
 * script block and execute injected markup (XSS).
 *
 * The canonical neutralization removes `<` and `>` from the serialized text
 * ENTIRELY, encoding them as `\u003c` / `\u003e`. JSON parsers decode those
 * back to `<` / `>`, so the embedded data round-trips losslessly while no raw
 * angle bracket — and therefore no HTML tag — can appear in the payload.
 *
 *   export function escapeJsonForScript(json: string): string {
 *     return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
 *   }
 *
 * WHY MUTATION PINNING. The behavioral tests in
 * `src/export/__tests__/xss-security.test.ts` and `sanitize-fuzz.test.ts`
 * exercise the six escape variants and prove the guard WORKS today. But they
 * import the helper and assert on its output — a future "simplification" that
 * reverts to the naive `</script>`-only replace passes every ASCII-only and
 * CJK-free test silently, because the divergence only shows on whitespace /
 * slash variants. Layer 1 pins the two global `<`/`>` replace branches in the
 * source TEXT and fails on any edit that narrows them back to `</script>`;
 * Layer 2 proves the neutralization invariant on the variant payloads; Layer 3
 * proves the naive (mutated) form leaks the very variants the guard exists for.
 *
 * SCOPE NOTE. The MEMORY notes that PLAIN-JSON `</script>` (the non-interactive
 * export path) is INTENTIONALLY left unescaped — a different, deliberate
 * boundary. This pin covers ONLY the interactive-HTML `escapeJsonForScript`
 * boundary, which MUST escape.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { escapeJsonForScript } from '@/export/enhanced-export-engine';

const GUARD_FILE = 'src/export/enhanced-export-engine.ts';

// Extract the function body (the return statement only) so anchors and
// negative-anchors are scoped to `escapeJsonForScript` itself, not the
// docstring above it or the rest of the file.
function escapeFnBody(): string {
  const src = readFileSync(GUARD_FILE, 'utf8');
  const m = src.match(/function escapeJsonForScript\(json: string\): string \{([\s\S]*?)\n\}/);
  if (m === null) {
    throw new Error(`escapeJsonForScript body not found in ${GUARD_FILE}`);
  }
  return m[1];
}

// --- (TC-305-01) source anchors: pin the two global angle-bracket replacements --

describe('escapeJsonForScript XSS guard — source anchors pinned (TC-305-01)', () => {
  // Anchors deliberately match structural tokens (`replace(/</g`, `u003c`) and
  // avoid counting backslashes in the source string literal, which is brittle.
  it('the function replaces EVERY "<" globally (single-char, not the </script> token)', () => {
    // A revert to the naive `/\<\/script\>/gi` leaves this anchor unmatched
    // (that form has no bare `replace(/</g`) → RED.
    expect(escapeFnBody()).toMatch(/\.replace\(\/<\/g/);
  });

  it('the function replaces EVERY ">" globally', () => {
    expect(escapeFnBody()).toMatch(/\.replace\(\/>\/g/);
  });

  it('both replacements target the \\u00XX angle-bracket escapes', () => {
    expect(escapeFnBody()).toMatch(/u003c/);
    expect(escapeFnBody()).toMatch(/u003e/);
  });

  it('the function body does NOT contain the naive "</script>"-only token replace', () => {
    // The OLD bug shape matched the complete `</script>` token only and leaked
    // whitespace/slash variants. If it ever reappears inside the function
    // body → RED. (The function body is the single return statement, which
    // must not reference `</script`.)
    expect(escapeFnBody()).not.toMatch(/<\/script/i);
  });
});

// --- (TC-305-02) behavioral witness: every script-breakout variant is neutralized -

describe('escapeJsonForScript XSS guard — neutralization invariant (TC-305-02)', () => {
  // The HTML5 tokenizer terminates a <script> block on "</script" followed by
  // whitespace, "/", or ">". Each of these must lose its angle brackets.
  const breakouts = [
    '</script>',
    '</script >',
    '</script\t>',
    '</script\n>',
    '</script/>',
    '</SCRIPT>',
    '</script\x0c>', // form feed is whitespace too
  ];

  it.each(breakouts)('neutralizes the %j breakout (no raw < or > remains)', (payload) => {
    const json = JSON.stringify({ label: payload });
    const escaped = escapeJsonForScript(json);
    // No raw angle bracket may survive — that is the bulletproof property.
    expect(escaped).not.toMatch(/[<>]/);
  });

  it('the escaped payload round-trips through JSON.parse losslessly', () => {
    const data = { summary: 'Step <b>1</b>: </script><img src=x>' };
    const escaped = escapeJsonForScript(JSON.stringify(data));
    // Round-trips because JSON decodes \u003c/\u003e back to </>.
    expect(JSON.parse(escaped)).toEqual(data);
  });

  it('attacker-controlled transcription data carries no breakout sequence after escaping', () => {
    // Scope the check to the EMBEDDED DATA (not the page's legitimate closing
    // tag). The escaped data must contain no literal "</script" — the tokenizer
    // sequence that would break out — and no raw angle bracket at all.
    const evil = 'normal text </script><script>alert(1)</script> </script >';
    const escaped = escapeJsonForScript(JSON.stringify({ t: evil }));
    expect(escaped).not.toMatch(/[<>]/);
    expect(escaped).not.toMatch(/<\/script/i); // no literal breakout token in the data
    // And it still round-trips.
    expect(JSON.parse(escaped).t).toBe(evil);
  });
});

// --- (TC-305-03) mutation witness: the naive form leaks the variants -----------

describe('escapeJsonForScript XSS guard — mutation witness (TC-305-03)', () => {
  it('a naive "</script>"-only replace LEAVES the whitespace variant escapable', () => {
    // This is the BUG shape — what the guard defends against. If this assertion
    // ever flips (the naive form becomes safe), the variants are no longer a
    // vector and the guard could be simplified; the test fails loudly so we
    // notice. The naive form strips the EXACT token but leaves "</script >".
    const naive = (json: string): string => json.replace(/<\/script>/gi, '');
    const payload = JSON.stringify({ label: '</script >' });
    const result = naive(payload);
    // The whitespace variant survives — a real HTML tokenizer WOULD break out.
    expect(result).toMatch(/<\/script\s/i);
  });

  it('the guarded form neutralizes the SAME variant the naive form leaks', () => {
    const payload = JSON.stringify({ label: '</script >' });
    // Guarded: no raw angle bracket. The delta vs. the naive form above is the
    // guard's load-bearing contribution — pinning that delta is the point of TC-305.
    expect(escapeJsonForScript(payload)).not.toMatch(/[<>]/);
  });
});
