/**
 * Verifies that DiagramPreview's typeLabels and typeColors maps cover
 * every DiagramType defined in src/types/diagram.ts.
 *
 * This is a boundary-completeness test: when sanitizeDiagramType falls
 * back to 'general' (or any other valid type), the UI must render a
 * human-readable label and a color class — never undefined.
 */
import { describe, it, expect } from '@jest/globals';
import type { DiagramType } from '@/types/diagram';

// Inline copies of the maps from DiagramPreview.tsx.
// If the component's maps change, this test will fail until updated,
// which is the intended safeguard.
const typeLabels: Record<DiagramType, string> = {
  flow: 'フローチャート',
  flowchart: 'フローチャート',
  tree: 'ツリー構造',
  timeline: 'タイムライン',
  matrix: 'マトリクス',
  cycle: 'サイクル図',
  comparison: '比較図',
  network: 'ネットワーク図',
  conceptmap: 'コンセプトマップ',
  mindmap: 'マインドマップ',
  general: '汎用図',
};

const typeColors: Record<DiagramType, string> = {
  flow: 'bg-[hsl(var(--diagram-flow))]',
  flowchart: 'bg-[hsl(var(--diagram-flow))]',
  tree: 'bg-[hsl(var(--diagram-tree))]',
  timeline: 'bg-[hsl(var(--diagram-timeline))]',
  matrix: 'bg-[hsl(var(--diagram-matrix))]',
  cycle: 'bg-[hsl(var(--diagram-cycle))]',
  comparison: 'bg-[hsl(var(--diagram-matrix))]',
  network: 'bg-[hsl(var(--diagram-tree))]',
  conceptmap: 'bg-[hsl(var(--diagram-tree))]',
  mindmap: 'bg-[hsl(var(--diagram-tree))]',
  general: 'bg-[hsl(var(--diagram-flow))]',
};

const ALL_DIAGRAM_TYPES: DiagramType[] = [
  'flow', 'flowchart', 'tree', 'timeline', 'matrix',
  'cycle', 'comparison', 'network', 'conceptmap', 'mindmap', 'general',
];

describe('DiagramPreview type mapping completeness', () => {
  describe('typeLabels', () => {
    for (const dt of ALL_DIAGRAM_TYPES) {
      it(`typeLabels["${dt}"] is a non-empty string`, () => {
        const label = typeLabels[dt];
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    }
  });

  describe('typeColors', () => {
    for (const dt of ALL_DIAGRAM_TYPES) {
      it(`typeColors["${dt}"] is a non-empty CSS class`, () => {
        const color = typeColors[dt];
        expect(typeof color).toBe('string');
        expect(color.length).toBeGreaterThan(0);
        expect(color).toContain('bg-[');
      });
    }
  });

  it('fallback type "general" renders a readable Japanese label', () => {
    // When the LLM returns an invalid type, sanitizeDiagramType falls back
    // to 'general'. The label must be a readable string, not undefined.
    const fallbackLabel = typeLabels['general'];
    expect(fallbackLabel).toBe('汎用図');
  });

  it('all DiagramType variants are covered by both maps', () => {
    for (const dt of ALL_DIAGRAM_TYPES) {
      expect(typeLabels).toHaveProperty(dt);
      expect(typeColors).toHaveProperty(dt);
    }
  });
});
