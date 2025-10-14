#!/usr/bin/env -S node --loader tsx
/**
 * Simple parser test for LLM JSON responses
 * Verifies that code fences are stripped and JSON is parsed.
 */
import { parseJsonFromLLMText } from '@/analysis/llm-utils';

async function main() {
  const samples = [
    `{"title":"T","type":"flowchart","nodes":[{"id":"n1","label":"A"}],"edges":[]}`,
    "```json\n{\n  \"title\": \"X\",\n  \"type\": \"mindmap\",\n  \"nodes\": [{ \"id\": \"n1\", \"label\": \"Root\" }],\n  \"edges\": []\n}\n```",
    "```\n{\n  \"title\": \"Y\",\n  \"type\": \"timeline\",\n  \"nodes\": [],\n  \"edges\": []\n}\n```",
  ];

  for (const [i, s] of samples.entries()) {
    try {
      const parsed = parseJsonFromLLMText(s);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Parsed value is not an object');
      }
      if (!parsed.type || !parsed.nodes || !parsed.edges) {
        throw new Error('Missing required keys');
      }
      console.log(`✅ Sample ${i + 1} parsed: type=${parsed.type}, nodes=${parsed.nodes.length}, edges=${parsed.edges.length}`);
    } catch (err) {
      console.error(`❌ Sample ${i + 1} failed:`, err);
      process.exitCode = 1;
    }
  }
}

main();
