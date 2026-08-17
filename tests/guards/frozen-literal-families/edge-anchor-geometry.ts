import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 46). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 46 (specs/speech-to-visuals round-46 record): the ANCHOR GEOMETRY
   * of an edge endpoint or center read — the half-extent forms
   * `{x: n.x + getNodeWidth(n)( / 2|), y: ...}` for center/bottom/right
   * anchors, `{x: n.x, y: n.y + getNodeHeight(n) / 2}` for left, the
   * `sourceIsLeft ? a.x + getNodeWidth(a) : a.x` flank ternaries, the
   * ezo-balance center locals, and the v2 `const sw =
   * getNodeWidth(source, DEFAULT_NODE_WIDTH)` anchor locals — must delegate
   * to the point/pair helpers in src/visualization/strategy-edges.ts
   * (centerAnchor, the four side anchors, verticalFlowAnchors,
   * horizontalFlowAnchors, flankAnchors, centerToCenterAnchors). Before the
   * round, 14 blocks across 9 files re-derived the same geometry; a dropped
   * `+ node.x` origin term or a halved wrong axis in one copy would make one
   * engine's edge endpoints silently disagree with another's about the SAME
   * node. Duplicate-formula class, on every straight-line edge the layout
   * engines emit.
   *
   * Banned shapes are identifier-agnostic code-shape tells (backreference
   * `\1` binds the node identifier): the object-literal anchor `x:`
   * half-extent reads, the left-anchor `x: id.x,` reads, the flank ternaries,
   * the balance-center locals, and the sw/sh/tw anchor locals. Legitimate
   * reads do NOT match:
   *   - complex-layout-engine worker/fallback `(fromNode?.x ?? 0) + ...` —
   *     the parenthesized `?.x ?? 0` coordinate cannot bind `(\w+)\.x`; a
   *     MISSING-NODE policy, deliberately outside the family (scope-out).
   *   - multi-format-exporter `(from.x || 0) + getNodeWidth(from) / 2` —
   *     `const fx =` locals, no `{ x: id.x +` object-literal shape; `|| 0`
   *     defensive reads, scope-out.
   *   - force-directed-params `const dx = (node2.x + ...` center DIFFS —
   *     parenthesized, inside the round-40 frozen step body, scope-out.
   *   - LayoutOptimizer `getNodeWidth(fromNode, this.config.nodeWidth) / 2`
   *     — CONFIG-fallback extents (≠ the DEFAULT fallback family); its
   *     placement formulas (`- getNodeHeight(node, this.config...)`) are
   *     centering math, not anchors. Scope-out until a conscious round.
   *   - layout-utils extent edges (`right: node.x + getNodeWidth(node,
   *     fallbackWidth)`) — the round-41 extent-scan canonical, different
   *     concept (whole-extent, caller fallback).
   * Delegation pins per site live in
   * edge-anchor-geometry-single-source.test.ts.
   */
  {
    id: 'edge anchor geometry: no re-inlined half-extent anchor reads outside strategy-edges',
    roots: ['src'],
    exclude: {
      'src/visualization/strategy-edges.ts':
        'canonical source — the anchor point/pair helpers',
    },
    patterns: [
      // object-literal center/bottom/top/right anchor: `{ x: id.x + getNodeWidth(id)`
      /\{ x: (\w+)\.x \+ getNodeWidth\(\1\)/,
      // object-literal left anchor: `{ x: id.x, y: id.y + getNodeHeight(id) / 2`
      /\{ x: (\w+)\.x, y: \1\.y \+ getNodeHeight\(\1\) \/ 2/,
      // flank ternaries (source/target flanks chosen by comparison)
      /\? (\w+)\.x \+ getNodeWidth\(\1\) : \1\.x/,
      /\? (\w+)\.x : \1\.x \+ getNodeWidth\(\1\)/,
      // ezo-balance-style center locals: `const cx = id.x + getNodeWidth(id) / 2;`
      /const (\w+) = (\w+)\.x \+ getNodeWidth\(\2\) \/ 2;/,
      /const (\w+) = (\w+)\.y \+ getNodeHeight\(\2\) \/ 2;/,
      // v2 anchor locals: `const sw = getNodeWidth(source, DEFAULT_NODE_WIDTH);`
      /const s[wh] = getNodeWidth\((\w+), DEFAULT_NODE_WIDTH\);/,
      /const s[wh] = getNodeHeight\((\w+), DEFAULT_NODE_HEIGHT\);/,
    ],
    minSweptFiles: 300,
  },
];
