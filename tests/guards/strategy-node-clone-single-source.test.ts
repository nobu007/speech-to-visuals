/**
 * @jest-environment node
 */
/**
 * strategy-node-clone-single-source.test.ts — round 35.
 *
 * Family: the shallow-copy node-array helper of the physics-first strategy
 * system. GridSnapStrategy and SimulatedAnnealingStrategy each carried a
 * byte-identical private twin:
 *
 *   private cloneNodes<T extends PositionedNode>(nodes: T[]): T[] {
 *     return nodes.map(node => ({ ...node } as T));
 *   }
 *
 * (diff-verified byte-identical at extraction time). Its job is to keep
 * placement physics (grid snapping, annealing perturbation, best-solution
 * snapshots) from mutating caller-owned nodes — a drifted twin at one
 * strategy (e.g. an alias `return nodes` instead of the map, or a copy that
 * drops fields) would corrupt exactly that strategy's input nodes while the
 * other strategy and every shared fixture stayed green.
 *
 * Zero-delta extraction: the body moved VERBATIM to a protected member on
 * BaseLayoutStrategy (the file that already owns the shared protected
 * helpers ensurePositionedNode / areNodesOverlapping / doLinesIntersect);
 * only the visibility keyword changed. The three `this.cloneNodes(...)`
 * call sites are untouched. ProgressiveForceStrategy inherits the member
 * unused — that is allowed and pinned below.
 *
 * Layers:
 *   1. VERBATIM ORACLE — the pre-round-35 body, frozen below, stays
 *      value-equal to the inherited member through BOTH strategies.
 *   2. SINGLE-INHERITANCE PIN — the member lives on
 *      BaseLayoutStrategy.prototype and on NEITHER subclass prototype (a
 *      re-frozen private twin would show up as an own property).
 *   3. CONTRACT WITNESSES — one level of copying exactly: new array, new
 *      element objects, every field preserved — but NESTED objects aliased
 *      (the deliberate shallow contract, pinned so nobody "fixes" it into a
 *      deep copy without updating the strategies that rely on sharing).
 *   4. SOURCE ANCHORS — exactly one declaration in the family corpus; the
 *      strategies keep their call sites and carry no declaration.
 *
 * The "no site re-rolls the declaration" discovery sweep lives in the shared
 * registry (round-35 entry in
 * tests/guards/frozen-literal-families/strategy-node-clone.ts — bans the
 * generic `cloneNodes<T extends …` declaration shape anywhere outside the
 * canonical base class); this file holds the behavioral pins.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import type { PositionedNode } from '@stv/core/types/diagram';
import { BaseLayoutStrategy } from '@/visualization/layout/strategies/LayoutStrategy';
import { GridSnapStrategy } from '@/visualization/layout/strategies/GridSnapStrategy';
import { SimulatedAnnealingStrategy } from '@/visualization/layout/strategies/SimulatedAnnealingStrategy';
import { ProgressiveForceStrategy } from '@/visualization/layout/strategies/ProgressiveForceStrategy';

const CANONICAL = 'src/visualization/layout/strategies/LayoutStrategy.ts';
const FORMER_TWIN_FILES = [
  'src/visualization/layout/strategies/GridSnapStrategy.ts',
  'src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts',
] as const;

// ---------------------------------------------------------------------------
// Layer 1 material: the VERBATIM pre-round-35 body, frozen from
// GridSnapStrategy.ts:274 / SimulatedAnnealingStrategy.ts:426 @ 0ff41bc9
// (byte-identical twins, diff-verified). Do not "improve" this copy: its job
// is to be the OLD behavior, not good behavior.
// ---------------------------------------------------------------------------

function legacyCloneNodes<T extends PositionedNode>(nodes: T[]): T[] {
  return nodes.map(node => ({
    ...node,
    // Create a shallow copy of the node
  } as T));
}

// ---------------------------------------------------------------------------
// Corpus: plain nodes, an EVERY-field node (spread-preservation witness),
// extra non-declared fields, NaN coords, duplicate ids, empty array.
// ---------------------------------------------------------------------------

interface AnnealingNodeWitness extends PositionedNode {
  temperature: number;
  meta?: { shared: string };
}

const CORPUS: ReadonlyArray<readonly [string, AnnealingNodeWitness[]]> = [
  [
    'plain nodes',
    [
      { id: 'n0', label: 'A', x: 10, y: 20, width: 120, height: 60, temperature: 10 },
      { id: 'n1', label: 'B', x: 200, y: 40, width: 90, height: 45, temperature: 9.5 },
    ],
  ],
  [
    'every declared field + extra fields (spread witness)',
    [
      {
        id: 'full', label: 'F', x: 1, y: 2, width: 50, height: 25, temperature: 7,
        meta: { shared: 'nested-object' }, custom: 'extra-field',
      },
    ],
  ],
  [
    'NaN coordinates pass through verbatim',
    [{ id: 'nan', label: 'N', x: Number.NaN, y: Number.NaN, width: 50, height: 50, temperature: 1 }],
  ],
  [
    'duplicate ids (no dedup — copy, not normalization)',
    [
      { id: 'dup', label: 'first', x: 1, y: 2, width: 10, height: 10, temperature: 2 },
      { id: 'dup', label: 'last', x: 9, y: 9, width: 10, height: 10, temperature: 3 },
    ],
  ],
  ['empty array', []],
];

type CloneNodesMember = <T extends PositionedNode>(nodes: T[]) => T[];

function memberOf(strategyInstance: unknown): CloneNodesMember {
  return (strategyInstance as { cloneNodes: CloneNodesMember }).cloneNodes;
}

describe('round 35: strategy node-clone single source', () => {
  describe('layer 1 — verbatim oracle (pre-round-35 body ≡ inherited member)', () => {
    const strategies = [
      ['grid-snap', () => new GridSnapStrategy()],
      ['simulated-annealing', () => new SimulatedAnnealingStrategy()],
      ['base (via progressive-force instance)', () => new ProgressiveForceStrategy()],
    ] as const;

    for (const [name, make] of strategies) {
      for (const [caseName, nodes] of CORPUS) {
        it(`${name}.cloneNodes ≡ legacy body: ${caseName}`, () => {
          expect(memberOf(make())([...nodes])).toEqual(legacyCloneNodes([...nodes]));
        });
      }
    }
  });

  describe('layer 2 — single-inheritance pin (the member lives on the base only)', () => {
    it('cloneNodes is an own property of BaseLayoutStrategy.prototype', () => {
      expect(
        Object.prototype.hasOwnProperty.call(BaseLayoutStrategy.prototype, 'cloneNodes'),
      ).toBe(true);
    });

    it.each([
      ['GridSnapStrategy', GridSnapStrategy],
      ['SimulatedAnnealingStrategy', SimulatedAnnealingStrategy],
      ['ProgressiveForceStrategy', ProgressiveForceStrategy],
    ])('%s does not shadow the member (a re-frozen twin would be an own property)', (_n, ctor) => {
      expect(Object.prototype.hasOwnProperty.call(ctor.prototype, 'cloneNodes')).toBe(false);
      // …and resolves through the base, not through a subclass restamp.
      expect(Object.getPrototypeOf(ctor.prototype).cloneNodes).toBe(
        BaseLayoutStrategy.prototype.cloneNodes,
      );
    });
  });

  describe('layer 3 — contract witnesses (exactly one level of copying)', () => {
    const original: AnnealingNodeWitness[] = [
      {
        id: 'n0', label: 'A', x: 10, y: 20, width: 120, height: 60, temperature: 10,
        meta: { shared: 'nested' },
      },
    ];

    it('new array, new element objects — mutating the clone leaves the input untouched', () => {
      const clone = memberOf(new GridSnapStrategy())(original);
      expect(clone).not.toBe(original);
      clone[0].x = 999;
      clone[0].temperature = 999;
      expect(original[0].x).toBe(10);
      expect(original[0].temperature).toBe(10);
    });

    it('every field survives the copy (spread), including undeclared extras', () => {
      const [node] = memberOf(new SimulatedAnnealingStrategy())(original);
      expect(node).toEqual(original[0]);
      expect(node.id).toBe('n0');
      expect((node as AnnealingNodeWitness & { custom?: string }).custom).toBeUndefined();
    });

    it('the generic preserves the SUBTYPE (AnnealingNodeWitness fields kept, typed)', () => {
      const [node] = memberOf(new GridSnapStrategy())(original);
      expect(node.temperature).toBe(10); // subtype member, not stripped to PositionedNode
    });

    it('NESTED objects are aliased — the contract is shallow, pinned deliberately', () => {
      const [node] = memberOf(new GridSnapStrategy())(original);
      expect(node.meta).toBe(original[0].meta); // same reference — one level of copying exactly
    });

    it('length and order preserved; duplicates copied, not deduped', () => {
      const dupSource: AnnealingNodeWitness[] = CORPUS[3][1];
      const clone = memberOf(new GridSnapStrategy())(dupSource);
      expect(clone.map((n) => n.label)).toEqual(['first', 'last']);
    });
  });

  describe('layer 4 — source anchors', () => {
    it('the canonical base class holds exactly one declaration, verbatim body', () => {
      const src = readSource(CANONICAL);
      expect(src.match(/cloneNodes\s*<\w+\s+extends/g)?.length).toBe(1);
      expect(src).toContain('protected cloneNodes<T extends PositionedNode>(nodes: T[]): T[] {');
      expect(src).toContain('...node,');
      expect(src).toContain('} as T));');
    });

    it.each(FORMER_TWIN_FILES)('%s keeps its call sites but declares nothing', (file) => {
      const src = readSource(file);
      expect(src).not.toMatch(/\bcloneNodes\s*<\w+\s+extends\b/); // no declaration re-freeze
      expect(src).not.toMatch(/\bprivate\s+cloneNodes\b/);
      expect(src.match(/this\.cloneNodes\(/g)?.length ?? 0).toBeGreaterThan(0);
    });

    it('the family corpus holds no second declaration outside the canonical file', () => {
      for (const file of [
        ...FORMER_TWIN_FILES,
        'src/visualization/layout/strategies/ProgressiveForceStrategy.ts',
      ]) {
        expect(readSource(file)).not.toMatch(/\bcloneNodes\s*<\w+\s+extends\b/);
      }
    });
  });
});
