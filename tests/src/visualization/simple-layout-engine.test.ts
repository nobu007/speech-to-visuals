import { SimpleLayoutEngine } from '@/visualization/simple-layout-engine.ts';
import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';

async function runSimpleLayoutEngineTests() {
  console.log('🧪 Testing Simple Layout Engine...');

  const simpleLayoutEngine = new SimpleLayoutEngine();

  const testNodes: NodeDatum[] = [
    { id: 'n1', label: 'ノード1' },
    { id: 'n2', label: 'ノード2' },
    { id: 'n3', label: 'ノード3' },
    { id: 'n4', label: 'ノード4' }
  ];

  const testEdges: EdgeDatum[] = [
    { id: 'e1', from: 'n1', to: 'n2' },
    { id: 'e2', from: 'n2', to: 'n3' },
    { id: 'e3', from: 'n3', to: 'n4' }
  ];

  const types: DiagramType[] = ['flow', 'tree', 'timeline', 'cycle', 'network'];

  for (const diagramType of types) {
    const result = await simpleLayoutEngine.generateLayout(testNodes, testEdges, diagramType);
    const success = result.success && result.layout.nodes.length === testNodes.length;
    console.log(`${success ? '✅' : '❌'} ${diagramType} layout: ${result.layout.nodes.length} nodes positioned`);
  }

  console.log('🧪 Layout engine testing completed');
}

runSimpleLayoutEngineTests();
