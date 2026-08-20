/**
 * @jest-environment node
 */
/**
 * dagre-dangling-edge-filter-mutation-pinning.test.ts — TC-307
 *
 * Pins the dagre dangling-edge filter — a RECURRING bug class that must hold at
 * EVERY dagre-calling site — as a structural source sweep.
 *
 * THE BUG CLASS (recurring — see MEMORY). dagre silently AUTO-CREATES phantom
 * nodes for any edge endpoint that is not in the input node set. Feeding it an
 * edge `{from:'a', to:'ghost'}` where `'ghost'` is not a real node makes dagre
 * invent a node for `'ghost'`, pull real nodes toward the phantom position, and
 * emit edges pointing at non-existent nodes — propagating NaN coordinates
 * downstream. The canonical neutralization, applied BEFORE every `g.setEdge`
 * call, is two lines:
 *
 *   const nodeIds = new Set(nodes.map(n => n.id));
 *   const safeEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
 *
 * This guard exists inline at 3 files (4 sites — enhanced-zero-overlap-layout.ts
 * has the flowchart AND tree paths) plus canonically once in the shared
 * dagre-pipeline (round 30), which the flow/tree/flowchart strategies delegate
 * to. It is a CLASS, not a single guard: each new dagre strategy that forgets
 * the filter re-opens the class. The behavioral tests
 * (`src/visualization/strategies/__tests__/dagre-dangling-edges.test.ts` for
 * DagreLayoutStrategy, `dagre-strategies-dangling-edges.test.ts` for the
 * flow/tree/flowchart strategies) prove the filter WORKS today — but they are
 * per-strategy and import the strategies directly. A new strategy file added
 * without a filter would not be covered by either, and a "cleanup" that drops
 * the filter from one site passes its own behavioral test only if co-edited.
 *
 * WHY A STRUCTURAL SWEEP. Layer 1 pins the filter at every inline-dagre file
 * and the delegation hop at the pipeline-delegating strategies.
 * Layer 2 is the class-closing invariant: it scans the WHOLE visualization tree
 * for any `.ts` file that calls dagre `setEdge` and asserts that file ALSO
 * contains the `.has(.from) && .has(.to)` filter — so a future dagre strategy
 * added without the filter fails CI immediately, independent of any behavioral
 * test. Layer 3 proves the filter predicate is load-bearing (a `.has(.from)`
 * -only mutation lets a dangling `.to` through).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Anchored to import.meta.url, not process.cwd(): jest workers can run with a
// cwd that is not the repo root, which flaked the bare relative form under
// --maxWorkers>1 (same as TC-302/313).
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

// The load-bearing filter predicate — uniform across all 6 sites. Matches
// `<set>.has(<var>.from) && <set>.has(<var>.to)` regardless of the Set / edge
// variable names (nodeIds/flowchartNodeIds/treeNodeIds, edge/e).
const FILTER_ANCHOR = /\.has\(\s*\w+\.from\s*\)\s*&&\s*\w+\.has\(\s*\w+\.to\s*\)/;
// A node-id Set built from the input nodes (loose: covers `nodes.map(n => n.id)`
// and `nodes.map((node) => node.id)`).
const NODE_SET_ANCHOR = /new Set\(\s*\w+\.map\(/;
// dagre edge insertion — marks a file as a dagre-calling site.
const SETEDGE_ANCHOR = /\.setEdge\(/;

// Files that still roll their OWN dagre graph (setEdge inline) and therefore
// must carry the filter inline. Since round 30 the flow/tree/flowchart
// strategies no longer touch dagre directly — they delegate the whole
// pipeline to src/visualization/dagre-pipeline.ts, which holds the filter —
// so they moved from this list to DAGRE_DELEGATING_FILES below.
const DAGRE_FILES = [
  'src/visualization/strategies/DagreLayoutStrategy.ts',
  'src/visualization/enhanced-zero-overlap-layout.ts',
  'src/visualization/dagre-pipeline.ts',
];

// Files whose dagre access is the shared pipeline only: they must CALL the
// canonical pipeline (so their edges still pass the filter inside it) and
// must NOT re-roll a private dagre graph (a re-rolled graph without the
// filter would escape every anchor below).
const DAGRE_DELEGATING_FILES = [
  'src/visualization/strategies/flow-strategy.ts',
  'src/visualization/strategies/tree-strategy.ts',
  'src/visualization/strategies/flowchart-strategy.ts',
];

// --- (TC-307-01) source anchors: pin the filter at every known dagre site -------

describe('dagre dangling-edge filter — source anchors pinned per site (TC-307-01)', () => {
  it.each(DAGRE_FILES)('%s builds a node-id Set and filters both edge endpoints', (file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf8');
    expect(src).toMatch(NODE_SET_ANCHOR);
    expect(src).toMatch(FILTER_ANCHOR);
    expect(src).toMatch(SETEDGE_ANCHOR);
  });

  it.each(DAGRE_DELEGATING_FILES)('%s delegates to the canonical dagre pipeline and rolls no private graph', (file) => {
    const src = readFileSync(join(REPO_ROOT, file), 'utf8');
    // The delegation hop: without this, the strategy is not using the shared
    // pipeline and its edges bypass the filter inside it.
    expect(src).toMatch(/runDagrePipeline\(/);
    // No re-rolled dagre graph: setEdge/graphlib/dagre.layout inline would be
    // an unfiltered private pipeline.
    expect(src).not.toMatch(SETEDGE_ANCHOR);
    expect(src).not.toMatch(/graphlib/);
    expect(src).not.toMatch(/dagre\.layout\(/);
  });

  it('enhanced-zero-overlap-layout.ts has the filter at BOTH the flowchart and tree paths', () => {
    // Two independent dagre call sites (generateFlowchartLayout + generateTreeLayout).
    // A drift that drops one path drops the match count below 2 → RED.
    const src = readFileSync(join(REPO_ROOT, 'src/visualization/enhanced-zero-overlap-layout.ts'), 'utf8');
    const matches = src.match(new RegExp(FILTER_ANCHOR.source, 'g'));
    if (matches === null) {
      throw new Error('dangling-edge FILTER_ANCHOR regex found ZERO matches in enhanced-zero-overlap-layout.ts');
    }
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

// --- (TC-307-02) structural class invariant: EVERY dagre-calling file filters --

describe('dagre dangling-edge filter — structural class sweep (TC-307-02)', () => {
  // Recursively collect .ts files under a directory (excluding tests).
  function collectTs(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        collectTs(full, acc);
      } else if (entry.endsWith('.ts') && !entry.includes('.test.')) {
        acc.push(full);
      }
    }
    return acc;
  }

  it('every visualization .ts file that calls dagre setEdge also applies the endpoint filter', () => {
    // THE CLASS-CLOSING INVARIANT. Any file that hands edges to dagre MUST
    // filter them to the input-node set first. A new strategy added without
    // the filter lands here with setEdge-but-no-filter → RED.
    const repoRoot = REPO_ROOT;
    const vizFiles = collectTs(join(repoRoot, 'src/visualization'));
    expect(vizFiles.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const f of vizFiles) {
      const src = readFileSync(f, 'utf8');
      if (SETEDGE_ANCHOR.test(src) && !FILTER_ANCHOR.test(src)) {
        offenders.push(f.replace(repoRoot + '/', ''));
      }
    }
    expect(offenders).toEqual([]); // every dagre site must filter
  });
});

// --- (TC-307-03) mutation witness: the predicate is load-bearing ----------------

describe('dagre dangling-edge filter — mutation witness (TC-307-03)', () => {
  it('a `.has(.from)`-only filter (the mutated form) lets a dangling target through', () => {
    // This is the BUG shape — what the guard defends against. If a future edit
    // narrows the filter to check only `.from` (or only `.to`), a dangling edge
    // whose OTHER endpoint is non-existent slips through to dagre, which then
    // auto-creates the phantom node. If this assertion ever flips (a one-sided
    // check becomes sufficient), the filter has become redundant; the test
    // fails loudly so we notice.
    const nodeIds = new Set(['a', 'b', 'c']);
    const edges = [
      { from: 'a', to: 'b' }, // valid
      { from: 'b', to: 'ghost' }, // dangling TARGET
      { from: 'ghost2', to: 'c' }, // dangling SOURCE
    ];

    // Correct (both endpoints): drops both dangling edges.
    const correct = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    expect(correct).toEqual([{ from: 'a', to: 'b' }]);

    // Mutated (from-only): the dangling-target edge slips through — dagre would
    // auto-create a phantom node for 'ghost'. This is the detectable signature.
    const mutatedFrom = edges.filter((e) => nodeIds.has(e.from));
    expect(mutatedFrom).toContainEqual({ from: 'b', to: 'ghost' });

    // Mutated (to-only): the dangling-source edge slips through.
    const mutatedTo = edges.filter((e) => nodeIds.has(e.to));
    expect(mutatedTo).toContainEqual({ from: 'ghost2', to: 'c' });
  });
});
