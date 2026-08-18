/**
 * @jest-environment node
 */
/**
 * edge-repointing-single-source.test.ts — round 34.
 *
 * Family: the three physics-first strategies all ended with the SAME
 * 25-line private `updateEdgePoints` epilogue — nodeMap over the positioned
 * nodes, spread-preserve the already-built LayoutEdge, blank the points of a
 * dangling edge, straight-line RAW-coordinate anchors for a live edge:
 *
 *   GridSnapStrategy.ts           after grid placement
 *   ProgressiveForceStrategy.ts   after force settling
 *   SimulatedAnnealingStrategy.ts after annealing
 *
 * Verified byte-identical across the three files at extraction time (diff),
 * so — like round 33, unlike round 32 — this is a ZERO-DELTA extraction and
 * every oracle below is pure equality. The contract witnesses pin the
 * DELIBERATE differences from the neighboring edge-builder families so a
 * future "consistency" refactor cannot silently merge them:
 *
 *   - input and output are LayoutEdge[] keyed by `source`/`target` — a
 *     RE-POINT of built edges, not a build from EdgeDatum (round 32/33
 *     builders consume `from`/`to`);
 *   - both branches SPREAD the input edge, so optional fields the producer
 *     set (`type`, `id`, the mirrored `from`/`to`) survive verbatim — a
 *     reconstructed literal would silently drop them;
 *   - a dangling edge is KEPT with `points: []`, no warn, no drop
 *     (round-33 v1 builders warn; enhanced-zero-overlap's timeline path
 *     warns AND filters — both deliberately NOT this family);
 *   - anchors are RAW node x/y with no center-offset arithmetic (the
 *     round-32 centerToCenterAnchors adds half the extent — different
 *     coordinate convention);
 *   - endpoint lookup is plain-Map LAST-match-wins on duplicate node ids —
 *     the OPPOSITE tie-break of the round-33 first-match-wins v1 builder.
 *     Both are frozen contracts; do not unify.
 *
 * DRIFT SCENARIO this guard defends against: one strategy re-rolls its
 * epilogue (reconstructs the edge without the spread — losing `type` on
 * every edge of diagrams routed to that strategy; flips to first-match;
 * adds a center offset) and only that strategy drifts while the other two
 * strategies' shared-fixture tests stay green.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-34 body, frozen below, must stay
 *      value-equal to the canonical `repointEdgesStraightLine` on every
 *      corpus case (live, both dangling shapes, field-less edge,
 *      extra-field preservation, duplicate ids, empties).
 *   2. DELEGATION EQUALITY — each strategy's private `updateEdgePoints`
 *      (the real seam `performLayout` calls) equals the canonical function
 *      over the whole corpus, and is inert to the deliberately-dead
 *      `config` parameter.
 *   3. CONTRACT WITNESSES — exact live/dangling shapes, no-warn pin,
 *      raw-anchor pin (≠ centerToCenterAnchors), last-match-wins pin.
 *   4. SOURCE ANCHORS — the canonical file holds the frozen skeleton; the
 *      three strategy files delegate with the original signature; no
 *      strategy file re-rolls the spread; out-of-family files do not
 *      delegate.
 *
 * The "no site re-rolls the spread skeleton" discovery sweep lives in the
 * shared registry (tests/guards/frozen-literal-rules.ts, round-34 entry —
 * bans the `...edge` spread in src/visualization/layout/strategies, the one
 * line-shape every behavior-preserving re-roll must emit); this file holds
 * the behavioral pins.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import type { PositionedNode, LayoutEdge } from '@stv/core/types/diagram';
import type { LayoutConfig } from '@/visualization/types';
import { repointEdgesStraightLine } from '@/visualization/edge-repointing';
import { centerToCenterAnchors } from '@/visualization/strategy-edges';
import { GridSnapStrategy } from '@/visualization/layout/strategies/GridSnapStrategy';
import { ProgressiveForceStrategy } from '@/visualization/layout/strategies/ProgressiveForceStrategy';
import { SimulatedAnnealingStrategy } from '@/visualization/layout/strategies/SimulatedAnnealingStrategy';
import { logger } from '@stv/core/utils/logger';

const CANONICAL = 'src/visualization/edge-repointing.ts';
const DELEGATING_FILES = [
  'src/visualization/layout/strategies/GridSnapStrategy.ts',
  'src/visualization/layout/strategies/ProgressiveForceStrategy.ts',
  'src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts',
] as const;

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-34 body, frozen from
// GridSnapStrategy.ts / ProgressiveForceStrategy.ts /
// SimulatedAnnealingStrategy.ts @ 85e6f6bb (three byte-identical copies,
// diff-verified). Do not "improve" this copy: its job is to be the OLD
// behavior, not good behavior.
// ---------------------------------------------------------------------------

function legacyUpdateEdgePoints(
  nodes: PositionedNode[],
  edges: LayoutEdge[],
): LayoutEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return edges.map(edge => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (!source || !target) {
      return { ...edge, points: [] };
    }

    // Simple straight line for now
    return {
      ...edge,
      points: [
        { x: source.x, y: source.y },
        { x: target.x, y: target.y }
      ]
    };
  });
}

// ---------------------------------------------------------------------------
// Corpus: live chains, both dangling shapes, an edge with NO endpoint fields,
// an edge carrying EVERY optional field (the spread-preservation witness),
// duplicate-id nodes (the tie-break witness), empties.
// ---------------------------------------------------------------------------

const NODES: PositionedNode[] = [
  { id: 'n0', label: 'A', x: 10, y: 20, width: 120, height: 60 },
  { id: 'n1', label: 'B', x: 200, y: 40, width: 90, height: 45 },
  { id: 'n2', label: 'C', x: 400, y: 60, width: 60, height: 60 },
];

const BASE_EDGES: LayoutEdge[] = [
  { source: 'n0', target: 'n1', points: [{ x: 0, y: 0 }], label: 'live' },
  { source: 'ghost', target: 'n1', points: [{ x: 0, y: 0 }], label: 'dangling-source' },
  { source: 'n0', target: 'ghost2', points: [{ x: 0, y: 0 }], label: 'dangling-target' },
  { source: 'ghost', target: 'ghost2', points: [{ x: 0, y: 0 }], label: 'dangling-both' },
  { points: [{ x: 0, y: 0 }], label: 'no-endpoint-fields' },
  {
    source: 'n1', target: 'n2', points: [{ x: 0, y: 0 }],
    label: 'full', id: 'e-full', from: 'n1', to: 'n2', type: 'dashed',
  },
];

const CORPUS: ReadonlyArray<readonly [string, PositionedNode[], LayoutEdge[]]> = [
  ['chain + dangling shapes + full-field edge', NODES, BASE_EDGES],
  ['empty edges', NODES, []],
  ['empty nodes', [], BASE_EDGES],
  [
    'duplicate-id nodes (tie-break witness)',
    [
      { id: 'dup', label: 'first', x: 1, y: 2, width: 50, height: 50 },
      { id: 'dup', label: 'last', x: 90, y: 90, width: 50, height: 50 },
      { id: 'other', label: 'O', x: 500, y: 500, width: 50, height: 50 },
    ],
    [{ source: 'dup', target: 'other', points: [], label: 'tie' }],
  ],
  [
    'NaN coordinates pass through verbatim',
    [{ id: 'nan', label: 'N', x: Number.NaN, y: Number.NaN, width: 50, height: 50 }],
    [{ source: 'nan', target: 'nan', points: [], label: 'self' }],
  ],
];

describe('round 34: strategy edge repointing single source', () => {
  describe('layer 1 — verbatim oracle (pre-round-34 body ≡ canonical)', () => {
    for (const [name, nodes, edges] of CORPUS) {
      it(`pure equality: ${name}`, () => {
        expect(repointEdgesStraightLine(nodes, edges)).toEqual(
          legacyUpdateEdgePoints(nodes, edges),
        );
      });
    }

    it('oracle is live (would catch a canonical rewrite): a center-offset anchor diverges', () => {
      // If someone rewrote the canonical anchors to the centerToCenter
      // convention (x + width/2), the oracle above would still pass for
      // width-less corpus nodes — so pin the divergence directly.
      const withExtents = NODES;
      const live = repointEdgesStraightLine(withExtents, [BASE_EDGES[0]]);
      const oracle = legacyUpdateEdgePoints(withExtents, [BASE_EDGES[0]]);
      expect(live).toEqual(oracle);
      expect(live[0].points[0]).toEqual({ x: 10, y: 20 }); // RAW, not x + 120/2
    });
  });

  describe('layer 2 — delegation equality (the private seam performLayout calls)', () => {
    const config = { width: 1920, height: 1080 } as LayoutConfig;
    const strategies = [
      ['grid-snap', () => new GridSnapStrategy()],
      ['progressive-force', () => new ProgressiveForceStrategy()],
      ['simulated-annealing', () => new SimulatedAnnealingStrategy()],
    ] as const;

    for (const [name, make] of strategies) {
      it(`${name}.updateEdgePoints delegates to the canonical function over the corpus`, () => {
        const strategy = make() as unknown as {
          updateEdgePoints(n: PositionedNode[], e: LayoutEdge[], c: LayoutConfig): LayoutEdge[];
        };
        for (const [caseName, nodes, edges] of CORPUS) {
          expect(strategy.updateEdgePoints(nodes, edges, config)).toEqual(
            repointEdgesStraightLine(nodes, edges),
            `case: ${caseName}`,
          );
        }
      });

      it(`${name}.updateEdgePoints is inert to the deliberately-dead config parameter`, () => {
        const strategy = make() as unknown as {
          updateEdgePoints(n: PositionedNode[], e: LayoutEdge[], c: LayoutConfig): LayoutEdge[];
        };
        const a = strategy.updateEdgePoints(NODES, BASE_EDGES, config);
        const b = strategy.updateEdgePoints(NODES, BASE_EDGES, {
          width: 1, height: 1, nodeSeparation: 999,
        } as LayoutConfig);
        expect(a).toEqual(b);
      });
    }
  });

  describe('layer 3 — contract witnesses', () => {
    let warnSpy: jest.Spied<typeof logger.warn>;

    beforeEach(() => {
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('live edge: exactly two RAW-coordinate points, every other field preserved', () => {
      const [edge] = repointEdgesStraightLine(NODES, [BASE_EDGES[5]]);
      expect(edge.points).toEqual([
        { x: 200, y: 40 }, // n1 raw x/y — NOT x + width/2
        { x: 400, y: 60 }, // n2 raw x/y
      ]);
      expect(edge.label).toBe('full');
      expect(edge.id).toBe('e-full');
      expect(edge.from).toBe('n1');
      expect(edge.to).toBe('n2');
      expect(edge.type).toBe('dashed'); // the field a reconstructed literal would drop
    });

    it('dangling edge: KEPT with points: [], all fields intact, NO warn', () => {
      const [edge] = repointEdgesStraightLine(NODES, [BASE_EDGES[1]]);
      expect(edge.points).toEqual([]);
      expect(edge.label).toBe('dangling-source');
      expect(edge.source).toBe('ghost');
      expect(warnSpy).not.toHaveBeenCalled(); // v1 builders warn; this family is silent
    });

    it('raw anchors are NOT the centerToCenterAnchors convention (families must not merge)', () => {
      const [source, target] = [NODES[0], NODES[1]];
      const repointed = repointEdgesStraightLine(NODES, [BASE_EDGES[0]]);
      const centered = centerToCenterAnchors(source, target);
      expect(repointed[0].points[0]).toEqual({ x: source.x, y: source.y });
      expect(centered[0]).toEqual({ x: source.x + 60, y: source.y + 30 }); // + width/2, height/2
      expect(repointed[0].points[0]).not.toEqual(centered[0]);
    });

    it('duplicate node ids resolve LAST-match-wins (plain Map; opposite of round-33 v1)', () => {
      const [edge] = repointEdgesStraightLine(CORPUS[3][1], CORPUS[3][2]);
      // first copy is at (1,2); the plain Map keeps the LAST (90,90).
      expect(edge.points[0]).toEqual({ x: 90, y: 90 });
    });

    it('an edge with NO endpoint fields is a dangling edge (undefined lookup), kept blank', () => {
      const [edge] = repointEdgesStraightLine(NODES, [BASE_EDGES[4]]);
      expect(edge.points).toEqual([]);
      expect(edge.label).toBe('no-endpoint-fields');
    });
  });

  describe('layer 4 — source anchors', () => {
    it('the canonical file holds the frozen skeleton', () => {
      const src = readSource(CANONICAL);
      expect(src).toContain('export function repointEdgesStraightLine');
      expect(src).toContain('const nodeMap = new Map(nodes.map(n => [n.id, n]));');
      expect(src).toContain('nodeMap.get(edge.source)');
      expect(src).toContain('return { ...edge, points: [] };');
      expect(src).toContain('{ x: source.x, y: source.y }');
    });

    it.each(DELEGATING_FILES)('%s delegates with the original signature', (file) => {
      const src = readSource(file);
      expect(src).toMatch(/import \{ repointEdgesStraightLine \} from '\.\.\/\.\.\/edge-repointing';/);
      expect(src).toContain('private updateEdgePoints(');
      expect(src).toContain('config: LayoutConfig'); // dead param retained verbatim
      expect(src).toContain('return repointEdgesStraightLine(nodes, edges);');
    });

    it.each(DELEGATING_FILES)('%s does not re-roll the spread skeleton inline', (file) => {
      // Only the SPREAD is banned as a re-roll tell: the sibling
      // `nodeMap.get(edge.source)` lookup idiom is legitimately shared with
      // these files' PHYSICS methods (calculateEdgeEnergy /
      // calculateCrossingEnergy / applyLinkForces) — a different concept.
      const src = readSource(file);
      expect(src).not.toMatch(/\.\.\.edge/);
    });

    it('out-of-family files do not delegate (enhanced-zero-overlap keeps its warn+filter variant)', () => {
      expect(readSource('src/visualization/enhanced-zero-overlap-layout.ts')).not.toMatch(
        /repointEdgesStraightLine/,
      );
      expect(readSource('src/visualization/strategy-edges.ts')).not.toMatch(
        /repointEdgesStraightLine/,
      );
    });
  });
});
