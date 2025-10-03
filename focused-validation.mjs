#!/usr/bin/env node

/**
 * Focused System Validation Test
 * Quick validation of system status and next iteration planning
 */

import { performance } from 'perf_hooks';
import fs from 'fs';

console.log('🚀 Starting Focused System Validation...\n');

const startTime = performance.now();
const results = {
  iteration: 45,
  timestamp: new Date().toISOString(),
  tests: [],
  recommendations: []
};

// Test 1: Check system readiness
console.log('✅ Checking system readiness...');
const systemReady = {
  packageJson: fs.existsSync('package.json'),
  sourceDir: fs.existsSync('src'),
  pipeline: fs.existsSync('src/pipeline/main-pipeline.ts'),
  framework: fs.existsSync('src/framework'),
  documentation: fs.existsSync('.module/ITERATION_LOG.md')
};

const readyScore = Object.values(systemReady).filter(Boolean).length;
results.tests.push({
  name: "System Readiness",
  status: readyScore >= 4 ? "✅ READY" : "⚠️ PARTIAL",
  score: (readyScore / 5) * 100,
  details: systemReady
});

console.log(`   System Readiness: ${readyScore}/5 components ready`);

// Test 2: Check iteration log for current status
console.log('📚 Analyzing iteration history...');
if (fs.existsSync('.module/ITERATION_LOG.md')) {
  const logContent = fs.readFileSync('.module/ITERATION_LOG.md', 'utf8');
  const iterations = (logContent.match(/Iteration \d+/g) || []).length;
  const recentProgress = logContent.includes('2025-10') || logContent.includes('October');
  const qualityMetrics = logContent.includes('Quality') || logContent.includes('品質');

  results.tests.push({
    name: "Development Progress",
    status: iterations >= 40 ? "✅ MATURE" : "⚠️ DEVELOPING",
    score: Math.min(100, (iterations / 40) * 100),
    details: { iterations, recentProgress, qualityMetrics }
  });

  console.log(`   Development Progress: ${iterations} iterations completed`);
} else {
  results.tests.push({
    name: "Development Progress",
    status: "❌ NO LOG",
    score: 0
  });
}

// Test 3: Check next targets
console.log('🎯 Evaluating next targets...');
if (fs.existsSync('.module/NEXT_ITERATION_TARGETS.md')) {
  const targetsContent = fs.readFileSync('.module/NEXT_ITERATION_TARGETS.md', 'utf8');
  const hasSmartOptimization = targetsContent.includes('Smart') || targetsContent.includes('optimization');
  const hasPerformance = targetsContent.includes('Performance') || targetsContent.includes('performance');
  const hasAdvancedFeatures = targetsContent.includes('Advanced') || targetsContent.includes('features');

  const targetQuality = [hasSmartOptimization, hasPerformance, hasAdvancedFeatures].filter(Boolean).length;

  results.tests.push({
    name: "Next Iteration Planning",
    status: targetQuality >= 2 ? "✅ PLANNED" : "⚠️ NEEDS PLANNING",
    score: (targetQuality / 3) * 100,
    details: { hasSmartOptimization, hasPerformance, hasAdvancedFeatures }
  });

  console.log(`   Next Targets: ${targetQuality}/3 major areas planned`);
} else {
  results.tests.push({
    name: "Next Iteration Planning",
    status: "❌ NO TARGETS",
    score: 0
  });
}

// Calculate overall results
const totalScore = results.tests.reduce((sum, test) => sum + test.score, 0) / results.tests.length;
const processingTime = Math.round(performance.now() - startTime);

console.log('\n📊 Validation Summary:');
console.log('='.repeat(50));
console.log(`Overall Score: ${Math.round(totalScore)}%`);
console.log(`Processing Time: ${processingTime}ms`);
console.log(`System Status: ${totalScore >= 90 ? "EXCELLENT" : totalScore >= 75 ? "GOOD" : "NEEDS_WORK"}`);
console.log('='.repeat(50));

// Generate recommendations based on score
if (totalScore >= 90) {
  results.recommendations = [
    "✅ System is ready for advanced iteration development",
    "🎯 Focus on Smart Optimization (Iteration 9)",
    "⚡ Target: Intelligent parameter tuning and caching",
    "⏱️  Estimated time: 2-3 hours for completion"
  ];
} else if (totalScore >= 75) {
  results.recommendations = [
    "⚠️  System is functional but could use improvements",
    "🔧 Address any missing components first",
    "📈 Then proceed with next iteration development",
    "⏱️  Estimated time: 1 hour setup + 2-3 hours development"
  ];
} else {
  results.recommendations = [
    "❌ System needs significant attention",
    "🔨 Fix fundamental issues before new development",
    "📚 Review documentation and ensure completeness",
    "⏱️  Estimated time: 2-4 hours for stabilization"
  ];
}

console.log('\n💡 Recommendations:');
results.recommendations.forEach(rec => console.log(`   ${rec}`));

// Save results
const filename = `focused-validation-${Date.now()}.json`;
fs.writeFileSync(filename, JSON.stringify(results, null, 2));
console.log(`\n💾 Results saved: ${filename}`);

// Determine next action
if (totalScore >= 85) {
  console.log('\n🎉 Ready to proceed with next iteration!');
  process.exit(0);
} else {
  console.log('\n⚠️  Please address recommendations before proceeding.');
  process.exit(1);
}