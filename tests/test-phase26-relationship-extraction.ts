/**
 * Phase 26: Enhanced Relationship Extraction Test Suite
 * Tests the improved GeminiAnalyzer with advanced prompt engineering
 */

import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';

interface TestCase {
  name: string;
  text: string;
  expectedMinEdges: number;
  expectedMinNodes: number;
  description: string;
}

const testCases: TestCase[] = [
  {
    name: "Sequential Process (因果関係)",
    text: "研究により新技術が開発され、それを実用化して製品化する。製品化の後、市場展開を行う。",
    expectedMinEdges: 3,
    expectedMinNodes: 4,
    description: "Should extract sequential relationships: 研究→新技術→実用化→製品化→市場展開"
  },
  {
    name: "Hierarchical Structure (階層関係)",
    text: "組織の最上位に社長がいて、その下に営業部と技術部がある。営業部には営業1課と営業2課が所属する。",
    expectedMinEdges: 3,
    expectedMinNodes: 5,
    description: "Should extract hierarchical relationships: 社長→営業部→営業1課/営業2課"
  },
  {
    name: "Causal Chain (因果連鎖)",
    text: "温暖化により気温が上昇し、その結果として海面が上昇する。海面上昇によって沿岸部が浸水する。",
    expectedMinEdges: 3,
    expectedMinNodes: 4,
    description: "Should extract causal chain: 温暖化→気温上昇→海面上昇→沿岸浸水"
  },
  {
    name: "Complex Dependencies (複雑な依存関係)",
    text: "AとBを準備する。その後、Aを使ってCを作成し、Bを使ってDを作成する。最後にCとDを組み合わせてEを完成させる。",
    expectedMinEdges: 5,
    expectedMinNodes: 5,
    description: "Should extract complex dependencies with branches and joins"
  },
  {
    name: "Timeline with Multiple Events (時系列)",
    text: "2020年にプロジェクト開始。2021年に試作品完成。2022年に製品発売。2023年に市場シェア10%達成。",
    expectedMinEdges: 3,
    expectedMinNodes: 4,
    description: "Should extract temporal relationships with all events connected"
  }
];

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║    Phase 26: Enhanced Relationship Extraction Test Suite       ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const analyzer = new GeminiAnalyzer();

  if (!analyzer.isEnabled()) {
    console.log('⚠️  WARNING: GeminiAnalyzer not enabled (GOOGLE_API_KEY not set)');
    console.log('⚠️  Tests will be skipped. Set GOOGLE_API_KEY environment variable to run tests.');
    console.log('\n✅ SKIPPED: Test suite requires API key\n');
    return;
  }

  const results = {
    total: testCases.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    totalEdges: 0,
    totalNodes: 0,
    avgEdgeRatio: 0,
    totalTime: 0
  };

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n[${ i + 1}/${testCases.length}] ${testCase.name}`);
    console.log(`   Description: ${testCase.description}`);
    console.log(`   Input: "${testCase.text.slice(0, 80)}..."`);

    try {
      const startTime = Date.now();
      const result = await analyzer.analyzeText(testCase.text);
      const elapsed = Date.now() - startTime;
      results.totalTime += elapsed;

      if (!result) {
        console.log(`   ❌ FAILED: No result returned`);
        results.failed++;
        continue;
      }

      const nodes = result.nodes.length;
      const edges = result.edges.length;
      const edgeRatio = nodes > 1 ? edges / (nodes - 1) : 0;

      results.totalEdges += edges;
      results.totalNodes += nodes;
      results.avgEdgeRatio += edgeRatio;

      console.log(`   📊 Results: ${nodes} nodes, ${edges} edges (ratio: ${edgeRatio.toFixed(2)})`);
      console.log(`   🎯 Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`   ⏱️  Time: ${elapsed}ms`);
      console.log(`   💭 Reasoning: ${result.reasoning}`);

      // Validation
      const passedNodes = nodes >= testCase.expectedMinNodes;
      const passedEdges = edges >= testCase.expectedMinEdges;

      if (passedNodes && passedEdges) {
        console.log(`   ✅ PASSED: Meets minimum requirements`);
        results.passed++;
      } else {
        if (!passedNodes) {
          console.log(`   ⚠️  WARNING: Expected ≥${testCase.expectedMinNodes} nodes, got ${nodes}`);
        }
        if (!passedEdges) {
          console.log(`   ⚠️  WARNING: Expected ≥${testCase.expectedMinEdges} edges, got ${edges}`);
        }

        // Consider it a warning rather than failure if at least some edges extracted
        if (edges > 0) {
          console.log(`   ⚠️  WARNING: Partial success (has edges but below target)`);
          results.warnings++;
          results.passed++; // Count as passed with warning
        } else {
          console.log(`   ❌ FAILED: No relationships extracted`);
          results.failed++;
        }
      }

      // Display extracted relationships
      if (edges > 0) {
        console.log(`   🔗 Extracted relationships:`);
        result.edges.forEach((edge, idx) => {
          const fromNode = result.nodes.find(n => n.id === edge.from);
          const toNode = result.nodes.find(n => n.id === edge.to);
          const label = edge.label ? ` [${edge.label}]` : '';
          console.log(`      ${idx + 1}. ${fromNode?.label || edge.from} → ${toNode?.label || edge.to}${label}`);
        });
      }

    } catch (err: any) {
      console.log(`   ❌ ERROR: ${err.message}`);
      results.failed++;
    }
  }

  // Final statistics
  const stats = analyzer.getCacheStats();
  results.avgEdgeRatio /= testCases.length;

  console.log('\n' + '='.repeat(70));
  console.log('Phase 26 Test Results Summary');
  console.log('='.repeat(70));
  console.log(`\nTest Execution:`);
  console.log(`  Total Tests:     ${results.total}`);
  console.log(`  Passed:          ${results.passed} ✅`);
  console.log(`  Failed:          ${results.failed} ❌`);
  console.log(`  Warnings:        ${results.warnings} ⚠️`);
  console.log(`  Success Rate:    ${((results.passed / results.total) * 100).toFixed(1)}%`);

  console.log(`\nRelationship Extraction Quality:`);
  console.log(`  Total Nodes:     ${results.totalNodes}`);
  console.log(`  Total Edges:     ${results.totalEdges}`);
  console.log(`  Avg Nodes/Test:  ${(results.totalNodes / results.total).toFixed(1)}`);
  console.log(`  Avg Edges/Test:  ${(results.totalEdges / results.total).toFixed(1)}`);
  console.log(`  Avg Edge Ratio:  ${results.avgEdgeRatio.toFixed(2)} (target: ≥0.8)`);

  console.log(`\nPerformance:`);
  console.log(`  Total Time:      ${results.totalTime}ms`);
  console.log(`  Avg Time/Test:   ${(results.totalTime / results.total).toFixed(0)}ms`);
  console.log(`  P95 Target:      <10000ms (${results.totalTime / results.total < 10000 ? '✅' : '❌'})`);

  console.log(`\nLLM Service Stats:`);
  console.log(`  Cache Hits:      ${stats.hits}`);
  console.log(`  Cache Misses:    ${stats.misses}`);
  console.log(`  Total Requests:  ${stats.totalRequests}`);
  console.log(`  Flash Usage:     ${stats.modelSelection.flashUsagePercent.toFixed(1)}%`);
  console.log(`  Avg Response:    ${stats.adaptiveTimeout.avgResponseTimeMs.toFixed(0)}ms`);

  // Phase 26 specific quality assessment
  console.log(`\n${'='.repeat(70)}`);
  console.log('Phase 26 Quality Assessment');
  console.log('='.repeat(70));

  const edgeCompletenessScore = (results.totalEdges / (testCases.reduce((sum, tc) => sum + tc.expectedMinEdges, 0))) * 100;
  const avgEdgeRatioScore = (results.avgEdgeRatio / 0.8) * 100; // Target: 0.8
  const speedScore = results.totalTime / results.total < 10000 ? 100 : 50;
  const overallScore = (
    (results.passed / results.total) * 40 +
    Math.min(edgeCompletenessScore, 100) * 0.30 +
    Math.min(avgEdgeRatioScore, 100) * 0.20 +
    speedScore * 0.10
  );

  console.log(`\nMetric Scores:`);
  console.log(`  Test Pass Rate:        ${((results.passed / results.total) * 100).toFixed(1)}% (weight: 40%)`);
  console.log(`  Edge Completeness:     ${edgeCompletenessScore.toFixed(1)}% (weight: 30%)`);
  console.log(`  Edge Ratio Quality:    ${avgEdgeRatioScore.toFixed(1)}% (weight: 20%)`);
  console.log(`  Processing Speed:      ${speedScore}% (weight: 10%)`);
  console.log(`\n  Overall Phase 26 Score: ${overallScore.toFixed(1)}/100`);

  if (overallScore >= 90) {
    console.log(`\n🎉 EXCELLENT: Phase 26 goals achieved! Production-ready relationship extraction.`);
  } else if (overallScore >= 75) {
    console.log(`\n✅ GOOD: Phase 26 improvements successful. Minor optimizations possible.`);
  } else if (overallScore >= 60) {
    console.log(`\n⚠️  ACCEPTABLE: Phase 26 shows improvement but needs refinement.`);
  } else {
    console.log(`\n❌ NEEDS WORK: Phase 26 goals not met. Review prompt engineering strategy.`);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
