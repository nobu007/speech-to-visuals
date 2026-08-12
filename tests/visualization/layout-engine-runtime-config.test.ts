import { LayoutEngine } from '@/visualization/layout-engine';
import { NodeDatum } from '@/types/diagram';

/**
 * REQ-051: LayoutEngine construction-once sub-strategies must re-read runtime
 * config at generation.
 *
 * The LayoutEngine hands `this.config` to its sub-strategies (dagre, fallback,
 * overlap resolver, optimizer, evaluator) ONCE in the constructor, and they all
 * store that reference (not a copy). The pipeline's `applyConfigToCollaborators`
 * helper pushes `config.layout.{width,height,nodeWidth,nodeHeight}` into
 * `layoutEngine.updateConfig(...)` before every stage run — so a user override
 * on `PipelineConfig.layout` (or the auto-tuner's values) is expected to reach
 * layout GENERATION. The previous implementation reassigned
 * `this.config = { ...this.config, ...newConfig }`, which created a NEW object
 * and left every sub-strategy holding the stale original reference: the synced
 * config updated `getConfig()` (which reads `this.config` directly) but never
 * reached `dagreLayoutStrategy.applyLayout`, which reads nodeWidth/nodeHeight
 * from its captured config — a silent no-op in the same family as the
 * config-not-propagated defects (a value exposed on the boundary / pushed by the
 * central helper that never reached generation).
 */
describe('LayoutEngine runtime config propagation (REQ-051)', () => {
  /** Read the effective node width regardless of the deprecated `w`/`width` alias. */
  const effectiveWidth = (n: { width?: number; w?: number }): number => n.width ?? n.w ?? 0;
  const effectiveHeight = (n: { height?: number; h?: number }): number => n.height ?? n.h ?? 0;

  const twoNodes: NodeDatum[] = [
    { id: 'a', label: 'A' }, // short label → calculateNodeWidth returns the nodeWidth floor
    { id: 'b', label: 'B' },
  ];
  const oneEdge = [{ from: 'a', to: 'b' }];

  it('propagates nodeWidth set via updateConfig to dagre layout generation', async () => {
    const engine = new LayoutEngine();
    // Override AFTER construction — the construction-once dagre strategy must
    // observe this on the next generateLayout() call.
    engine.updateConfig({ nodeWidth: 400 });

    const result = await engine.generateLayout(twoNodes, oneEdge, 'flow', 1);
    const nodes = result.layout.nodes;

    expect(nodes.length).toBeGreaterThan(0);
    // calculateNodeWidth = Math.max(nodeWidth, Math.min(textWidth, nodeWidth*2)),
    // so every node is ≥ the configured nodeWidth when it propagated; with the
    // stale-config defect every width collapses to the default 120.
    for (const node of nodes) {
      expect(effectiveWidth(node)).toBeGreaterThanOrEqual(400);
    }
  });

  it('propagates nodeHeight set via updateConfig to dagre layout generation', async () => {
    const engine = new LayoutEngine();
    engine.updateConfig({ nodeHeight: 250 });

    const result = await engine.generateLayout(twoNodes, oneEdge, 'flow', 1);
    const nodes = result.layout.nodes;

    expect(nodes.length).toBeGreaterThan(0);
    // dagre sets each node height directly from config.nodeHeight, so the new
    // value must appear verbatim; the stale-config defect leaves it at default 60.
    for (const node of nodes) {
      expect(effectiveHeight(node)).toBe(250);
    }
  });

  it('reflects a second updateConfig (no stale snapshot between calls)', async () => {
    const engine = new LayoutEngine();
    engine.updateConfig({ nodeHeight: 250 });
    engine.updateConfig({ nodeHeight: 333 });

    const result = await engine.generateLayout(twoNodes, oneEdge, 'flow', 1);
    for (const node of result.layout.nodes) {
      expect(effectiveHeight(node)).toBe(333);
    }
  });
});
