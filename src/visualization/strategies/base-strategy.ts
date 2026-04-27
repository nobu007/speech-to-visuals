import { DiagramType } from '@/types/diagram';
import { LayoutStrategy, StrategyRegistry } from '../types';

export class DefaultStrategyRegistry implements StrategyRegistry {
  private strategies = new Map<DiagramType, LayoutStrategy>();

  register(diagramType: DiagramType, strategy: LayoutStrategy): void {
    const existing = this.strategies.get(diagramType);
    if (existing && existing.name === strategy.name) {
      return;
    }
    this.strategies.set(diagramType, strategy);
  }

  getStrategy(diagramType: DiagramType): LayoutStrategy {
    const strategy = this.strategies.get(diagramType);
    if (!strategy) {
      throw new Error(`No layout strategy registered for diagram type: ${diagramType}`);
    }
    return strategy;
  }

  hasStrategy(diagramType: DiagramType): boolean {
    return this.strategies.has(diagramType);
  }

  getAllStrategies(): Map<DiagramType, LayoutStrategy> {
    return new Map(this.strategies);
  }

  clear(): void {
    this.strategies.clear();
  }
}
