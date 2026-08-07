/**
 * Cross-cutting (invariant-intersection) fuzz for the MultiFormatExporter
 * STATIC SVG + PDF export paths — the renderers that are DISTINCT from the
 * animated-scene-renderer path pinned by svg-combined-attack-fuzz.
 *
 * Two format-specific neutralizers live ONLY on this class and are
 * independent re-implementations (NOT re-exports of animated-scene-renderer's
 * exported escapeXml):
 *
 *   - MultiFormatExporter.escapeXML      → SVG `<text>` element content / `<title>`
 *   - MultiFormatExporter.escapePDFString → PDF literal string `(…) Tj`
 *
 * A refactor that drifts EITHER neutralizer leaves the static export path
 * protected only by the SHARED detector, validateSceneGraphForExport — and
 * that detector is never pinned against these renderers on the same payload.
 * This file closes that gap: every iteration holds ONE payload against TWO
 * independently-held invariants.
 *
 *   A. DETECTOR — validateSceneGraphForExport(scene, { strict: true }) flags
 *      the pattern (script-tag / img-onerror / pdf-operator-injection …) and
 *      fails ⇒ a strict export would BLOCK it.
 *   B. NEUTRALIZER — even in non-strict mode (where export proceeds), the
 *      rendered SVG contains no raw executable tag-open (escapeXML encoded it)
 *      and the rendered PDF contains no raw `) Tj (` breakout (escapePDFString
 *      escaped the parens).
 *
 * The SVG block mirrors svg-combined-attack-fuzz's tag class on a DIFFERENT
 * renderer; the PDF block is a genuinely format-specific intersection
 * (paren-based operator injection) that no existing single-invariant net
 * composes. Reuses the shared fuzz helpers (@tests/helpers/fuzz).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MultiFormatExporter } from '../multi-format-exporter';
import { validateSceneGraphForExport } from '../export-content-validator';
import type { SceneGraph } from '@/types/diagram';
import { mulberry32, pick } from '@tests/helpers/fuzz';

// The detector logs a WARN per malicious scene (expected — that IS the
// detector doing its job). With 600 randomized iterations the output is
// noise; silence it like the sibling multi-format-exporter.test.ts does.
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tag-based XSS vectors for the SVG path. escapeXML encodes `< > " ' &`, so the
// neutralization invariant is crisp: the raw tag-open must NOT survive in the
// SVG output. (Protocol vectors like `javascript:` are inert inside SVG <text>
// element content and are covered by the detector alone; this composition
// focuses on the tag class where BOTH layers have a concrete job on the same
// payload — exactly like svg-combined-attack-fuzz.)
// ---------------------------------------------------------------------------
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

/**
 * PDF operator-injection vectors. A label rendered as `(label) Tj` can break
 * out of the literal string with an unbalanced `) Tj (`, injecting arbitrary
 * PDF content-stream operators. The detector flags `) Tj (` (pdf-operator-
 * injection, HIGH severity); escapePDFString neutralizes it by escaping every
 * `(`/`)`. Every vector MUST contain the `) Tj (` breakout so the detector has
 * a concrete job on the same payload the neutralizer defuses.
 */
const PDF_INJECTION_VECTORS: ReadonlyArray<{ payload: string; breakout: string }> = [
  { payload: 'a) Tj (b', breakout: ') Tj (' },
  { payload: 'Hello ) Tj (World', breakout: ') Tj (' },
  { payload: 'x) Tj (y) Tj (z', breakout: ') Tj (' },
  // Breakout wrapped in a realistic label with surrounding inert text.
  { payload: 'Step 1 ) Tj (Step 2 done', breakout: ') Tj (' },
];

/** Inert characters mixed into a label to vary payload position/length. */
const SAFE_CHARS = 'ABCDEFGHabcdefgh0123456789 .';
function safeToken(rng: () => number): string {
  const len = 1 + Math.floor(rng() * 6);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(rng() * SAFE_CHARS.length)];
  }
  return out;
}

/**
 * Build a SceneGraph whose FIRST layout node + edge label carry `label`.
 *
 * The MultiFormatExporter SVG/PDF renderers read from `scene.layout.nodes` /
 * `scene.layout.edges`; validateSceneGraphForExport recursively scans BOTH
 * `scene.nodes` AND `scene.layout`, so the SAME field is seen by the detector
 * and the neutralizer — the precondition for a real invariant intersection.
 */
function makeSceneWithLabel(label: string): SceneGraph {
  return {
    id: 'attack-scene',
    type: 'flow',
    summary: 'combined-attack fixture',
    nodes: [
      { id: 'n1', label, x: 100, y: 100, width: 120, height: 60 },
      { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 },
    ],
    edges: [{ from: 'n1', to: 'n2', label }],
    layout: {
      nodes: [
        { id: 'n1', label, x: 100, y: 100, width: 120, height: 60 },
        { id: 'n2', label: 'End', x: 400, y: 100, width: 120, height: 60 },
      ],
      edges: [{ from: 'n1', to: 'n2', label, points: [] }],
    },
    startMs: 0,
    durationMs: 5000,
    keyphrases: [],
  };
}

const exporter = new MultiFormatExporter();

async function exportText(format: 'svg' | 'pdf', scene: SceneGraph): Promise<string> {
  const result = await exporter.export(scene, { format });
  expect(result.success).toBe(true);
  return await (result.data as Blob).text();
}

// ===========================================================================
// SVG literal anchor cases
// ===========================================================================
describe('MultiFormat combined-attack composition fuzz', () => {
  describe('SVG literal anchors (xss-detector × escapeXML-neutralizer)', () => {
    it('<script> label: strict detector blocks AND renderer encodes the tag', async () => {
      const payload = '<script>alert(1)</script>';
      const scene = makeSceneWithLabel(payload);

      // A — detector flags the XSS in the raw scene data and strict blocks.
      const v = validateSceneGraphForExport(scene, { strict: true });
      expect(v.passed).toBe(false);
      expect(v.findings.some((f) => f.pattern === 'script-tag' && f.severity === 'high')).toBe(true);

      // B — renderer escapeXML'd the label: encoded entities present, raw tag absent.
      const svg = await exportText('svg', scene);
      expect(svg).not.toContain('<script');
      expect(svg).toContain('&lt;script');
    });

    it('<svg onload=…> label: detector flags svg-onload AND no raw <svg onload survives', async () => {
      const payload = '<svg onload=alert(1)>';
      const scene = makeSceneWithLabel(payload);
      expect(
        validateSceneGraphForExport(scene, { strict: true }).findings.some(
          (f) => f.pattern === 'svg-onload',
        ),
      ).toBe(true);

      // The document root is `<svg xmlns=…>` (legitimate structural markup);
      // the dangerous `<svg onload` payload open-sequence must NOT survive.
      const svg = await exportText('svg', scene);
      expect(svg).not.toContain('<svg onload');
      expect(svg).toContain('&lt;svg onload');
    });
  });

  // ===========================================================================
  // PDF literal anchor case — the format-specific intersection
  // ===========================================================================
  describe('PDF literal anchor (pdf-operator-injection-detector × escapePDFString-neutralizer)', () => {
    it('`) Tj (` label: strict detector blocks AND renderer escapes the parens', async () => {
      const payload = 'a) Tj (b';
      const scene = makeSceneWithLabel(payload);

      // A — detector flags the PDF operator-injection breakout (high severity).
      const v = validateSceneGraphForExport(scene, { strict: true });
      expect(v.passed).toBe(false);
      expect(
        v.findings.some((f) => f.pattern === 'pdf-operator-injection' && f.severity === 'high'),
      ).toBe(true);

      // B — escapePDFString escaped every paren: the raw `) Tj (` breakout is
      // gone, replaced by the neutralized `\) Tj \(` form. The literal string
      // `(a\) Tj \(b) Tj` stays balanced — the injection cannot break out.
      const pdf = await exportText('pdf', scene);
      expect(pdf).not.toContain(') Tj (');
      expect(pdf).toContain('\\) Tj \\(');
    });
  });

  // ===========================================================================
  // Randomized SVG composition: every xss-in-label is detected AND neutralized
  // ===========================================================================
  describe('randomized SVG: every xss-in-label is detected AND neutralized', () => {
    const rng = mulberry32(0xfe1afe);

    it('300 combined labels: detector flags the pattern AND renderer encodes the tag-open', async () => {
      for (let iter = 0; iter < 300; iter++) {
        const vector = pick(SVG_XSS_VECTORS, rng);
        const label = safeToken(rng) + vector.payload + safeToken(rng);
        const scene = makeSceneWithLabel(label);

        // INVARIANT A — detector flags the XSS vector in the raw scene data.
        const detected = validateSceneGraphForExport(scene, { strict: true }).findings.some(
          (f) => f.pattern === vector.pattern,
        );
        // INVARIANT B — renderer escapeXML'd the label: raw tag-open absent,
        // entity-encoded form present in the SVG output.
        const svg = await exportText('svg', scene);
        const rawTagAbsent = !svg.includes(vector.tagOpen);
        const escapedPresent = svg.includes('&lt;');

        if (!detected || !rawTagAbsent || !escapedPresent) {
          expect({ label, detected, rawTagAbsent, escapedPresent }).toEqual({
            label,
            detected: true,
            rawTagAbsent: true,
            escapedPresent: true,
          });
        }
        expect(detected).toBe(true);
        expect(rawTagAbsent).toBe(true);
        expect(escapedPresent).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Randomized PDF composition: every operator-injection breakout is detected
  // AND neutralized
  // ===========================================================================
  describe('randomized PDF: every `) Tj (` breakout is detected AND neutralized', () => {
    const rng = mulberry32(0xbaadf00d);

    it('300 paren-injection labels: detector flags pdf-operator-injection AND renderer escapes parens', async () => {
      for (let iter = 0; iter < 300; iter++) {
        const vector = pick(PDF_INJECTION_VECTORS, rng);
        const label = safeToken(rng) + vector.payload + safeToken(rng);
        const scene = makeSceneWithLabel(label);

        // INVARIANT A — detector flags the PDF operator-injection breakout.
        const detected = validateSceneGraphForExport(scene, { strict: true }).findings.some(
          (f) => f.pattern === 'pdf-operator-injection',
        );
        // INVARIANT B — escapePDFString neutralized the breakout: no raw
        // `) Tj (` survives in the rendered PDF (it is `\) Tj \`(`).
        const pdf = await exportText('pdf', scene);
        const breakoutAbsent = !pdf.includes(') Tj (');

        if (!detected || !breakoutAbsent) {
          expect({ label, detected, breakoutAbsent }).toEqual({
            label,
            detected: true,
            breakoutAbsent: true,
          });
        }
        expect(detected).toBe(true);
        expect(breakoutAbsent).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Defense-in-depth: the layers must not collapse into one
  // ===========================================================================
  describe('defense-in-depth: strict detector blocks even though the renderers neutralize', () => {
    it('a script label: strict rejects, yet SVG+PDF both produced neutralized output', async () => {
      const payload = '<script>alert(1)</script>';
      const scene = makeSceneWithLabel(payload);

      // Strict validation blocks the raw payload (detector side).
      const strict = validateSceneGraphForExport(scene, { strict: true });
      expect(strict.passed).toBe(false);

      // …yet non-strict export still neutralizes it in BOTH formats.
      const svg = await exportText('svg', scene);
      expect(svg).not.toContain('<script');
      // PDF embeds the label inside a literal string; escapePDFString leaves
      // `<script>` intact (PDF text is not HTML — it is inert there) but the
      // detector still flagged it, so strict mode is what gates this payload
      // on the PDF path. Pinning both keeps the layers independently truthful.
      const pdf = await exportText('pdf', scene);
      expect(pdf.startsWith('%PDF')).toBe(true);
    });
  });
});
