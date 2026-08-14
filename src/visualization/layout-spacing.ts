/**
 * Default layout spacing constants (single-source, round 11).
 *
 * Before this module, the default spacing values (nodeSeparation 50,
 * edgeSeparation 10, rankSeparation 50, margin 50) were independently frozen
 * at 20+ sites: both layout engines' default configs, seven strategies'
 * `getStrategyDefaults` blocks, and the `|| 50` / `|| 10` partial-config
 * fallbacks in dagre setup, the network sizer, the timeline margins, and the
 * layout worker. A partial `LayoutConfig` flowing through two of those sites
 * could silently get different spacing.
 *
 * Values are UNCHANGED — this is desync-proofing, not new behavior.
 * Per-diagram-type TUNED separations (Tree 80, Timeline 80, Comparison 70,
 * Network 60, Flowchart rank 70, the src/visualization/layout strategy
 * system's nodeSeparation 30) are different concepts and stay literal.
 */

/** Default horizontal gap between sibling nodes when config omits it. */
export const DEFAULT_NODE_SEPARATION = 50;

/** Default gap between parallel edges when config omits it. */
export const DEFAULT_EDGE_SEPARATION = 10;

/** Default vertical gap between ranks when config omits it. */
export const DEFAULT_RANK_SEPARATION = 50;

/** Default canvas margin (applies to both X and Y) when config omits it. */
export const DEFAULT_MARGIN = 50;
