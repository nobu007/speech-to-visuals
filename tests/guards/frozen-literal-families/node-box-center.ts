import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 47). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 47 (specs/speech-to-visuals round-47 record): the NODE BOX-CENTER
   * fold — `corner + half-extent`, `{x: n.x + width/2, y: n.y + height/2}` —
   * must delegate to layout-utils `calculateNodeCenter` / `nodesCentroid`
   * (per-axis `widthFallback`/`heightFallback` seam). Before the round ~19
   * sites across 9 files re-derived the fold under three read policies
   * (geometry-neutral fallback 0, render-default 120/60, config sizes) plus
   * two defensive coordinate pre-guards (`|| 0`, `?? 0`); a dropped origin
   * term or a wrong-axis half in one copy makes one engine's "center" for
   * the SAME node differ from another's — edges detaching from node centers
   * exactly on dimensionless nodes. This round also resolves the three
   * shapes round 46 had scoped out of edge-anchor-geometry (LayoutOptimizer
   * config-fallback anchors, force-directed-params center diffs, exporter
   * `|| 0` reads) now that the fallback seam makes their delegation
   * bit-identical.
   *
   * Banned shapes are identifier-agnostic code-shape tells. Legitimate reads
   * do NOT match:
   *   - ezo calculateOptimalSeparation's UNGROUPED fold
   *     `node1.x + n1w / 2 - node2.x - n2w / 2` — no parentheses, and its
   *     n*w locals are RAW `node.width ?? node.w ?? 0` reads kept for
   *     NaN/Infinity detection. Delegating it would REGROUP the subtraction
   *     (ungrouped ≠ grouped on 1e16-scale floats — witness pinned in
   *     node-box-center-single-source.test.ts), so it stays inline by
   *     design. Only the PARENTHESIZED grouped pair form is banned.
   *   - strategy-edges side anchors (`x: node.x + getNodeWidth(node) / 2,`)
   *     — the round-46 canonical for ANCHOR geometry (excluded there);
   *     centerAnchor itself now composes calculateNodeCenter.
   *   - layout-utils extent edges (`right: node.x + getNodeWidth(node,
   *     fallbackWidth)`) — the round-41 whole-extent canonical, no `/ 2`.
   *   - placement formulas like `spacing * (index + 1) - width / 2` —
   *     centering math in positioning loops, not box-center reads of a
   *     positioned node (no `id.x +` origin term on the left).
   * The registry walk skips __tests__ and *.test.* — where frozen verbatim
   * oracles legitimately reproduce retired shapes.
   * Delegation pins per site live in node-box-center-single-source.test.ts.
   */
  {
    id: 'node box-center: no re-inlined corner+half-extent folds outside layout-utils',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — calculateNodeCenter / nodesCentroid',
      'src/visualization/strategy-edges.ts':
        'round-46 anchor canonical — side anchors keep single-axis half-extent reads; centerAnchor composes calculateNodeCenter',
    },
    patterns: [
      // object-literal computed-local fold: `{ x: n.x + w / 2, y: n.y + h / 2 }`
      /\{ x: (\w+)\.x \+ (\w+) \/ 2, y: \1\.y \+ (\w+) \/ 2 \}/,
      // center local with explicit 0 fallback: `const aCx = a.x + getNodeWidth(a, 0) / 2;`
      /const (\w+) = (\w+)\.x \+ getNodeWidth\(\2, 0\) \/ 2;/,
      // centroid accumulation: `cx += n.x + w / 2;` / `sumX += n.x + w / 2;`
      /(\w+) \+= (\w+)\.x \+ (\w+) \/ 2;/,
      // LayoutOptimizer importance-centroid reduce fold (config fallbacks)
      /sum \+ \((\w+)\.x \+ getNodeWidth\(\1, this\.config\.nodeWidth\) \/ 2\)/,
      /sum \+ \((\w+)\.y \+ getNodeHeight\(\1, this\.config\.nodeHeight\) \/ 2\)/,
      // LayoutOptimizer circular anchor object (config fallbacks)
      /\{ x: (\w+)\.x \+ getNodeWidth\(\1, this\.config\.nodeWidth\) \/ 2/,
      // force-directed pair center DIFFS (grouped parenthesized form)
      /\((\w+)\.x \+ getNodeWidth\(\1\) \/ 2\) - \(/,
      /\((\w+)\.y \+ getNodeHeight\(\1\) \/ 2\) - \(/,
      // complex-layout-engine phantom reads (`?? 0` coordinate + `?? {}` node)
      /\(\w+\?\.x \?\? 0\) \+ getNodeWidth\(\w+ \?\? \{\}\) \/ 2/,
      /\(\w+\?\.y \?\? 0\) \+ getNodeHeight\(\w+ \?\? \{\}\) \/ 2/,
      // multi-format-exporter defensive coordinate reads (`|| 0`)
      /\((\w+)\.x \|\| 0\) \+ getNodeWidth\(\1\) \/ 2/,
      /\((\w+)\.y \|\| 0\) \+ getNodeHeight\(\1\) \/ 2/,
      // visual-balance-scorer sanitized-ingestion fold (pre-delegation shape)
      /sanitizeFinite\(\w+\.x, 0\) \+ \w+\(\w+, 0\) \/ 2/,
      /sanitizeFinite\(\w+\.y, 0\) \+ \w+\(\w+, 0\) \/ 2/,
      // ezo calculateMoveVector grouped pair form (computed-local variant)
      /const d[xy] = \((\w+)\.x \+ (\w+) \/ 2\) - \(/,
    ],
    minSweptFiles: 300,
  },
];
