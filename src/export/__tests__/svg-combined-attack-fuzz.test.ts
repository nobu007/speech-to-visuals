/**
 * Cross-cutting (invariant-intersection) fuzz for the SVG export path: an XSS
 * payload placed in a scene label is held against TWO independently-implemented
 * defenses at once.
 *
 *   A. DETECTOR — the content validator flags the XSS vector in the RAW
 *      (pre-escaping) scene data: validateExportPayload({ scenes: [{ label }] })
 *      reports the expected pattern (script-tag / img-onerror / svg-onload …).
 *
 *   B. NEUTRALIZER — the SVG renderer escapeXml()s the label before embedding
 *      it, so the rendered output contains the entity-encoded form and NO raw
 *      executable tag-open: generateAnimatedSVG(...) has no `<script`/`<img`/…
 *      and the escaped label sits inside `<text>…</text>` element content (the
 *      safe sink), never in an attribute.
 *
 * Single-invariant nets already cover A (export-content-validator-fuzz family)
 * and escapeXml in isolation (sanitize-fuzz). The risk THIS file catches is
 * their COMPOSITION on the SVG output path: if escapeXml regressed — or the
 * renderer stopped routing the label through it — only the detector would
 * backstop the SVG output, and that backstop is never pinned against the
 * renderer on the same payload. A regression making the detector skip SVG-bound
 * content would symmetrically leave escapeXml as the sole, uncomposed defense.
 *
 * Mirrors csv-combined-attack-fuzz (CSV-sanitizer layer × validator) for the
 * SVG-renderer layer. Reuses the shared fuzz helpers (@tests/helpers/fuzz).
 */

import { describe, it, expect } from '@jest/globals';
import { generateAnimatedSVG, escapeXml } from '../animated-scene-renderer';
import { validateExportPayload } from '../export-content-validator';
import { mulberry32, pick } from '@tests/helpers/fuzz';

/**
 * Tag-based XSS vectors. escapeXml unambiguously neutralizes these by encoding
 * `< > " ' &`, so the neutralization invariant is crisp: the raw tag-open
 * sequence must not survive in the SVG output; the entity-encoded form must be
 * present. (Protocol vectors like `javascript:` are inert inside SVG `<text>`
 * element content — they need an attribute context to fire — so the detector
 * side alone covers them; this composition test focuses on the tag class where
 * both defenses have a concrete job on the same payload.)
 */
const SVG_XSS_VECTORS: ReadonlyArray<{
  payload: string;
  pattern: string;
  /** Raw tag-open sequence that must NOT survive escaping in the SVG output. */
  tagOpen: string;
}> = [
  { payload: '<script>alert(1)</script>', pattern: 'script-tag', tagOpen: '<script' },
  { payload: '<img src=x onerror=alert(1)>', pattern: 'img-onerror', tagOpen: '<img' },
  { payload: '<svg onload=alert(1)>', pattern: 'svg-onload', tagOpen: '<svg onload' },
  { payload: '<iframe src=//evil>', pattern: 'iframe-tag', tagOpen: '<iframe' },
  { payload: '<embed src=//evil>', pattern: 'embed-tag', tagOpen: '<embed' },
  { payload: '<object data=//evil>', pattern: 'object-tag', tagOpen: '<object' },
];

/** Inert characters mixed into the label to vary payload position/length. */
const SAFE_CHARS = 'ABCDEFGHabcdefgh0123456789 .';
function safeToken(rng: () => number): string {
  const len = 1 + Math.floor(rng() * 6);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(rng() * SAFE_CHARS.length)];
  }
  return out;
}

const FRAMES = { width: 1920, height: 1080 };

/** Render a single scene whose label is `label` to an SVG string. */
function renderLabel(label: string): string {
  return generateAnimatedSVG(
    { scenes: [{ label, type: 'process', duration: 2 }] },
    FRAMES,
  );
}

describe('SVG combined-attack composition fuzz (xss-detector × escapeXml-neutralizer)', () => {
  describe('literal anchor cases', () => {
    it('<script> label: detector flags script-tag AND renderer encodes the tag', () => {
      const payload = '<script>alert(1)</script>';
      const data = { scenes: [{ label: payload, type: 'process', duration: 2 }] };

      // A — detector catches the XSS in the raw scene data (high severity).
      const result = validateExportPayload(data);
      const finding = result.findings.find((f) => f.pattern === 'script-tag');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('high');

      // B — renderer escapeXml'd the label: encoded form present, raw tag absent.
      const svg = renderLabel(payload);
      expect(svg).toContain(escapeXml(payload));
      expect(svg).not.toContain('<script');
    });

    it('<svg onload=…> label: detector flags svg-onload AND no raw <svg onload survives', () => {
      const payload = '<svg onload=alert(1)>';
      const data = { scenes: [{ label: payload, type: 'process', duration: 2 }] };
      expect(
        validateExportPayload(data).findings.some((f) => f.pattern === 'svg-onload'),
      ).toBe(true);

      const svg = renderLabel(payload);
      // The document root is `<svg xmlns=…>`, which is legitimate structural
      // markup; the dangerous `<svg onload` payload open-sequence must NOT
      // survive — it is encoded as `&lt;svg onload`.
      expect(svg).not.toContain('<svg onload');
      expect(svg).toContain('&lt;svg onload');
    });
  });

  describe('randomized: every xss-in-label is detected AND neutralized', () => {
    const rng = mulberry32(0xdecafb);

    it('300 combined labels: detector flags the pattern AND renderer encodes the tag-open', () => {
      for (let iter = 0; iter < 300; iter++) {
        const vector = pick(SVG_XSS_VECTORS, rng);
        // Embed the payload in inert text so its position/length varies.
        const label = safeToken(rng) + vector.payload + safeToken(rng);
        const data = { scenes: [{ label, type: 'process', duration: 2 }] };

        // INVARIANT A — detector flags the XSS vector in the raw scene data.
        const detected = validateExportPayload(data).findings.some(
          (f) => f.pattern === vector.pattern,
        );
        // INVARIANT B — renderer escapeXml'd the label: encoded form embedded
        // in <text> element content, raw dangerous tag-open absent.
        const svg = renderLabel(label);
        const encodedEmbedded = svg.includes(escapeXml(label) + '</text>');
        const rawTagAbsent = !svg.includes(vector.tagOpen);

        if (!detected || !encodedEmbedded || !rawTagAbsent) {
          // Fail loudly with the offending payload for diagnosis.
          expect({ label, detected, encodedEmbedded, rawTagAbsent }).toEqual({
            label,
            detected: true,
            encodedEmbedded: true,
            rawTagAbsent: true,
          });
        }
        expect(detected).toBe(true);
        expect(encodedEmbedded).toBe(true);
        expect(rawTagAbsent).toBe(true);
      }
    });
  });

  describe('multi-scene composition: detection + neutralization hold across a scene list', () => {
    const rng = mulberry32(0xba5eba11);

    it('a scene list of N distinct xss labels: every one detected AND every tag encoded', () => {
      for (let iter = 0; iter < 100; iter++) {
        const sceneCount = 1 + Math.floor(rng() * 5);
        const vectors = Array.from({ length: sceneCount }, () =>
          pick(SVG_XSS_VECTORS, rng),
        );
        const scenes = vectors.map((v) => ({
          label: safeToken(rng) + v.payload + safeToken(rng),
          type: 'process',
          duration: 2,
        }));

        // A — every scene's label is flagged in the raw payload.
        const result = validateExportPayload({ scenes });
        const allDetected = vectors.every(
          (v) => result.findings.some((f) => f.pattern === v.pattern),
        );

        // B — every label is encoded in the SVG output, no raw tag-open anywhere.
        const svg = generateAnimatedSVG({ scenes }, FRAMES);
        const allEncoded = vectors.every((v) => svg.includes(escapeXml(v.payload)));
        const noRawTag = vectors.every((v) => !svg.includes(v.tagOpen));

        if (!allDetected || !allEncoded || !noRawTag) {
          expect({ sceneCount, allDetected, allEncoded, noRawTag }).toEqual({
            sceneCount,
            allDetected: true,
            allEncoded: true,
            noRawTag: true,
          });
        }
        expect(allDetected).toBe(true);
        expect(allEncoded).toBe(true);
        expect(noRawTag).toBe(true);
      }
    });
  });

  describe('defense-in-depth: a neutralized SVG is still detectable in the raw input', () => {
    // The two layers must not collapse into one: even though the renderer
    // neutralizes the payload, the raw scene data MUST still trip the detector,
    // so strict-mode export (which gates on the detector) still blocks a
    // payload that the renderer would have rendered safely. If escapeXml ever
    // started *stripping* tags (instead of encoding them), this would still
    // hold for the detector — but the renderer would have silently lost the
    // content. Pinning both keeps the layers independently truthful.
    it('strict-mode rejects the raw payload even though the SVG output is neutralized', () => {
      const payload = '<script>alert(1)</script>';
      const data = { scenes: [{ label: payload, type: 'process', duration: 2 }] };
      const strictResult = validateExportPayload(data, undefined, { strict: true });
      expect(strictResult.passed).toBe(false); // blocked by the detector
      expect(strictResult.findings.some((f) => f.pattern === 'script-tag')).toBe(true);

      // …yet the renderer still produced a neutralized (safe) SVG.
      expect(renderLabel(payload)).not.toContain('<script');
    });
  });
});
