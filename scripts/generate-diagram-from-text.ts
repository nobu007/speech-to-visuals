#!/usr/bin/env -S node --loader tsx
/**
 * Generate diagram JSON from plain text using Gemini (fallback to rule-based)
 * Usage:
 *   npx tsx scripts/generate-diagram-from-text.ts --text "..."
 *   npx tsx scripts/generate-diagram-from-text.ts ./path/to/text.txt
 * Output:
 *   Writes JSON to public/scenes/diagram.json
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GeminiAnalyzer } from '@/analysis/gemini-analyzer';
import type { DiagramData, DiagramNode, DiagramEdge } from '@/types/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(): { text?: string; file?: string; out?: string } {
  const args = process.argv.slice(2);
  const result: { text?: string; file?: string; out?: string } = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--text' && args[i + 1]) {
      result.text = args[++i];
    } else if (a === '--out' && args[i + 1]) {
      result.out = args[++i];
    } else if (!a.startsWith('-') && !result.file) {
      result.file = a;
    }
  }
  return result;
}

function readTextFromFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`❌ Failed to read file: ${filePath}`);
    throw err;
  }
}

function ruleBasedExtract(text: string): { nodes: DiagramNode[]; edges: DiagramEdge[]; type: string; title?: string } {
  // Simple baseline: split sentences into nodes, connect sequentially
  const sentences = text
    .split(/[。.!?\n]+/)    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const nodes: DiagramNode[] = sentences.map((s, i) => ({
    id: `n${i + 1}`,
    label: s.length > 60 ? s.slice(0, 57) + '…' : s,
    type: 'step',
  }));
  const edges: DiagramEdge[] = nodes.slice(1).map((_, i) => ({
    id: `e${i + 1}`,
    from: `n${i + 1}`,
    to: `n${i + 2}`,
  }));
  return { nodes, edges, type: 'flow', title: 'Auto-generated (rule-based)' };
}

async function main() {
  const { text, file, out } = parseArgs();
  const inputText = text ?? (file ? readTextFromFile(path.resolve(process.cwd(), file)) : undefined);
  if (!inputText) {
    console.error('Usage: tsx scripts/generate-diagram-from-text.ts [--text "..."] [input.txt] [--out out.json]');
    process.exit(1);
  }

  const analyzer = new GeminiAnalyzer();
  let nodes: DiagramNode[] = [];
  let edges: DiagramEdge[] = [];
  let type = 'flow';
  let title: string | undefined = undefined;

  if (analyzer.isEnabled()) {
    console.log('🔗 Using Gemini for structural extraction...');
    const analysis = await analyzer.analyzeText(inputText);
    if (analysis) {
      type = analysis.type;
      nodes = (analysis.nodes || []).map((n, i) => ({ id: n.id || `n${i + 1}`, label: n.label || `Node ${i + 1}`, type: 'auto' }));
      edges = (analysis.edges || []).map((e, i) => ({ id: `e${i + 1}`, from: e.from, to: e.to, label: e.label }));
      title = 'Auto-generated (Gemini)';
    } else {
      console.log('⚙️  Falling back to rule-based extraction');
      const rb = ruleBasedExtract(inputText);
      nodes = rb.nodes; edges = rb.edges; type = rb.type; title = rb.title;
    }
  } else {
    console.log('⚙️  Gemini disabled or no API key. Using rule-based extraction');
    const rb = ruleBasedExtract(inputText);
    nodes = rb.nodes; edges = rb.edges; type = rb.type; title = rb.title;
  }

  const diagram: DiagramData = {
    nodes,
    edges,
    layout: { width: 1920, height: 1080, nodes: {} },
    metadata: { type, title },
  };

  const outputPath = path.resolve(process.cwd(), out ?? path.join('public', 'scenes', 'diagram.json'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(diagram, null, 2), 'utf8');
  console.log(`✅ Diagram JSON written to: ${outputPath}`);
}

main().catch((err) => {
  console.error('❌ Failed to generate diagram from text:', err);
  process.exit(1);
});
