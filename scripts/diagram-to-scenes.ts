#!/usr/bin/env -S node --loader tsx
/**
 * Convert DiagramData JSON (public/scenes/diagram.json) into SceneGraph JSON for rendering.
 * Usage:
 *   npx tsx scripts/diagram-to-scenes.ts [inputDiagramJson] [outputSceneJson]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { LayoutEngine } from '@/visualization/layout-engine';
import type { DiagramType, NodeDatum, EdgeDatum, SceneGraph } from '@/types/diagram';

type DiagramData = {
  metadata?: { type?: string; title?: string };
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label?: string }[];
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

async function main() {
  const [inArg, outArg] = process.argv.slice(2);
  const inputPath = path.resolve(process.cwd(), inArg ?? path.join('public', 'scenes', 'diagram.json'));
  const outputPath = path.resolve(process.cwd(), outArg ?? path.join('public', 'scenes', 'scene-data.json'));

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input not found: ${inputPath}`);
    process.exit(1);
  }

  const data = readJson<DiagramData>(inputPath);

  const typeMap: Record<string, DiagramType> = {
    flowchart: 'flow',
    mindmap: 'tree',
    timeline: 'timeline',
    orgchart: 'tree',
  };
  const diagramType: DiagramType = (data.metadata?.type && typeMap[data.metadata.type]) || 'flow';

  const nodes: NodeDatum[] = (data.nodes ?? []).map((n) => ({ id: n.id, label: n.label }));
  const edges: EdgeDatum[] = (data.edges ?? []).map((e) => ({ from: e.from, to: e.to, label: e.label }));

  const layoutEngine = new LayoutEngine({ width: 1920, height: 1080, nodeWidth: 140, nodeHeight: 64 });
  const layoutRes = await layoutEngine.generateLayout(nodes, edges, diagramType, 1);
  if (!layoutRes.success) {
    console.warn('⚠️ Layout generation failed, proceeding without layout positions.');
  }

  const scene: SceneGraph = {
    type: diagramType,
    nodes,
    edges,
    layout: layoutRes.layout,
    startMs: 0,
    durationMs: 10000,
    summary: data.metadata?.title ?? 'Auto-generated diagram',
    keyphrases: [],
  };

  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ scenes: [scene], audioUrl: null }, null, 2), 'utf8');
  console.log(`✅ Scene data written: ${outputPath}`);
}

main().catch((err) => {
  console.error('❌ Failed to build scene from diagram:', err);
  process.exit(1);
});
