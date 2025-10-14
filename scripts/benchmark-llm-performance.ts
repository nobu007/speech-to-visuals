/**
 * LLM Performance Benchmarking Tool
 * Monitors and tracks key performance indicators for LLM integration
 * - Response time percentiles (P50, P95, P99)
 * - Cache hit rates
 * - Adaptive timeout effectiveness
 * - Error rates and fallback frequency
 */

import 'dotenv/config';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';
import fs from 'fs';
import path from 'path';

interface BenchmarkResult {
  timestamp: string;
  testName: string;
  durationMs: number;
  success: boolean;
  cached: boolean;
  nodeCount: number;
  edgeCount: number;
  errorMessage?: string;
}

interface BenchmarkSummary {
  timestamp: string;
  totalTests: number;
  successRate: number;
  cacheHitRate: number;
  avgResponseTimeMs: number;
  p50ResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  totalDurationMs: number;
  testsPerSecond: number;
}

const testInputs = [
  {
    name: 'Short Simple Flow',
    text: 'まず準備をして、次に実行し、最後に確認します。'
  },
  {
    name: 'Medium Process',
    text: 'システム開発では要件定義から始まり、設計、実装、テストという流れで進みます。各工程で品質チェックを行います。'
  },
  {
    name: 'Complex Hierarchy',
    text: '会社組織は社長がトップで、その下に営業部、技術部、管理部があります。営業部には営業課と企画課、技術部には開発課と保守課が所属しています。'
  },
  {
    name: 'Timeline',
    text: '2020年にプロジェクト開始、2021年に第一フェーズ完了、2022年に第二フェーズ開始、2023年に全体完了しました。'
  },
  {
    name: 'Branching Logic',
    text: 'ユーザーがログインすると権限をチェックします。管理者ならば管理画面へ、一般ユーザーならダッシュボードへ、ゲストならトップページへ遷移します。'
  },
  {
    name: 'Long Complex Process',
    text: 'データ分析プロジェクトでは、まずデータ収集を行い、次にデータクレンジングで品質を確保します。その後、探索的データ分析でパターンを発見し、仮説を立てます。機械学習モデルを構築してトレーニングを実施し、検証データで評価します。最適なモデルを選定後、本番環境にデプロイし、継続的にモニタリングします。'
  }
];

/**
 * Calculate percentiles from sorted array
 */
function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Run benchmark suite
 */
async function runBenchmark(): Promise<void> {
  console.log('🏃 LLM Performance Benchmark');
  console.log('=' .repeat(80));
  console.log();

  const analyzer = new GeminiAnalyzer();

  if (!analyzer.isEnabled()) {
    console.error('❌ Gemini API is not enabled. Please set GOOGLE_API_KEY.');
    process.exit(1);
  }

  const results: BenchmarkResult[] = [];
  const startTime = Date.now();

  // Run tests multiple times to measure cache performance
  const iterations = 2;
  console.log(`Running ${testInputs.length} tests × ${iterations} iterations = ${testInputs.length * iterations} total tests\n`);

  for (let iter = 0; iter < iterations; iter++) {
    console.log(`\n📊 Iteration ${iter + 1}/${iterations}`);
    console.log('-'.repeat(80));

    for (const testInput of testInputs) {
      const testStart = Date.now();
      let success = false;
      let cached = false;
      let nodeCount = 0;
      let edgeCount = 0;
      let errorMessage: string | undefined;

      try {
        // Check if cached before calling
        const cacheStatsBefore = analyzer.getCacheStats();
        const hitsBefore = cacheStatsBefore.totalHits;

        const result = await analyzer.analyzeText(testInput.text);
        const duration = Date.now() - testStart;

        const cacheStatsAfter = analyzer.getCacheStats();
        const hitsAfter = cacheStatsAfter.totalHits;
        cached = hitsAfter > hitsBefore;

        if (result) {
          success = true;
          nodeCount = result.nodes.length;
          edgeCount = result.edges.length;
          console.log(`  ✅ ${testInput.name}: ${duration}ms ${cached ? '(cached)' : '(fresh)'} | ${nodeCount}N/${edgeCount}E`);
        } else {
          errorMessage = 'Returned null';
          console.log(`  ⚠️  ${testInput.name}: ${duration}ms | Returned null`);
        }

        results.push({
          timestamp: new Date().toISOString(),
          testName: testInput.name,
          durationMs: duration,
          success,
          cached,
          nodeCount,
          edgeCount,
          errorMessage
        });

      } catch (error: any) {
        const duration = Date.now() - testStart;
        errorMessage = error.message || String(error);
        console.log(`  ❌ ${testInput.name}: ${duration}ms | ${errorMessage}`);

        results.push({
          timestamp: new Date().toISOString(),
          testName: testInput.name,
          durationMs: duration,
          success: false,
          cached: false,
          nodeCount: 0,
          edgeCount: 0,
          errorMessage
        });
      }
    }
  }

  const totalDuration = Date.now() - startTime;

  // Calculate summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('📊 BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  const successfulResults = results.filter(r => r.success);
  const cachedResults = results.filter(r => r.cached);
  const freshResults = successfulResults.filter(r => !r.cached);

  console.log(`\n✅ Success Rate: ${successfulResults.length}/${results.length} (${((successfulResults.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`💾 Cache Hit Rate: ${cachedResults.length}/${results.length} (${((cachedResults.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`⚡ Tests/Second: ${(results.length / (totalDuration / 1000)).toFixed(2)}`);

  if (successfulResults.length > 0) {
    const durations = successfulResults.map(r => r.durationMs).sort((a, b) => a - b);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p50 = calculatePercentile(durations, 0.5);
    const p95 = calculatePercentile(durations, 0.95);
    const p99 = calculatePercentile(durations, 0.99);
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    console.log('\n📈 Response Time Statistics (Successful Tests):');
    console.log(`  Min:     ${min}ms`);
    console.log(`  Average: ${Math.round(avgDuration)}ms`);
    console.log(`  P50:     ${Math.round(p50)}ms`);
    console.log(`  P95:     ${Math.round(p95)}ms`);
    console.log(`  P99:     ${Math.round(p99)}ms`);
    console.log(`  Max:     ${max}ms`);

    if (freshResults.length > 0) {
      const freshDurations = freshResults.map(r => r.durationMs);
      const avgFresh = freshDurations.reduce((sum, d) => sum + d, 0) / freshDurations.length;
      console.log(`\n🔄 Fresh Request Average: ${Math.round(avgFresh)}ms`);
    }

    if (cachedResults.length > 0) {
      const cachedDurations = cachedResults.map(r => r.durationMs);
      const avgCached = cachedDurations.reduce((sum, d) => sum + d, 0) / cachedDurations.length;
      console.log(`💾 Cached Request Average: ${Math.round(avgCached)}ms`);

      if (freshResults.length > 0) {
        const avgFresh = freshResults.map(r => r.durationMs).reduce((sum, d) => sum + d, 0) / freshResults.length;
        const speedup = avgFresh / avgCached;
        console.log(`⚡ Cache Speedup: ${speedup.toFixed(1)}x faster`);
      }
    }
  }

  // Analyzer statistics
  const analyzerStats = analyzer.getCacheStats();
  console.log('\n📊 Analyzer Statistics:');
  console.log(`  Total API Requests: ${analyzerStats.totalRequests}`);
  console.log(`  Cache Size: ${analyzerStats.size} entries`);
  console.log(`  Cache Hits: ${analyzerStats.totalHits}`);
  console.log(`  Adaptive Timeout: ${analyzerStats.adaptiveTimeout.currentTimeoutMs}ms`);

  if (analyzerStats.adaptiveTimeout.historySamples > 0) {
    console.log(`  Historical Samples: ${analyzerStats.adaptiveTimeout.historySamples}`);
    console.log(`  Avg Response Time: ${analyzerStats.adaptiveTimeout.avgResponseTimeMs}ms`);
    console.log(`  P50 Response Time: ${analyzerStats.adaptiveTimeout.p50ResponseTimeMs}ms`);
    console.log(`  P95 Response Time: ${analyzerStats.adaptiveTimeout.p95ResponseTimeMs}ms`);
    console.log(`  P99 Response Time: ${analyzerStats.adaptiveTimeout.p99ResponseTimeMs}ms`);
  }

  // Save results
  const outputDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const summary: BenchmarkSummary = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    successRate: successfulResults.length / results.length,
    cacheHitRate: cachedResults.length / results.length,
    avgResponseTimeMs: successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.durationMs, 0) / successfulResults.length
      : 0,
    p50ResponseTimeMs: successfulResults.length > 0
      ? calculatePercentile(successfulResults.map(r => r.durationMs).sort((a, b) => a - b), 0.5)
      : 0,
    p95ResponseTimeMs: successfulResults.length > 0
      ? calculatePercentile(successfulResults.map(r => r.durationMs).sort((a, b) => a - b), 0.95)
      : 0,
    p99ResponseTimeMs: successfulResults.length > 0
      ? calculatePercentile(successfulResults.map(r => r.durationMs).sort((a, b) => a - b), 0.99)
      : 0,
    minResponseTimeMs: successfulResults.length > 0
      ? Math.min(...successfulResults.map(r => r.durationMs))
      : 0,
    maxResponseTimeMs: successfulResults.length > 0
      ? Math.max(...successfulResults.map(r => r.durationMs))
      : 0,
    totalDurationMs: totalDuration,
    testsPerSecond: results.length / (totalDuration / 1000)
  };

  const summaryPath = path.join(outputDir, 'benchmark-summary.json');
  const detailsPath = path.join(outputDir, 'benchmark-details.json');

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  fs.writeFileSync(detailsPath, JSON.stringify({ summary, results }, null, 2));

  console.log(`\n💾 Results saved:`);
  console.log(`  Summary: ${summaryPath}`);
  console.log(`  Details: ${detailsPath}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Benchmark Complete!');
  console.log('='.repeat(80));
  console.log();
}

// Run benchmark
runBenchmark().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
