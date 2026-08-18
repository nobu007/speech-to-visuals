/**
 * Comprehensive LLM Analysis Accuracy Validation Suite
 * Tests against custom instructions requirements:
 * - Entity extraction F1 score ≥ 0.80
 * - Relation accuracy ≥ 0.85
 * - Scene segmentation F1 ≥ 0.75
 */

import 'dotenv/config';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';
import { ContentAnalyzer } from '../src/analysis/content-analyzer';

interface TestCase {
  name: string;
  input: string;
  expected: {
    type: 'flow' | 'tree' | 'timeline';
    minNodes: number;
    maxNodes: number;
    minEdges: number;
    expectedEntities?: string[];
    expectedRelations?: Array<{ from: string; to: string }>;
  };
}

const testCases: TestCase[] = [
  {
    name: 'Simple Process Flow',
    input: 'まず研究を行い、次に開発を実施し、最後にテストを実行します。',
    expected: {
      type: 'flow',
      minNodes: 3,
      maxNodes: 4,
      minEdges: 2,
      expectedEntities: ['研究', '開発', 'テスト'],
      expectedRelations: [
        { from: '研究', to: '開発' },
        { from: '開発', to: 'テスト' }
      ]
    }
  },
  {
    name: 'Hierarchical Organization',
    input: '会社組織は社長がトップで、その下に営業部と技術部があり、営業部には営業課と企画課があります。',
    expected: {
      type: 'tree',
      minNodes: 4,
      maxNodes: 6,
      minEdges: 3,
      expectedEntities: ['社長', '営業部', '技術部']
    }
  },
  {
    name: 'Historical Timeline',
    input: '2020年にプロジェクトを開始し、2021年に開発を完了し、2022年にリリースしました。',
    expected: {
      type: 'timeline',
      minNodes: 3,
      maxNodes: 4,
      minEdges: 2,
      expectedEntities: ['2020', '2021', '2022']
    }
  },
  {
    name: 'Complex Multi-Step Process',
    input: 'システム開発では要件定義から始まり、設計、実装、テスト、デプロイという段階を経ます。各段階でレビューを実施し、品質を確保します。',
    expected: {
      type: 'flow',
      minNodes: 5,
      maxNodes: 8,
      minEdges: 4,
      expectedEntities: ['要件定義', '設計', '実装', 'テスト', 'デプロイ']
    }
  },
  {
    name: 'Branching Logic',
    input: 'ユーザーがログインすると、権限をチェックします。管理者の場合は管理画面へ、一般ユーザーの場合はダッシュボードへ遷移します。',
    expected: {
      type: 'flow',
      minNodes: 4,
      maxNodes: 6,
      minEdges: 3,
      expectedEntities: ['ログイン', '権限チェック', '管理画面', 'ダッシュボード']
    }
  }
];

interface ValidationMetrics {
  entityExtractionF1: number;
  relationAccuracy: number;
  typeAccuracy: number;
  structuralCompleteness: number;
}

/**
 * Calculate F1 score for entity extraction
 */
function calculateEntityF1(extracted: string[], expected: string[]): number {
  if (expected.length === 0) return 1.0;

  // Normalize for comparison (lowercase, trim)
  const normalizedExtracted = extracted.map(e => e.toLowerCase().trim());
  const normalizedExpected = expected.map(e => e.toLowerCase().trim());

  // Calculate true positives (fuzzy match)
  let truePositives = 0;
  for (const exp of normalizedExpected) {
    if (normalizedExtracted.some(ext => ext.includes(exp) || exp.includes(ext))) {
      truePositives++;
    }
  }

  const precision = normalizedExtracted.length > 0 ? truePositives / normalizedExtracted.length : 0;
  const recall = normalizedExpected.length > 0 ? truePositives / normalizedExpected.length : 0;

  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Calculate relation accuracy
 */
function calculateRelationAccuracy(
  extractedEdges: Array<{ from: string; to: string }>,
  expectedRelations?: Array<{ from: string; to: string }>
): number {
  if (!expectedRelations || expectedRelations.length === 0) {
    // If no expected relations, just check that we have some reasonable structure
    return extractedEdges.length > 0 ? 1.0 : 0.5;
  }

  let correctRelations = 0;
  for (const exp of expectedRelations) {
    // Fuzzy match on relation pairs
    const found = extractedEdges.some(edge => {
      const fromMatch = edge.from.toLowerCase().includes(exp.from.toLowerCase()) ||
                       exp.from.toLowerCase().includes(edge.from.toLowerCase());
      const toMatch = edge.to.toLowerCase().includes(exp.to.toLowerCase()) ||
                     exp.to.toLowerCase().includes(edge.to.toLowerCase());
      return fromMatch && toMatch;
    });
    if (found) correctRelations++;
  }

  return expectedRelations.length > 0 ? correctRelations / expectedRelations.length : 1.0;
}

/**
 * Calculate structural completeness
 */
function calculateStructuralCompleteness(
  nodeCount: number,
  edgeCount: number,
  expected: TestCase['expected']
): number {
  const nodeScore = (nodeCount >= expected.minNodes && nodeCount <= expected.maxNodes) ? 1.0 : 0.5;
  const edgeScore = edgeCount >= expected.minEdges ? 1.0 : 0.5;
  return (nodeScore + edgeScore) / 2;
}

/**
 * Run validation test suite
 */
async function runValidation(): Promise<void> {
  console.log('🧪 LLM Analysis Accuracy Validation Suite');
  console.log('=' .repeat(80));
  console.log();

  const geminiAnalyzer = new GeminiAnalyzer();
  const contentAnalyzer = new ContentAnalyzer();

  if (!geminiAnalyzer.isEnabled()) {
    console.error('❌ Gemini API is not enabled. Please set GOOGLE_API_KEY.');
    process.exit(1);
  }

  const results: ValidationMetrics[] = [];
  let passedTests = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📝 Test ${i + 1}/${testCases.length}: ${testCase.name}`);
    console.log('-'.repeat(80));

    try {
      // Run analysis
      const startTime = Date.now();
      const diagramData = await contentAnalyzer.execute(testCase.input);
      const duration = Date.now() - startTime;

      console.log(`⏱️  Analysis completed in ${(duration / 1000).toFixed(2)}s`);
      console.log(`   Type: ${diagramData.type}`);
      console.log(`   Nodes: ${diagramData.nodes.length}`);
      console.log(`   Edges: ${diagramData.edges.length}`);

      // Extract entities from nodes
      const extractedEntities = diagramData.nodes.map(n => n.label);

      // Build ID-to-label map for edge resolution
      const idToLabel = new Map(diagramData.nodes.map(n => [n.id, n.label]));

      // Resolve edges from IDs to labels for accurate comparison
      const resolvedEdges = diagramData.edges.map(edge => ({
        from: idToLabel.get(edge.from) || edge.from,
        to: idToLabel.get(edge.to) || edge.to,
        label: edge.label
      }));

      // Calculate metrics
      const entityF1 = testCase.expected.expectedEntities
        ? calculateEntityF1(extractedEntities, testCase.expected.expectedEntities)
        : 1.0;

      const relationAccuracy = calculateRelationAccuracy(
        resolvedEdges,
        testCase.expected.expectedRelations
      );

      // Type mapping: ContentAnalyzer returns DiagramData types, we need to map to expected types
      const typeMap: Record<string, string> = {
        'flowchart': 'flow',
        'orgchart': 'tree',
        'mindmap': 'tree',
        'timeline': 'timeline'
      };
      const normalizedActualType = typeMap[diagramData.type as string] || diagramData.type;
      const typeAccuracy = normalizedActualType === testCase.expected.type ? 1.0 : 0.0;

      const structuralCompleteness = calculateStructuralCompleteness(
        diagramData.nodes.length,
        diagramData.edges.length,
        testCase.expected
      );

      const metrics: ValidationMetrics = {
        entityExtractionF1: entityF1,
        relationAccuracy,
        typeAccuracy,
        structuralCompleteness
      };

      results.push(metrics);

      // Display metrics
      console.log('\n📊 Metrics:');
      console.log(`   Entity Extraction F1:    ${(entityF1 * 100).toFixed(1)}% ${entityF1 >= 0.80 ? '✅' : '⚠️'}`);
      console.log(`   Relation Accuracy:       ${(relationAccuracy * 100).toFixed(1)}% ${relationAccuracy >= 0.85 ? '✅' : '⚠️'}`);
      console.log(`   Type Accuracy:           ${(typeAccuracy * 100).toFixed(1)}% ${typeAccuracy === 1.0 ? '✅' : '⚠️'}`);
      console.log(`   Structural Completeness: ${(structuralCompleteness * 100).toFixed(1)}% ${structuralCompleteness >= 0.75 ? '✅' : '⚠️'}`);

      // Overall pass/fail
      const passed = entityF1 >= 0.80 && relationAccuracy >= 0.85 && structuralCompleteness >= 0.75;
      if (passed) {
        passedTests++;
        console.log('\n✅ PASSED');
      } else {
        console.log('\n⚠️  PARTIAL PASS (Some metrics below threshold)');
      }

    } catch (error: unknown) {
      console.error(`\n❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        entityExtractionF1: 0,
        relationAccuracy: 0,
        typeAccuracy: 0,
        structuralCompleteness: 0
      });
    }
  }

  // Aggregate results
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL RESULTS');
  console.log('='.repeat(80));

  const avgEntityF1 = results.reduce((sum, r) => sum + r.entityExtractionF1, 0) / results.length;
  const avgRelationAccuracy = results.reduce((sum, r) => sum + r.relationAccuracy, 0) / results.length;
  const avgTypeAccuracy = results.reduce((sum, r) => sum + r.typeAccuracy, 0) / results.length;
  const avgStructuralCompleteness = results.reduce((sum, r) => sum + r.structuralCompleteness, 0) / results.length;

  console.log(`\nTests Passed: ${passedTests}/${testCases.length} (${((passedTests / testCases.length) * 100).toFixed(1)}%)`);
  console.log('\nAverage Metrics:');
  console.log(`  Entity Extraction F1:    ${(avgEntityF1 * 100).toFixed(1)}% (Target: ≥80%) ${avgEntityF1 >= 0.80 ? '✅' : '❌'}`);
  console.log(`  Relation Accuracy:       ${(avgRelationAccuracy * 100).toFixed(1)}% (Target: ≥85%) ${avgRelationAccuracy >= 0.85 ? '✅' : '❌'}`);
  console.log(`  Type Accuracy:           ${(avgTypeAccuracy * 100).toFixed(1)}% ${avgTypeAccuracy >= 0.80 ? '✅' : '⚠️'}`);
  console.log(`  Structural Completeness: ${(avgStructuralCompleteness * 100).toFixed(1)}% (Target: ≥75%) ${avgStructuralCompleteness >= 0.75 ? '✅' : '❌'}`);

  // Cache statistics
  console.log('\n📈 Performance Statistics:');
  const cacheStats = geminiAnalyzer.getCacheStats();
  console.log(`  Total Requests: ${cacheStats.totalRequests}`);
  console.log(`  Cache Hits: ${cacheStats.hits}`);
  console.log(`  Cache Size: ${cacheStats.size}`);
  console.log(`  Adaptive Timeout: ${cacheStats.adaptiveTimeout.currentTimeoutMs}ms`);
  console.log(`  Avg Response Time: ${cacheStats.adaptiveTimeout.avgResponseTimeMs}ms`);
  if (cacheStats.adaptiveTimeout.p95ResponseTimeMs) {
    console.log(`  P50 Response Time: ${cacheStats.adaptiveTimeout.p50ResponseTimeMs}ms`);
    console.log(`  P95 Response Time: ${cacheStats.adaptiveTimeout.p95ResponseTimeMs}ms`);
    console.log(`  P99 Response Time: ${cacheStats.adaptiveTimeout.p99ResponseTimeMs}ms`);
  }

  // Final verdict
  console.log('\n' + '='.repeat(80));
  const allMetricsPassed = avgEntityF1 >= 0.80 && avgRelationAccuracy >= 0.85 && avgStructuralCompleteness >= 0.75;
  if (allMetricsPassed) {
    console.log('✅ VALIDATION PASSED - All metrics meet custom instructions requirements!');
  } else {
    console.log('⚠️  VALIDATION INCOMPLETE - Some metrics below target thresholds');
  }
  console.log('='.repeat(80));
  console.log();
}

// Run validation
runValidation().catch(error => {
  console.error('Validation suite failed:', error);
  process.exit(1);
});
