/**
 * Layout Strategy Interface
 *
 * Strategy Pattern Implementation for Layout Algorithms
 * - Each diagram type gets its own strategy
 * - Strategies are independent and testable
 * - Easy to add new diagram types
 *
 * Design Principles:
 * - Open/Closed: Open for extension (new strategies), closed for modification
 * - Single Responsibility: Each strategy handles ONE diagram type
 * - Interface Segregation: Minimal interface, maximum flexibility
 */

import { DiagramType, NodeDatum, EdgeDatum, PositionedNode, LayoutEdge } from '@/types/diagram';
import { LayoutConfig } from '../types';

/**
 * Output from a layout strategy
 */
export interface LayoutStrategyOutput {
  nodes: PositionedNode[];
  edges: LayoutEdge[];
}

/**
 * Interface for all layout strategies
 * Implement this to create a new layout algorithm
 */
export interface ILayoutStrategy {
  /**
   * Unique name for this strategy
   * Used for logging and debugging
   */
  readonly name: string;

  /**
   * Check if this strategy supports a given diagram type
   * @param diagramType - The diagram type to check
   * @returns true if this strategy can handle the diagram type
   */
  supports(diagramType: DiagramType): boolean;

  /**
   * Generate layout for nodes and edges
   * @param nodes - Input nodes (without positions)
   * @param edges - Input edges
   * @param config - Layout configuration
   * @returns Positioned nodes and layout edges
   */
  generateLayout(
    nodes: NodeDatum[],
    edges: EdgeDatum[],
    config: LayoutConfig
  ): Promise<LayoutStrategyOutput>;

  /**
   * Optional: Validate inputs before layout generation
   * @returns true if inputs are valid, false otherwise
   */
  validateInputs?(nodes: NodeDatum[], edges: EdgeDatum[]): boolean;

  /**
   * Optional: Get strategy-specific configuration defaults
   */
  getStrategyDefaults?(): Partial<LayoutConfig>;
}

/**
 * Registry for managing layout strategies
 * Allows dynamic strategy selection based on diagram type
 */
export class LayoutStrategyRegistry {
  private strategies: Map<string, ILayoutStrategy> = new Map();

  /**
   * Register a new layout strategy
   */
  register(strategy: ILayoutStrategy): void {
    if (this.strategies.has(strategy.name)) {
      console.warn(`Strategy '${strategy.name}' already registered, overwriting`);
    }
    this.strategies.set(strategy.name, strategy);
    console.log(`✓ Registered layout strategy: ${strategy.name}`);
  }

  /**
   * Register multiple strategies at once
   */
  registerAll(strategies: ILayoutStrategy[]): void {
    strategies.forEach(strategy => this.register(strategy));
  }

  /**
   * Get strategy for a given diagram type
   * @throws Error if no strategy found
   */
  getStrategy(diagramType: DiagramType): ILayoutStrategy {
    for (const strategy of this.strategies.values()) {
      if (strategy.supports(diagramType)) {
        return strategy;
      }
    }

    throw new Error(
      `No layout strategy found for diagram type: ${diagramType}\n` +
      `Available strategies: ${this.listStrategyNames().join(', ')}`
    );
  }

  /**
   * Check if a strategy exists for a diagram type
   */
  hasStrategy(diagramType: DiagramType): boolean {
    for (const strategy of this.strategies.values()) {
      if (strategy.supports(diagramType)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get strategy by name (for testing/debugging)
   */
  getStrategyByName(name: string): ILayoutStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * List all registered strategy names
   */
  listStrategyNames(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get all registered strategies
   */
  getAllStrategies(): ILayoutStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Remove a strategy by name
   */
  unregister(name: string): boolean {
    return this.strategies.delete(name);
  }

  /**
   * Clear all strategies
   */
  clear(): void {
    this.strategies.clear();
  }

  /**
   * Get count of registered strategies
   */
  count(): number {
    return this.strategies.size;
  }
}
