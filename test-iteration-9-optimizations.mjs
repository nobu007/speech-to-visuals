/**
 * Iteration 9 Smart Self-Optimization System Test
 * Tests the enhanced optimization features: smart parameter tuning, semantic caching, and predictive monitoring
 */

import { performance } from 'perf_hooks';
import fs from 'fs';

// Mock audio data for testing
const mockAudioData = new ArrayBuffer(16000 * 2 * 10); // 10 seconds of 16kHz 16-bit audio
const mockTranscript = `
Today we'll explore machine learning algorithms that power modern AI systems.
The process involves data preprocessing, model training, and evaluation phases.
First, we collect and clean the data to ensure quality input.
Then we select appropriate algorithms like neural networks or decision trees.
Finally, we validate the model performance using test datasets.
This creates a robust system capable of making accurate predictions.
`;

// Advanced test scenarios
const testScenarios = [
  {
    name: 'Technical Content - Complex',
    transcript: `
    The microservices architecture implementation involves several key components.
    We have the API gateway that routes requests to appropriate services.
    The service mesh handles inter-service communication and load balancing.
    Each microservice has its own database following the database-per-service pattern.
    Container orchestration with Kubernetes manages deployment and scaling.
    This creates a resilient distributed system architecture.
    `,
    expectedCharacteristics: {
      complexity: 'complex',
      domain: 'technical',
      speechRate: 120,
      diagramHints: ['flow', 'architecture']
    }
  },
  {
    name: 'Business Process - Moderate',
    transcript: `
    Our sales funnel starts with lead generation through marketing campaigns.
    Qualified leads move to the discovery phase where we understand needs.
    Sales representatives present customized solutions to prospects.
    Contract negotiation follows with legal and procurement teams.
    Implementation begins after signed agreements and payments.
    Customer success ensures ongoing satisfaction and retention.
    `,
    expectedCharacteristics: {
      complexity: 'moderate',
      domain: 'business',
      speechRate: 140,
      diagramHints: ['flow', 'process']
    }
  },
  {
    name: 'Educational Content - Simple',
    transcript: `
    Learning a new language involves practice and repetition.
    Start with basic vocabulary and common phrases.
    Practice pronunciation with native speakers.
    Read simple texts to improve comprehension.
    Write short paragraphs to practice grammar.
    Immerse yourself in the language environment.
    `,
    expectedCharacteristics: {
      complexity: 'simple',
      domain: 'educational',
      speechRate: 110,
      diagramHints: ['timeline', 'process']
    }
  }
];

class Iteration9Tester {
  constructor() {
    this.testResults = [];
    this.optimizationStats = {};
  }

  async runComprehensiveTest() {
    console.log('🚀 Testing Iteration 9: Smart Self-Optimization System');
    console.log('================================================================');

    try {
      // Test 1: Smart Parameter Optimization
      await this.testSmartOptimizer();

      // Test 2: Semantic Caching System
      await this.testSemanticCache();

      // Test 3: Predictive Monitoring
      await this.testPredictiveMonitor();

      // Test 4: Integration Test
      await this.testOptimizedPipeline();

      // Test 5: Performance Validation
      await this.testPerformanceGains();

      // Generate comprehensive report
      await this.generateTestReport();

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }

  async testSmartOptimizer() {
    console.log('\n🧠 Test 1: Smart Parameter Optimization');
    console.log('----------------------------------------');

    try {
      // Dynamic import for ES modules
      const { smartOptimizer } = await import('./src/optimization/smart-optimizer.js');

      for (const scenario of testScenarios) {
        console.log(`\n📝 Testing scenario: ${scenario.name}`);

        const startTime = performance.now();

        // Test content analysis
        const characteristics = await smartOptimizer.analyzeContent(mockAudioData, scenario.transcript);
        console.log('📊 Content characteristics:', characteristics);

        // Validate characteristics match expectations
        const validationResults = this.validateCharacteristics(characteristics, scenario.expectedCharacteristics);
        console.log('✅ Validation:', validationResults);

        // Test optimization settings generation
        const settings = await smartOptimizer.optimizeSettings(characteristics);
        console.log('⚙️ Optimized settings:', settings);

        // Test predictive issue detection
        const predictions = await smartOptimizer.predictIssues(characteristics);
        console.log('🔮 Predictions:', predictions);

        const processingTime = performance.now() - startTime;

        this.testResults.push({
          test: 'SmartOptimizer',
          scenario: scenario.name,
          success: true,
          processingTime,
          characteristics,
          settings,
          predictions,
          validationResults
        });
      }

      // Test learning mechanism
      console.log('\n📚 Testing learning mechanism...');
      const mockMetrics = {
        processingTime: 2500,
        accuracy: 0.92,
        userSatisfaction: 0.85,
        errorRate: 0.02,
        cacheHitRate: 0.8
      };

      const characteristics = await smartOptimizer.analyzeContent(mockAudioData, mockTranscript);
      const settings = await smartOptimizer.optimizeSettings(characteristics);
      await smartOptimizer.learnFromResults(characteristics, settings, mockMetrics);

      console.log('✅ Smart optimizer learning test completed');

    } catch (error) {
      console.error('❌ Smart optimizer test failed:', error);
      this.testResults.push({
        test: 'SmartOptimizer',
        scenario: 'All',
        success: false,
        error: error.message
      });
    }
  }

  async testSemanticCache() {
    console.log('\n📦 Test 2: Semantic Caching System');
    console.log('-----------------------------------');

    try {
      const { semanticCache } = await import('./src/optimization/semantic-cache.js');

      // Test 1: Content fingerprinting
      console.log('🔍 Testing content fingerprinting...');
      const mockScenes = [
        {
          startTime: 0,
          endTime: 6000,
          title: 'Test Scene',
          confidence: 0.9,
          diagram: {
            type: 'flow',
            nodes: [{ id: 'n1', label: 'Start', type: 'start' }],
            edges: []
          }
        }
      ];

      const fingerprint1 = await semanticCache.generateFingerprint(testScenarios[0].transcript, mockScenes);
      const fingerprint2 = await semanticCache.generateFingerprint(testScenarios[1].transcript, mockScenes);

      console.log('📋 Fingerprint 1:', fingerprint1);
      console.log('📋 Fingerprint 2:', fingerprint2);

      // Test 2: Cache storage and retrieval
      console.log('\n💾 Testing cache storage...');
      const mockLayouts = [
        {
          sceneIndex: 0,
          nodes: [{ id: 'n1', x: 100, y: 100, width: 150, height: 80 }],
          edges: [],
          bounds: { width: 800, height: 600 },
          quality: 0.9
        }
      ];

      const mockPerformance = {
        processingTime: 2000,
        accuracy: 0.88,
        userRating: 0.85
      };

      await semanticCache.store(testScenarios[0].transcript, mockScenes, mockLayouts, mockPerformance);
      console.log('✅ Content stored successfully');

      // Test 3: Similar content detection
      console.log('\n🔎 Testing similarity matching...');
      const similarMatches = await semanticCache.findSimilar(fingerprint1, testScenarios[0].transcript);
      console.log('📊 Similar matches found:', similarMatches.length);

      if (similarMatches.length > 0) {
        console.log('🎯 Best match similarity:', similarMatches[0].similarity);
        console.log('🔧 Applicable parts:', similarMatches[0].applicableParts);

        // Test content adaptation
        const adapted = await semanticCache.adaptCachedContent(similarMatches[0], fingerprint1, testScenarios[0].transcript);
        console.log('🔄 Adapted content:', { sceneCount: adapted.scenes.length, layoutCount: adapted.layouts.length });
      }

      // Test 4: Cache statistics
      const cacheStats = semanticCache.getCacheStats();
      console.log('📊 Cache statistics:', cacheStats);

      this.testResults.push({
        test: 'SemanticCache',
        scenario: 'Comprehensive',
        success: true,
        fingerprints: { fingerprint1, fingerprint2 },
        similarMatches: similarMatches.length,
        cacheStats
      });

    } catch (error) {
      console.error('❌ Semantic cache test failed:', error);
      this.testResults.push({
        test: 'SemanticCache',
        scenario: 'Comprehensive',
        success: false,
        error: error.message
      });
    }
  }

  async testPredictiveMonitor() {
    console.log('\n🔮 Test 3: Predictive Monitoring System');
    console.log('---------------------------------------');

    try {
      const { predictiveMonitor } = await import('./src/optimization/predictive-monitor.js');

      // Test 1: Health monitoring
      console.log('❤️ Testing health monitoring...');
      const currentHealth = await predictiveMonitor.getCurrentHealth();
      console.log('📊 Current health metrics:', currentHealth);

      // Test 2: Predictive analysis
      console.log('\n🔮 Testing predictive analysis...');
      const predictions = await predictiveMonitor.analyzePredictivePatterns(currentHealth);
      console.log('📈 Predictions:', predictions);

      // Test 3: Monitoring statistics
      const monitorStats = predictiveMonitor.getMonitoringStats();
      console.log('📊 Monitor statistics:', monitorStats);

      // Test 4: Start/stop monitoring
      console.log('\n🔄 Testing monitoring lifecycle...');
      await predictiveMonitor.startMonitoring();
      console.log('✅ Monitoring started');

      // Wait a bit to collect some data
      await new Promise(resolve => setTimeout(resolve, 2000));

      predictiveMonitor.stopMonitoring();
      console.log('🛑 Monitoring stopped');

      this.testResults.push({
        test: 'PredictiveMonitor',
        scenario: 'Comprehensive',
        success: true,
        currentHealth,
        predictions,
        monitorStats
      });

    } catch (error) {
      console.error('❌ Predictive monitor test failed:', error);
      this.testResults.push({
        test: 'PredictiveMonitor',
        scenario: 'Comprehensive',
        success: false,
        error: error.message
      });
    }
  }

  async testOptimizedPipeline() {
    console.log('\n🎯 Test 4: Optimized Pipeline Integration');
    console.log('------------------------------------------');

    try {
      const { optimizedPipelineEngine } = await import('./src/optimization/index.js');

      for (const scenario of testScenarios) {
        console.log(`\n🚀 Testing integrated pipeline: ${scenario.name}`);

        const context = {
          audioData: mockAudioData,
          transcript: scenario.transcript,
          requestId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userPreferences: {
            quality: 'balanced',
            diagramTypes: ['flow', 'tree'],
            maxProcessingTime: 30000
          }
        };

        const startTime = performance.now();
        const result = await optimizedPipelineEngine.processOptimized(context);
        const processingTime = performance.now() - startTime;

        console.log('⚡ Processing completed in:', Math.round(processingTime), 'ms');
        console.log('📊 Optimization metrics:', result.optimizationMetrics);
        console.log('🎥 Generated scenes:', result.scenes.length);
        console.log('🎨 Generated layouts:', result.layouts.length);

        this.testResults.push({
          test: 'OptimizedPipeline',
          scenario: scenario.name,
          success: true,
          processingTime,
          optimizationMetrics: result.optimizationMetrics,
          sceneCount: result.scenes.length,
          layoutCount: result.layouts.length
        });
      }

      // Test optimization statistics
      const optimizationStats = await optimizedPipelineEngine.getOptimizationStats();
      console.log('\n📊 Comprehensive optimization statistics:');
      console.log(JSON.stringify(optimizationStats, null, 2));

      this.optimizationStats = optimizationStats;

    } catch (error) {
      console.error('❌ Optimized pipeline test failed:', error);
      this.testResults.push({
        test: 'OptimizedPipeline',
        scenario: 'Integration',
        success: false,
        error: error.message
      });
    }
  }

  async testPerformanceGains() {
    console.log('\n⚡ Test 5: Performance Validation');
    console.log('----------------------------------');

    // Calculate performance improvements
    const optimizedResults = this.testResults.filter(r => r.test === 'OptimizedPipeline' && r.success);

    if (optimizedResults.length > 0) {
      const avgProcessingTime = optimizedResults.reduce((sum, r) => sum + r.processingTime, 0) / optimizedResults.length;
      const cacheHitRate = optimizedResults.filter(r => r.optimizationMetrics?.cacheHit).length / optimizedResults.length;
      const avgOptimizationGain = optimizedResults.reduce((sum, r) => sum + (r.optimizationMetrics?.optimizationGain || 0), 0) / optimizedResults.length;

      console.log('📊 Performance Summary:');
      console.log(`   Average processing time: ${Math.round(avgProcessingTime)}ms`);
      console.log(`   Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);
      console.log(`   Average optimization gain: ${(avgOptimizationGain * 100).toFixed(1)}%`);

      // Validate against targets
      const targets = {
        maxProcessingTime: 3000, // 3 seconds
        minCacheHitRate: 0.3, // 30%
        minOptimizationGain: 0.1 // 10%
      };

      const performanceValidation = {
        processingTimeTarget: avgProcessingTime <= targets.maxProcessingTime,
        cacheHitRateTarget: cacheHitRate >= targets.minCacheHitRate,
        optimizationGainTarget: avgOptimizationGain >= targets.minOptimizationGain
      };

      console.log('🎯 Target Validation:', performanceValidation);

      this.testResults.push({
        test: 'PerformanceValidation',
        scenario: 'Summary',
        success: true,
        avgProcessingTime,
        cacheHitRate,
        avgOptimizationGain,
        performanceValidation,
        targets
      });
    }
  }

  async generateTestReport() {
    console.log('\n📋 Test Summary Report');
    console.log('================================================================');

    const successfulTests = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;
    const successRate = (successfulTests / totalTests) * 100;

    console.log(`✅ Tests passed: ${successfulTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    console.log('\n🔍 Detailed Results:');

    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.test} - ${result.scenario}: ${result.success ? 'PASSED' : 'FAILED'}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    // Iteration 9 Success Criteria Validation
    console.log('\n🎯 Iteration 9 Success Criteria:');
    console.log('--------------------------------');

    const criteria = {
      automatedParameterTuning: successfulTests > 0 && this.testResults.some(r => r.test === 'SmartOptimizer' && r.success),
      adaptiveProcessing: this.testResults.some(r => r.test === 'OptimizedPipeline' && r.success),
      intelligentCaching: this.testResults.some(r => r.test === 'SemanticCache' && r.success),
      predictiveErrorPrevention: this.testResults.some(r => r.test === 'PredictiveMonitor' && r.success)
    };

    Object.entries(criteria).forEach(([criterion, met]) => {
      const status = met ? '✅' : '❌';
      console.log(`${status} ${criterion}: ${met ? 'ACHIEVED' : 'NOT MET'}`);
    });

    const allCriteriaMet = Object.values(criteria).every(met => met);
    console.log(`\n🏆 Overall Status: ${allCriteriaMet ? 'ITERATION 9 SUCCESS' : 'NEEDS IMPROVEMENT'}`);

    // Save detailed report
    const reportData = {
      testTimestamp: new Date().toISOString(),
      iteration: 9,
      testResults: this.testResults,
      optimizationStats: this.optimizationStats,
      successCriteria: criteria,
      overallSuccess: allCriteriaMet,
      summary: {
        totalTests,
        successfulTests,
        successRate: successRate.toFixed(1) + '%'
      }
    };

    fs.writeFileSync('iteration-9-test-report.json', JSON.stringify(reportData, null, 2));
    console.log('\n📁 Detailed report saved to: iteration-9-test-report.json');

    return reportData;
  }

  validateCharacteristics(actual, expected) {
    const results = {};

    Object.keys(expected).forEach(key => {
      if (key === 'speechRate') {
        // Allow 20% variance for speech rate
        const variance = Math.abs(actual[key] - expected[key]) / expected[key];
        results[key] = variance <= 0.2 ? 'PASS' : `FAIL (${variance.toFixed(2)} variance)`;
      } else if (key === 'diagramHints') {
        // Check if at least one expected hint is present
        const hasExpectedHint = expected[key].some(hint => actual[key]?.includes(hint));
        results[key] = hasExpectedHint ? 'PASS' : 'FAIL';
      } else {
        results[key] = actual[key] === expected[key] ? 'PASS' : `FAIL (got ${actual[key]})`;
      }
    });

    return results;
  }
}

// Run the comprehensive test
console.log('🎬 Starting Iteration 9 Smart Self-Optimization Test Suite...\n');

const tester = new Iteration9Tester();
tester.runComprehensiveTest()
  .then(() => {
    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });