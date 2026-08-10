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
import { readFileSync } from 'node:fs';
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
