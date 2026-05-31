import {
  LayoutStrategyRegistry,
} from '@/visualization/strategies/ILayoutStrategy';
import { FlowchartLayoutStrategy } from '@/visualization/strategies/FlowchartLayoutStrategy';
import { ComparisonLayoutStrategy } from '@/visualization/strategies/ComparisonLayoutStrategy';
import { NetworkLayoutStrategy } from '@/visualization/strategies/NetworkLayoutStrategy';
import { ConceptMapLayoutStrategy } from '@/visualization/strategies/ConceptMapLayoutStrategy';

describe('LayoutStrategyRegistry', () => {
  let registry: LayoutStrategyRegistry;

  beforeEach(() => {
    registry = new LayoutStrategyRegistry();
  });

  describe('register()', () => {
    it('should register a single strategy', () => {
      const strategy = new FlowchartLayoutStrategy();
      registry.register(strategy);

      expect(registry.count()).toBe(1);
      expect(registry.getStrategyByName('flowchart')).toBe(strategy);
    });

    it('should overwrite a strategy with the same name', () => {
      const strategy1 = new FlowchartLayoutStrategy();
      const strategy2 = new FlowchartLayoutStrategy();
      registry.register(strategy1);
      registry.register(strategy2);

      expect(registry.count()).toBe(1);
      expect(registry.getStrategyByName('flowchart')).toBe(strategy2);
    });

    it('should register multiple strategies with different names', () => {
      registry.register(new FlowchartLayoutStrategy());
      registry.register(new ComparisonLayoutStrategy());
      registry.register(new NetworkLayoutStrategy());

      expect(registry.count()).toBe(3);
    });
  });

  describe('registerAll()', () => {
    it('should register multiple strategies at once', () => {
      const strategies = [
        new FlowchartLayoutStrategy(),
        new ComparisonLayoutStrategy(),
        new NetworkLayoutStrategy(),
        new ConceptMapLayoutStrategy(),
      ];

      registry.registerAll(strategies);

      expect(registry.count()).toBe(4);
      expect(registry.listStrategyNames()).toContain('flowchart');
      expect(registry.listStrategyNames()).toContain('comparison');
      expect(registry.listStrategyNames()).toContain('network');
      expect(registry.listStrategyNames()).toContain('conceptmap');
    });

    it('should handle empty array', () => {
      registry.registerAll([]);
      expect(registry.count()).toBe(0);
    });
  });

  describe('getStrategy()', () => {
    it('should return the strategy that supports a given diagram type', () => {
      const flowchart = new FlowchartLayoutStrategy();
      const comparison = new ComparisonLayoutStrategy();
      registry.registerAll([flowchart, comparison]);

      expect(registry.getStrategy('flowchart')).toBe(flowchart);
      expect(registry.getStrategy('flow')).toBe(flowchart);
      expect(registry.getStrategy('comparison')).toBe(comparison);
    });

    it('should return conceptmap strategy for conceptmap and general', () => {
      const conceptMap = new ConceptMapLayoutStrategy();
      registry.register(conceptMap);

      expect(registry.getStrategy('conceptmap')).toBe(conceptMap);
      expect(registry.getStrategy('general')).toBe(conceptMap);
    });

    it('should throw an error for unregistered diagram type', () => {
      expect(() => registry.getStrategy('network')).toThrow(
        'No layout strategy found for diagram type: network'
      );
    });

    it('should include available strategies in error message', () => {
      registry.register(new FlowchartLayoutStrategy());

      expect(() => registry.getStrategy('network')).toThrow(/Available strategies: flowchart/);
    });
  });

  describe('hasStrategy()', () => {
    it('should return false when no strategies are registered', () => {
      expect(registry.hasStrategy('flow')).toBe(false);
      expect(registry.hasStrategy('flowchart')).toBe(false);
    });

    it('should return true when a supporting strategy is registered', () => {
      registry.register(new FlowchartLayoutStrategy());

      expect(registry.hasStrategy('flow')).toBe(true);
      expect(registry.hasStrategy('flowchart')).toBe(true);
    });

    it('should return false for unsupported diagram type', () => {
      registry.register(new FlowchartLayoutStrategy());

      expect(registry.hasStrategy('network')).toBe(false);
      expect(registry.hasStrategy('comparison')).toBe(false);
    });

    it('should return true for all supported types when all strategies are registered', () => {
      registry.registerAll([
        new FlowchartLayoutStrategy(),
        new ComparisonLayoutStrategy(),
        new NetworkLayoutStrategy(),
        new ConceptMapLayoutStrategy(),
      ]);

      expect(registry.hasStrategy('flow')).toBe(true);
      expect(registry.hasStrategy('flowchart')).toBe(true);
      expect(registry.hasStrategy('comparison')).toBe(true);
      expect(registry.hasStrategy('network')).toBe(true);
      expect(registry.hasStrategy('conceptmap')).toBe(true);
      expect(registry.hasStrategy('mindmap')).toBe(false); // mindmap has dedicated MindMapStrategy (LayoutStrategy)
      expect(registry.hasStrategy('general')).toBe(true);
    });
  });

  describe('unregister()', () => {
    it('should remove a registered strategy by name', () => {
      registry.register(new FlowchartLayoutStrategy());
      registry.register(new ComparisonLayoutStrategy());

      expect(registry.count()).toBe(2);

      const result = registry.unregister('flowchart');

      expect(result).toBe(true);
      expect(registry.count()).toBe(1);
      expect(registry.getStrategyByName('flowchart')).toBeUndefined();
    });

    it('should return false when unregistering a non-existent strategy', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove the correct strategy when multiple are registered', () => {
      registry.registerAll([
        new FlowchartLayoutStrategy(),
        new ComparisonLayoutStrategy(),
        new NetworkLayoutStrategy(),
      ]);

      registry.unregister('comparison');

      expect(registry.count()).toBe(2);
      expect(registry.hasStrategy('comparison')).toBe(false);
      expect(registry.hasStrategy('flow')).toBe(true);
      expect(registry.hasStrategy('network')).toBe(true);
    });
  });

  describe('getStrategyByName()', () => {
    it('should return the strategy with the given name', () => {
      const strategy = new NetworkLayoutStrategy();
      registry.register(strategy);

      expect(registry.getStrategyByName('network')).toBe(strategy);
    });

    it('should return undefined for non-existent strategy name', () => {
      expect(registry.getStrategyByName('nonexistent')).toBeUndefined();
    });
  });

  describe('listStrategyNames()', () => {
    it('should return empty array when no strategies registered', () => {
      expect(registry.listStrategyNames()).toEqual([]);
    });

    it('should return all registered strategy names', () => {
      registry.registerAll([
        new FlowchartLayoutStrategy(),
        new NetworkLayoutStrategy(),
      ]);

      const names = registry.listStrategyNames();
      expect(names).toContain('flowchart');
      expect(names).toContain('network');
      expect(names).toHaveLength(2);
    });
  });

  describe('getAllStrategies()', () => {
    it('should return empty array when no strategies registered', () => {
      expect(registry.getAllStrategies()).toEqual([]);
    });

    it('should return all registered strategies', () => {
      const flowchart = new FlowchartLayoutStrategy();
      const network = new NetworkLayoutStrategy();
      registry.registerAll([flowchart, network]);

      const all = registry.getAllStrategies();
      expect(all).toHaveLength(2);
      expect(all).toContain(flowchart);
      expect(all).toContain(network);
    });
  });

  describe('clear()', () => {
    it('should remove all registered strategies', () => {
      registry.registerAll([
        new FlowchartLayoutStrategy(),
        new ComparisonLayoutStrategy(),
        new NetworkLayoutStrategy(),
      ]);

      expect(registry.count()).toBe(3);

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.listStrategyNames()).toEqual([]);
    });
  });

  describe('count()', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.count()).toBe(0);
    });

    it('should return the number of registered strategies', () => {
      registry.register(new FlowchartLayoutStrategy());
      expect(registry.count()).toBe(1);

      registry.register(new ComparisonLayoutStrategy());
      expect(registry.count()).toBe(2);

      registry.unregister('flowchart');
      expect(registry.count()).toBe(1);
    });
  });

  describe('getting strategy for diagram types', () => {
    it('should resolve correct strategy for all diagram types', () => {
      registry.registerAll([
        new FlowchartLayoutStrategy(),
        new ComparisonLayoutStrategy(),
        new NetworkLayoutStrategy(),
        new ConceptMapLayoutStrategy(),
      ]);

      // flowchart supports 'flow' and 'flowchart'
      const flowResult = registry.getStrategy('flow');
      expect(flowResult.name).toBe('flowchart');

      const flowchartResult = registry.getStrategy('flowchart');
      expect(flowchartResult.name).toBe('flowchart');

      // comparison supports 'comparison'
      const comparisonResult = registry.getStrategy('comparison');
      expect(comparisonResult.name).toBe('comparison');

      // network supports 'network'
      const networkResult = registry.getStrategy('network');
      expect(networkResult.name).toBe('network');

      // conceptmap supports 'conceptmap' and 'general' (mindmap has dedicated MindMapStrategy)
      const conceptmapResult = registry.getStrategy('conceptmap');
      expect(conceptmapResult.name).toBe('conceptmap');

      const generalResult = registry.getStrategy('general');
      expect(generalResult.name).toBe('conceptmap');

      // mindmap uses dedicated MindMapStrategy (LayoutStrategy), not registered in ILayoutStrategy registry
      expect(registry.hasStrategy('mindmap')).toBe(false);
    });
  });
});
