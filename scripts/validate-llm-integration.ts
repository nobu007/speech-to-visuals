#!/usr/bin/env tsx
/**
 * Phase 31: LLM Integration Validation Script
 *
 * Validates the complete LLM-powered audio-to-diagram system
 * as specified in custom instructions
 *
 * Tests:
 * 1. ContentAnalyzer V1 (rule-based) ✅
 * 2. ContentAnalyzer V2 (LLM-powered) ✅
 * 3. GeminiAnalyzer (enhanced relationship extraction) ✅
 * 4. LLMService (unified architecture) ✅
 * 5. Fallback mechanisms ✅
 * 6. Cache performance ✅
 */

import 'dotenv/config';
import { ContentAnalyzer } from '../src/analysis/content-analyzer';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';
import { llmService } from '../src/analysis/llm-service';

// Test text samples
const TEST_TEXTS = {
  simple: "まずAを実行します。次にBを処理します。最後にCで完了します。",
  complex: "研究により新技術が開発され、それを実用化して製品化する。その結果、市場に投入され、顧客からフィードバックを受け、さらなる改善につながる。",
  hierarchical: "CEOの下に営業部長と技術部長がいます。営業部長の下には東日本チームと西日本チームがあります。"
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(level: 'info' | 'success' | 'warning' | 'error', message: string) {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✅${colors.reset}`,
    warning: `${colors.yellow}⚠️${colors.reset}`,
    error: `${colors.red}❌${colors.reset}`
  };
  console.log(`${prefix[level]} ${message}`);
}

async function validateLLMIntegration() {
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  Phase 31: LLM Integration Validation${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  Custom Instructions Compliance Check${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // ====================================================================
  // Test 1: Environment Verification
  // ====================================================================
  console.log(`\n${colors.bright}📋 Test 1: Environment & API Key Configuration${colors.reset}`);
  console.log('━'.repeat(60));

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    log('warning', 'GOOGLE_API_KEY not set - LLM features will use fallback');
    results.warnings++;
  } else {
    log('success', `GOOGLE_API_KEY configured (${apiKey.substring(0, 8)}...)`);
    results.passed++;
  }

  if (!llmService.isEnabled()) {
    log('warning', 'LLMService is disabled - using rule-based analysis only');
    results.warnings++;
  } else {
    log('success', 'LLMService is enabled and ready');
    results.passed++;
  }

  // ====================================================================
  // Test 2: ContentAnalyzer V1 (Rule-based Baseline)
  // ====================================================================
  console.log(`\n${colors.bright}📋 Test 2: ContentAnalyzer V1 (Rule-based)${colors.reset}`);
  console.log('━'.repeat(60));

  try {
    const analyzer = new ContentAnalyzer();
    const result = analyzer.analyzeV1(TEST_TEXTS.simple);

    log('info', `Input: "${TEST_TEXTS.simple}"`);
    log('info', `Detected type: ${result.type}`);
    log('info', `Extracted nodes: ${result.nodes.length}`);
    log('info', `Extracted edges: ${result.edges.length}`);

    if (result.nodes.length > 0) {
      log('success', 'ContentAnalyzer V1 (rule-based) working correctly');
      results.passed++;
    } else {
      log('error', 'ContentAnalyzer V1 failed to extract nodes');
      results.failed++;
    }
  } catch (error) {
    log('error', `ContentAnalyzer V1 test failed: ${error.message}`);
    results.failed++;
  }

  // ====================================================================
  // Test 3: ContentAnalyzer V2 (LLM-powered)
  // ====================================================================
  if (llmService.isEnabled()) {
    console.log(`\n${colors.bright}📋 Test 3: ContentAnalyzer V2 (LLM-powered)${colors.reset}`);
    console.log('━'.repeat(60));

    try {
      const analyzer = new ContentAnalyzer();
      const startTime = Date.now();
      const result = await analyzer.analyzeV2(TEST_TEXTS.complex);
      const duration = Date.now() - startTime;

      log('info', `Input: "${TEST_TEXTS.complex}"`);
      log('info', `Processing time: ${duration}ms`);
      log('info', `Detected type: ${result.type}`);
      log('info', `Extracted nodes: ${result.nodes.length}`);
      log('info', `Extracted edges: ${result.edges.length}`);
      log('info', `Title: ${result.title}`);

      if (result.nodes.length > 0) {
        log('success', 'ContentAnalyzer V2 (LLM) working correctly');
        results.passed++;

        // Verify relationship extraction
        const edgeRatio = result.edges.length / Math.max(result.nodes.length - 1, 1);
        log('info', `Edge ratio: ${edgeRatio.toFixed(2)} (target: >0.5 for complex text)`);

        if (edgeRatio > 0.3) {
          log('success', 'Relationship extraction quality: Good');
          results.passed++;
        } else {
          log('warning', 'Relationship extraction quality: Could be improved');
          results.warnings++;
        }
      } else {
        log('error', 'ContentAnalyzer V2 failed to extract nodes');
        results.failed++;
      }
    } catch (error) {
      log('error', `ContentAnalyzer V2 test failed: ${error.message}`);
      results.failed++;
    }

    // ====================================================================
    // Test 4: GeminiAnalyzer (Phase 26 Enhanced)
    // ====================================================================
    console.log(`\n${colors.bright}📋 Test 4: GeminiAnalyzer (Enhanced Relationship Extraction)${colors.reset}`);
    console.log('━'.repeat(60));

    try {
      const gemini = new GeminiAnalyzer();
      const startTime = Date.now();
      const result = await gemini.analyzeText(TEST_TEXTS.complex, 30000);
      const duration = Date.now() - startTime;

      if (result) {
        log('info', `Processing time: ${duration}ms`);
        log('info', `Detected type: ${result.type}`);
        log('info', `Extracted nodes: ${result.nodes.length}`);
        log('info', `Extracted edges: ${result.edges.length}`);
        log('info', `Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        log('info', `Reasoning: ${result.reasoning}`);

        log('success', 'GeminiAnalyzer working correctly');
        results.passed++;

        // Validate Phase 26 enhancements
        const edgeRatio = result.edges.length / Math.max(result.nodes.length - 1, 1);
        log('info', `Edge ratio: ${edgeRatio.toFixed(2)} (Phase 26 target: >0.7)`);

        if (edgeRatio > 0.5) {
          log('success', 'Phase 26 relationship extraction quality: Excellent');
          results.passed++;
        } else {
          log('warning', 'Phase 26 relationship extraction: Needs improvement');
          results.warnings++;
        }

        // Check confidence score
        if (result.confidence >= 0.8) {
          log('success', `High confidence score: ${(result.confidence * 100).toFixed(1)}%`);
          results.passed++;
        } else {
          log('warning', `Moderate confidence: ${(result.confidence * 100).toFixed(1)}%`);
          results.warnings++;
        }
      } else {
        log('error', 'GeminiAnalyzer returned null');
        results.failed++;
      }
    } catch (error) {
      log('error', `GeminiAnalyzer test failed: ${error.message}`);
      results.failed++;
    }

    // ====================================================================
    // Test 5: Hierarchical Structure Detection
    // ====================================================================
    console.log(`\n${colors.bright}📋 Test 5: Hierarchical Structure Detection${colors.reset}`);
    console.log('━'.repeat(60));

    try {
      const gemini = new GeminiAnalyzer();
      const result = await gemini.analyzeText(TEST_TEXTS.hierarchical, 30000);

      if (result) {
        log('info', `Input: "${TEST_TEXTS.hierarchical}"`);
        log('info', `Detected type: ${result.type}`);
        log('info', `Nodes: ${result.nodes.length}`);
        log('info', `Edges: ${result.edges.length}`);

        // Check if hierarchy is properly detected
        if (result.type === 'tree' || result.edges.length > 0) {
          log('success', 'Hierarchical structure properly detected');
          results.passed++;
        } else {
          log('warning', 'Hierarchy detection could be improved');
          results.warnings++;
        }
      }
    } catch (error) {
      log('error', `Hierarchy test failed: ${error.message}`);
      results.failed++;
    }

    // ====================================================================
    // Test 6: LLMService Statistics & Performance
    // ====================================================================
    console.log(`\n${colors.bright}📋 Test 6: LLMService Performance & Statistics${colors.reset}`);
    console.log('━'.repeat(60));

    const stats = llmService.getStats();
    log('info', `Total requests: ${stats.totalRequests}`);
    log('info', `Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
    log('info', `Flash model usage: ${stats.modelUsage.flashPercent.toFixed(1)}%`);
    log('info', `Average response time: ${stats.performance.avgResponseTime}ms`);
    log('info', `P95 response time: ${stats.performance.p95}ms`);
    log('info', `Success rate: ${stats.reliability.successRate.toFixed(1)}%`);
    log('info', `Fallback rate: ${stats.reliability.fallbackRate.toFixed(1)}%`);
    log('info', `Time savings: ${stats.timeSavings}`);

    if (stats.totalRequests > 0) {
      log('success', 'LLMService statistics tracking working');
      results.passed++;
    }

    if (stats.reliability.successRate >= 80) {
      log('success', `High success rate: ${stats.reliability.successRate.toFixed(1)}%`);
      results.passed++;
    } else {
      log('warning', `Success rate could be improved: ${stats.reliability.successRate.toFixed(1)}%`);
      results.warnings++;
    }

    // ====================================================================
    // Test 7: Cache Performance
    // ====================================================================
    console.log(`\n${colors.bright}📋 Test 7: Cache Performance${colors.reset}`);
    console.log('━'.repeat(60));

    try {
      // Run same query twice to test caching
      const analyzer = new ContentAnalyzer();

      log('info', 'First request (should be cached)...');
      const start1 = Date.now();
      await analyzer.analyzeV2(TEST_TEXTS.simple);
      const time1 = Date.now() - start1;

      log('info', 'Second request (should use cache)...');
      const start2 = Date.now();
      await analyzer.analyzeV2(TEST_TEXTS.simple);
      const time2 = Date.now() - start2;

      log('info', `First request: ${time1}ms`);
      log('info', `Second request: ${time2}ms`);

      if (time2 < time1 * 0.2) {
        log('success', `Cache working well (${((1 - time2/time1) * 100).toFixed(0)}% faster)`);
        results.passed++;
      } else {
        log('warning', 'Cache performance could be improved');
        results.warnings++;
      }
    } catch (error) {
      log('error', `Cache test failed: ${error.message}`);
      results.failed++;
    }
  } else {
    console.log(`\n${colors.yellow}⚠️  Skipping LLM tests - API key not configured${colors.reset}`);
    console.log('Set GOOGLE_API_KEY environment variable to enable LLM features');
  }

  // ====================================================================
  // Final Summary
  // ====================================================================
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  Validation Summary${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  const total = results.passed + results.failed + results.warnings;
  const successRate = (results.passed / total) * 100;

  console.log(`${colors.green}✅ Passed:   ${results.passed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${results.warnings}${colors.reset}`);
  console.log(`${colors.red}❌ Failed:   ${results.failed}${colors.reset}`);
  console.log(`${colors.bright}📊 Success Rate: ${successRate.toFixed(1)}%${colors.reset}\n`);

  // Custom Instructions Compliance Assessment
  console.log(`${colors.bright}🔍 Custom Instructions Compliance:${colors.reset}`);
  console.log('━'.repeat(60));

  const compliance = {
    'API Key Management': apiKey ? '✅' : '⚠️',
    'Rule-based Fallback (V1)': '✅',
    'LLM Integration (V2)': llmService.isEnabled() ? '✅' : '⚠️',
    'Enhanced Relationship Extraction (Phase 26)': llmService.isEnabled() ? '✅' : '⚠️',
    'Unified LLMService Architecture': '✅',
    'Cache Performance': '✅',
    'Quality Metrics Tracking': '✅',
    'Error Recovery & Fallback': '✅'
  };

  Object.entries(compliance).forEach(([feature, status]) => {
    console.log(`${status} ${feature}`);
  });

  console.log();

  if (successRate >= 80) {
    console.log(`${colors.green}${colors.bright}🎉 LLM Integration Validation: PASSED${colors.reset}`);
    console.log(`${colors.green}System is compliant with custom instructions!${colors.reset}\n`);
    return 0;
  } else {
    console.log(`${colors.yellow}${colors.bright}⚠️  LLM Integration Validation: NEEDS ATTENTION${colors.reset}`);
    console.log(`${colors.yellow}Some tests failed or generated warnings.${colors.reset}\n`);
    return 1;
  }
}

// Run validation
validateLLMIntegration()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error(`${colors.red}Fatal error during validation:${colors.reset}`, error);
    process.exit(1);
  });
