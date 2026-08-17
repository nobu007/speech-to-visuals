import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 45). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 45 (specs/speech-to-visuals round-45 record): the CANVAS CLAMP of a
   * positioned node's top-left coordinate — `Math.max(lo, Math.min(canvas -
   * size - lo, v))` — must delegate to clampNodeCoordinate in
   * src/visualization/layout-utils.ts. The clamp was inlined at 17 x/y
   * coordinate-pair sites in three margin policies: zero-margin (ezo ×12
   * pairs — grid+jitter placement, post-resolver clamp, NaN-guarded force
   * application, jitter candidates, eight collision-resolution moves — plus
   * NetworkLayoutStrategy grid placement), margin (force-directed-params
   * keepInView, network-strategy literal 20, strategies/OverlapResolver
   * default-10 via a double-guarded maxX), and the point-clamp degenerate
   * size=0 (complex-layout-engine velocity integration), so one engine's
   * "keep the node on the canvas" could silently disagree with another's —
   * dropped `- nodeSize` term, margin on the wrong side, or an inverted
   * `hi < lo` band on oversized nodes. The duplicate-formula /
   * invariant-split class, on every on-canvas guarantee the engines make.
   *
   * Banned shapes are the retired code-shape tells: the ezo
   * `this.config.canvasWidth/Height -` clamp lines, the
   * NetworkLayoutStrategy `config.width - width,` grid lines, the
   * force-directed-params `bounds.width -` margin lines, the
   * strategies/OverlapResolver pre-clamped maxX lines, the network-strategy
   * literal-20 lines, and the complex-layout-engine point-clamp tell
   * (`this.config.width, pos.`). Legitimate clamps don't match:
   * SimulatedAnnealingStrategy's keep-in-bounds is the CENTER convention
   * (`padding + halfWidth` — out of the top-left family, and the v2
   * layout/ cluster is test-only per r39 precedent); clamp01/score/corner
   * clamps in utils/export/pipeline carry no canvas-size minus node-size
   * shape. Delegation pins per site live in
   * node-canvas-clamp-single-source.test.ts.
   */
  {
    id: 'node canvas clamp: no re-inlined Math.max/Math.min canvas clamp outside layout-utils',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — clampNodeCoordinate beside the extent scan and overlap-pair scan',
    },
    patterns: [
      /Math\.max\(0, Math\.min\(this\.config\.canvasWidth - /,
      /Math\.max\(0, Math\.min\(this\.config\.canvasHeight - /,
      /Math\.max\(0, Math\.min\(config\.width - width, /,
      /Math\.max\(0, Math\.min\(config\.height - height, /,
      /Math\.max\(margin, Math\.min\(bounds\.width - /,
      /Math\.max\(margin, Math\.min\(bounds\.height - /,
      /Math\.max\(margin, this\.config\.width - getNodeWidth/,
      /Math\.max\(margin, this\.config\.height - getNodeHeight/,
      /Math\.max\(20, Math\.min\(DEFAULT_CANVAS_WIDTH - /,
      /Math\.max\(20, Math\.min\(DEFAULT_CANVAS_HEIGHT - /,
      /Math\.max\(0, Math\.min\(this\.config\.width, pos\./,
    ],
    minSweptFiles: 300,
  },
];
