import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 48). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 48 (specs/speech-to-visuals round-48 record): the RING/CIRCLE
   * placement arithmetic — the even ring step `(2π · index) / count` and the
   * circle point `{x: cx + r·cos θ, y: cy + r·sin θ}` — must delegate to
   * layout-utils `ringAngle` / `pointOnCircle`. Before the round 14 sites
   * across 9 files re-derived the pair in four text variants (`2π·i`, `i·2π`,
   * `π·2·attempt`, and LayoutOptimizer's `/ Math.max(1, count)` dead guard),
   * three coordinate policies (center-point storage, `- w / 2` top-left
   * conversion, origin-centered), and three radius policies (fixed,
   * per-node importance, per-index spiral). A phase-shifted or off-by-one
   * step in one copy silently rotates ONE engine's cycle layout relative to
   * every other consumer of the same topology.
   *
   * Banned shapes are identifier-agnostic code-shape tells. Legitimate reads
   * do NOT match:
   *   - OverlapResolver's radial PUSH (`node1.x += Math.cos(angle) *
   *     separation;` / `node2.x -= …`) — a direction-vector displacement
   *     with no circle center, deliberately scoped out (`+=`/`-=` mutation
   *     forms are syntactically distinct from the banned `+ ` reads).
   *   - mindmap-strategy's WEIGHTED sector `(2 * Math.PI * branchWeights[i])
   *     / totalWeight` — weight-proportional, not index-even (subscripted
   *     operand fails the `\w+` tell); converging it would be a behavior
   *     change, not a deduplication.
   *   - cycle-strategy's inverse `circumferenceNeeded / (2 * Math.PI)` —
   *     circumference→radius, the reciprocal concept.
   *   - OverlapResolver's random-direction bound `rng() * 2 * Math.PI` and
   *     mindmap's `-Math.PI / 2` start cursor — constants, not folds.
   * The registry walk skips comment lines and __tests__ / *.test.* — where
   * frozen verbatim oracles and worker-mock faithful shapes legitimately
   * reproduce the retired forms. Delegation pins per site live in
   * ring-placement-single-source.test.ts.
   */
  {
    id: 'ring placement: no re-inlined (2π·i)/n + cx + r·cos folds outside layout-utils',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — ringAngle / pointOnCircle',
    },
    patterns: [
      // even-step angle local: `const angle = (2 * Math.PI * i) / n;`
      // (also catches the retired `/ Math.max(1, n)` guard variant — same prefix)
      /const \w+ = \(2 \* Math\.PI \* \w+\) \/ /,
      // commuted operand step: `const angle = (i * 2 * Math.PI) / nodes.length;`
      /const \w+ = \(\w+ \* 2 \* Math\.PI\) \/ /,
      // pi-first step: `const angle = (Math.PI * 2 * attempt) / attempts;`
      /const \w+ = \(Math\.PI \* 2 \* \w+\) \/ /,
      // object-literal circle point (with or without a trailing `- w / 2`):
      // `x: cx + radius * Math.cos(angle),`
      /x: \w+ \+ \w+ \* Math\.cos\(\w+\)/,
      /y: \w+ \+ \w+ \* Math\.sin\(\w+\)/,
      // origin-centered / commuted object form: `x: Math.cos(angle) * radius,`
      /x: Math\.cos\(\w+\) \* \w+/,
      /y: Math\.sin\(\w+\) \* \w+/,
      // polar local read: `const bx = center.x + Math.cos(baseAngle) * branchRadius;`
      // (the scoped-out `+=` push lines fail this tell — `+=` ≠ `+ `)
      /const \w+ = \w+\.x \+ Math\.cos\(\w+\) \* \w+;/,
      /const \w+ = \w+\.y \+ Math\.sin\(\w+\) \* \w+;/,
      // target local: `const targetX = centerX + radius * Math.cos(angle);`
      /const \w+ = \w+ \+ \w+ \* Math\.cos\(\w+\);/,
      /const \w+ = \w+ \+ \w+ \* Math\.sin\(\w+\);/,
    ],
    minSweptFiles: 300,
  },
];
