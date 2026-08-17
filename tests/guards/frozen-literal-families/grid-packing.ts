import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 50). Registry policy and
// the ordered aggregation live in tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  {
    id: 'square-grid packing + cell-centered stamp single-sourced in layout-utils (round 50)',
    roots: ['src'],
    exclude: {
      'src/visualization/layout-utils.ts':
        'canonical source — squareGridColumns / squareGridRows / aspectGridColumns / centerInCell',
    },
    patterns: [
      // The column derivation re-rolled outside squareGridColumns /
      // aspectGridColumns — covers both the pure `max(1, ceil(sqrt(n)))`
      // form and the aspect `max(1, ceil(sqrt(n * ratio)))` form (the
      // aspect product is an argument to the same clamped-ceil-sqrt shape).
      /Math\.max\(1,\s*Math\.ceil\(Math\.sqrt\(/,
      // The rows divisor re-rolled outside squareGridRows — any
      // `max(1, ceil(<expr> / <expr>))` divides a packed count by columns;
      // advanced-layouts' UNCLAMPED drift (`ceil(n / cols)`, no max) is not
      // matched by this, but its live re-introduction would regress the
      // layer-3 anchor in grid-packing-single-source.test.ts first.
      /Math\.max\(1,\s*Math\.ceil\([^\n()]*\/\s*[^\n()]*\)\)/,
      // Stamp shape A — `(i·cell + cell/2) − extent/2` (ezo/Network/
      // LayoutOptimizer's retired grouping; the backreference pins the SAME
      // cell on both sides of the `+`).
      /\* (cellWidth|cellHeight|cellW|cellH|spacingX|spacingY) \+ \1 \/ 2 - /,
      // Stamp shape B — `i·cell + (cell − extent)/2` in any spelling
      // (single expression, or matrix's old two-step cellX local).
      /\+ \((cellWidth|cellHeight|cellW|cellH|spacingX|spacingY) - [^()]+\) \/ 2/,
    ],
    minSweptFiles: 300,
  },
];
