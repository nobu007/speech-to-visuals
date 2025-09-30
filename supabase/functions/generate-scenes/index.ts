import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cue words for diagram type detection
const CUE = {
  flow: ['まず', '次に', 'そして', '最後に', '手順', 'プロセス', 'ステップ'],
  cause: ['原因', '要因', 'ため', '結果', '影響', 'だから', 'ので'],
  compare: ['一方', '対して', 'しかし', '比較', '対比', 'メリット', 'デメリット'],
  timeline: ['年', '月', '日', '時間', 'まず→次', '以前', '以降'],
  cycle: ['循環', 'ループ', 'サイクル', 'PDCA', '継続的'],
  tree: ['一種', '分類', '構成要素', '包含', '〜は〜に含まれる'],
};

const SPLIT_SIGNALS = ['まず', '次に', '最後に', 'まとめ', '結論', '一方', 'しかし'];

function decideType(text: string): string {
  const hit = (arr: string[]) => arr.some((w) => text.includes(w));
  if (hit(CUE.cycle)) return 'cycle';
  if (hit(CUE.compare)) return 'matrix';
  if (hit(CUE.tree)) return 'tree';
  if (hit(CUE.timeline)) return 'timeline';
  if (hit(CUE.cause)) return 'flow';
  if (hit(CUE.flow)) return 'flow';
  return 'flow';
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/。|！|？/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractNodesAndEdges(text: string, type: string) {
  const sentences = splitSentences(text);
  const nodes: any[] = [];
  const edges: any[] = [];

  if (type === 'flow') {
    sentences.forEach((s, i) => {
      if (s.length > 3) {
        nodes.push({ id: `n${i}`, label: s.substring(0, 40) + (s.length > 40 ? '...' : '') });
      }
    });
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
    }
  } else if (type === 'tree') {
    if (sentences.length > 0) {
      nodes.push({ id: 'root', label: sentences[0].substring(0, 40) });
      sentences.slice(1, 6).forEach((s, i) => {
        const id = `c${i}`;
        nodes.push({ id, label: s.substring(0, 35) });
        edges.push({ from: 'root', to: id });
      });
    }
  } else if (type === 'timeline') {
    const events = sentences.slice(0, 5);
    events.forEach((e, i) => {
      nodes.push({ id: `t${i}`, label: e.substring(0, 35) });
    });
    for (let i = 0; i < events.length - 1; i++) {
      edges.push({ from: `t${i}`, to: `t${i + 1}` });
    }
  } else if (type === 'cycle') {
    const steps = sentences.slice(0, 4);
    steps.forEach((s, i) => {
      nodes.push({ id: `p${i}`, label: s.substring(0, 30) });
    });
    for (let i = 0; i < steps.length; i++) {
      edges.push({ from: `p${i}`, to: `p${(i + 1) % steps.length}` });
    }
  } else if (type === 'matrix') {
    // Simple 2x2 matrix
    ['A項目', 'B項目', 'C項目', 'D項目'].forEach((label, i) => {
      nodes.push({ id: `m${i}`, label });
    });
  }

  return { nodes, edges };
}

function calculateLayout(nodes: any[], edges: any[], type: string) {
  const positioned: any[] = [];
  const laidEdges: any[] = [];

  if (type === 'flow') {
    // Left to right flow
    const gap = 280;
    nodes.forEach((n, i) => {
      positioned.push({
        ...n,
        x: 150 + i * gap,
        y: 400,
        w: 240,
        h: 80,
      });
    });
    edges.forEach((e) => {
      const fromNode = positioned.find((n) => n.id === e.from);
      const toNode = positioned.find((n) => n.id === e.to);
      if (fromNode && toNode) {
        laidEdges.push({
          ...e,
          points: [
            { x: fromNode.x + fromNode.w, y: fromNode.y + fromNode.h / 2 },
            { x: toNode.x, y: toNode.y + toNode.h / 2 },
          ],
        });
      }
    });
  } else if (type === 'tree') {
    // Root at top, children below
    const root = nodes.find((n) => n.id === 'root');
    if (root) {
      positioned.push({ ...root, x: 960, y: 200, w: 280, h: 80 });
      const children = nodes.filter((n) => n.id !== 'root');
      const childGap = 320;
      const startX = 960 - ((children.length - 1) * childGap) / 2;
      children.forEach((n, i) => {
        const x = startX + i * childGap;
        positioned.push({ ...n, x, y: 450, w: 260, h: 70 });
        laidEdges.push({
          from: 'root',
          to: n.id,
          points: [
            { x: 960, y: 280 },
            { x, y: 450 },
          ],
        });
      });
    }
  } else if (type === 'timeline') {
    // Horizontal timeline with alternating positions
    const gap = 280;
    nodes.forEach((n, i) => {
      const x = 150 + i * gap;
      const y = 400 + (i % 2 ? 100 : -100);
      positioned.push({ ...n, x, y, w: 220, h: 70 });
    });
    edges.forEach((e) => {
      const fromNode = positioned.find((n) => n.id === e.from);
      const toNode = positioned.find((n) => n.id === e.to);
      if (fromNode && toNode) {
        laidEdges.push({
          ...e,
          points: [
            { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h },
            { x: toNode.x + toNode.w / 2, y: toNode.y },
          ],
        });
      }
    });
  } else if (type === 'cycle') {
    // Circular layout
    const cx = 960;
    const cy = 400;
    const radius = 260;
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      positioned.push({
        ...n,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        w: 200,
        h: 70,
      });
    });
    edges.forEach((e) => {
      const fromNode = positioned.find((n) => n.id === e.from);
      const toNode = positioned.find((n) => n.id === e.to);
      if (fromNode && toNode) {
        laidEdges.push({
          ...e,
          points: [
            { x: fromNode.x, y: fromNode.y },
            { x: toNode.x, y: toNode.y },
          ],
        });
      }
    });
  } else if (type === 'matrix') {
    // 2x2 grid
    const cellW = 300;
    const cellH = 200;
    const startX = 660;
    const startY = 250;
    nodes.forEach((n, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      positioned.push({
        ...n,
        x: startX + col * cellW,
        y: startY + row * cellH,
        w: 260,
        h: 160,
      });
    });
  }

  return { nodes: positioned, edges: laidEdges };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript) {
      throw new Error('Transcript is required');
    }

    console.log('Processing transcript, length:', transcript.length);

    // Simple scene splitting based on signals
    const paragraphs = transcript.split(/\n+/).filter((p: string) => p.trim().length > 0);
    const scenes: any[] = [];
    let currentTime = 0;

    for (const para of paragraphs) {
      const shouldSplit = SPLIT_SIGNALS.some((signal) => para.includes(signal));
      
      if (shouldSplit || scenes.length === 0) {
        const type = decideType(para);
        const { nodes, edges } = extractNodesAndEdges(para, type);
        const layout = calculateLayout(nodes, edges, type);
        
        const sentences = splitSentences(para);
        const duration = Math.max(3000, Math.min(8000, sentences.length * 1500));

        scenes.push({
          type,
          nodes,
          edges,
          layout,
          startMs: currentTime,
          durationMs: duration,
          summary: sentences[0] || `シーン ${scenes.length + 1}`,
          keyphrases: sentences.slice(0, 3),
        });

        currentTime += duration;
      }
    }

    // Ensure we have at least one scene
    if (scenes.length === 0) {
      const type = 'flow';
      const { nodes, edges } = extractNodesAndEdges(transcript, type);
      const layout = calculateLayout(nodes, edges, type);
      scenes.push({
        type,
        nodes,
        edges,
        layout,
        startMs: 0,
        durationMs: 5000,
        summary: 'シーン 1',
        keyphrases: splitSentences(transcript).slice(0, 3),
      });
    }

    console.log(`Generated ${scenes.length} scenes`);

    return new Response(
      JSON.stringify({ scenes }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
