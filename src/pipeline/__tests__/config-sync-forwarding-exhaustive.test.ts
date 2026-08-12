/**
 * @jest-environment node
 */
/**
 * Structural sweep-pin for the construction-once-collaborator /
 * runtime-config-not-propagated defect class (REQ-039..052).
 *
 * WHY THIS EXISTS
 * --------------
 * `applyConfigToCollaborators` is the SINGLE source that maps a
 * `PipelineConfig` partial onto the three construction-once collaborators. The
 * recurring failure mode of this whole class (REQ-039..051) is "a field exposed
 * on the public config boundary never reaches generation": either it is never
 * forwarded here, or it is forwarded to a collaborator that never reads it. The
 * sibling `config-sync.test.ts` verifies the helper's RUNTIME behavior with fake
 * collaborators (the right partial reaches updateConfig), and
 * `config-boundary-reaches-generation.test.ts` RED-verifies that the REAL
 * collaborators then read the new value at GENERATION output.
 *
 * Neither, however, GUARDS THE BOUNDARY ITSELF against the next member of the
 * family: someone adding a field to `PipelineConfig.{transcription,analysis,
 * layout}` (e.g. a `transcription.combineMs`) gets NO failure if they forget to
 * route it through this helper — it compiles, the field is silently dead, and
 * the bug ships exactly the way `language` (REQ-043) and `layoutType` (REQ-049)
 * did. This file closes that gap with a source-anchored invariant:
 *
 *   every field declared in PipelineConfig.{transcription,analysis,layout}
 *   MUST be forwarded by applyConfigToCollaborators — and vice-versa.
 *
 * If the two sets ever diverge this test goes RED, forcing a conscious decision
 * (wire the new field through the helper, or explicitly exempt it here) instead
 * of a silent dead option. This is the highest-leverage guard for a saturated
 * class: per the project's recurring-bug lesson, a sweep pin that catches NEW
 * members beats re-hunting the same ground.
 *
 * `output` is intentionally OUT of scope: it does not route to a collaborator
 * (fps → generateRenderPlan; includeAudio is a known DEAD design-heavy field),
 * so the helper correctly never touches it. Only the three collaborator-bearing
 * sections are constrained.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG_SYNC_FILE = path.resolve(__dirname, '../config-sync.ts');
const TYPES_FILE = path.resolve(__dirname, '../types.ts');

/** The three PipelineConfig sections that map to construction-once collaborators. */
const COLLABORATOR_SECTIONS = ['transcription', 'analysis', 'layout'] as const;

/**
 * Extract the field names each `PipelineConfig` collaborator section DECLARES,
 * straight from the interface source (not from a runtime fixture, which can drift).
 * Returns a map section → sorted field names.
 */
function readTypeFields(): Record<string, string[]> {
  const src = fs.readFileSync(TYPES_FILE, 'utf-8');
  const iface = src.match(/export\s+interface\s+PipelineConfig\s*\{([\s\S]*?)\n\}/);
  if (!iface) throw new Error('PipelineConfig interface not found in types.ts');
  const body = iface[1];

  const fields: Record<string, string[]> = {};
  // Each section is `name: { ... };` with primitive/union fields (no nested braces).
  for (const m of body.matchAll(/(\w+)\s*:\s*\{([^}]*)\}/g)) {
    const section = m[1];
    const block = m[2];
    const names = [...block.matchAll(/(\w+)\s*\??\s*:/g)].map((x) => x[1]);
    fields[section] = names.sort();
  }
  return fields;
}

/**
 * Extract the field names `applyConfigToCollaborators` FORWARDS per section,
 * straight from the helper source. The helper's mandated style is
 * `const { a, b } = updates.<section>;` followed by per-field conditional
 * spreads (so an omitted field is not clobbered). We read the conditional-spread
 * site — the ACTUAL push — not the destructure, so a future style change to the
 * destructure alone cannot make this guard vacuous.
 */
function readForwardedFields(): Record<string, string[]> {
  const src = fs.readFileSync(CONFIG_SYNC_FILE, 'utf-8');
  const fields: Record<string, string[]> = {};
  for (const section of COLLABORATOR_SECTIONS) {
    // Scope to this section's `if (updates.<section>) { ... }` block so a field
    // name that coincides across sections cannot bleed.
    const blockRe = new RegExp(`if\\s*\\(updates\\.${section}\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
    const block = src.match(blockRe);
    if (!block) throw new Error(`helper block for section "${section}" not found`);
    // The forwarding conditional: ...(FIELD !== undefined ? { FIELD } : {})
    const names = [...block[1].matchAll(/\.\.\.\(\s*(\w+)\s*!==\s*undefined\s*\?\s*\{\s*\1\s*\}\s*:\s*\{\s*\}\s*\)/g)].map(
      (x) => x[1],
    );
    fields[section] = [...new Set(names)].sort();
  }
  return fields;
}

describe('REQ-053: applyConfigToCollaborators forwards every declared config field (sweep-pin)', () => {
  const typeFields = readTypeFields();
  const forwardedFields = readForwardedFields();

  it('every collaborator section is present in both sources', () => {
    for (const section of COLLABORATOR_SECTIONS) {
      expect(Array.isArray(typeFields[section])).toBe(true);
      expect(typeFields[section].length).toBeGreaterThan(0);
      expect(Array.isArray(forwardedFields[section])).toBe(true);
      expect(forwardedFields[section].length).toBeGreaterThan(0);
    }
  });

  // One assertion per section so a failure names the offending section.
  it.each(COLLABORATOR_SECTIONS)(
    'section "%s": forwarded fields == declared fields (no silent dead option)',
    (section) => {
      expect(new Set(forwardedFields[section])).toEqual(new Set(typeFields[section]));
    },
  );

  it('output section is intentionally NOT forwarded (not a collaborator section)', () => {
    // Documents the out-of-scope contract: output.fps routes to generateRenderPlan,
    // output.includeAudio is a known DEAD design-heavy field. If a future change
    // makes output collaborator-bearing, re-scope COLLABORATOR_SECTIONS.
    expect(forwardedFields.output ?? []).toEqual([]);
  });
});
