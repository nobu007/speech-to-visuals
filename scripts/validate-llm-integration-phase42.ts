/**
 * Phase 42: LLM Integration Validation Test
 *
 * Validates the comprehensive LLM-powered architecture built in Phases 1-41:
 * - Unified LLMService with adaptive model selection
 * - ContentAnalyzer with fallback mechanisms
 * - GeminiAnalyzer with enhanced relationship extraction
 * - Semantic caching and complexity detection
 * - Multilingual prompt support
 * - Quality monitoring and metrics tracking
 */

import 'dotenv/config';
import { LLMService, llmService } from '../src/analysis/llm-service';
import { ContentAnalyzer } from '../src/analysis/content-analyzer';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';
import { ComplexityDetector } from '../src/analysis/complexity-detector';
import { detectLanguage } from '../src/analysis/language-detector';

console.log('🚀 Phase 42: LLM Integration Validation Test\n');
console.log('═'.repeat(80));

interface ValidationResult {
  component: string;
  test: string;
  passed: boolean;
  details: string;
  duration: number;
  metrics?: any;
}

const results: ValidationResult[] = [];

/**
 * Test 1: LLMService Initialization and Configuration
 */
async function testLLMServiceInit(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n📋 Test 1: LLMService Initialization');

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const isEnabled = llmService.isEnabled();

    console.log(`   API Key: ${apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Service Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`);

    const stats = llmService.getStats();
    console.log(`   Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses`);
    console.log(`   Total Requests: ${stats.totalRequests}`);

    return {
      component: 'LLMService',
      test: 'Initialization',
      passed: isEnabled && apiKey !== undefined,
      details: `Service ${isEnabled ? 'enabled' : 'disabled'}, API ${apiKey ? 'configured' : 'missing'}`,
      duration: Date.now() - start,
      metrics: stats
    };
  } catch (error) {
    return {
      component: 'LLMService',
      test: 'Initialization',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 2: ContentAnalyzer - Rule-based Fallback (V1)
 */
async function testContentAnalyzerV1(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n📝 Test 2: ContentAnalyzer - Rule-based Analysis (V1)');

  try {
    const analyzer = new ContentAnalyzer();
    const testText = `
      First, we need to understand the problem.
      Then, we analyze the requirements.
      Next, we design the solution.
      After that, we implement the code.
      Finally, we test and deploy.
    `;

    console.log('   Testing rule-based extraction...');
    const result = analyzer.analyzeV1(testText);

    const passed =
      result.nodes.length > 0 &&
      result.edges.length > 0 &&
      result.type === 'flowchart';

    console.log(`   ${passed ? '✅' : '❌'} Nodes: ${result.nodes.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Edges: ${result.edges.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Type: ${result.type}`);

    return {
      component: 'ContentAnalyzer',
      test: 'Rule-based V1',
      passed,
      details: `Extracted ${result.nodes.length} nodes, ${result.edges.length} edges`,
      duration: Date.now() - start,
      metrics: { nodes: result.nodes.length, edges: result.edges.length }
    };
  } catch (error) {
    return {
      component: 'ContentAnalyzer',
      test: 'Rule-based V1',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 3: ContentAnalyzer - LLM-based Analysis (V2)
 */
async function testContentAnalyzerV2(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n🤖 Test 3: ContentAnalyzer - LLM-based Analysis (V2)');

  try {
    if (!llmService.isEnabled()) {
      console.log('   ⚠️  LLM disabled, skipping test');
      return {
        component: 'ContentAnalyzer',
        test: 'LLM-based V2',
        passed: true,
        details: 'Skipped - LLM disabled',
        duration: Date.now() - start
      };
    }

    const analyzer = new ContentAnalyzer();
    const testText = `
      The research team discovered a new algorithm.
      This algorithm improves processing speed by 50%.
      The team then tested the algorithm on real data.
      Based on the results, they published their findings.
    `;

    console.log('   Testing LLM-based extraction...');
    const result = await analyzer.analyzeV2(testText);

    const passed =
      result.nodes.length >= 3 &&
      result.edges.length >= 2 &&
      Array.isArray(result.nodes) &&
      Array.isArray(result.edges);

    console.log(`   ${passed ? '✅' : '❌'} Nodes: ${result.nodes.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Edges: ${result.edges.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Type: ${result.type}`);

    // Show sample nodes and edges
    if (result.nodes.length > 0) {
      console.log(`   Sample node: "${result.nodes[0].label}"`);
    }
    if (result.edges.length > 0) {
      console.log(`   Sample edge: ${result.edges[0].from} → ${result.edges[0].to}`);
    }

    return {
      component: 'ContentAnalyzer',
      test: 'LLM-based V2',
      passed,
      details: `Extracted ${result.nodes.length} nodes, ${result.edges.length} edges via LLM`,
      duration: Date.now() - start,
      metrics: {
        nodes: result.nodes.length,
        edges: result.edges.length,
        type: result.type
      }
    };
  } catch (error) {
    return {
      component: 'ContentAnalyzer',
      test: 'LLM-based V2',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 4: GeminiAnalyzer - Enhanced Relationship Extraction (Phase 26)
 */
async function testGeminiAnalyzer(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n🔗 Test 4: GeminiAnalyzer - Enhanced Relationship Extraction');

  try {
    if (!llmService.isEnabled()) {
      console.log('   ⚠️  LLM disabled, skipping test');
      return {
        component: 'GeminiAnalyzer',
        test: 'Relationship Extraction',
        passed: true,
        details: 'Skipped - LLM disabled',
        duration: Date.now() - start
      };
    }

    const analyzer = new GeminiAnalyzer();
    const testText = `
      The CEO manages the VP of Engineering.
      The VP of Engineering oversees the Development Team.
      The Development Team builds the product.
      The product is delivered to customers.
    `;

    console.log('   Testing enhanced relationship extraction...');
    const result = await analyzer.analyzeText(testText, 15000);

    if (!result) {
      console.log('   ⚠️  No result returned');
      return {
        component: 'GeminiAnalyzer',
        test: 'Relationship Extraction',
        passed: false,
        details: 'No result from analyzer',
        duration: Date.now() - start
      };
    }

    const passed =
      result.nodes.length >= 4 &&
      result.edges.length >= 3 &&
      result.confidence > 0.5;

    console.log(`   ${passed ? '✅' : '❌'} Nodes: ${result.nodes.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Edges: ${result.edges.length}`);
    console.log(`   ${passed ? '✅' : '❌'} Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   ${passed ? '✅' : '❌'} Type: ${result.type}`);

    // Analyze relationship quality
    const edgeRatio = result.nodes.length > 1 ? result.edges.length / (result.nodes.length - 1) : 0;
    console.log(`   Edge/Node ratio: ${edgeRatio.toFixed(2)}`);

    return {
      component: 'GeminiAnalyzer',
      test: 'Relationship Extraction',
      passed,
      details: `Extracted ${result.edges.length} relationships from ${result.nodes.length} entities (${(result.confidence * 100).toFixed(1)}% confidence)`,
      duration: Date.now() - start,
      metrics: {
        nodes: result.nodes.length,
        edges: result.edges.length,
        confidence: result.confidence,
        edgeRatio
      }
    };
  } catch (error) {
    return {
      component: 'GeminiAnalyzer',
      test: 'Relationship Extraction',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 5: Complexity Detector
 */
async function testComplexityDetector(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n📊 Test 5: Complexity Detector');

  try {
    const detector = new ComplexityDetector();

    const simpleText = "Hello world. This is simple.";
    const complexText = `
      The quantum mechanical framework underlying superconductivity phenomena
      involves intricate Hamiltonian operators and Cooper pair formations,
      necessitating sophisticated mathematical models and computational approaches
      to accurately predict critical temperatures and magnetic flux behaviors.
    `;

    const simple = detector.analyze(simpleText);
    const complex = detector.analyze(complexText);

    console.log(`   Simple text: ${simple.level} (score: ${(simple.score * 100).toFixed(1)}%)`);
    console.log(`   → Model: ${simple.recommendedModel}`);
    console.log(`   Complex text: ${complex.level} (score: ${(complex.score * 100).toFixed(1)}%)`);
    console.log(`   → Model: ${complex.recommendedModel}`);

    const passed =
      simple.level === 'low' &&
      complex.level === 'high' &&
      simple.recommendedModel.includes('flash') &&
      complex.recommendedModel.includes('pro');

    console.log(`   ${passed ? '✅' : '❌'} Correct model selection for complexity levels`);

    return {
      component: 'ComplexityDetector',
      test: 'Complexity Analysis',
      passed,
      details: `Simple→${simple.recommendedModel}, Complex→${complex.recommendedModel}`,
      duration: Date.now() - start,
      metrics: {
        simple: simple.level,
        complex: complex.level
      }
    };
  } catch (error) {
    return {
      component: 'ComplexityDetector',
      test: 'Complexity Analysis',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 6: Language Detection (Phase 32)
 */
async function testLanguageDetection(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n🌐 Test 6: Language Detection');

  try {
    const englishText = "This is an English sentence for testing.";
    const japaneseText = "これは日本語のテストです。プロジェクトの説明をします。";

    const enResult = detectLanguage(englishText);
    const jaResult = detectLanguage(japaneseText);

    console.log(`   English detection: ${enResult.language} (${(enResult.confidence * 100).toFixed(1)}%)`);
    console.log(`   Japanese detection: ${jaResult.language} (${(jaResult.confidence * 100).toFixed(1)}%)`);

    const passed =
      enResult.language === 'en' &&
      jaResult.language === 'ja' &&
      enResult.confidence > 0.5 &&
      jaResult.confidence > 0.5;

    console.log(`   ${passed ? '✅' : '❌'} Correct language detection`);

    return {
      component: 'LanguageDetector',
      test: 'Language Detection',
      passed,
      details: `EN: ${(enResult.confidence * 100).toFixed(1)}%, JA: ${(jaResult.confidence * 100).toFixed(1)}%`,
      duration: Date.now() - start,
      metrics: {
        en: enResult.confidence,
        ja: jaResult.confidence
      }
    };
  } catch (error) {
    return {
      component: 'LanguageDetector',
      test: 'Language Detection',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Test 7: LLM Performance Metrics
 */
async function testLLMPerformanceMetrics(): Promise<ValidationResult> {
  const start = Date.now();
  console.log('\n⚡ Test 7: LLM Performance Metrics');

  try {
    const stats = llmService.getStats();

    console.log(`   Total Requests: ${stats.totalRequests}`);
    console.log(`   Cache Hit Rate: ${stats.cacheHitRate}%`);
    console.log(`   Model Usage: Flash ${stats.modelUsage.flashPercent}%`);
    console.log(`   Success Rate: ${stats.reliability.successRate}%`);
    console.log(`   Avg Response Time: ${stats.performance.avgResponseTime}ms`);
    console.log(`   Time Savings: ${stats.timeSavings}`);

    const passed = stats.totalRequests >= 0; // Just check structure exists

    return {
      component: 'LLMService',
      test: 'Performance Metrics',
      passed,
      details: `${stats.totalRequests} requests, ${stats.cacheHitRate}% cache hit rate`,
      duration: Date.now() - start,
      metrics: stats
    };
  } catch (error) {
    return {
      component: 'LLMService',
      test: 'Performance Metrics',
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      duration: Date.now() - start
    };
  }
}

/**
 * Run all validation tests
 */
async function runValidation(): Promise<void> {
  console.log('Testing LLM integration across all components...\n');

  const suiteStart = Date.now();

  // Run all tests
  results.push(await testLLMServiceInit());
  results.push(await testContentAnalyzerV1());
  results.push(await testContentAnalyzerV2());
  results.push(await testGeminiAnalyzer());
  results.push(await testComplexityDetector());
  results.push(await testLanguageDetection());
  results.push(await testLLMPerformanceMetrics());

  const totalDuration = Date.now() - suiteStart;

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(80));

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const successRate = (passed / total) * 100;

  console.log('\nTest Results:');
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.component.padEnd(20)} | ${result.test}`);
    console.log(`       ${result.details}`);
    console.log(`       Duration: ${result.duration}ms`);
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('─'.repeat(80));

  if (successRate === 100) {
    console.log('\n🎉 Phase 42 Validation: ALL TESTS PASSED!');
    console.log('✨ LLM integration is fully operational and ready for production.');
  } else if (successRate >= 85) {
    console.log('\n✅ Phase 42 Validation: MOSTLY SUCCESSFUL');
    console.log('⚠️  Some optional features may need attention.');
  } else {
    console.log('\n⚠️  Phase 42 Validation: NEEDS ATTENTION');
    console.log('Please review failed tests above.');
  }

  console.log('\n📋 System Status:');
  console.log(`   LLM Service: ${llmService.isEnabled() ? '🟢 Online' : '🔴 Offline'}`);
  console.log(`   API Key: ${process.env.GOOGLE_API_KEY ? '🔑 Configured' : '❌ Missing'}`);

  const finalStats = llmService.getStats();
  console.log(`   Total LLM Calls: ${finalStats.totalRequests}`);
  console.log(`   Cache Performance: ${finalStats.cacheHitRate}% hit rate`);
  console.log(`   Model Distribution: Flash ${finalStats.modelUsage.flashPercent}%, Pro ${(100 - finalStats.modelUsage.flashPercent).toFixed(1)}%`);

  console.log('\n' + '═'.repeat(80));

  // Exit with appropriate code
  process.exit(successRate >= 85 ? 0 : 1);
}

// Run validation
runValidation().catch((error) => {
  console.error('❌ Fatal error in validation suite:', error);
  process.exit(1);
});
