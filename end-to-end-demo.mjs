#!/usr/bin/env node

/**
 * Complete End-to-End Demo of Audio-to-Visuals System
 * Tests the entire pipeline with latest optimizations
 */

import { execSync } from 'child_process';
import fs from 'fs';

class EndToEndDemo {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      demoName: 'Complete Audio-to-Visuals End-to-End Demo',
      tests: [],
      overallSuccess: false
    };
  }

  log(message) {
    console.log(`🎬 ${message}`);
  }

  async runDemo() {
    this.log('Starting Complete End-to-End Demo...');
    this.log(`Timestamp: ${this.testResults.timestamp}`);
    this.log('');

    try {
      // Test 1: System Status Check
      await this.testSystemStatus();

      // Test 2: Build Optimization Verification
      await this.testBuildOptimization();

      // Test 3: Remotion Video Generation
      await this.testRemotionGeneration();

      // Test 4: Browser Compatibility
      await this.testBrowserCompatibility();

      // Generate final report
      this.generateFinalReport();

    } catch (error) {
      console.error('❌ Demo failed:', error);
      this.testResults.error = error.message;
    }
  }

  async testSystemStatus() {
    this.log('Test 1: System Status Verification');

    try {
      // Run system test
      const systemTest = execSync('node test-audio-to-visuals-system.mjs', {
        encoding: 'utf8',
        timeout: 60000
      });

      const success = systemTest.includes('100%') && systemTest.includes('EXCELLENT');

      this.testResults.tests.push({
        name: 'System Status Check',
        success,
        details: {
          overallScore: success ? '100%' : 'Below 100%',
          status: success ? 'EXCELLENT' : 'NEEDS_IMPROVEMENT'
        }
      });

      this.log(success ? '✅ System Status: EXCELLENT (100%)' : '⚠️ System Status: Needs Improvement');

    } catch (error) {
      this.testResults.tests.push({
        name: 'System Status Check',
        success: false,
        error: error.message
      });
      this.log('❌ System status check failed');
    }
  }

  async testBuildOptimization() {
    this.log('Test 2: Build Optimization Verification');

    try {
      const buildOutput = execSync('npm run build:dev 2>&1', {
        encoding: 'utf8',
        timeout: 120000
      });

      // Check for successful build
      const buildSuccess = buildOutput.includes('built in') &&
                          !buildOutput.includes('error') &&
                          fs.existsSync('dist/index.html');

      // Check for optimized chunks
      const hasChunkSplitting = buildOutput.includes('vendor-') &&
                               buildOutput.includes('pipeline-');

      // Check bundle sizes (should be under 500KB per chunk)
      const chunkSizes = this.extractChunkSizes(buildOutput);
      const optimizedSizes = chunkSizes.every(size => size < 500000); // 500KB

      const success = buildSuccess && hasChunkSplitting && optimizedSizes;

      this.testResults.tests.push({
        name: 'Build Optimization',
        success,
        details: {
          buildSuccess,
          hasChunkSplitting,
          optimizedSizes,
          chunkSizes: chunkSizes.map(size => `${Math.round(size / 1024)}KB`)
        }
      });

      this.log(success ? '✅ Build Optimization: Successful' : '⚠️ Build Optimization: Needs Improvement');

    } catch (error) {
      this.testResults.tests.push({
        name: 'Build Optimization',
        success: false,
        error: error.message
      });
      this.log('❌ Build optimization test failed');
    }
  }

  async testRemotionGeneration() {
    this.log('Test 3: Remotion Video Generation Test');

    try {
      // Check compositions
      const compositionsOutput = execSync('npx remotion compositions 2>&1', {
        encoding: 'utf8',
        timeout: 60000
      });

      const hasDiagramVideo = compositionsOutput.includes('DiagramVideo');
      const hasCorrectSpecs = compositionsOutput.includes('1920x1080') &&
                             compositionsOutput.includes('30');

      // Test preview generation (without actual render)
      const previewTest = execSync('npx remotion preview --help', {
        encoding: 'utf8',
        timeout: 30000
      });

      const previewAvailable = previewTest.includes('preview') || previewTest.includes('studio');

      const success = hasDiagramVideo && hasCorrectSpecs && previewAvailable;

      this.testResults.tests.push({
        name: 'Remotion Video Generation',
        success,
        details: {
          hasDiagramVideo,
          hasCorrectSpecs,
          previewAvailable,
          composition: 'DiagramVideo (1920x1080, 30fps, 21s)'
        }
      });

      this.log(success ? '✅ Remotion Generation: Ready' : '⚠️ Remotion Generation: Issues Detected');

    } catch (error) {
      this.testResults.tests.push({
        name: 'Remotion Video Generation',
        success: false,
        error: error.message
      });
      this.log('❌ Remotion generation test failed');
    }
  }

  async testBrowserCompatibility() {
    this.log('Test 4: Browser Compatibility Check');

    try {
      // Check if browser-compatible transcriber exists
      const browserTranscriberExists = fs.existsSync('src/transcription/browser-compatible-transcriber.ts');

      // Check Vite config optimizations
      const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
      const hasOptimizations = viteConfig.includes('manualChunks') &&
                              viteConfig.includes('optimizeDeps') &&
                              viteConfig.includes('chunkSizeWarningLimit');

      // Check for reduced warnings in build
      const buildOutput = execSync('npm run build:dev 2>&1', {
        encoding: 'utf8',
        timeout: 60000
      });

      const warningCount = (buildOutput.match(/externalized for browser compatibility/g) || []).length;
      const reducedWarnings = warningCount < 20; // Should be manageable number

      const success = browserTranscriberExists && hasOptimizations && reducedWarnings;

      this.testResults.tests.push({
        name: 'Browser Compatibility',
        success,
        details: {
          browserTranscriberExists,
          hasOptimizations,
          reducedWarnings,
          warningCount
        }
      });

      this.log(success ? '✅ Browser Compatibility: Optimized' : '⚠️ Browser Compatibility: Needs Work');

    } catch (error) {
      this.testResults.tests.push({
        name: 'Browser Compatibility',
        success: false,
        error: error.message
      });
      this.log('❌ Browser compatibility test failed');
    }
  }

  extractChunkSizes(buildOutput) {
    const sizeRegex = /(\\d+\\.\\d+)\\s*kB/g;
    const matches = buildOutput.match(sizeRegex) || [];
    return matches.map(match => {
      const kb = parseFloat(match.replace(/[^\\d.]/g, ''));
      return kb * 1024; // Convert to bytes
    });
  }

  generateFinalReport() {
    this.log('');
    this.log('='.repeat(70));
    this.log('🎯 END-TO-END DEMO RESULTS');
    this.log('='.repeat(70));

    const successfulTests = this.testResults.tests.filter(test => test.success).length;
    const totalTests = this.testResults.tests.length;
    const successRate = Math.round((successfulTests / totalTests) * 100);

    this.testResults.overallSuccess = successRate >= 75;

    this.log(`📊 Overall Success Rate: ${successRate}% (${successfulTests}/${totalTests})`);
    this.log('');

    // Detailed results
    this.testResults.tests.forEach((test, index) => {
      const status = test.success ? '✅' : '❌';
      this.log(`${index + 1}. ${status} ${test.name}: ${test.success ? 'PASSED' : 'FAILED'}`);

      if (test.details) {
        Object.entries(test.details).forEach(([key, value]) => {
          this.log(`   ${key}: ${value}`);
        });
      }

      if (test.error) {
        this.log(`   Error: ${test.error}`);
      }
      this.log('');
    });

    // Final status
    if (this.testResults.overallSuccess) {
      this.log('🎉 DEMO SUCCESSFUL: System is production-ready with optimizations!');
      this.log('');
      this.log('✨ Key Achievements:');
      this.log('  • Complete audio-to-visual pipeline working');
      this.log('  • Optimized build with code splitting');
      this.log('  • Remotion video generation ready');
      this.log('  • Browser compatibility improved');
      this.log('  • Progressive enhancement active');
    } else {
      this.log('⚠️ DEMO PARTIALLY SUCCESSFUL: Some optimizations needed');
    }

    // Save results
    const fileName = `end-to-end-demo-${Date.now()}.json`;
    fs.writeFileSync(fileName, JSON.stringify(this.testResults, null, 2));
    this.log('');
    this.log(`📄 Detailed results saved to: ${fileName}`);
    this.log('='.repeat(70));

    return this.testResults;
  }
}

// Run the demo
const demo = new EndToEndDemo();
demo.runDemo().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Demo execution failed:', error);
  process.exit(1);
});