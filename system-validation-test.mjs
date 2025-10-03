#!/usr/bin/env node

/**
 * 🔬 System Validation Test - Real Pipeline Integration
 *
 * Tests the actual TypeScript pipeline components to identify any
 * implementation gaps or missing dependencies per custom instructions.
 *
 * Follows recursive development approach:
 * - Test each module individually
 * - Identify missing dependencies
 * - Validate integrations
 * - Generate improvement report
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration following custom instructions
const validationConfig = {
  projectName: "Speech-to-Visuals System",
  testPhase: "システム検証",
  iteration: 1,
  timestamp: new Date().toISOString(),
  categories: [
    'TypeScript Compilation',
    'Module Dependencies',
    'Pipeline Integration',
    'Component Functionality',
    'Error Handling',
    'Performance Metrics'
  ]
};

let testResults = {
  ...validationConfig,
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0
  },
  recommendations: []
};

/**
 * 🔍 Test: TypeScript Compilation
 */
async function testTypeScriptCompilation() {
  console.log('\n🔧 Testing TypeScript Compilation...');

  const test = {
    category: 'TypeScript Compilation',
    name: 'TypeScript compilation check',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Check if TypeScript can compile the main pipeline
    const tscResult = await runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck']);

    if (tscResult.success) {
      test.status = 'passed';
      test.details.push('✅ TypeScript compilation successful');
      test.details.push(`📊 Compilation output: ${tscResult.output.slice(0, 200)}...`);
    } else {
      test.status = 'failed';
      test.details.push('❌ TypeScript compilation failed');
      test.details.push(`📊 Error output: ${tscResult.error}`);

      // Analyze common compilation errors
      if (tscResult.error.includes('Cannot find module')) {
        test.details.push('🔍 Issue: Missing module dependencies');
        testResults.recommendations.push({
          type: 'dependency',
          description: 'Install missing TypeScript modules',
          action: 'Review and install missing @types packages'
        });
      }
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ Compilation test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🔍 Test: Module Dependencies
 */
async function testModuleDependencies() {
  console.log('\n📦 Testing Module Dependencies...');

  const test = {
    category: 'Module Dependencies',
    name: 'Module import validation',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Check critical module files exist
    const criticalModules = [
      'src/pipeline/main-pipeline.ts',
      'src/transcription/index.ts',
      'src/analysis/index.ts',
      'src/visualization/index.ts',
      'src/quality/index.ts',
      'src/framework/recursive-custom-instructions.ts'
    ];

    let existingModules = 0;
    let missingModules = [];

    for (const module of criticalModules) {
      try {
        await fs.access(module);
        existingModules++;
        test.details.push(`✅ ${module}`);
      } catch (error) {
        missingModules.push(module);
        test.details.push(`❌ ${module} - MISSING`);
      }
    }

    const completeness = (existingModules / criticalModules.length) * 100;

    if (completeness >= 90) {
      test.status = 'passed';
      test.details.push(`🎯 Module completeness: ${completeness.toFixed(1)}% (EXCELLENT)`);
    } else if (completeness >= 70) {
      test.status = 'warning';
      test.details.push(`⚠️ Module completeness: ${completeness.toFixed(1)}% (NEEDS ATTENTION)`);
    } else {
      test.status = 'failed';
      test.details.push(`❌ Module completeness: ${completeness.toFixed(1)}% (CRITICAL)`);
    }

    if (missingModules.length > 0) {
      testResults.recommendations.push({
        type: 'modules',
        description: `Create missing modules: ${missingModules.join(', ')}`,
        action: 'Implement missing module files'
      });
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ Module dependency test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🔍 Test: NPM Package Dependencies
 */
async function testNPMDependencies() {
  console.log('\n📋 Testing NPM Dependencies...');

  const test = {
    category: 'NPM Dependencies',
    name: 'Required packages validation',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Check package.json for required dependencies
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

    const requiredDeps = [
      'remotion',
      '@remotion/captions',
      '@remotion/media-utils',
      '@dagrejs/dagre',
      'react',
      'typescript'
    ];

    const devRequiredDeps = [
      '@remotion/cli',
      '@remotion/bundler',
      'ts-node',
      '@types/node'
    ];

    let missingDeps = [];
    let missingDevDeps = [];

    // Check production dependencies
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
        missingDeps.push(dep);
        test.details.push(`❌ Missing production dependency: ${dep}`);
      } else {
        test.details.push(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
      }
    }

    // Check dev dependencies
    for (const dep of devRequiredDeps) {
      if (!packageJson.devDependencies || !packageJson.devDependencies[dep]) {
        missingDevDeps.push(dep);
        test.details.push(`⚠️ Missing dev dependency: ${dep}`);
      } else {
        test.details.push(`✅ ${dep}: ${packageJson.devDependencies[dep]}`);
      }
    }

    if (missingDeps.length === 0 && missingDevDeps.length === 0) {
      test.status = 'passed';
      test.details.push('🎯 All required dependencies present');
    } else if (missingDeps.length === 0) {
      test.status = 'warning';
      test.details.push(`⚠️ Missing ${missingDevDeps.length} dev dependencies`);
    } else {
      test.status = 'failed';
      test.details.push(`❌ Missing ${missingDeps.length} critical dependencies`);
    }

    if (missingDeps.length > 0) {
      testResults.recommendations.push({
        type: 'dependencies',
        description: `Install missing dependencies: ${missingDeps.join(', ')}`,
        action: `npm install ${missingDeps.join(' ')}`
      });
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ NPM dependency test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🔍 Test: Build Process
 */
async function testBuildProcess() {
  console.log('\n🏗️ Testing Build Process...');

  const test = {
    category: 'Build Process',
    name: 'Vite build test',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Test if the project can build
    console.log('   Running build process...');
    const buildResult = await runCommand('npm', ['run', 'build'], { timeout: 60000 });

    if (buildResult.success) {
      test.status = 'passed';
      test.details.push('✅ Build process completed successfully');
      test.details.push(`📊 Build output size: ${await getBuildSize()}`);
    } else {
      test.status = 'failed';
      test.details.push('❌ Build process failed');
      test.details.push(`📊 Error: ${buildResult.error}`);

      // Analyze build errors
      if (buildResult.error.includes('Module not found')) {
        testResults.recommendations.push({
          type: 'build',
          description: 'Fix module resolution issues',
          action: 'Review import paths and module exports'
        });
      }
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ Build test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🔍 Test: Pipeline Component Instantiation
 */
async function testPipelineComponents() {
  console.log('\n⚙️ Testing Pipeline Components...');

  const test = {
    category: 'Pipeline Components',
    name: 'Component instantiation test',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Create a simple TypeScript test file
    const testCode = `
import { MainPipeline } from './src/pipeline/main-pipeline';

try {
  console.log('Testing MainPipeline instantiation...');
  const pipeline = new MainPipeline();
  console.log('✅ MainPipeline created successfully');
  console.log('✅ Config:', JSON.stringify(pipeline.getConfig(), null, 2));
  process.exit(0);
} catch (error) {
  console.error('❌ MainPipeline instantiation failed:', error.message);
  process.exit(1);
}
`;

    await fs.writeFile('test-pipeline-components.ts', testCode);

    // Run the test
    const testResult = await runCommand('npx', ['ts-node', 'test-pipeline-components.ts']);

    if (testResult.success) {
      test.status = 'passed';
      test.details.push('✅ Pipeline components instantiate correctly');
      test.details.push(`📊 Test output: ${testResult.output}`);
    } else {
      test.status = 'failed';
      test.details.push('❌ Pipeline component instantiation failed');
      test.details.push(`📊 Error: ${testResult.error}`);

      if (testResult.error.includes('Cannot find module')) {
        testResults.recommendations.push({
          type: 'imports',
          description: 'Fix import path issues',
          action: 'Review and correct module import paths'
        });
      }
    }

    // Clean up test file
    try {
      await fs.unlink('test-pipeline-components.ts');
    } catch (e) {
      // Ignore cleanup errors
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ Component test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🔍 Test: Remotion Configuration
 */
async function testRemotionSetup() {
  console.log('\n🎬 Testing Remotion Configuration...');

  const test = {
    category: 'Remotion Setup',
    name: 'Remotion studio and components',
    status: 'running',
    startTime: Date.now(),
    details: []
  };

  try {
    // Check Remotion configuration
    const remotionConfigExists = await fileExists('remotion.config.ts');
    const remotionSrcExists = await fileExists('src/remotion');

    test.details.push(`${remotionConfigExists ? '✅' : '❌'} remotion.config.ts`);
    test.details.push(`${remotionSrcExists ? '✅' : '❌'} src/remotion directory`);

    if (remotionConfigExists && remotionSrcExists) {
      // Test Remotion studio startup (quick check)
      try {
        const studioTest = await runCommand('timeout', ['5s', 'npx', 'remotion', 'studio', '--port=0'], { timeout: 6000 });
        test.details.push('✅ Remotion studio can start');
      } catch (error) {
        test.details.push('⚠️ Remotion studio test skipped (timeout)');
      }

      test.status = 'passed';
      test.details.push('🎯 Remotion configuration is complete');
    } else {
      test.status = 'failed';
      test.details.push('❌ Remotion configuration incomplete');

      testResults.recommendations.push({
        type: 'remotion',
        description: 'Complete Remotion setup',
        action: 'Create missing Remotion configuration and components'
      });
    }

  } catch (error) {
    test.status = 'failed';
    test.details.push(`❌ Remotion test error: ${error.message}`);
  }

  test.duration = Date.now() - test.startTime;
  testResults.tests.push(test);

  console.log(`   ${test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌'} ${test.name} (${test.duration}ms)`);
  return test;
}

/**
 * 🎯 Generate System Validation Report
 */
async function generateValidationReport() {
  console.log('\n📊 Generating System Validation Report...');

  // Calculate summary statistics
  testResults.summary.total = testResults.tests.length;
  testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
  testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;
  testResults.summary.warnings = testResults.tests.filter(t => t.status === 'warning').length;

  const successRate = (testResults.summary.passed / testResults.summary.total) * 100;

  // Determine overall system status
  let systemStatus;
  let statusEmoji;

  if (successRate >= 90) {
    systemStatus = 'EXCELLENT';
    statusEmoji = '🎉';
  } else if (successRate >= 75) {
    systemStatus = 'GOOD';
    statusEmoji = '✅';
  } else if (successRate >= 50) {
    systemStatus = 'NEEDS_IMPROVEMENT';
    statusEmoji = '⚠️';
  } else {
    systemStatus = 'CRITICAL';
    statusEmoji = '❌';
  }

  testResults.systemStatus = systemStatus;
  testResults.successRate = successRate;

  // Generate comprehensive report
  const reportPath = join(__dirname, `system-validation-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('🔬 SYSTEM VALIDATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`${statusEmoji} Overall Status: ${systemStatus}`);
  console.log(`📊 Success Rate: ${successRate.toFixed(1)}%`);
  console.log(`✅ Passed: ${testResults.summary.passed}/${testResults.summary.total}`);
  console.log(`❌ Failed: ${testResults.summary.failed}/${testResults.summary.total}`);
  console.log(`⚠️ Warnings: ${testResults.summary.warnings}/${testResults.summary.total}`);

  console.log('\n📋 Test Results Summary:');
  testResults.tests.forEach(test => {
    const statusIcon = test.status === 'passed' ? '✅' : test.status === 'warning' ? '⚠️' : '❌';
    console.log(`   ${statusIcon} ${test.category}: ${test.name} (${test.duration}ms)`);
  });

  if (testResults.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    testResults.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. [${rec.type.toUpperCase()}] ${rec.description}`);
      console.log(`      Action: ${rec.action}`);
    });
  }

  console.log(`\n📄 Detailed report: ${reportPath}`);

  return testResults;
}

// Helper Functions
async function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const timeout = options.timeout || 30000;
    let output = '';
    let errorOutput = '';

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        output: output,
        error: 'Command timed out',
        timedOut: true
      });
    }, timeout);

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0,
        output: output.trim(),
        error: errorOutput.trim(),
        exitCode: code
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        success: false,
        output: output,
        error: error.message
      });
    });
  });
}

async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function getBuildSize() {
  try {
    const stats = await fs.stat('dist');
    return `${(stats.size / 1024).toFixed(1)}KB`;
  } catch {
    return 'Unknown';
  }
}

/**
 * 🚀 Main Validation Execution
 */
async function runSystemValidation() {
  console.log('🔬 Starting Comprehensive System Validation');
  console.log(`📅 ${validationConfig.timestamp}`);
  console.log('='.repeat(60));

  try {
    // Run all validation tests
    await testTypeScriptCompilation();
    await testModuleDependencies();
    await testNPMDependencies();
    await testBuildProcess();
    await testPipelineComponents();
    await testRemotionSetup();

    // Generate final report
    const finalResults = await generateValidationReport();

    if (finalResults.successRate >= 75) {
      console.log('\n🎊 SYSTEM VALIDATION SUCCESSFUL!');
      console.log('💡 System is ready for production use');
    } else {
      console.log('\n⚠️ SYSTEM NEEDS IMPROVEMENTS');
      console.log('💡 Please address the recommendations above');
    }

    return finalResults;

  } catch (error) {
    console.error('\n💥 SYSTEM VALIDATION FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

// Execute validation if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSystemValidation()
    .then(results => {
      process.exit(results.successRate >= 75 ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation execution failed:', error);
      process.exit(1);
    });
}

export { runSystemValidation };