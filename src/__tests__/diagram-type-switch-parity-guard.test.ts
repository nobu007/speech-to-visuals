/**
 * @jest-environment node
 */
/**
 * DiagramType switch-parity — structural guard for the 'flow' vs 'flowchart'
 * namespace class.
 *
 * THE BUG CLASS. `'flow'` and `'flowchart'` are BOTH distinct canonical members
 * of `DIAGRAM_TYPES` (src/types/diagram.ts), but a flowchart is semantically a
 * flow diagram. A `switch` over a DiagramType discriminant that handles
 * `'flow'` and lets `'flowchart'` fall through to the `default` branch silently
 * mis-routes every flowchart-typed scene. On the production
 * `LayoutEngine → DagreLayoutStrategy` path (used by main-pipeline and
 * pipeline-orchestrator) this produced real, reachable defects:
 *
 *   - getGraphConfig (layout-utils) — flowchart got the bare `baseConfig`
 *     (no `rankdir`/`align`) instead of flow's TB+UL config, called for EVERY
 *     type via DagreLayoutStrategy.applyLayout.
 *   - FallbackLayoutStrategy.fallbackLayout — flowchart → `createGridLayout`
 *     (a grid for a flowchart) on the Dagre failure-fallback path.
 *   - OverlapResolver.handleIdenticalPositions — flowchart → the default
 *     branch's `Math.random()` displacement (non-deterministic jitter for a
 *     flow diagram) instead of flow's deterministic y-axis separation.
 *   - simple-diagram-detector.explainReasoning — flowchart → default reasoning
 *     (cosmetic; the detector does not currently emit 'flowchart', but the case
 *     is paired for parity so a future emitter is correct by construction).
 *
 * WHY A SWEEP GUARD. Each instance is a one-line `case 'flowchart':` fall-through
 * fix, but the same omission recurs independently across every new
 * DiagramType-aware switch (the recurring "namespace/id mismatch" class — see
 * the project memory). Picking them off one at a time leaves the next switch
 * unguarded. This test sweeps ALL switch statements whose discriminant is a
 * `DiagramType`-typed parameter and asserts flow/flowchart case PARITY: a switch
 * that handles one must handle the other. A brand-new unpaired switch (the next
 * recurrence, in any file) is not paired → RED.
 *
 * SCOPE / PRECISION. The sweep keys on functions/methods whose parameter list
 * contains a `DiagramType`-typed parameter, then examines `switch` CASE labels
 * (not object-literal lookups) within that function body. Case labels are
 * unambiguous single-type tokens, so this excludes:
 *   - edge-type `'flow'` switches (e.g. simple-diagram-detector's edge
 *     `type?: 'flow' | 'conditional' | 'timeline'` — not a DiagramType param);
 *   - composite-key maps (e.g. diagram-detector.buildFusionStrategy's
 *     `'flow,timeline'` fusion keys — a Record, not a switch, and multi-type).
 * Object-literal lookups keyed by diagram type (e.g. a `{ flow: 30 }[t]` map)
 * are out of scope here and are covered by per-site unit assertions instead,
 * because distinguishing a single-type key from a composite key statically is
 * fragile and would drown the guard in special-casing.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';

// --- comment stripping (string literals PRESERVED so 'flow' tokens survive) ---

function stripComments(src: string): string {
  const chars = src.split('');
  let i = 0;
  while (i < chars.length) {
    const c = chars[i], n = chars[i + 1];
    if (c === '/' && n === '/') {
      while (i < chars.length && chars[i] !== '\n') { chars[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && n === '*') {
      chars[i] = ' '; chars[i + 1] = ' '; i += 2;
      while (i < chars.length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n') chars[i] = ' ';
        i++;
      }
      if (i < chars.length) { chars[i] = ' '; chars[i + 1] = ' '; i += 2; }
      continue;
    }
    i++;
  }
  return chars.join('');
}

function matchBalanced(src: string, openIdx: number, openCh: string, closeCh: string): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function lineOf(src: string, off: number): number {
  let l = 1;
  for (let i = 0; i < off && i < src.length; i++) if (src[i] === '\n') l++;
  return l;
}

interface SwitchSite {
  file: string;
  /** 1-based line of the DiagramType-param function header. */
  line: number;
  hasFlow: boolean;
  hasFlowchart: boolean;
}

/**
 * Find every `switch` whose discriminant identifier is a `DiagramType`-typed
 * parameter of the enclosing function/method. Returns one site per qualifying
 * switch with whether it handles 'flow' and/or 'flowchart'.
 *
 * Strategy: locate parameter groups `(... DiagramType ...)` (balanced one level
 * of nesting for arrow params / generics), then take the function body as the
 * balanced `{...}` starting at the first `{` after the group, and scan it for
 * `case 'flow':` / `case 'flowchart':` labels.
 */
function findDiagramTypeSwitchSites(files: string[]): SwitchSite[] {
  const sites: SwitchSite[] = [];
  // a parameter group is "( ... DiagramType ... )" with one level of () nesting
  const paramRe = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const src = stripComments(raw);
    let m: RegExpExecArray | null;
    paramRe.lastIndex = 0;
    while ((m = paramRe.exec(src)) !== null) {
      if (!m[1].includes('DiagramType')) continue;
      const groupEnd = m.index + m[0].length;
      // body opens at the first '{' after the param group (skip return-type anno)
      let i = groupEnd;
      while (i < src.length && src[i] !== '{') i++;
      if (src[i] !== '{') continue;
      const end = matchBalanced(src, i, '{', '}');
      if (end < 0) continue;
      const body = src.slice(i, end + 1);
      const hasFlow = /case\s+['"]flow['"]\s*:/.test(body);
      const hasFlowchart = /case\s+['"]flowchart['"]\s*:/.test(body);
      if (!hasFlow && !hasFlowchart) continue; // not a flow/flowchart switch at all
      sites.push({ file, line: lineOf(raw, m.index), hasFlow, hasFlowchart });
    }
  }
  return sites;
}

const SRC_FILES = (): string[] => {
  const ts = globSync('src/**/*.ts') as string[];
  const tsx = globSync('src/**/*.tsx') as string[];
  return ts.concat(tsx).filter((f) => !f.includes('__tests__'));
};

// --- the known fixes pinned (RED on revert) ----------------------------------

describe('flow/flowchart switch parity — known fixes pinned', () => {
  const cases: Array<{ file: string; anchor: RegExp; label: string }> = [
    // Each anchor matches ONLY the paired two-case form. A revert that drops the
    // `case 'flowchart':` line leaves a bare `case 'flow':` immediately followed
    // by the flow body, so the anchor no longer matches → RED.
    {
      file: 'src/visualization/layout-utils.ts',
      label: 'getGraphConfig routes flowchart through the flow branch',
      anchor: /case\s+['"]flow['"]\s*:\s*\n\s*case\s+['"]flowchart['"]\s*:\s*\n\s*return\s*\{\s*\n\s*\.\.\./,
    },
    {
      file: 'src/visualization/strategies/FallbackLayoutStrategy.ts',
      label: 'fallbackLayout routes flowchart to createFlowLayout',
      anchor: /case\s+['"]flow['"]\s*:\s*\n\s*case\s+['"]flowchart['"]\s*:\s*\n\s*return\s+this\.createFlowLayout\(/,
    },
    {
      file: 'src/visualization/strategies/OverlapResolver.ts',
      label: 'handleIdenticalPositions routes flowchart to flow y-axis separation',
      anchor: /case\s+['"]flow['"]\s*:\s*\n\s*case\s+['"]flowchart['"]\s*:\s*\n\s*node1\.y\s*-=\s*separation/,
    },
    {
      file: 'src/analysis/simple-diagram-detector.ts',
      label: 'explainReasoning routes flowchart through the flow branch',
      anchor: /case\s+['"]flow['"]\s*:\s*\n\s*case\s+['"]flowchart['"]\s*:\s*\n\s*reasons\.push\('プロセスや手順を示すキーワードが検出されました'\)/,
    },
  ];

  for (const { file, anchor, label } of cases) {
    it(label, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toMatch(anchor);
    });
  }
});

// --- the broad sweep: no unpaired flow/flowchart switch anywhere -------------

describe('flow/flowchart switch parity — sweep closes the class', () => {
  it('every DiagramType-param switch that handles flow also handles flowchart (and vice versa)', () => {
    const sites = findDiagramTypeSwitchSites(SRC_FILES());
    const unpaired = sites.filter((s) => s.hasFlow !== s.hasFlowchart);
    if (unpaired.length) {
      throw new Error(
        'Unpaired flow/flowchart switch(es) in a DiagramType-param function — a ' +
        'flowchart-typed scene would fall through to the default branch. Add a ' +
        "`case 'flowchart':` fall-through to the existing `case 'flow':` (flowchart " +
        'is semantically a flow diagram), or, if the two genuinely differ, handle ' +
        "flowchart explicitly:\n" +
          unpaired.map((s) => `  ${s.file}:${s.line} (flow=${s.hasFlow} flowchart=${s.hasFlowchart})`).join('\n'),
      );
    }
    // Sanity: the sweep must still be finding the known sites — if it finds
    // ZERO flow/flowchart switches the detector has gone blind (a parse change)
    // and the parity assertion above would pass vacuously.
    expect(sites.length).toBeGreaterThan(0);
  });
});

// --- canonical equivalence-pair inventory ------------------------------------
//
// STRATEGY (AI Hub steering feedback A): "one guard file per equivalence
// class keeps the AST-scan cost bounded while extending protection." Concretely:
//   1. The canonical DiagramType pair inventory lives in `EQUIVALENCE_PAIRS`
//      below. Currently only `{ canonical: 'flow', aliases: ['flowchart'] }`.
//   2. When a NEW pair is added to the canonical DiagramType (e.g. an alias
//      type for an existing diagram semantic), add it here and create a NEW
//      guard file (`diagram-type-switch-parity-<canonical>.guard.test.ts`)
//      keyed on the new canonical. The new guard mirrors the structure of
//      this file (known-fixes-pinned + sweep), and this inventory test
//      verifies the new guard file exists for every pair in EQUIVALENCE_PAIRS.
//   3. The single-pair sweep above does NOT have to grow into a multi-pair
//      monolith — each pair keeps its own self-contained AST scan.
//
// CURRENT STATE (REQ-298 TC-298-01): The canonical DiagramType has exactly
// ONE semantic equivalence pair — `flow` / `flowchart`. No other types share
// semantics (`sequence` is NOT in DIAGRAM_TYPES; `hierarchy` is a tree-detection
// KEYWORD, not a DiagramType member; etc.). This test pins that inventory.

const EQUIVALENCE_PAIRS: ReadonlyArray<{
  canonical: string;
  aliases: ReadonlyArray<string>;
}> = [
  { canonical: 'flow', aliases: ['flowchart'] },
];

describe('diagram-type equivalence pair inventory — pinned canonical set (REQ-298)', () => {
  it('EQUIVALENCE_PAIRS is non-empty (otherwise the parity-guard sweep is undefined)', () => {
    expect(EQUIVALENCE_PAIRS.length).toBeGreaterThan(0);
  });

  it('every alias is a canonical DIAGRAM_TYPES member (no drift)', () => {
    // Importing from the source-of-truth: see `DIAGRAM_TYPES` in
    // src/types/diagram.ts. We re-read it rather than import to keep this
    // test pure-string (the guard is an AST sweep — no runtime deps).
    const src = readFileSync('src/types/diagram.ts', 'utf8');
    const m = src.match(/DIAGRAM_TYPES:\s*readonly DiagramType\[\]\s*=\s*\[([^\]]+)\]/);
    expect(m).not.toBeNull();
    const members = (m![1].match(/'[^']+'/g) ?? []).map((s) => s.slice(1, -1));
    for (const pair of EQUIVALENCE_PAIRS) {
      expect(members).toContain(pair.canonical);
      for (const alias of pair.aliases) {
        expect(members).toContain(alias);
      }
    }
  });

  it('every canonical is distinct from every alias (no self-pair)', () => {
    for (const pair of EQUIVALENCE_PAIRS) {
      for (const alias of pair.aliases) {
        expect(alias).not.toBe(pair.canonical);
      }
    }
  });

  it('no duplicate canonical or alias across pairs (each diagram type belongs to at most one equivalence class)', () => {
    const seen = new Set<string>();
    for (const pair of EQUIVALENCE_PAIRS) {
      expect(seen.has(pair.canonical)).toBe(false);
      seen.add(pair.canonical);
      for (const alias of pair.aliases) {
        expect(seen.has(alias)).toBe(false);
        seen.add(alias);
      }
    }
  });

  it('the parity-guard test file for each canonical pair exists (strategy enforcement)', () => {
    // For every canonical, a dedicated guard test file must exist. Today only
    // `diagram-type-switch-parity-guard.test.ts` exists (for flow/flowchart).
    // Adding a NEW pair REQUIRES adding a NEW guard test file of the naming
    // convention `diagram-type-switch-parity-<canonical>-guard.test.ts`.
    // (The flow/flowchart guard keeps its current single-file name for
    // historical/back-compat reasons; new pairs MUST follow the suffix form.)
    for (const pair of EQUIVALENCE_PAIRS) {
      // The flow/flowchart file is grandfathered; new pairs use the suffix.
      const candidates =
        pair.canonical === 'flow'
          ? ['src/__tests__/diagram-type-switch-parity-guard.test.ts']
          : [`src/__tests__/diagram-type-switch-parity-${pair.canonical}-guard.test.ts`];
      const found = candidates.some((c) => existsSync(c));
      if (!found) {
        throw new Error(
          `Missing guard file for equivalence pair canonical='${pair.canonical}' ` +
          `aliases=[${pair.aliases.join(', ')}]. Expected one of:\n` +
          candidates.map((c) => `  ${c}`).join('\n') +
          `\nPer strategy: one guard file per equivalence class keeps the AST ` +
          `scan cost bounded while extending protection.`,
        );
      }
    }
  });
});
