---
title: Module src-visualization
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module src-visualization

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 47
- Bytes: 460125

## Key Files

- `src/visualization/layout-quality-composite.ts`
- `src/visualization/advanced-layouts.ts`
- `src/visualization/advanced-visual-engine.ts`
- `src/visualization/canvas-calculator.ts`
- `src/visualization/complex-layout-engine.ts`
- `src/visualization/edge-crossing-minimizer.ts`
- `src/visualization/enhanced-zero-overlap-layout.ts`
- `src/visualization/index.ts`

## Risk Signals

- RISK-0821 (medium, Concurrency Or Timing) in `src/visualization/__tests__/advanced-visual-engine.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L571: it('creates fallback scene on enhancement failure', async () => {
- RISK-0822 (medium, Parser Or Heuristic) in `src/visualization/__tests__/advanced-visual-engine.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L571: it('creates fallback scene on enhancement failure', async () => {
- RISK-0823 (low, High Attention File) in `src/visualization/advanced-layouts.ts`: The digest found several implementation signals worth manual review. Evidence: L68: edgeDrawing: { duration: number; easing: string };
- RISK-0824 (medium, Concurrency Or Timing) in `src/visualization/advanced-visual-engine.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L181: private async enhanceLayout(scene: SceneGraph, style: VisualStyle): Promise<Record<string, unknown>> {
- RISK-0825 (low, High Attention File) in `src/visualization/advanced-visual-engine.ts`: The digest found several implementation signals worth manual review. Evidence: L69: private iteration: number = 1;
- RISK-0826 (high, Destructive Mutation) in `src/visualization/complex-layout-engine.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L89: export interface ForceDirectedState {
- RISK-0827 (medium, Persistence Or State) in `src/visualization/complex-layout-engine.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L89: export interface ForceDirectedState {
- RISK-0828 (low, High Attention File) in `src/visualization/complex-layout-engine.ts`: The digest found several implementation signals worth manual review. Evidence: L68: memoryLimit: number;
- RISK-0829 (high, Destructive Mutation) in `src/visualization/edge-crossing-minimizer.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L326: const force = (repulsionStrength * weight) / (dist * dist);
- RISK-0830 (medium, Parser Or Heuristic) in `src/visualization/edge-crossing-minimizer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: * heuristic-based minimization to reduce crossing count.
- RISK-0831 (low, High Attention File) in `src/visualization/edge-crossing-minimizer.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * heuristic-based minimization to reduce crossing count.
- RISK-0832 (medium, Concurrency Or Timing) in `src/visualization/enhanced-zero-overlap-layout.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L204: private async generateInitialLayout(
- RISK-0833 (low, High Attention File) in `src/visualization/enhanced-zero-overlap-layout.ts`: The digest found several implementation signals worth manual review. Evidence: L99: private config: ZeroOverlapConfig;
- RISK-0834 (medium, Concurrency Or Timing) in `src/visualization/layout-auto-optimizer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L6: * Maximum 3 retries. Each retry re-evaluates the score.
- RISK-0835 (medium, Parser Or Heuristic) in `src/visualization/layout-auto-optimizer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L169: * @param strategySelector  Provides fallback chain for strategy reselection
- RISK-0836 (low, High Attention File) in `src/visualization/layout-auto-optimizer.ts`: The digest found several implementation signals worth manual review. Evidence: L6: * Maximum 3 retries. Each retry re-evaluates the score.
- RISK-0837 (medium, Parser Or Heuristic) in `src/visualization/layout-engine.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L11: import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy';
- RISK-0838 (low, High Attention File) in `src/visualization/layout-engine.ts`: The digest found several implementation signals worth manual review. Evidence: L11: import { FallbackLayoutStrategy } from './strategies/FallbackLayoutStrategy';
- RISK-0839 (low, High Attention File) in `src/visualization/layout-quality-composite.ts`: The digest found several implementation signals worth manual review. Evidence: L84: const crossingRaw = input.crossingCount ?? 0;
- RISK-0840 (high, Destructive Mutation) in `src/visualization/layout/OverlapResolver.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L3: import ProgressiveForceStrategy from './strategies/ProgressiveForceStrategy';
- RISK-0841 (medium, Concurrency Or Timing) in `src/visualization/layout/OverlapResolver.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L69: const strategyResult = await this.applyStrategyWithTimeout(
- RISK-0842 (low, High Attention File) in `src/visualization/layout/OverlapResolver.ts`: The digest found several implementation signals worth manual review. Evidence: L10: private strategies: LayoutStrategy[] = [];
- RISK-0843 (low, High Attention File) in `src/visualization/layout/strategies/GridSnapStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L17: private cellSize: number = 100; // Initial cell size, will be adjusted
- RISK-0844 (high, Destructive Mutation) in `src/visualization/layout/strategies/ProgressiveForceStrategy.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: path contains `force`
- RISK-0845 (low, High Attention File) in `src/visualization/layout/strategies/ProgressiveForceStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L17: private alpha = 1.0; // Current simulation temperature
- RISK-0846 (low, High Attention File) in `src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L16: private initialTemperature = 10;
- RISK-0847 (medium, Parser Or Heuristic) in `src/visualization/overlap-resolver.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L80: // Final check - if still has overlaps, apply grid-snap fallback
- RISK-0848 (low, High Attention File) in `src/visualization/overlap-resolver.ts`: The digest found several implementation signals worth manual review. Evidence: L10: private maxIterations: number;
- RISK-0849 (low, High Attention File) in `src/visualization/spatial-hash.ts`: The digest found several implementation signals worth manual review. Evidence: L11: private grid = new Map<string, Set<PositionedNode>>();
- RISK-0850 (medium, Concurrency Or Timing) in `src/visualization/strategies/CulturalLayoutAdapter.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L46: private async applyRTLLayout(layout: DiagramLayout): Promise<DiagramLayout> {
- RISK-0851 (low, High Attention File) in `src/visualization/strategies/CulturalLayoutAdapter.ts`: The digest found several implementation signals worth manual review. Evidence: L5: private config: ComplexLayoutConfig;
- RISK-0852 (medium, Parser Or Heuristic) in `src/visualization/strategies/DagreLayoutStrategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: import { FallbackLayoutStrategy } from './FallbackLayoutStrategy';
- RISK-0853 (low, High Attention File) in `src/visualization/strategies/DagreLayoutStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L5: import { FallbackLayoutStrategy } from './FallbackLayoutStrategy';
- RISK-0854 (medium, Parser Or Heuristic) in `src/visualization/strategies/FallbackLayoutStrategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `fallback`
- RISK-0855 (low, High Attention File) in `src/visualization/strategies/FallbackLayoutStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L4: export class FallbackLayoutStrategy {
- RISK-0856 (low, High Attention File) in `src/visualization/strategies/LayoutEvaluator.ts`: The digest found several implementation signals worth manual review. Evidence: L6: private config: LayoutConfig;
- RISK-0857 (medium, Concurrency Or Timing) in `src/visualization/strategies/LayoutOptimizer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L139: private async adjustSpacingByImportance(layout: DiagramLayout): Promise<DiagramLayout> {
- RISK-0858 (low, High Attention File) in `src/visualization/strategies/LayoutOptimizer.ts`: The digest found several implementation signals worth manual review. Evidence: L5: private config: LayoutConfig;
- RISK-0859 (high, Destructive Mutation) in `src/visualization/strategies/NetworkLayoutStrategy.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L113: private async applyForceDirectedAlgorithm(
- RISK-0860 (medium, Concurrency Or Timing) in `src/visualization/strategies/NetworkLayoutStrategy.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L113: private async applyForceDirectedAlgorithm(
- RISK-0861 (low, High Attention File) in `src/visualization/strategies/NetworkLayoutStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L64: private calculateOptimalSpacing(nodeCount: number, config: LayoutConfig): number {
- RISK-0862 (high, Destructive Mutation) in `src/visualization/strategies/OverlapResolver.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L256: private async forceSeparateOverlappingNodes(nodes: PositionedNode[]): Promise<void> {
- RISK-0863 (medium, Concurrency Or Timing) in `src/visualization/strategies/OverlapResolver.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L170: private async resolveSpecificOverlap(node1: PositionedNode, node2: PositionedNode, diagramType: DiagramType): Promise<void> {
- RISK-0864 (low, High Attention File) in `src/visualization/strategies/OverlapResolver.ts`: The digest found several implementation signals worth manual review. Evidence: L17: private config: LayoutConfig;
- RISK-0865 (medium, Network Or IPC) in `src/visualization/strategies/TimelineLayoutStrategy.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L36: // Sort nodes by temporal order (using array order as proxy for time)
- RISK-0866 (medium, Parser Or Heuristic) in `src/visualization/strategies/TreeLayoutStrategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L195: // Fallback
- RISK-0867 (low, High Attention File) in `src/visualization/strategies/TreeLayoutStrategy.ts`: The digest found several implementation signals worth manual review. Evidence: L75: private findRootNode(nodes: NodeDatum[], edges: EdgeDatum[]): string {
- RISK-0868 (high, Destructive Mutation) in `src/visualization/strategies/__tests__/flow-strategy.test.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L274: // ---- gridSnapFallback (via forced overlap) ----
- RISK-0869 (medium, Parser Or Heuristic) in `src/visualization/strategies/__tests__/flow-strategy.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L188: it('should handle many nodes (potential gridSnapFallback path)', () => {
- RISK-0870 (low, High Attention File) in `src/visualization/strategies/__tests__/flow-strategy.test.ts`: The digest found several implementation signals worth manual review. Evidence: L188: it('should handle many nodes (potential gridSnapFallback path)', () => {
- RISK-0871 (high, Destructive Mutation) in `src/visualization/strategies/__tests__/tree-strategy.test.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L327: // ---- gridSnapFallback (via forced overlap) ----
- RISK-0872 (medium, Parser Or Heuristic) in `src/visualization/strategies/__tests__/tree-strategy.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L226: it('should handle many nodes (potential gridSnapFallback path)', () => {
- RISK-0873 (low, High Attention File) in `src/visualization/strategies/__tests__/tree-strategy.test.ts`: The digest found several implementation signals worth manual review. Evidence: L226: it('should handle many nodes (potential gridSnapFallback path)', () => {
- RISK-0874 (high, Destructive Mutation) in `src/visualization/strategies/cycle-strategy.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L5: * Uses Force-Directed fallback if overlaps are detected after initial placement.
- RISK-0875 (medium, Parser Or Heuristic) in `src/visualization/strategies/cycle-strategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: * Uses Force-Directed fallback if overlaps are detected after initial placement.
- RISK-0876 (low, High Attention File) in `src/visualization/strategies/cycle-strategy.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * Uses Force-Directed fallback if overlaps are detected after initial placement.
- RISK-0877 (medium, Parser Or Heuristic) in `src/visualization/strategies/flow-strategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L80: return this.gridSnapFallback(nodes, edges, positionedNodes);
- RISK-0878 (medium, Parser Or Heuristic) in `src/visualization/strategies/matrix-strategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: * Grid placement guarantees zero overlaps -- no fallback needed.
- RISK-0879 (high, Destructive Mutation) in `src/visualization/strategies/timeline-strategy.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L5: * with X-axis optimized via force-directed method and grid-snap fallback.
- RISK-0880 (medium, Parser Or Heuristic) in `src/visualization/strategies/timeline-strategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: * with X-axis optimized via force-directed method and grid-snap fallback.
- RISK-0881 (low, High Attention File) in `src/visualization/strategies/timeline-strategy.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * with X-axis optimized via force-directed method and grid-snap fallback.
- RISK-0882 (medium, Parser Or Heuristic) in `src/visualization/strategies/tree-strategy.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L80: return this.gridSnapFallback(nodes, edges, positionedNodes);
- RISK-0883 (medium, Concurrency Or Timing) in `src/visualization/strategy-selector.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L95: export async function executeLayout(
- RISK-0884 (medium, Parser Or Heuristic) in `src/visualization/strategy-selector.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L15: private fallbackStrategy: LayoutStrategy;
- RISK-0885 (low, High Attention File) in `src/visualization/strategy-selector.ts`: The digest found several implementation signals worth manual review. Evidence: L14: private registry: StrategyRegistry;
- RISK-0886 (medium, Parser Or Heuristic) in `src/visualization/visual-balance-scorer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L183: // Dynamic grid size: scales with node count to avoid penalizing sparse layouts
- RISK-0887 (low, High Attention File) in `src/visualization/visual-balance-scorer.ts`: The digest found several implementation signals worth manual review. Evidence: L93: private computeCentroid(centers: { x: number; y: number }[]): { x: number; y: number } {

## Files

- `src/visualization/__tests__/advanced-visual-engine.test.ts` — typescript, 795 lines, attention 14
- `src/visualization/advanced-layouts.ts` — typescript, 645 lines, attention 100
- `src/visualization/advanced-visual-engine.ts` — typescript, 628 lines, attention 100
- `src/visualization/base/BaseLayoutEngine.ts` — typescript, 296 lines, attention 0
- `src/visualization/canvas-calculator.ts` — typescript, 150 lines, attention 0
- `src/visualization/complex-layout-engine.ts` — typescript, 1046 lines, attention 100
- `src/visualization/edge-crossing-minimizer.ts` — typescript, 524 lines, attention 84
- `src/visualization/enhanced-zero-overlap-layout.ts` — typescript, 1420 lines, attention 100
- `src/visualization/index.ts` — typescript, 23 lines, attention 0
- `src/visualization/layout-auto-optimizer.ts` — typescript, 561 lines, attention 100
- `src/visualization/layout-engine-v2.ts` — typescript, 126 lines, attention 14
- `src/visualization/layout-engine.ts` — typescript, 267 lines, attention 100
- `src/visualization/layout-quality-composite.ts` — typescript, 240 lines, attention 84
- `src/visualization/layout-utils.ts` — typescript, 159 lines, attention 0
- `src/visualization/layout/OverlapResolver.ts` — typescript, 512 lines, attention 100
- `src/visualization/layout/strategies/GridSnapStrategy.ts` — typescript, 311 lines, attention 100
- `src/visualization/layout/strategies/LayoutStrategy.ts` — typescript, 385 lines, attention 0
- `src/visualization/layout/strategies/ProgressiveForceStrategy.ts` — typescript, 478 lines, attention 100
- `src/visualization/layout/strategies/SimulatedAnnealingStrategy.ts` — typescript, 426 lines, attention 100
- `src/visualization/overlap-resolver.ts` — typescript, 168 lines, attention 84
- `src/visualization/smart-label-sizer.ts` — typescript, 160 lines, attention 14
- `src/visualization/spatial-hash.ts` — typescript, 99 lines, attention 70
- `src/visualization/strategies/ComparisonLayoutStrategy.ts` — typescript, 213 lines, attention 42
- `src/visualization/strategies/ConceptMapLayoutStrategy.ts` — typescript, 177 lines, attention 28
- `src/visualization/strategies/CulturalLayoutAdapter.ts` — typescript, 172 lines, attention 100
- `src/visualization/strategies/DagreLayoutStrategy.ts` — typescript, 98 lines, attention 98
- `src/visualization/strategies/FallbackLayoutStrategy.ts` — typescript, 237 lines, attention 100
- `src/visualization/strategies/FlowchartLayoutStrategy.ts` — typescript, 180 lines, attention 14
- `src/visualization/strategies/ILayoutStrategy.ts` — typescript, 165 lines, attention 14
- `src/visualization/strategies/LayoutEvaluator.ts` — typescript, 285 lines, attention 70
- `src/visualization/strategies/LayoutOptimizationPipeline.ts` — typescript, 31 lines, attention 14
- `src/visualization/strategies/LayoutOptimizer.ts` — typescript, 317 lines, attention 100
- `src/visualization/strategies/NetworkLayoutStrategy.ts` — typescript, 362 lines, attention 98
- `src/visualization/strategies/OverlapResolver.ts` — typescript, 296 lines, attention 100
- `src/visualization/strategies/TimelineLayoutStrategy.ts` — typescript, 187 lines, attention 42
- `src/visualization/strategies/TreeLayoutStrategy.ts` — typescript, 324 lines, attention 98
- `src/visualization/strategies/__tests__/flow-strategy.test.ts` — typescript, 423 lines, attention 100
- `src/visualization/strategies/__tests__/tree-strategy.test.ts` — typescript, 502 lines, attention 100
- `src/visualization/strategies/base-strategy.ts` — typescript, 35 lines, attention 14
- `src/visualization/strategies/cycle-strategy.ts` — typescript, 258 lines, attention 100
- `src/visualization/strategies/flow-strategy.ts` — typescript, 199 lines, attention 28
- `src/visualization/strategies/matrix-strategy.ts` — typescript, 128 lines, attention 28
- `src/visualization/strategies/timeline-strategy.ts` — typescript, 328 lines, attention 70
- `src/visualization/strategies/tree-strategy.ts` — typescript, 223 lines, attention 28
- `src/visualization/strategy-selector.ts` — typescript, 146 lines, attention 100
- `src/visualization/types.ts` — typescript, 100 lines, attention 0
- `src/visualization/visual-balance-scorer.ts` — typescript, 213 lines, attention 84
