export { LayoutEngine } from './layout-engine';
import { LayoutEngine } from './layout-engine';
export const simpleLayoutEngineInstance = new LayoutEngine({ isSimpleMode: true });
export { ComplexLayoutEngine } from './complex-layout-engine';

// Correct export path to match actual filename
export { EnhancedZeroOverlapLayoutEngine } from './enhanced-zero-overlap-layout';
export { AdvancedVisualEngine } from './advanced-visual-engine';
export { AdvancedLayoutEngine } from './advanced-layouts';
export type {
  LayoutConfig,
  LayoutResult,
  LayoutMetrics
} from './types';

// Phase 31 quality modules (REQ-079~083)
export { VisualBalanceScorer } from './visual-balance-scorer';
export { detectEdgeCrossings, minimizeEdgeCrossings, EdgeCrossingMinimizer } from './edge-crossing-minimizer';
export { sizeLabel, sizeAllLabels } from './smart-label-sizer';
export type { LabelSizingResult } from './smart-label-sizer';
export { calculateCompositeScore, scoreLayout, LayoutQualityCompositeScorer } from './layout-quality-composite';
export { runAutoOptimization, LayoutAutoOptimizer } from './layout-auto-optimizer';
