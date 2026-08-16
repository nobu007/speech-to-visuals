import type { FrozenLiteralRule } from '../freeze-guard';

// Family file of the frozen-literal registry (round 35 split). The original
// rule doc blocks below are verbatim moves from the single-file registry —
// the registry policy and the ordered aggregation live in
// tests/guards/frozen-literal-rules.ts.

export const RULES: FrozenLiteralRule[] = [
  /**
   * Round 13: the per-diagram-type Japanese display title lives only in
   * DIAGRAM_TYPE_TITLES (src/types/diagram.ts). Before this round,
   * video-generator's generateSceneTitle and DiagramScene's rendered title
   * each froze their own `type → title` map and the two had ALREADY drifted
   * (flowchart 「プロセスフロー」 vs 「フローチャート」, general 「ダイアグラム」
   * vs 「一般」) — the scene list and the rendered video frame disagreed on
   * the same scene's title. The banned shape is the object-literal member
   * `<diagramType>: '<title string>'` for any key of the union and any of the
   * known title variants (including DiagramPreview's badge wordings, so a NEW
   * site cannot smuggle a fourth map under different wording). The
   * diagram-detector keyword arrays (`'マインドマップ', …` inside `[]`) and the
   * `'cycle,timeline': '循環タイムライン'` hybrid-name table use quoted keys /
   * bare array elements, which the unquoted-key shape cannot match.
   * DiagramPreview's badge map is a different surface (UI shorthand on the
   * preview card, not the video title) and stays local by design.
   */
  {
    id: 'diagram-type titles single-sourced in DIAGRAM_TYPE_TITLES (types/diagram)',
    roots: ['src'],
    exclude: {
      'src/types/diagram.ts': 'the canonical source itself',
      'src/components/DiagramPreview.tsx':
        'UI badge shorthand on the preview card — different surface/wording than the video title',
    },
    patterns: [
      /^\s*(flow|flowchart|tree|timeline|matrix|cycle|comparison|network|conceptmap|mindmap|general):\s*'(プロセスフロー|フローチャート|階層構造|ツリー構造|タイムライン|比較表|マトリクス|循環プロセス|サイクル図|比較|比較図|ネットワーク|ネットワーク図|コンセプトマップ|マインドマップ|一般|汎用図|ダイアグラム)'/,
    ],
    minSweptFiles: 200,
  },
];
