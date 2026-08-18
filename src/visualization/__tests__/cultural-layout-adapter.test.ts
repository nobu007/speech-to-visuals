import { describe, expect, it } from '@jest/globals';

import type { DiagramLayout, PositionedNode } from '@stv/core/types/diagram';
import type { ComplexLayoutConfig } from '../complex-layout-engine';
import { CulturalLayoutAdapter } from '../strategies/CulturalLayoutAdapter';

describe('CulturalLayoutAdapter', () => {
  const config: ComplexLayoutConfig = {
    width: 1920,
    height: 1080,
    nodeWidth: 120,
    nodeHeight: 60,
    marginX: 50,
    marginY: 50,
    rankDirection: 'TB',
    nodeSeparation: 50,
    edgeSeparation: 30,
    rankSeparation: 50,
  };

  it('does not mutate the caller nodes array on a ttb (vertical) adaptation', async () => {
    // Regression: applyVerticalLayout sorted `layout.nodes` IN PLACE
    // (Array.prototype.sort mutates). applyCulturalAdaptation passes a shallow
    // copy ({ ...layout }) whose `nodes` array is the SAME reference as the
    // caller's input, so the sort reordered the caller's nodes as a silent
    // side effect. The sibling layout methods use .map() (non-destructive);
    // only the vertical path sorted in place. Non-destructive pass.
    const adapter = new CulturalLayoutAdapter(config);

    // Deliberately NOT in y-ascending order, so an in-place sort is detectable.
    const originalNodes: PositionedNode[] = [
      { id: 'n1', label: 'A', x: 0, y: 300 },
      { id: 'n2', label: 'B', x: 0, y: 100 },
      { id: 'n3', label: 'C', x: 0, y: 200 },
    ];
    const originalOrder = originalNodes.map((n) => n.id); // ['n1','n2','n3']
    const layout: DiagramLayout = { nodes: originalNodes, edges: [] };

    const result = await adapter.applyCulturalAdaptation(layout, {
      languageCode: 'ja',
      readingPattern: 'ttb',
      hierarchyPreference: 'moderate',
      visualStyle: 'minimalist',
      colorHarmony: [],
    });

    // The caller's array must remain in its original order (no side effect).
    expect(originalNodes.map((n) => n.id)).toEqual(originalOrder);
    // The returned layout still sorts internally (on a copy) by y ascending:
    // n2(100), n3(200), n1(300) — proving the sort ran, just non-destructively.
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.id)).toEqual(['n2', 'n3', 'n1']);
  });
});
