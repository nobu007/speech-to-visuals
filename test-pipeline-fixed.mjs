#!/usr/bin/env node

/**
 * Quick test of the fixed SimplePipeline
 * Tests the integration fixes made to SimplePipeline.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🧪 Testing Fixed SimplePipeline Integration');
console.log('=' .repeat(50));

const testResults = {
  buildTest: false,
  importTest: false,
  componentExist: false,
  pipelineStructure: false
};

try {
  // 1. Test build
  console.log('\n1. 🏗️  Testing build...');
  execSync('npm run build', { stdio: 'inherit' });
  testResults.buildTest = true;
  console.log('✅ Build successful');

  // 2. Test that all components exist
  console.log('\n2. 📁 Testing component existence...');
  const requiredComponents = [
    'src/transcription/transcriber.ts',
    'src/analysis/scene-segmenter.ts',
    'src/analysis/diagram-detector.ts',
    'src/visualization/layout-engine.ts',
    'src/pipeline/video-generator.ts',
    'src/pipeline/simple-pipeline.ts',
    'src/framework/continuous-learner.ts'
  ];

  let missingComponents = [];
  for (const component of requiredComponents) {
    if (!fs.existsSync(component)) {
      missingComponents.push(component);
    }
  }

  if (missingComponents.length === 0) {
    testResults.componentExist = true;
    console.log('✅ All required components exist');
  } else {
    console.log('❌ Missing components:', missingComponents);
  }

  // 3. Test import syntax
  console.log('\n3. 📦 Testing import syntax...');
  const simplePipelineContent = fs.readFileSync('src/pipeline/simple-pipeline.ts', 'utf8');

  // Check if the fixed imports are correct
  const checks = [
    {
      check: simplePipelineContent.includes('import { continuousLearner } from \'@/framework/continuous-learner\''),
      name: 'continuous-learner import'
    },
    {
      check: simplePipelineContent.includes('const contentSegments = await this.segmenter.segment('),
      name: 'segmenter method call fixed'
    },
    {
      check: simplePipelineContent.includes('await this.detector.analyze(segment)'),
      name: 'detector method call fixed'
    },
    {
      check: simplePipelineContent.includes('await this.layoutEngine.generateLayout('),
      name: 'layout engine method call fixed'
    },
    {
      check: simplePipelineContent.includes('this.detector = new DiagramDetector();'),
      name: 'detector constructor fixed'
    }
  ];

  let passedChecks = 0;
  for (const { check, name } of checks) {
    if (check) {
      console.log(`  ✅ ${name}`);
      passedChecks++;
    } else {
      console.log(`  ❌ ${name}`);
    }
  }

  if (passedChecks === checks.length) {
    testResults.importTest = true;
    console.log('✅ All integration fixes applied correctly');
  }

  // 4. Test pipeline structure
  console.log('\n4. 🔧 Testing pipeline structure...');

  // Check if the SimplePipeline exports are correct
  if (simplePipelineContent.includes('export const simplePipeline = new SimplePipeline()')) {
    testResults.pipelineStructure = true;
    console.log('✅ SimplePipeline singleton export found');
  } else {
    console.log('❌ SimplePipeline singleton export missing');
  }

} catch (error) {
  console.error('❌ Test failed:', error.message);
}

// Summary
console.log('\n📊 Test Results Summary');
console.log('=' .repeat(30));
for (const [test, passed] of Object.entries(testResults)) {
  console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
}

const allPassed = Object.values(testResults).every(result => result);
console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

if (allPassed) {
  console.log('\n🚀 SimplePipeline integration fixes are working correctly!');
  console.log('📝 Ready for end-to-end testing with real audio files.');
} else {
  console.log('\n🔧 Some issues remain. Please review the failed tests above.');
}

process.exit(allPassed ? 0 : 1);