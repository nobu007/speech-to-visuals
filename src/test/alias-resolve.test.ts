import { DiagramType, NodeDatum, EdgeDatum } from '@/types/diagram';

describe('TASK-0001: Path Alias Resolution', () => {
  test('@/types/diagram resolves correctly', () => {
    const type: DiagramType = 'flow';
    expect(type).toBe('flow');
  });

  test('NodeDatum type works via alias', () => {
    const node: NodeDatum = { id: '1', label: 'Test' };
    expect(node.id).toBe('1');
    expect(node.label).toBe('Test');
  });

  test('EdgeDatum type works via alias', () => {
    const edge: EdgeDatum = { from: '1', to: '2' };
    expect(edge.from).toBe('1');
    expect(edge.to).toBe('2');
  });
});
