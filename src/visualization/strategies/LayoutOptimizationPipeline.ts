import { DiagramLayout, DiagramType } from '@/types/diagram';
import { LayoutOptimizer } from './LayoutOptimizer';

export class LayoutOptimizationPipeline {
  private layoutOptimizer: LayoutOptimizer;

  constructor(layoutOptimizer: LayoutOptimizer) {
    this.layoutOptimizer = layoutOptimizer;
  }

  public async applyOptimizations(
    layout: DiagramLayout,
    diagramType: DiagramType,
    iteration: number
  ): Promise<DiagramLayout> {
    let currentLayout = layout;

    // Iteration 2+: Type-specific optimizations
    if (iteration > 1) {
      currentLayout = await this.layoutOptimizer.optimizeForDiagramType(currentLayout, diagramType);
    }

    // Iteration 3+: Advanced layout improvements
    if (iteration > 2) {
      currentLayout = await this.layoutOptimizer.advancedOptimizations(currentLayout, diagramType);
    }

    return currentLayout;
  }
}
