/**
 * Structural + behavioral guard: per-diagram-type Japanese display titles
 * have ONE source (round 13).
 *
 * Before round 13, video-generator's `generateSceneTitle` and DiagramScene's
 * rendered title each froze their own `type → title` map, and the two had
 * ALREADY drifted: `flowchart` was 「プロセスフロー」 in the generated scene
 * title but 「フローチャート」 in the rendered video frame, and `general` was
 * 「ダイアグラム」 vs 「一般」. Both surfaces describe the SAME scene, so the
 * scene list and the video disagreed on its title.
 *
 * This file pins VALUES, CONSUMER IMPORTS, and the BEHAVIORAL delegation
 * (VideoGenerator titles). The "no src file re-freezes the map" discovery
 * sweep lives in the shared registry — tests/guards/frozen-literal-registry.test.ts,
 * rule 'diagram-type titles single-sourced in DIAGRAM_TYPE_TITLES'.
 *
 * Intentional exclusion: src/components/DiagramPreview.tsx keeps its own
 * badge wording (ツリー構造/マトリクス/サイクル図/…) — a UI shorthand badge on
 * the preview card, a different surface from the video title.
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from '@tests/guards/freeze-guard';
import { DIAGRAM_TYPE_TITLES, DIAGRAM_TYPES, type DiagramType } from '@stv/core/types/diagram';
import { VideoGenerator } from '@/pipeline/video-generator';
import type { SceneGraph } from '@stv/core/types/diagram';

/** Locking the canonical values makes any future re-freeze detectable as a
 *  value divergence instead of silently coinciding. */
const CANONICAL_VALUES: Record<DiagramType, string> = {
  flow: 'プロセスフロー',
  flowchart: 'フローチャート',
  tree: '階層構造',
  timeline: 'タイムライン',
  matrix: '比較表',
  cycle: '循環プロセス',
  comparison: '比較',
  network: 'ネットワーク',
  conceptmap: 'コンセプトマップ',
  mindmap: 'マインドマップ',
  general: '一般',
};

function makeScene(type: DiagramType): SceneGraph {
  return {
    id: `scene-${type}`,
    type,
    content: 'コンテンツ',
    summary: '',
    keyphrases: [],
    confidence: 0.9,
    startTime: 0,
    endTime: 5,
    startMs: 0,
    durationMs: 5000,
    layout: { nodes: [], edges: [] },
  } as unknown as SceneGraph;
}

describe('round 13: diagram-type titles single source (REQ-308)', () => {
  it('canonical map holds its documented values', () => {
    expect(DIAGRAM_TYPE_TITLES).toEqual(CANONICAL_VALUES);
  });

  it('canonical map is total over DIAGRAM_TYPES — no missing and no extra keys', () => {
    expect(Object.keys(DIAGRAM_TYPE_TITLES).sort()).toEqual([...DIAGRAM_TYPES].sort());
    for (const type of DIAGRAM_TYPES) {
      expect(typeof DIAGRAM_TYPE_TITLES[type]).toBe('string');
      expect(DIAGRAM_TYPE_TITLES[type].length).toBeGreaterThan(0);
    }
  });

  describe('behavioral: VideoGenerator scene titles delegate to the canonical map', () => {
    // generateSceneTitle is private; convertSceneToRemotionFormat is the
    // public-shaped seam that embeds the title (same cast pattern as the
    // scene-consumer-fields tests).
    const vg = new VideoGenerator({});
    const convert = (
      vg as unknown as {
        convertSceneToRemotionFormat: (s: SceneGraph, i: number) => { title: string };
      }
    ).convertSceneToRemotionFormat.bind(vg);

    it.each(DIAGRAM_TYPES)('title for %s starts with the canonical title', (type) => {
      const out = convert(makeScene(type), 0);
      expect(out.title.startsWith(`${DIAGRAM_TYPE_TITLES[type]} - `)).toBe(true);
    });

    it('the two historically drifted keys now agree with the canonical map', () => {
      // Before round 13: flowchart → プロセスフロー, general → ダイアグラム here,
      // while DiagramScene rendered フローチャート / 一般.
      expect(convert(makeScene('flowchart'), 0).title.startsWith('フローチャート - ')).toBe(true);
      expect(convert(makeScene('general'), 0).title.startsWith('一般 - ')).toBe(true);
    });
  });

  it('DiagramScene consumes DIAGRAM_TYPE_TITLES (no local title map)', () => {
    const src = readSource('src/remotion/DiagramScene.tsx');
    expect(src).toMatch(/import\s*\{[^}]*DIAGRAM_TYPE_TITLES[^}]*\}\s*from\s*'@stv\/core\/types\/diagram'/);
    expect(src).not.toMatch(/const\s+DIAGRAM_TITLES\s*:/);
  });

  it('video-generator consumes DIAGRAM_TYPE_TITLES (no local title map)', () => {
    const src = readSource('src/pipeline/video-generator.ts');
    expect(src).toMatch(/import\s*\{[^}]*DIAGRAM_TYPE_TITLES[^}]*\}\s*from\s*'@stv\/core\/types\/diagram'/);
    expect(src).not.toMatch(/const\s+typeLabels\s*:\s*Record<DiagramType,\s*string>/);
  });
});
