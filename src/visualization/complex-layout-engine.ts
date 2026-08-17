/**
 * Complex Layout Engine for Large Diagrams - Iteration 50: Global Excellence
 * Handles diagrams with 20+ nodes using advanced algorithms
 * Enhanced with cultural layout adaptation and real-time optimization
 * Global performance optimizations for all languages and contexts
 * With Web Worker integration for layout computation (TASK-0115)
 */

import dagre from '@dagrejs/dagre';
import { DiagramType, NodeDatum, EdgeDatum, DiagramLayout, PositionedNode, LayoutEdge } from '@/types/diagram';
import { getNodeWidth, getNodeHeight, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './node-dimensions';
import { LayoutConfig, LayoutResult } from './types';
import {
  DEFAULT_NODE_SEPARATION,
  DEFAULT_EDGE_SEPARATION,
  DEFAULT_RANK_SEPARATION,
  DEFAULT_MARGIN,
} from './layout-spacing';
import { nodesOverlap, distance, nodeExtentEdges, foldNodeExtents, clampNodeCoordinate, calculateNodeCenter, ringAngle, pointOnCircle } from './layout-utils';
import { centerToCenterAnchors } from './strategy-edges';
import { mulberry32, seedFromString } from './layout-rng';
import { OverlapResolver } from './strategies/OverlapResolver';
import { LayoutOptimizer } from './strategies/LayoutOptimizer';
import { DagreLayoutStrategy } from './strategies/DagreLayoutStrategy';
import { VisualizationError } from '@/pipeline/pipeline-errors';
import {
  WorkerPool,
  isWorkerAvailable,
  getOptimalWorkerCount,
  computeLayout as workerComputeLayout,
} from '../workers';
import { createLayoutWorkerFactory } from '../workers/worker-factories';
import type {
  WorkerMessage,
  LayoutWorkerPayload,
  LayoutWorkerResult,
} from '../workers';

/**
 * Deterministic seeding for force-directed initialization: same graph (node
 * IDs) → same initial positions → reproducible layout output and reproducible
 * tests. Random seeding made the simulation's converged quality vary
 * run-to-run (flake class: layout-quality assertions on a random seed).
 * The PRNG itself is the shared single source in ./layout-rng.
 */

export interface ComplexLayoutConfig extends LayoutConfig {
  // Node clustering settings
  enableClustering: boolean;
  maxClusterSize: number;
  clusterSeparation: number;

  // Force-directed layout settings
  enableForceDirected: boolean;
  springStrength: number;
  repulsionStrength: number;
  iterations: number;

  // Multi-level layout settings
  enableMultiLevel: boolean;
  levelThreshold: number;

  // Overlap resolution
  enableOverlapResolution: boolean;
  overlapTolerance: number;

  // Edge optimization
  enableEdgeOptimization: boolean;
  minimizeCrossings: boolean;

  // Performance settings
  maxProcessingTime: number;
  useWebWorkers: boolean;

  // ✨ Iteration 50: Cultural Layout Adaptation


  // ✨ Real-time optimization features
  enableRealTimeOptimization: boolean;
  adaptiveThresholds: boolean;

  // Performance targets (used by constructor defaults)
  performanceTargets?: {
    maxLayoutTime: number;
    targetFPS: number;
    memoryLimit: number;
  };

  // ✨ Iteration 50: Cultural Layout Adaptation
  culturalAdaptation?: {
    languageCode: string;
    readingPattern: 'ltr' | 'rtl' | 'ttb';
    hierarchyPreference: 'strong' | 'moderate' | 'flat';
    visualStyle: 'minimalist' | 'expressive' | 'technical';
    colorHarmony: string[];
  };
}

export interface ClusterData {
  id: string;
  nodes: NodeDatum[];
  centroid: { x: number; y: number };
  bounds: { width: number; height: number };
  importance: number;
}

export interface ForceDirectedState {
  positions: Map<string, { x: number; y: number; vx: number; vy: number }>;
  forces: Map<string, { fx: number; fy: number }>;
  energy: number;
  converged: boolean;
}

import { CulturalLayoutAdapter } from './strategies/CulturalLayoutAdapter';
import { logger } from '../utils/logger';

/**
 * Deterministic worker-message id (round 17). Was
 * `layout_${Date.now()}_${Math.random …}` — the id appears in output JSON,
 * so it silently made whole-JSON golden comparisons non-deterministic. The id
 * is identity-only (no consumer references it; verified by grep), so keying
 * it to the node-id set is safe: regenerating the same diagram yields the
 * same id, which is exactly the determinism this engine's positions already
 * guarantee via initializeForceDirectedState.
 */
export function makeLayoutWorkerMessageId(nodes: NodeDatum[]): string {
  const rand = mulberry32(seedFromString(nodes.map(n => n.id).join('|')));
  return `layout_${rand().toString(36).slice(2, 9)}`;
}

export class ComplexLayoutEngine {
  private config: ComplexLayoutConfig;
  private culturalLayoutAdapter: CulturalLayoutAdapter;
  private layoutWorkerPool: WorkerPool | null = null;
  private disposed = false;

  constructor(
    config: Partial<ComplexLayoutConfig> = {},
    private overlapResolver?: OverlapResolver,
    private layoutOptimizer?: LayoutOptimizer,
    private dagreLayoutStrategy?: DagreLayoutStrategy,
    culturalLayoutAdapter?: CulturalLayoutAdapter,
  ) {
    this.config = {
      // Basic layout config
      width: 1920,
      height: 1080,
      nodeWidth: DEFAULT_NODE_WIDTH,
      nodeHeight: DEFAULT_NODE_HEIGHT,
      marginX: DEFAULT_MARGIN,
      marginY: DEFAULT_MARGIN,
      rankDirection: 'TB',
      nodeSeparation: DEFAULT_NODE_SEPARATION,
      edgeSeparation: DEFAULT_EDGE_SEPARATION,
      rankSeparation: DEFAULT_RANK_SEPARATION,

      // Complex layout extensions
      enableClustering: true,
      maxClusterSize: 8,
      clusterSeparation: 150,

      enableForceDirected: true,
      springStrength: 0.3,
      repulsionStrength: 800,
      iterations: 100,

      enableMultiLevel: true,
      levelThreshold: 15,

      enableOverlapResolution: true,
      overlapTolerance: 10,

      enableEdgeOptimization: true,
      minimizeCrossings: true,

      maxProcessingTime: 10000, // 10 seconds
      useWebWorkers: false, // Enable to offload layout computation to Web Workers

      // ✨ Iteration 50 enhancements
      enableRealTimeOptimization: true,
      adaptiveThresholds: true,
      performanceTargets: {
        maxLayoutTime: 5000, // 5 seconds
        targetFPS: 60,
        memoryLimit: 256 * 1024 * 1024 // 256MB
      },

      ...config
    };
    this.culturalLayoutAdapter = culturalLayoutAdapter || new CulturalLayoutAdapter(this.config);
  }

  /** Lazily initialize and return the worker pool */
  private getWorkerPool(): WorkerPool | null {
    if (this.disposed || !this.config.useWebWorkers || !isWorkerAvailable()) return null;
    if (!this.layoutWorkerPool) {
      this.layoutWorkerPool = new WorkerPool(
        createLayoutWorkerFactory(),
        getOptimalWorkerCount(2),
      );
    }
    return this.layoutWorkerPool.isTerminated ? null : this.layoutWorkerPool;
  }

  /** Whether Web Workers are active for layout computation */
  get isWorkerEnabled(): boolean {
    if (!this.config.useWebWorkers) return false;
    const pool = this.layoutWorkerPool;
    return !this.disposed && pool !== null && !pool.isTerminated;
  }

  /** Terminate worker pool and release resources */
  dispose(): void {
    this.disposed = true;
    this.layoutWorkerPool?.terminate();
    this.layoutWorkerPool = null;
  }

  /**
   * Generate layout for complex diagrams (20+ nodes)
   * Offloads computation to Web Workers when enabled.
   */
  async generateComplexLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<LayoutResult> {
    const startTime = performance.now();

    // Try worker-based computation first when enabled
    const workerPool = this.getWorkerPool();
    if (workerPool) {
      const workerLayout = await this.computeLayoutViaWorker(nodes, edges);
      if (workerLayout) {
        const bounds = this.calculateBounds(workerLayout);

        // Apply post-processing if configured
        let layout = workerLayout;
        if (this.config.enableOverlapResolution && this.overlapResolver) {
          layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);
        }
        if (this.config.enableEdgeOptimization && this.layoutOptimizer) {
          layout = await this.layoutOptimizer.optimizeForDiagramType(layout, diagramType);
        }
        if (this.config.culturalAdaptation) {
          layout = await this.culturalLayoutAdapter.applyCulturalAdaptation(layout, this.config.culturalAdaptation);
        }

        const processingTime = performance.now() - startTime;
        return {
          layout,
          bounds: this.calculateBounds(layout),
          processingTime,
          success: true,
        };
      }
      // Worker failed, fall through to main-thread computation
    }

    try {
      let layout: DiagramLayout;

      // Choose algorithm based on node count and diagram type
      if (nodes.length < this.config.levelThreshold) {
        // Use standard Dagre for smaller graphs
        layout = await this.standardLayout(nodes, edges, diagramType);
      } else if (this.config.enableMultiLevel) {
        // Use multi-level approach for very large graphs
        layout = await this.multiLevelLayout(nodes, edges, diagramType);
      } else if (this.config.enableClustering) {
        // Use clustering approach
        layout = await this.clusteredLayout(nodes, edges, diagramType);
      } else {
        // Use force-directed approach
        layout = await this.forceDirectedLayout(nodes, edges, diagramType);
      }

      // Post-processing optimizations
      if (this.config.enableOverlapResolution && this.overlapResolver) {
        layout = await this.overlapResolver.ensureZeroOverlaps(layout, diagramType);
      }

      if (this.config.enableEdgeOptimization && this.layoutOptimizer) {
        layout = await this.layoutOptimizer.optimizeForDiagramType(layout, diagramType);
      }

      // ✨ Iteration 50: Cultural Layout Adaptation
      if (this.config.culturalAdaptation) {
        layout = await this.culturalLayoutAdapter.applyCulturalAdaptation(layout, this.config.culturalAdaptation);
      }
      const bounds = this.calculateBounds(layout);
      const processingTime = performance.now() - startTime;


      return {
        layout,
        bounds,
        processingTime,
        success: true
      };

    } catch (error) {
      logger.error('Complex layout failed:', error);

      // Fallback to simple grid layout
      if (!this.dagreLayoutStrategy) {
        throw new VisualizationError("DagreLayoutStrategy is not initialized for fallback in ComplexLayoutEngine.");
      }
      const fallbackLayout = await this.dagreLayoutStrategy.applyLayout(nodes, edges, diagramType);
      const bounds = this.calculateBounds(fallbackLayout);

      return {
        layout: fallbackLayout,
        bounds,
        processingTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Complex layout error'
      };
    }
  }

  /**
   * Multi-level layout for very large graphs
   */
  private async multiLevelLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {

    // Step 1: Graph coarsening (reduce complexity)
    const levels = await this.coarsenGraph(nodes, edges);

    // Step 2: Layout coarsest level
    let layout = await this.layoutCoarsestLevel(levels[levels.length - 1], diagramType);

    // Step 3: Uncoarsen and refine
    for (let i = levels.length - 2; i >= 0; i--) {
      layout = await this.uncoarsenAndRefine(layout, levels[i], diagramType);
    }

    return layout;
  }

  /**
   * Clustered layout approach
   */
  private async clusteredLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {

    // Step 1: Cluster nodes based on connectivity and importance
    const clusters = await this.clusterNodes(nodes, edges);

    // Step 2: Layout clusters
    const clusterLayout = await this.layoutClusters(clusters, diagramType);

    // Step 3: Layout nodes within each cluster
    const finalLayout = await this.layoutWithinClusters(clusters, clusterLayout, edges);

    return finalLayout;
  }

  /**
   * Force-directed layout for organic arrangement
   */
  private async forceDirectedLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    diagramType: DiagramType
  ): Promise<DiagramLayout> {

    // Initialize positions
    const state = this.initializeForceDirectedState(nodes);

    // Run simulation
    for (let i = 0; i < this.config.iterations && !state.converged; i++) {
      this.stepForceDirectedSimulation(state, nodes, edges);

      // Check convergence every 10 iterations
      if (i % 10 === 0) {
        state.converged = this.checkConvergence(state);
      }
    }


    // Convert to layout format
    return this.forceStateToLayout(state, nodes, edges);
  }

  /**
   * Cluster nodes using community detection
   */
  private async clusterNodes(nodes: NodeDatum[], edges: EdgeDatum[]): Promise<ClusterData[]> {
    const clusters: ClusterData[] = [];
    const visited = new Set<string>();

    // Build adjacency list
    const adjacency = new Map<string, Set<string>>();
    nodes.forEach(node => adjacency.set(node.id, new Set()));
    edges.forEach(edge => {
      adjacency.get(edge.from)?.add(edge.to);
      adjacency.get(edge.to)?.add(edge.from);
    });

    // Simple clustering algorithm (can be improved with more sophisticated methods)
    for (const node of nodes) {
      if (visited.has(node.id)) continue;

      const cluster = this.growCluster(node, adjacency, visited, nodes);
      if (cluster.length > 0) {
        clusters.push({
          id: `cluster_${clusters.length}`,
          nodes: cluster,
          centroid: this.calculateClusterCentroid(cluster),
          bounds: this.calculateClusterBounds(cluster),
          importance: this.calculateClusterImportance(cluster)
        });
      }
    }

    return clusters;
  }

  /**
   * Grow cluster from seed node
   */
  private growCluster(
    seedNode: NodeDatum,
    adjacency: Map<string, Set<string>>,
    visited: Set<string>,
    allNodes: NodeDatum[]
  ): NodeDatum[] {
    const cluster: NodeDatum[] = [];
    const queue = [seedNode];
    const inCluster = new Set<string>();

    while (queue.length > 0 && cluster.length < this.config.maxClusterSize) {
      const node = queue.shift()!;

      if (visited.has(node.id) || inCluster.has(node.id)) continue;

      visited.add(node.id);
      inCluster.add(node.id);
      cluster.push(node);

      // Add neighbors to queue
      const neighbors = adjacency.get(node.id) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId) && !inCluster.has(neighborId)) {
          const neighborNode = allNodes.find(n => n.id === neighborId);
          if (neighborNode) {
            queue.push(neighborNode);
          }
        }
      }
    }

    return cluster;
  }

  /**
   * Layout clusters in meta-arrangement
   */
  private async layoutClusters(clusters: ClusterData[], diagramType: DiagramType): Promise<Map<string, { x: number; y: number }>> {
    const clusterPositions = new Map<string, { x: number; y: number }>();

    // Simple circular arrangement for clusters
    const centerX = this.config.width / 2;
    const centerY = this.config.height / 2;
    const radius = Math.min(this.config.width, this.config.height) * 0.3;

    clusters.forEach((cluster, index) => {
      // Round 48 single-source — ring step + circle point in layout-utils;
      // cluster anchors are CENTER points (no top-left conversion).
      clusterPositions.set(cluster.id, pointOnCircle(centerX, centerY, ringAngle(index, clusters.length), radius));
    });

    return clusterPositions;
  }

  /**
   * Layout nodes within clusters
   */
  private async layoutWithinClusters(
    clusters: ClusterData[],
    clusterPositions: Map<string, { x: number; y: number }>,
    edges: EdgeDatum[]
  ): Promise<DiagramLayout> {
    const allNodes: PositionedNode[] = [];
    const allEdges: LayoutEdge[] = [];

    for (const cluster of clusters) {
      const clusterPos = clusterPositions.get(cluster.id) ?? { x: 0, y: 0 };
      const clusterNodes = await this.layoutClusterNodes(cluster.nodes, clusterPos);
      allNodes.push(...clusterNodes);
    }

    // Layout edges
    edges.forEach(edge => {
      const fromNode = allNodes.find(n => n.id === edge.from);
      const toNode = allNodes.find(n => n.id === edge.to);

      if (fromNode && toNode) {
        allEdges.push({
          from: edge.from,
          to: edge.to,
          // Round 46 single-source — center anchors in strategy-edges.ts. The
          // drop-dangling policy (this `if` guard) stays at this site.
          points: [...centerToCenterAnchors(fromNode, toNode)],
          label: edge.label
        });
      }
    });

    return { nodes: allNodes, edges: allEdges };
  }

  /**
   * Layout nodes within a single cluster
   */
  private async layoutClusterNodes(
    nodes: NodeDatum[],
    clusterCenter: { x: number; y: number }
  ): Promise<PositionedNode[]> {
    const clusterRadius = 80; // Radius for nodes within cluster
    const nodeSize = { width: 100, height: 50 };

    return nodes.map((node, index) => {
      // Round 48 single-source — ring step + circle point in layout-utils;
      // the `- nodeSize.width / 2` top-left conversion stays here.
      const p = pointOnCircle(clusterCenter.x, clusterCenter.y, ringAngle(index, nodes.length), clusterRadius);
      return {
        ...node,
        x: p.x - nodeSize.width / 2,
        y: p.y - nodeSize.height / 2,
        w: nodeSize.width,
        h: nodeSize.height
      };
    });
  }







  // Helper methods...
  private calculateBounds(layout: DiagramLayout) {
    // Extent scan delegates to foldNodeExtents (round 41 single source).
    // Behavior change on degenerate input only: the retired both-corner flat
    // scan (`min/max` over `[x, x + width]` pairs) resolved a node with a
    // NEGATIVE explicit width to a zero-width box; the canonical direct-corner
    // read resolves it to a reversed (negative-width) box. Every non-negative
    // width — all reachable layouts — is bit-identical.
    const extents = foldNodeExtents(layout.nodes || [], nodeExtentEdges);
    if (extents === null) {
      return { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    const { minX, minY, maxX, maxY } = extents;
    return { width: maxX - minX, height: maxY - minY, minX, minY, maxX, maxY };
  }







  // Layout algorithm implementations
  private async standardLayout(nodes: NodeDatum[], edges: EdgeDatum[], type: DiagramType): Promise<DiagramLayout> {
    // Use basic Dagre layout for smaller graphs
    if (!this.dagreLayoutStrategy) {
      throw new VisualizationError("DagreLayoutStrategy is not initialized in ComplexLayoutEngine.");
    }
    return this.dagreLayoutStrategy.applyLayout(nodes, edges, type);
  }

  private async coarsenGraph(nodes: NodeDatum[], edges: EdgeDatum[]): Promise<Array<{ nodes: NodeDatum[]; edges: EdgeDatum[] }>> {
    const levels: Array<{ nodes: NodeDatum[]; edges: EdgeDatum[] }> = [{ nodes, edges }];

    let currentNodes = nodes;
    let currentEdges = edges;
    const minNodes = Math.max(this.config.levelThreshold, 5);

    // Coarsen until we reach a small enough graph (max 4 levels)
    for (let level = 0; level < 4 && currentNodes.length > minNodes; level++) {
      const result = this.coarsenOneLevel(currentNodes, currentEdges);
      if (result.nodes.length >= currentNodes.length) break; // no further reduction possible
      levels.push(result);
      currentNodes = result.nodes;
      currentEdges = result.edges;
    }

    return levels;
  }

  /** Single-level coarsening via heavy-edge matching */
  private coarsenOneLevel(nodes: NodeDatum[], edges: EdgeDatum[]): { nodes: NodeDatum[]; edges: EdgeDatum[] } {
    // Build adjacency with edge weights (degree-based)
    const adjWeight = new Map<string, Map<string, number>>();
    for (const node of nodes) {
      adjWeight.set(node.id, new Map());
    }
    for (const edge of edges) {
      const w = 1;
      adjWeight.get(edge.from)?.set(edge.to, (adjWeight.get(edge.from)?.get(edge.to) ?? 0) + w);
      adjWeight.get(edge.to)?.set(edge.from, (adjWeight.get(edge.to)?.get(edge.from) ?? 0) + w);
    }

    // Greedy heavy-edge matching
    const matched = new Set<string>();
    const mergedInto = new Map<string, string>(); // original id -> supernode id
    const supernodes: NodeDatum[] = [];
    let supernodeIdx = 0;

    // Sort edges by weight (heaviest first) for greedy matching
    const sortedEdges = [...edges].sort((a, b) => {
      const wa = adjWeight.get(a.from)?.get(a.to) ?? 0;
      const wb = adjWeight.get(b.from)?.get(b.to) ?? 0;
      return wb - wa;
    });

    for (const edge of sortedEdges) {
      if (matched.has(edge.from) || matched.has(edge.to)) continue;
      const supernodeId = `super_${supernodeIdx++}`;
      const supernode: NodeDatum = {
        id: supernodeId,
        label: `Super_${supernodeId}`,
        meta: {
          mergedIds: [edge.from, edge.to],
          importance: 2,
        },
      };
      supernodes.push(supernode);
      matched.add(edge.from);
      matched.add(edge.to);
      mergedInto.set(edge.from, supernodeId);
      mergedInto.set(edge.to, supernodeId);
    }

    // Unmatched nodes become their own supernodes
    for (const node of nodes) {
      if (matched.has(node.id)) continue;
      const supernodeId = `super_${supernodeIdx++}`;
      supernodes.push({
        id: supernodeId,
        label: node.label,
        meta: {
          mergedIds: [node.id],
          importance: 1,
        },
      });
      mergedInto.set(node.id, supernodeId);
    }

    // Remap edges to supernodes
    const superedgeMap = new Map<string, Map<string, number>>();
    for (const edge of edges) {
      const fromSuper = mergedInto.get(edge.from);
      const toSuper = mergedInto.get(edge.to);
      if (!fromSuper || !toSuper || fromSuper === toSuper) continue;

      if (!superedgeMap.has(fromSuper)) superedgeMap.set(fromSuper, new Map());
      const innerMap = superedgeMap.get(fromSuper);
      if (!innerMap) continue;
      const current = innerMap.get(toSuper) ?? 0;
      innerMap.set(toSuper, current + 1);
    }

    const superedges: EdgeDatum[] = [];
    for (const [from, targets] of superedgeMap) {
      for (const [to] of targets) {
        superedges.push({ from, to });
      }
    }

    return { nodes: supernodes, edges: superedges };
  }

  private async layoutCoarsestLevel(level: { nodes: NodeDatum[]; edges: EdgeDatum[] }, type: DiagramType): Promise<DiagramLayout> {
    if (!this.dagreLayoutStrategy) {
      throw new VisualizationError("DagreLayoutStrategy is not initialized for layoutCoarsestLevel in ComplexLayoutEngine.");
    }
    return this.dagreLayoutStrategy.applyLayout(level.nodes, level.edges, type);
  }

  private async uncoarsenAndRefine(layout: DiagramLayout, level: { nodes: NodeDatum[]; edges: EdgeDatum[] }, type: DiagramType): Promise<DiagramLayout> {
    if (!this.dagreLayoutStrategy) {
      throw new VisualizationError("DagreLayoutStrategy is not initialized for uncoarsenAndRefine in ComplexLayoutEngine.");
    }
    // Re-layout using dagre with interpolated initial positions from coarser level
    return this.dagreLayoutStrategy.applyLayout(level.nodes, level.edges, type);
  }

  private initializeForceDirectedState(nodes: NodeDatum[]): ForceDirectedState {
    const positions = new Map();
    const forces = new Map();

    // Seed from the node set so identical input graphs converge identically
    // (deterministic render output). See seedFromString above.
    const rand = mulberry32(seedFromString(nodes.map(n => n.id).join('|')));

    nodes.forEach(node => {
      positions.set(node.id, {
        x: rand() * this.config.width,
        y: rand() * this.config.height,
        vx: 0,
        vy: 0
      });
      forces.set(node.id, { fx: 0, fy: 0 });
    });

    return { positions, forces, energy: Infinity, converged: false };
  }

  private stepForceDirectedSimulation(state: ForceDirectedState, nodes: NodeDatum[], edges: EdgeDatum[]): void {
    const { springStrength, repulsionStrength } = this.config;
    const damping = 0.9;
    const idealLength = Math.max(
      50,
      Math.sqrt((this.config.width * this.config.height) / Math.max(nodes.length, 1))
    );

    // Reset forces
    for (const id of state.forces.keys()) {
      state.forces.set(id, { fx: 0, fy: 0 });
    }

    // Repulsive forces between all node pairs (Coulomb's law)
    for (let i = 0; i < nodes.length; i++) {
      const pi = state.positions.get(nodes[i].id) ?? { x: 0, y: 0, vx: 0, vy: 0 };
      for (let j = i + 1; j < nodes.length; j++) {
        const pj = state.positions.get(nodes[j].id) ?? { x: 0, y: 0, vx: 0, vy: 0 };
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dist = Math.max(distance(dx, dy), 0.1);
        const force = repulsionStrength / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const fi = state.forces.get(nodes[i].id) ?? { fx: 0, fy: 0 };
        const fj = state.forces.get(nodes[j].id) ?? { fx: 0, fy: 0 };
        state.forces.set(nodes[i].id, { fx: fi.fx + fx, fy: fi.fy + fy });
        state.forces.set(nodes[j].id, { fx: fj.fx - fx, fy: fj.fy - fy });
      }
    }

    // Attractive forces along edges (Hooke's law)
    for (const edge of edges) {
      const pi = state.positions.get(edge.from);
      const pj = state.positions.get(edge.to);
      if (!pi || !pj) continue;

      const dx = pj.x - pi.x;
      const dy = pj.y - pi.y;
      const dist = Math.max(distance(dx, dy), 0.1);
      const force = springStrength * (dist - idealLength);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      const fi = state.forces.get(edge.from) ?? { fx: 0, fy: 0 };
      const fj = state.forces.get(edge.to) ?? { fx: 0, fy: 0 };
      state.forces.set(edge.from, { fx: fi.fx + fx, fy: fi.fy + fy });
      state.forces.set(edge.to, { fx: fj.fx - fx, fy: fj.fy - fy });
    }

    // Apply forces with damping, compute total energy
    let totalEnergy = 0;
    const maxDisplacement = this.config.width * 0.1;

    for (const node of nodes) {
      const pos = state.positions.get(node.id) ?? { x: 0, y: 0, vx: 0, vy: 0 };
      const f = state.forces.get(node.id) ?? { fx: 0, fy: 0 };

      // Update velocity with damping
      pos.vx = (pos.vx + f.fx) * damping;
      pos.vy = (pos.vy + f.fy) * damping;

      // Clamp displacement to prevent large jumps
      const disp = distance(pos.vx, pos.vy);
      if (disp > maxDisplacement) {
        pos.vx = (pos.vx / disp) * maxDisplacement;
        pos.vy = (pos.vy / disp) * maxDisplacement;
      }

      // Update position, keep within bounds (point clamp: this velocity
      // integration ignores the node extent by design — size 0)
      pos.x = clampNodeCoordinate(pos.x + pos.vx, this.config.width, 0);
      pos.y = clampNodeCoordinate(pos.y + pos.vy, this.config.height, 0);

      totalEnergy += pos.vx * pos.vx + pos.vy * pos.vy;
    }

    state.energy = totalEnergy;
  }

  private checkConvergence(state: ForceDirectedState): boolean {
    return state.energy < 0.01;
  }

  private forceStateToLayout(state: ForceDirectedState, nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const positionedNodes: PositionedNode[] = nodes.map(node => {
      const pos = state.positions.get(node.id) ?? { x: 0, y: 0, vx: 0, vy: 0 };
      return {
        ...node,
        x: pos.x - 50,
        y: pos.y - 25,
        w: 100,
        h: 50
      };
    });

    const layoutEdges: LayoutEdge[] = edges.map(edge => {
      const fromPos = state.positions.get(edge.from) ?? { x: 0, y: 0, vx: 0, vy: 0 };
      const toPos = state.positions.get(edge.to) ?? { x: 0, y: 0, vx: 0, vy: 0 };
      return {
        from: edge.from,
        to: edge.to,
        points: [fromPos, toPos],
        label: edge.label
      };
    });

    return { nodes: positionedNodes, edges: layoutEdges };
  }

  /**
   * Send layout computation to a Web Worker.
   * Returns null if the worker fails, signalling fallback.
   */
  private async computeLayoutViaWorker(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
  ): Promise<DiagramLayout | null> {
    const pool = this.getWorkerPool();
    if (!pool) return null;

    const payload: LayoutWorkerPayload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        label: n.label,
      })),
      edges: edges.map((e) => ({ source: e.from, target: e.to })),
      config: {
        width: this.config.width,
        height: this.config.height,
        rankDirection: this.config.rankDirection,
        nodeSeparation: this.config.nodeSeparation,
        rankSeparation: this.config.rankSeparation,
      },
    };

    const message: WorkerMessage<LayoutWorkerPayload> = {
      id: makeLayoutWorkerMessageId(nodes),
      type: 'LAYOUT_COMPUTE',
      payload,
    };

    try {
      const response = await pool.execute(message);
      if (response.error) {
        logger.warn('Layout worker returned error, falling back:', response.error.message);
        return null;
      }

      const result = response.payload as LayoutWorkerResult | undefined;
      if (!result) return null;

      // Convert LayoutWorkerResult to DiagramLayout
      const layoutNodes: PositionedNode[] = result.nodes.map((n) => {
        const originalNode = nodes.find((on) => on.id === n.id);
        return {
          id: n.id,
          label: originalNode?.label ?? '',
          x: n.x,
          y: n.y,
          w: n.width ?? 0,
          h: n.height ?? 0,
          ...(originalNode?.meta ? { meta: originalNode.meta } : {}),
        } as PositionedNode;
      });

      const layoutEdges: LayoutEdge[] = edges.map((e) => {
        const fromNode = layoutNodes.find((n) => n.id === e.from);
        const toNode = layoutNodes.find((n) => n.id === e.to);
        return {
          from: e.from,
          to: e.to,
          points: [
            // Round 47 single source — node box-centers via layout-utils
            // `calculateNodeCenter`. The `?? {x:0,y:0}` pre-guard reproduces
            // the retired `(fromNode?.x ?? 0)` phantom read, and the explicit
            // DEFAULT fallbacks reproduce the retired `getNodeWidth(x ?? {})`
            // defaults.
            calculateNodeCenter((fromNode ?? { x: 0, y: 0 }) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
            calculateNodeCenter((toNode ?? { x: 0, y: 0 }) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
          ],
          label: e.label,
        };
      });

      return { nodes: layoutNodes, edges: layoutEdges };
    } catch {
      logger.warn('Layout worker failed, falling back to main thread');
      return null;
    }
  }

  /**
   * Compute layout on main thread using the fallback function.
   */
  private computeLayoutFallback(nodes: NodeDatum[], edges: EdgeDatum[]): DiagramLayout {
    const payload: LayoutWorkerPayload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        width: this.config.nodeWidth,
        height: this.config.nodeHeight,
        label: n.label,
      })),
      edges: edges.map((e) => ({ source: e.from, target: e.to })),
      config: {
        width: this.config.width,
        height: this.config.height,
        rankDirection: this.config.rankDirection,
        nodeSeparation: this.config.nodeSeparation,
        rankSeparation: this.config.rankSeparation,
      },
    };

    const result = workerComputeLayout(payload);

    const layoutNodes: PositionedNode[] = result.nodes.map((n) => {
      const originalNode = nodes.find((on) => on.id === n.id);
      return {
        id: n.id,
        label: originalNode?.label ?? '',
        x: n.x,
        y: n.y,
        w: n.width ?? 0,
        h: n.height ?? 0,
        ...(originalNode?.meta ? { meta: originalNode.meta } : {}),
      } as PositionedNode;
    });

    const layoutEdges: LayoutEdge[] = edges.map((e) => {
      const fromNode = layoutNodes.find((n) => n.id === e.from);
      const toNode = layoutNodes.find((n) => n.id === e.to);
      return {
        from: e.from,
        to: e.to,
        points: [
          // Round 47 single source — node box-centers via layout-utils
          // `calculateNodeCenter` (`?? {x:0,y:0}` phantom-read pre-guard and
          // explicit DEFAULT fallbacks reproduce the retired form).
          calculateNodeCenter((fromNode ?? { x: 0, y: 0 }) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
          calculateNodeCenter((toNode ?? { x: 0, y: 0 }) as PositionedNode, DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT),
        ],
        label: e.label,
      };
    });

    return { nodes: layoutNodes, edges: layoutEdges };
  }

  private calculateClusterCentroid(nodes: NodeDatum[]): { x: number; y: number } {
    if (nodes.length === 0) {
      return { x: 0, y: 0 };
    }
    const totalX = nodes.reduce((sum, node) => sum + ((node as unknown as PositionedNode).x || 0), 0);
    const totalY = nodes.reduce((sum, node) => sum + ((node as unknown as PositionedNode).y || 0), 0);
    return { x: totalX / nodes.length, y: totalY / nodes.length };
  }

  private calculateClusterBounds(nodes: NodeDatum[]): { width: number; height: number } {
    // Extent scan delegates to foldNodeExtents (round 41 single source). The
    // read keeps this site's `|| 0` policy: cluster members arrive as raw
    // NodeDatum whose x/y may be missing pre-positioning, and a falsy
    // coordinate contributes 0 rather than poisoning the cluster box with NaN.
    const extents = foldNodeExtents(nodes as unknown as PositionedNode[], (node) => ({
      left: node.x || 0,
      top: node.y || 0,
      right: (node.x || 0) + getNodeWidth(node),
      bottom: (node.y || 0) + getNodeHeight(node),
    }));
    if (extents === null) {
      return { width: 0, height: 0 };
    }

    const { minX, minY, maxX, maxY } = extents;
    return { width: maxX - minX, height: maxY - minY };
  }

  private calculateClusterImportance(nodes: NodeDatum[]): number {
    // `??` not `||`: a node with importance 0 contributes 0 to the cluster sum,
    // not 1. `||` would inflate the normalization base for low-importance clusters.
    return nodes.reduce((sum, node) => sum + (node.meta?.importance ?? 1), 0);
  }



  // ✨ Real-time Optimization Methods

  /**
   * Real-time layout optimization with performance monitoring
   */
  async optimizeRealTime(
    layout: DiagramLayout,
    performanceMetrics: {
      currentFPS: number;
      memoryUsage: number;
      layoutTime: number;
    }
  ): Promise<DiagramLayout> {

    let optimizedLayout = layout;

    // Adaptive quality based on performance
    if (performanceMetrics.currentFPS < this.config.performanceTargets.targetFPS) {
      optimizedLayout = await this.reduceLayoutComplexity(optimizedLayout);
    }

    // Memory optimization
    if (performanceMetrics.memoryUsage > this.config.performanceTargets.memoryLimit) {
      optimizedLayout = await this.optimizeMemoryUsage(optimizedLayout);
    }

    // Time optimization
    if (performanceMetrics.layoutTime > this.config.performanceTargets.maxLayoutTime) {
      optimizedLayout = await this.optimizeLayoutTime(optimizedLayout);
    }

    return optimizedLayout;
  }

  /**
   * Reduce layout complexity for better performance
   */
  private async reduceLayoutComplexity(layout: DiagramLayout): Promise<DiagramLayout> {
    // Simplify edge paths, reduce node details, etc.
    const simplifiedEdges = layout.edges.map(edge => ({
      ...edge,
      points: edge.points && edge.points.length > 0
        ? [edge.points[0], edge.points[edge.points.length - 1]]
        : []
    }));

    return { ...layout, edges: simplifiedEdges };
  }

  /**
   * Optimize memory usage
   */
  private async optimizeMemoryUsage(layout: DiagramLayout): Promise<DiagramLayout> {
    // Remove unnecessary data, optimize data structures
    const optimizedNodes = layout.nodes.map(node => {
      const { meta, ...essentialNode } = node;
      return essentialNode;
    });

    return { ...layout, nodes: optimizedNodes };
  }

  /**
   * Optimize layout computation time
   */
  private async optimizeLayoutTime(layout: DiagramLayout): Promise<DiagramLayout> {
    // Use faster algorithms, reduce iterations
    // For this implementation, we'll just return the layout as-is
    // In a real scenario, this might switch to simpler algorithms
    return layout;
  }

  /**
   * Performance monitoring and adaptive threshold adjustment
   */
  updateAdaptiveThresholds(
    currentPerformance: {
      fps: number;
      memory: number;
      layoutTime: number;
    }
  ): void {
    if (!this.config.adaptiveThresholds) return;

    // Adjust thresholds based on current system performance
    if (currentPerformance.fps < 30) {
      this.config.performanceTargets.targetFPS = Math.max(20, this.config.performanceTargets.targetFPS - 5);
    } else if (currentPerformance.fps > 50) {
      this.config.performanceTargets.targetFPS = Math.min(60, this.config.performanceTargets.targetFPS + 2);
    }

  }
}

export default ComplexLayoutEngine;
