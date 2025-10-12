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
