/**
 * Canonical XML/SVG entity escaper — the SINGLE source of truth for escaping
 * text that is embedded into XML or SVG markup in the export pipeline.
 *
 * Two byte-identical copies of this logic previously lived in
 * `animated-scene-renderer.ts` (exported `escapeXml`) and
 * `multi-format-exporter.ts` (private `escapeXML`). Both sit on the SVG export
 * security path, so a future edit to either copy (a changed entity, a flipped
 * replacement order, an added character) would silently desync the two emitters
 * — exactly the invariant-split drift this module eliminates. Import this
 * helper everywhere XML/SVG text is embedded; do NOT re-inline it.
 *
 * The apostrophe is encoded as `&apos;` (XML named entity, valid in SVG/XML and
 * HTML5). This deliberately differs from `api/routes/errors.ts sanitizeMessage`,
 * which emits the HTML5 numeric `&#x27;` — that function also strips tags, so it
 * is a different concept and is intentionally not unified here.
 *
 * Replacement order is significant: `&` MUST be escaped first so that the
 * entities we emit (`&lt;`, `&gt;`, …) are not themselves re-escaped.
 *
 * @param str - raw text to escape (coerced to a string; non-strings handled by
 *   callers before this point, as in the historical signature `(str: string)`)
 * @returns the input with the five XML special characters replaced by entities
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
