/**
 * Phase 19: Adaptive LLM Model Selection - Validation Test
 *
 * Tests complexity detection and adaptive model selection
 * Target: 60-75% processing time reduction for simple content
 */

import { ComplexityDetector } from '../src/analysis/complexity-detector';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';

// Test content samples
const testSamples = {
  simple: [
    {
      name: "Simple Sequential Process",
      text: "First, prepare the ingredients. Next, mix them together. Then, cook for 20 minutes. Finally, serve hot."
    },
    {
      name: "Basic List",
      text: "The company has three divisions: Sales, Marketing, and Operations. Each division reports to the CEO."
    },
    {
      name: "Timeline Events",
      text: "In 2020, we started the project. In 2021, we launched the beta. In 2022, we reached 1 million users."
    }
  ],
  moderate: [
    {
      name: "Business Process",
      text: "The customer journey involves multiple touchpoints. First, awareness through marketing campaigns, followed by consideration of product features, then evaluation against competitors, and finally purchase decision influenced by pricing and reviews."
    },
    {
      name: "Technical Overview",
      text: "The system architecture consists of three layers: presentation layer handles user interface, business logic layer processes transactions, and data layer manages persistence. Each layer communicates through well-defined APIs."
    }
  ],
  complex: [
    {
      name: "Technical Architecture",
      text: "The distributed microservices architecture employs event-driven communication patterns utilizing Apache Kafka as the message broker. Service mesh implementation via Istio provides traffic management, security policies, and observability metrics. The data persistence layer leverages PostgreSQL for ACID transactions while Redis serves as the caching layer for frequently accessed data. Kubernetes orchestration enables horizontal pod autoscaling based on CPU and memory utilization metrics, ensuring optimal resource allocation during peak load scenarios."
    },
    {
      name: "Research Abstract",
      text: "This study investigates the correlation between machine learning model complexity and generalization performance across heterogeneous datasets. We hypothesize that architectural regularization through dropout mechanisms and batch normalization layers mitigates overfitting tendencies in deep neural networks. Our experimental methodology employs cross-validation strategies with stratified sampling to ensure statistical significance. Results indicate that ensemble methods combining gradient boosting and random forests achieve superior predictive accuracy compared to individual models, particularly in high-dimensional feature spaces with non-linear decision boundaries."
    }
  ]
};

/**
 * Test 1: Complexity Detection Accuracy
 */
async function testComplexityDetection() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Complexity Detection Accuracy');
  console.log('='.repeat(80) + '\n');

  const detector = new ComplexityDetector();
  let totalTests = 0;
  let correctClassifications = 0;

  for (const [expectedLevel, samples] of Object.entries(testSamples)) {
    console.log(`\n📊 Testing ${expectedLevel.toUpperCase()} content samples:\n`);

    for (const sample of samples) {
      totalTests++;
      const analysis = detector.analyze(sample.text);

      const isCorrect = analysis.level === expectedLevel;
      if (isCorrect) correctClassifications++;

      const icon = isCorrect ? '✅' : '❌';
      console.log(`${icon} "${sample.name}"`);
      console.log(`   Text preview: "${sample.text.substring(0, 80)}..."`);
      console.log(`   Detected level: ${analysis.level} (score: ${(analysis.score * 100).toFixed(1)}%)`);
      console.log(`   Recommended model: ${analysis.recommendedModel}`);
      console.log(`   Reasoning: ${analysis.reasoning}`);
      console.log(`   Factors:`);
      console.log(`     - Vocabulary: ${(analysis.factors.vocabularyComplexity * 100).toFixed(1)}%`);
      console.log(`     - Structure: ${(analysis.factors.structuralComplexity * 100).toFixed(1)}%`);
      console.log(`     - Semantics: ${(analysis.factors.semanticDensity * 100).toFixed(1)}%`);
      console.log(`     - Entities: ${(analysis.factors.entityCount * 100).toFixed(1)}%`);
      console.log(`     - Relations: ${(analysis.factors.relationshipDensity * 100).toFixed(1)}%`);
      console.log('');
    }
  }

  const accuracy = (correctClassifications / totalTests) * 100;
  console.log('\n' + '-'.repeat(80));
  console.log(`\n📈 Complexity Detection Accuracy: ${correctClassifications}/${totalTests} (${accuracy.toFixed(1)}%)`);

  const passed = accuracy >= 70; // 70% accuracy threshold
  console.log(passed ? '✅ TEST 1 PASSED' : '❌ TEST 1 FAILED');

  return { passed, accuracy };
}

/**
 * Test 2: Model Selection Distribution
 */
async function testModelSelectionDistribution() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Model Selection Distribution');
  console.log('='.repeat(80) + '\n');

  const detector = new ComplexityDetector();
  const allSamples = [
    ...testSamples.simple,
    ...testSamples.moderate,
    ...testSamples.complex
  ];

  const analyses = allSamples.map(sample => detector.analyze(sample.text));
  const stats = detector.getComplexityStats(analyses);

  console.log('📊 Model Selection Statistics:\n');
  console.log(`Average complexity score: ${(stats.avgComplexity * 100).toFixed(1)}%`);
  console.log('');
  console.log('Model distribution:');
  Object.entries(stats.modelDistribution).forEach(([model, count]) => {
    const percent = (count / allSamples.length) * 100;
    console.log(`  ${model}: ${count} (${percent.toFixed(1)}%)`);
  });
  console.log('');
  console.log('Complexity level distribution:');
  Object.entries(stats.levelDistribution).forEach(([level, count]) => {
    const percent = (count / allSamples.length) * 100;
    console.log(`  ${level}: ${count} (${percent.toFixed(1)}%)`);
  });

  // Expected: majority should use Flash model (simple + moderate)
  const flashCount = stats.modelDistribution['gemini-2.5-flash'] || 0;
  const flashPercent = (flashCount / allSamples.length) * 100;

  console.log('\n' + '-'.repeat(80));
  console.log(`\n🎯 Flash model usage: ${flashCount}/${allSamples.length} (${flashPercent.toFixed(1)}%)`);
  console.log(`📉 Expected time savings: ~${flashPercent.toFixed(0)}% of requests use faster Flash model`);

  const passed = flashPercent >= 50; // At least 50% should use Flash
  console.log(passed ? '✅ TEST 2 PASSED' : '❌ TEST 2 FAILED');

  return { passed, flashPercent };
}

/**
 * Test 3: End-to-End Integration Test (with actual LLM if API key available)
 */
async function testEndToEndIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: End-to-End Integration Test');
  console.log('='.repeat(80) + '\n');

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('⚠️  GOOGLE_API_KEY not found. Skipping E2E test.');
    console.log('ℹ️  To run this test, set GOOGLE_API_KEY environment variable.');
    return { passed: true, skipped: true };
  }

  const analyzer = new GeminiAnalyzer(apiKey);

  // Test simple content (should use Flash model)
  console.log('Testing simple content with adaptive model selection...\n');
  const simpleText = testSamples.simple[0].text;
  console.log(`Input: "${simpleText.substring(0, 80)}..."\n`);

  const startTime = Date.now();
  const result = await analyzer.analyzeText(simpleText);
  const processingTime = Date.now() - startTime;

  console.log(`\n⏱️  Processing time: ${(processingTime / 1000).toFixed(2)}s`);

  if (result) {
    console.log(`✅ Analysis successful!`);
    console.log(`   Type: ${result.type}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Nodes: ${result.nodes.length}`);
    console.log(`   Edges: ${result.edges.length}`);
  } else {
    console.log(`❌ Analysis failed (may be rate limited or API error)`);
  }

  // Get statistics
  const stats = analyzer.getCacheStats();
  console.log('\n📊 Model Selection Statistics:');
  console.log(`   Total requests: ${stats.modelSelection.totalRequests}`);
  console.log(`   Flash requests: ${stats.modelSelection.flashRequests} (${stats.modelSelection.flashUsagePercent}%)`);
  console.log(`   Pro requests: ${stats.modelSelection.proRequests}`);
  console.log(`   Complexity overrides: ${stats.modelSelection.complexityOverrides} (${stats.modelSelection.overrideRate}%)`);
  console.log(`   Estimated time savings: ${stats.modelSelection.estimatedTimeSavings}`);

  console.log('\n' + '-'.repeat(80));
  const passed = result !== null && processingTime < 60000; // Should complete within 60s
  console.log(passed ? '✅ TEST 3 PASSED' : '❌ TEST 3 FAILED (or rate limited)');

  return { passed, processingTime, result };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  Phase 19: Adaptive LLM Model Selection - Validation Test Suite'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80));

  const results = {
    test1: await testComplexityDetection(),
    test2: await testModelSelectionDistribution(),
    test3: await testEndToEndIntegration()
  };

  // Summary
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + '  TEST SUMMARY'.padEnd(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80) + '\n');

  const totalTests = Object.values(results).filter(r => !r.skipped).length;
  const passedTests = Object.values(results).filter(r => r.passed && !r.skipped).length;

  console.log(`Test 1 (Complexity Detection): ${results.test1.passed ? '✅ PASSED' : '❌ FAILED'} (${results.test1.accuracy.toFixed(1)}% accuracy)`);
  console.log(`Test 2 (Model Distribution): ${results.test2.passed ? '✅ PASSED' : '❌ FAILED'} (${results.test2.flashPercent.toFixed(1)}% Flash usage)`);
  console.log(`Test 3 (E2E Integration): ${results.test3.skipped ? '⏭️  SKIPPED' : results.test3.passed ? '✅ PASSED' : '❌ FAILED'}`);

  console.log('\n' + '-'.repeat(80));
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);

  const allPassed = passedTests === totalTests;
  if (allPassed) {
    console.log('\n✅ Phase 19 validation COMPLETE - All tests passed!');
    console.log('\n📈 Expected Performance Impact:');
    console.log(`   - ${results.test2.flashPercent.toFixed(0)}% of requests use faster Flash model`);
    console.log(`   - Estimated 60-75% time reduction for simple content`);
    console.log(`   - Reduced rate limiting due to optimal model selection`);
    console.log(`   - Lower API costs for simple content processing`);
  } else {
    console.log('\n⚠️  Phase 19 validation INCOMPLETE - Some tests failed');
  }

  console.log('\n' + '█'.repeat(80) + '\n');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
