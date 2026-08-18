import {
  handleGenerateScenes,
  decideType,
  splitSentences,
  extractNodesAndEdges,
  calculateLayout,
  GENERATE_TIMEOUT_MS,
} from '../../../supabase/functions/generate-scenes/index';
import type { GenerateScenesRequest } from '../../../supabase/functions/generate-scenes/index';

const USER_ID = 'user-test-002';

// ─── decideType Tests ────────────────────────────────────────────────────────

describe('decideType', () => {
  it('should detect flow type from sequential cues', () => {
    expect(decideType('まずAをします。次にBをします。')).toBe('flow');
  });

  it('should detect flow type from cause cues', () => {
    expect(decideType('Aが原因でBが起きた')).toBe('flow');
  });

  it('should detect cycle type', () => {
    expect(decideType('PDCAサイクルを回す')).toBe('cycle');
  });

  it('should detect matrix/compare type', () => {
    expect(decideType('一方Aは大きく、Bは小さい')).toBe('matrix');
  });

  it('should detect tree type', () => {
    expect(decideType('構成要素は以下の通り')).toBe('tree');
  });

  it('should detect timeline type', () => {
    expect(decideType('2024年に開始し、2025年に完了')).toBe('timeline');
  });

  it('should default to flow for unknown text', () => {
    expect(decideType('some random text without cues')).toBe('flow');
  });

  it('should prioritize cycle over other types', () => {
    // Cycle is checked first in the function
    expect(decideType('サイクルの中で手順を踏む')).toBe('cycle');
  });
});

// ─── splitSentences Tests ────────────────────────────────────────────────────

describe('splitSentences', () => {
  it('should split on Japanese punctuation', () => {
    const result = splitSentences('これは文1。これは文2。');
    expect(result).toEqual(['これは文1', 'これは文2']);
  });

  it('should split on exclamation marks', () => {
    const result = splitSentences('すごい！本当に？');
    expect(result).toEqual(['すごい', '本当に']);
  });

  it('should filter out empty segments', () => {
    const result = splitSentences('。。。');
    expect(result).toEqual([]);
  });

  it('should handle whitespace', () => {
    const result = splitSentences('  Hello。 World。  ');
    expect(result).toEqual(['Hello', 'World']);
  });
});

// ─── extractNodesAndEdges Tests ──────────────────────────────────────────────

describe('extractNodesAndEdges', () => {
  it('should create flow nodes and edges', () => {
    const { nodes, edges } = extractNodesAndEdges('ステップ1を行う。ステップ2を行う。ステップ3を行う。', 'flow');
    expect(nodes.length).toBe(3);
    expect(edges.length).toBe(2);
    expect(edges[0]).toEqual({ from: 'n0', to: 'n1' });
  });

  it('should truncate long labels in flow', () => {
    const longText = 'あ'.repeat(50);
    const { nodes } = extractNodesAndEdges(longText + '。', 'flow');
    if (nodes.length > 0) {
      expect(nodes[0].label.length).toBeLessThanOrEqual(43); // 40 + '...'
    }
  });

  it('should create tree with root and children', () => {
    const { nodes, edges } = extractNodesAndEdges('ルート。子供1。子供2。子供3。', 'tree');
    expect(nodes[0].id).toBe('root');
    expect(nodes.length).toBeGreaterThan(1);
    expect(edges.length).toBe(nodes.length - 1);
  });

  it('should create timeline nodes', () => {
    const { nodes, edges } = extractNodesAndEdges('イベント1。イベント2。イベント3。', 'timeline');
    expect(nodes.length).toBe(3);
    expect(edges.length).toBe(2);
  });

  it('should create cycle with circular edges', () => {
    const { nodes, edges } = extractNodesAndEdges('ステップA。ステップB。ステップC。', 'cycle');
    expect(nodes.length).toBe(3);
    // Last edge should point back to first
    const lastEdge = edges[edges.length - 1];
    expect(lastEdge.to).toBe('p0');
  });

  it('should create matrix nodes', () => {
    const { nodes, edges } = extractNodesAndEdges('anything', 'matrix');
    expect(nodes.length).toBe(4);
    expect(nodes.map((n) => n.label)).toEqual(['A項目', 'B項目', 'C項目', 'D項目']);
    expect(edges.length).toBe(0);
  });

  it('should filter short sentences in flow', () => {
    const { nodes } = extractNodesAndEdges('ab。これは長い文章です。', 'flow');
    // 'ab' is <= 3 chars so it should be filtered
    expect(nodes.length).toBe(1);
    expect(nodes[0].label).toContain('これは');
  });
});

// ─── calculateLayout Tests ───────────────────────────────────────────────────

describe('calculateLayout', () => {
  it('should position flow nodes horizontally', () => {
    const nodes = [
      { id: 'n0', label: 'A' },
      { id: 'n1', label: 'B' },
    ];
    const edges = [{ from: 'n0', to: 'n1' }];
    const { nodes: positioned, edges: laidEdges } = calculateLayout(nodes, edges, 'flow');

    expect(positioned[0].x).toBeDefined();
    expect(positioned[0].y).toBeDefined();
    expect(positioned[0].w).toBeDefined();
    expect(positioned[1].x).toBeGreaterThan(positioned[0].x!);
    expect(laidEdges.length).toBe(1);
    expect(laidEdges[0].points).toBeDefined();
  });

  it('should position tree with root at top', () => {
    const nodes = [
      { id: 'root', label: 'Root' },
      { id: 'c0', label: 'Child' },
    ];
    const edges = [{ from: 'root', to: 'c0' }];
    const { nodes: positioned } = calculateLayout(nodes, edges, 'tree');

    const root = positioned.find((n) => n.id === 'root');
    const child = positioned.find((n) => n.id === 'c0');
    expect(root!.y).toBeLessThan(child!.y);
  });

  it('should position cycle nodes in circle', () => {
    const nodes = [
      { id: 'p0', label: 'A' },
      { id: 'p1', label: 'B' },
      { id: 'p2', label: 'C' },
    ];
    const edges = [
      { from: 'p0', to: 'p1' },
      { from: 'p1', to: 'p2' },
      { from: 'p2', to: 'p0' },
    ];
    const { nodes: positioned } = calculateLayout(nodes, edges, 'cycle');

    // All nodes should have positions
    positioned.forEach((n) => {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
    });
  });

  it('should position matrix in grid', () => {
    const nodes = [
      { id: 'm0', label: 'A' },
      { id: 'm1', label: 'B' },
      { id: 'm2', label: 'C' },
      { id: 'm3', label: 'D' },
    ];
    const { nodes: positioned } = calculateLayout(nodes, [], 'matrix');

    expect(positioned.length).toBe(4);
    // Grid: first row has smaller y than second row
    expect(positioned[0].y).toBeLessThan(positioned[2].y!);
  });
});

// ─── handleGenerateScenes Tests ──────────────────────────────────────────────

describe('handleGenerateScenes', () => {
  it('should generate scenes from a transcript', async () => {
    const result = await handleGenerateScenes(
      { transcript: 'まず準備を行います。次に実行します。最後に確認します。' },
      USER_ID
    );

    expect(result.scenes.length).toBeGreaterThan(0);
    expect(result.sceneCount).toBe(result.scenes.length);
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  it('should split scenes on signal words', async () => {
    const result = await handleGenerateScenes(
      {
        transcript:
          'まず準備を行います。そして資料を集めます。\n次に実行します。最後に確認します。',
      },
      USER_ID
    );

    // Should create at least 2 scenes (split on 'まず' and '次に')
    expect(result.scenes.length).toBeGreaterThanOrEqual(2);
  });

  it('should include layout in each scene', async () => {
    const result = await handleGenerateScenes(
      { transcript: 'テストテキストです。' },
      USER_ID
    );

    result.scenes.forEach((scene) => {
      expect(scene.layout).toBeDefined();
      expect(scene.type).toBeDefined();
      expect(scene.startMs).toBeGreaterThanOrEqual(0);
      expect(scene.durationMs).toBeGreaterThan(0);
    });
  });

  it('should create at least one scene even for simple text', async () => {
    const result = await handleGenerateScenes(
      { transcript: 'simple text' },
      USER_ID
    );

    expect(result.scenes.length).toBe(1);
    expect(result.sceneCount).toBe(1);
  });

  it('should throw validation error when transcript is missing', async () => {
    await expect(
      handleGenerateScenes({} as GenerateScenesRequest, USER_ID)
    ).rejects.toThrow('transcript is required');
  });

  it('should throw validation error when transcript is empty', async () => {
    await expect(
      handleGenerateScenes({ transcript: '' }, USER_ID)
    ).rejects.toThrow('transcript is required');
  });

  it('should accept segments parameter without error', async () => {
    const result = await handleGenerateScenes(
      {
        transcript: 'テスト。',
        segments: [{ start: 0, end: 1, text: 'テスト' }],
      },
      USER_ID
    );

    expect(result.scenes.length).toBeGreaterThan(0);
  });

  it('should default to 60s timeout', () => {
    expect(GENERATE_TIMEOUT_MS).toBe(60000);
  });

  it('should calculate total duration correctly', async () => {
    const result = await handleGenerateScenes(
      { transcript: 'まずA。次にB。' },
      USER_ID
    );

    const manualTotal = result.scenes.reduce((sum, s) => sum + s.durationMs, 0);
    expect(result.totalDurationMs).toBe(manualTotal);
  });
});
