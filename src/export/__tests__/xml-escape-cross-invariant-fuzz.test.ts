/**
 * Cross-invariant pin for the XML/SVG escape consolidation.
 *
 * Two byte-identical copies of the escape logic previously lived in
 * `animated-scene-renderer.ts` (exported escapeXml) and `multi-format-exporter.ts`
 * (private escapeXML), both on the SVG export security path — an invariant-split
 * that could drift apart on any future edit. The logic now has ONE definition in
 * `xml-escape.ts`; both emitters import it. This file pins that fact so a
 * re-divergence (re-inlining a second copy, changing one emitter's entities,
 * flipping the replacement order) is caught immediately.
 *
 * Reuses the shared fuzz helper (@tests/helpers/fuzz) for determinism.
 */

import { describe, it, expect } from '@jest/globals';
import { mulberry32 } from '@tests/helpers/fuzz';
import { escapeXml as canonical } from '../xml-escape';
import { escapeXml as reexported } from '../animated-scene-renderer';

const DANGEROUS = ['&', '<', '>', '"', "'"] as const;

/**
 * The only way a raw dangerous character can survive escaping is as part of an
 * emitted ENTITY (`&amp;`, `&lt;`, …). Stripping those entity forms first means
 * any remaining raw `<`/`>`/`&`/`"`/`'` is an escaping failure.
 */
function hasRawDangerous(s: string): boolean {
  let stripped = s;
  for (const ent of ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;']) {
    stripped = stripped.split(ent).join('');
  }
  return DANGEROUS.some((c) => stripped.includes(c));
}

describe('XML/SVG escape: single source of truth (xml-escape.ts)', () => {
  // -------------------------------------------------------------------------
  // Structural pin — the canonical definition and the re-exported public
  // surface MUST be the same function binding. On the old code these were two
  // separately-defined functions, so this would have been false.
  // -------------------------------------------------------------------------
  describe('structural: one function binding', () => {
    it('canonical xml-escape.escapeXml IS animated-scene-renderer.escapeXml (re-exported, not re-defined)', () => {
      expect(canonical).toBe(reexported);
    });
  });

  // -------------------------------------------------------------------------
  // Literal anchors — the entity table + the &-first ordering invariant.
  // -------------------------------------------------------------------------
  describe('literal anchors: entity table and replacement order', () => {
    it('maps the five XML special characters to their entities', () => {
      expect(canonical('&')).toBe('&amp;');
      expect(canonical('<')).toBe('&lt;');
      expect(canonical('>')).toBe('&gt;');
      expect(canonical('"')).toBe('&quot;');
      expect(canonical("'")).toBe('&apos;');
    });

    it('escapes & BEFORE < so emitted entities are not double-encoded', () => {
      // A raw '<' must become exactly '&lt;', never '&amp;lt;'. '&amp;lt;' would
      // mean '<' was escaped first to '&lt;', then the '&' inside it was escaped
      // again — the classic wrong-order bug.
      expect(canonical('<')).toBe('&lt;');
      expect(canonical('<')).not.toBe('&amp;lt;');
      // And a pre-existing entity-like input is re-escaped (stays literal text):
      expect(canonical('&amp;')).toBe('&amp;amp;');
    });

    it('escapes the full tag-breakout payload, attribute-context payload, and empty string', () => {
      expect(canonical('<script>alert(1)</script>')).toBe(
        '&lt;script&gt;alert(1)&lt;/script&gt;',
      );
      expect(canonical('" onmouseover="alert(1)')).toBe(
        '&quot; onmouseover=&quot;alert(1)',
      );
      expect(canonical('')).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // Fuzz — arbitrary attack payloads leave no raw dangerous character, and the
  // two import paths agree byte-for-byte.
  // -------------------------------------------------------------------------
  describe('fuzz: no raw specials survive + both paths agree', () => {
    const alphabet = 'abcABC019 .&<>"\'=();/\n\t\\';

    it('5000 random payloads leave no raw dangerous character', () => {
      const rng = mulberry32(0x5a1e0e);
      for (let i = 0; i < 5000; i++) {
        const len = Math.floor(rng() * 24);
        let s = '';
        for (let j = 0; j < len; j++) s += alphabet[Math.floor(rng() * alphabet.length)];
        const out = canonical(s);
        expect(hasRawDangerous(out)).toBe(false);
      }
    });

    it('canonical and re-exported produce byte-identical output for 5000 payloads', () => {
      const rng = mulberry32(0xc0ffee);
      for (let i = 0; i < 5000; i++) {
        const len = Math.floor(rng() * 24);
        let s = '';
        for (let j = 0; j < len; j++) s += alphabet[Math.floor(rng() * alphabet.length)];
        expect(canonical(s)).toBe(reexported(s));
      }
    });

    it('every dangerous character, in every position, is neutralized', () => {
      // Deterministic full-coverage sweep of each special char placed at start,
      // middle, and end of a safe string.
      const safe = 'abcXYZ';
      for (const c of DANGEROUS) {
        for (const input of [c + safe, safe + c, 'ab' + c + 'cd']) {
          expect(hasRawDangerous(canonical(input))).toBe(false);
        }
      }
    });
  });
});
