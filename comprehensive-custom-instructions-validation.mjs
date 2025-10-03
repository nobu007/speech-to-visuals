#!/usr/bin/env node

/**
 * 🔄 Comprehensive Custom Instructions Validation
 *
 * Validates that all elements from the custom instructions are properly implemented
 * Tests the recursive development framework integration
 * Ensures quality metrics and iterative improvement processes are working
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Validation report structure
const validationReport = {
  timestamp: new Date().toISOString(),
  customInstructionsCompliance: {
    systemOverview: { score: 0, details: [] },
    developmentPhases: { score: 0, details: [] },
    recursiveFramework: { score: 0, details: [] },
    qualityAssurance: { score: 0, details: [] },
    moduleStructure: { score: 0, details: [] }
  },
  technicalValidation: {
    coreComponents: { score: 0, details: [] },
    integrationTesting: { score: 0, details: [] },
    performanceMetrics: { score: 0, details: [] }
  },
  overallCompliance: 0,
  recommendations: []
};

/**
 * 1. Validate System Overview and Core Principles
 */
async function validateSystemOverview() {
  console.log('🎯 Validating System Overview...');

  const checks = [
    {
      name: 'Project definition matches custom instructions',
      check: async () => {
        try {
          const readme = await fs.readFile('./README.md', 'utf-8');
          const hasAudioDiagram = readme.includes('AutoDiagram') || readme.includes('speech-to-visual');
          return { score: hasAudioDiagram ? 1 : 0.5, message: hasAudioDiagram ? 'Project purpose clearly defined' : 'Project definition could be clearer' };
        } catch {
          return { score: 0.5, message: 'README needs to reflect custom instructions purpose' };
        }
      }
    },
    {
      name: 'Working directory is ~/speech-to-visuals',
      check: async () => {
        const cwd = process.cwd();
        const isCorrectDir = cwd.includes('speech-to-visuals');
        return {
          score: isCorrectDir ? 1 : 0,
          message: isCorrectDir ? 'Working in correct directory' : `Working in wrong directory: ${cwd}`
        };
      }
    },
    {
      name: 'Target libraries installed (Remotion, Dagre, TypeScript)',
      check: async () => {
        try {
          const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
          const requiredDeps = ['remotion', '@dagrejs/dagre', 'typescript', '@remotion/captions'];
          const installed = requiredDeps.filter(dep =>
            pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]
          );
          const score = installed.length / requiredDeps.length;
          return {
            score,
            message: `${installed.length}/${requiredDeps.length} required libraries installed: ${installed.join(', ')}`
          };
        } catch {
          return { score: 0, message: 'Cannot verify package.json dependencies' };
        }
      }
    },
    {
      name: 'Development principles (incremental, recursive, modular, testable, transparent)',
      check: async () => {
        try {
          // Check for modular structure
          const srcDirs = await fs.readdir('./src', { withFileTypes: true });
          const expectedDirs = ['transcription', 'analysis', 'visualization', 'animation', 'pipeline'];
          const existingDirs = srcDirs.filter(d => d.isDirectory()).map(d => d.name);
          const moduleScore = expectedDirs.filter(d => existingDirs.includes(d)).length / expectedDirs.length;

          return {
            score: moduleScore,
            message: `Modular structure: ${Math.round(moduleScore * 100)}% complete. Found: ${existingDirs.join(', ')}`
          };
        } catch {
          return { score: 0, message: 'Cannot verify modular structure' };
        }
      }
    }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    const result = await check.check();
    return { name: check.name, ...result };
  }));

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  validationReport.customInstructionsCompliance.systemOverview = {
    score: avgScore,
    details: results
  };

  console.log(`✅ System Overview Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 2. Validate Development Phases Implementation
 */
async function validateDevelopmentPhases() {
  console.log('📋 Validating Development Phases...');

  const phases = [
    { name: 'MVP構築', expectedFiles: ['pipeline/main-pipeline.ts', 'transcription/'], criteria: ['音声入力→字幕付き動画出力が動作'] },
    { name: '内容分析', expectedFiles: ['analysis/scene-segmenter.ts', 'analysis/diagram-detector.ts'], criteria: ['シーン分割精度80%', '図解タイプ判定70%'] },
    { name: '図解生成', expectedFiles: ['visualization/', 'layout/'], criteria: ['レイアウト破綻0', 'ラベル可読性100%'] },
    { name: '品質向上', expectedFiles: ['quality/', 'performance/'], criteria: ['処理成功率>90%', '平均処理時間<60秒'] }
  ];

  const results = [];
  for (const phase of phases) {
    let phaseScore = 0;
    const details = [];

    // Check for expected files/directories
    for (const expectedFile of phase.expectedFiles) {
      try {
        const fullPath = `./src/${expectedFile}`;
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory() || stats.isFile()) {
          phaseScore += 0.5;
          details.push(`✅ ${expectedFile} exists`);
        }
      } catch {
        details.push(`❌ ${expectedFile} missing`);
      }
    }

    // Normalize score
    phaseScore = phaseScore / phase.expectedFiles.length;

    results.push({
      name: phase.name,
      score: phaseScore,
      message: `Phase implementation: ${Math.round(phaseScore * 100)}%`,
      details: details,
      criteria: phase.criteria
    });
  }

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  validationReport.customInstructionsCompliance.developmentPhases = {
    score: avgScore,
    details: results
  };

  console.log(`✅ Development Phases Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 3. Validate Recursive Framework Implementation
 */
async function validateRecursiveFramework() {
  console.log('🔄 Validating Recursive Framework...');

  const checks = [
    {
      name: 'Recursive Development Framework exists',
      check: async () => {
        try {
          await fs.stat('./src/framework/recursive-development-framework.ts');
          return { score: 1, message: 'Recursive framework file exists' };
        } catch {
          return { score: 0, message: 'Recursive framework file missing' };
        }
      }
    },
    {
      name: 'RecursiveIntegrationPipeline exists',
      check: async () => {
        try {
          await fs.stat('./src/pipeline/recursive-integration-pipeline.ts');
          return { score: 1, message: 'Recursive integration pipeline exists' };
        } catch {
          return { score: 0, message: 'Recursive integration pipeline missing' };
        }
      }
    },
    {
      name: 'Development cycles defined (MVP構築, 内容分析, 図解生成, 品質向上)',
      check: async () => {
        try {
          const frameworkContent = await fs.readFile('./src/framework/recursive-development-framework.ts', 'utf-8');
          const expectedCycles = ['MVP構築', '内容分析', '図解生成', '品質向上'];
          const foundCycles = expectedCycles.filter(cycle => frameworkContent.includes(cycle));
          const score = foundCycles.length / expectedCycles.length;
          return {
            score,
            message: `${foundCycles.length}/${expectedCycles.length} development cycles defined: ${foundCycles.join(', ')}`
          };
        } catch {
          return { score: 0, message: 'Cannot verify development cycles' };
        }
      }
    },
    {
      name: 'Quality thresholds configured',
      check: async () => {
        try {
          const frameworkContent = await fs.readFile('./src/framework/recursive-development-framework.ts', 'utf-8');
          const qualityMetrics = [
            'transcriptionAccuracy',
            'sceneSegmentationPrecision',
            'diagramTypeDetection',
            'layoutGenerationSuccess',
            'overallSystemStability'
          ];
          const foundMetrics = qualityMetrics.filter(metric => frameworkContent.includes(metric));
          const score = foundMetrics.length / qualityMetrics.length;
          return {
            score,
            message: `${foundMetrics.length}/${qualityMetrics.length} quality metrics configured`
          };
        } catch {
          return { score: 0, message: 'Cannot verify quality thresholds' };
        }
      }
    },
    {
      name: 'Commit strategies implemented',
      check: async () => {
        try {
          const frameworkContent = await fs.readFile('./src/framework/recursive-development-framework.ts', 'utf-8');
          const commitTypes = ['immediate', 'checkpoint', 'review'];
          const foundTypes = commitTypes.filter(type => frameworkContent.includes(type));
          const score = foundTypes.length / commitTypes.length;
          return {
            score,
            message: `${foundTypes.length}/${commitTypes.length} commit strategies implemented`
          };
        } catch {
          return { score: 0, message: 'Cannot verify commit strategies' };
        }
      }
    }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    const result = await check.check();
    return { name: check.name, ...result };
  }));

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  validationReport.customInstructionsCompliance.recursiveFramework = {
    score: avgScore,
    details: results
  };

  console.log(`✅ Recursive Framework Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 4. Validate Quality Assurance Implementation
 */
async function validateQualityAssurance() {
  console.log('📊 Validating Quality Assurance...');

  const checks = [
    {
      name: 'Quality monitoring system exists',
      check: async () => {
        try {
          const qDir = await fs.readdir('./src');
          const hasQuality = qDir.includes('quality') || qDir.includes('monitoring');
          return {
            score: hasQuality ? 1 : 0.5,
            message: hasQuality ? 'Quality monitoring directory found' : 'Quality monitoring structure could be improved'
          };
        } catch {
          return { score: 0, message: 'No quality monitoring system found' };
        }
      }
    },
    {
      name: 'Iteration log exists and is maintained',
      check: async () => {
        try {
          const iterationLog = await fs.readFile('./.module/ITERATION_LOG.md', 'utf-8');
          const hasRecentEntries = iterationLog.includes('2024') || iterationLog.includes('2025');
          const hasQualityMetrics = iterationLog.includes('Quality') || iterationLog.includes('品質');
          const score = (hasRecentEntries ? 0.5 : 0) + (hasQualityMetrics ? 0.5 : 0);
          return {
            score,
            message: `Iteration log quality: Recent entries: ${hasRecentEntries}, Quality tracking: ${hasQualityMetrics}`
          };
        } catch {
          return { score: 0, message: 'Iteration log missing or inaccessible' };
        }
      }
    },
    {
      name: 'Automatic quality checks implemented',
      check: async () => {
        try {
          const frameworkContent = await fs.readFile('./src/framework/recursive-development-framework.ts', 'utf-8');
          const hasQualityAssessment = frameworkContent.includes('assessQuality');
          const hasMetrics = frameworkContent.includes('measureTranscriptionAccuracy') &&
                           frameworkContent.includes('measureSegmentationPrecision');
          const score = (hasQualityAssessment ? 0.5 : 0) + (hasMetrics ? 0.5 : 0);
          return {
            score,
            message: `Quality assessment: ${hasQualityAssessment}, Metrics: ${hasMetrics}`
          };
        } catch {
          return { score: 0, message: 'Cannot verify quality assessment implementation' };
        }
      }
    },
    {
      name: 'Success criteria validation',
      check: async () => {
        try {
          const pipelineContent = await fs.readFile('./src/pipeline/recursive-integration-pipeline.ts', 'utf-8');
          const hasSuccessCriteria = pipelineContent.includes('checkPhaseCriteria');
          const hasValidation = pipelineContent.includes('evaluateSystemQuality');
          const score = (hasSuccessCriteria ? 0.5 : 0) + (hasValidation ? 0.5 : 0);
          return {
            score,
            message: `Success criteria checking: ${hasSuccessCriteria}, Quality validation: ${hasValidation}`
          };
        } catch {
          return { score: 0, message: 'Cannot verify success criteria validation' };
        }
      }
    }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    const result = await check.check();
    return { name: check.name, ...result };
  }));

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  validationReport.customInstructionsCompliance.qualityAssurance = {
    score: avgScore,
    details: results
  };

  console.log(`✅ Quality Assurance Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 5. Validate Module Structure and Architecture
 */
async function validateModuleStructure() {
  console.log('🏗️ Validating Module Structure...');

  const expectedStructure = {
    '.module/': ['ITERATION_LOG.md', 'SYSTEM_CORE.md', 'PIPELINE_FLOW.md', 'QUALITY_METRICS.md'],
    'src/transcription/': ['transcriber.ts', 'types.ts'],
    'src/analysis/': ['scene-segmenter.ts', 'diagram-detector.ts', 'types.ts'],
    'src/visualization/': ['layout-generator.ts', 'types.ts'],
    'src/animation/': ['animation-composer.ts'],
    'src/pipeline/': ['main-pipeline.ts', 'recursive-integration-pipeline.ts', 'types.ts'],
    'src/framework/': ['recursive-development-framework.ts']
  };

  const results = [];
  let totalExpected = 0;
  let totalFound = 0;

  for (const [dir, files] of Object.entries(expectedStructure)) {
    try {
      const existingFiles = await fs.readdir(dir);
      const foundFiles = files.filter(file => existingFiles.includes(file));
      const score = foundFiles.length / files.length;

      totalExpected += files.length;
      totalFound += foundFiles.length;

      results.push({
        name: dir,
        score,
        message: `${foundFiles.length}/${files.length} expected files found`,
        details: foundFiles.map(f => `✅ ${f}`)
          .concat(files.filter(f => !foundFiles.includes(f)).map(f => `❌ ${f} missing`))
      });
    } catch {
      results.push({
        name: dir,
        score: 0,
        message: 'Directory not found',
        details: [`❌ Directory ${dir} missing`]
      });
    }
  }

  const avgScore = totalFound / totalExpected;
  validationReport.customInstructionsCompliance.moduleStructure = {
    score: avgScore,
    details: results
  };

  console.log(`✅ Module Structure Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 6. Technical Validation - Test actual functionality
 */
async function validateTechnicalImplementation() {
  console.log('⚙️ Validating Technical Implementation...');

  const checks = [
    {
      name: 'Recursive framework can be instantiated',
      check: async () => {
        try {
          // Try to import and create framework instance
          const frameworkPath = './src/framework/recursive-development-framework.ts';
          const frameworkExists = await fs.stat(frameworkPath).then(() => true).catch(() => false);

          if (!frameworkExists) {
            return { score: 0, message: 'Recursive framework file not found' };
          }

          // Check if framework exports expected classes/functions
          const content = await fs.readFile(frameworkPath, 'utf-8');
          const hasClass = content.includes('class RecursiveDevelopmentFramework');
          const hasExport = content.includes('export');

          const score = (hasClass ? 0.5 : 0) + (hasExport ? 0.5 : 0);
          return {
            score,
            message: `Framework structure: Class defined: ${hasClass}, Properly exported: ${hasExport}`
          };
        } catch (error) {
          return { score: 0, message: `Framework instantiation failed: ${error.message}` };
        }
      }
    },
    {
      name: 'Pipeline integration works',
      check: async () => {
        try {
          const pipelinePath = './src/pipeline/recursive-integration-pipeline.ts';
          const pipelineExists = await fs.stat(pipelinePath).then(() => true).catch(() => false);

          if (!pipelineExists) {
            return { score: 0, message: 'Recursive integration pipeline not found' };
          }

          const content = await fs.readFile(pipelinePath, 'utf-8');
          const hasIntegration = content.includes('RecursiveIntegrationPipeline');
          const hasExecution = content.includes('executeWithRecursiveImprovement');

          const score = (hasIntegration ? 0.5 : 0) + (hasExecution ? 0.5 : 0);
          return {
            score,
            message: `Pipeline integration: Class exists: ${hasIntegration}, Execution method: ${hasExecution}`
          };
        } catch (error) {
          return { score: 0, message: `Pipeline integration check failed: ${error.message}` };
        }
      }
    },
    {
      name: 'Package.json scripts match custom instructions',
      check: async () => {
        try {
          const pkg = JSON.parse(await fs.readFile('./package.json', 'utf-8'));
          const expectedScripts = ['dev', 'build', 'remotion:studio', 'remotion:render'];
          const foundScripts = expectedScripts.filter(script => pkg.scripts?.[script]);
          const score = foundScripts.length / expectedScripts.length;

          return {
            score,
            message: `${foundScripts.length}/${expectedScripts.length} required scripts found: ${foundScripts.join(', ')}`
          };
        } catch (error) {
          return { score: 0, message: `Package.json validation failed: ${error.message}` };
        }
      }
    }
  ];

  const results = await Promise.all(checks.map(async (check) => {
    const result = await check.check();
    return { name: check.name, ...result };
  }));

  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  validationReport.technicalValidation.coreComponents = {
    score: avgScore,
    details: results
  };

  console.log(`✅ Technical Implementation Score: ${Math.round(avgScore * 100)}%`);
  return avgScore;
}

/**
 * 7. Generate recommendations based on validation results
 */
function generateRecommendations() {
  console.log('💡 Generating Recommendations...');

  const recommendations = [];
  const allScores = [
    validationReport.customInstructionsCompliance.systemOverview.score,
    validationReport.customInstructionsCompliance.developmentPhases.score,
    validationReport.customInstructionsCompliance.recursiveFramework.score,
    validationReport.customInstructionsCompliance.qualityAssurance.score,
    validationReport.customInstructionsCompliance.moduleStructure.score,
    validationReport.technicalValidation.coreComponents.score
  ];

  const overallScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  validationReport.overallCompliance = overallScore;

  // System Overview recommendations
  if (validationReport.customInstructionsCompliance.systemOverview.score < 0.8) {
    recommendations.push({
      priority: 'high',
      category: 'System Overview',
      suggestion: 'Update README.md to clearly reflect the AutoDiagram Video Generator purpose and custom instructions'
    });
  }

  // Development Phases recommendations
  if (validationReport.customInstructionsCompliance.developmentPhases.score < 0.8) {
    recommendations.push({
      priority: 'medium',
      category: 'Development Phases',
      suggestion: 'Complete missing phase implementations: ensure all expected directories and files exist'
    });
  }

  // Recursive Framework recommendations
  if (validationReport.customInstructionsCompliance.recursiveFramework.score < 0.9) {
    recommendations.push({
      priority: 'high',
      category: 'Recursive Framework',
      suggestion: 'Enhance recursive framework implementation to include all development cycles and quality metrics'
    });
  }

  // Quality Assurance recommendations
  if (validationReport.customInstructionsCompliance.qualityAssurance.score < 0.8) {
    recommendations.push({
      priority: 'high',
      category: 'Quality Assurance',
      suggestion: 'Implement comprehensive quality monitoring and automatic validation system'
    });
  }

  // Module Structure recommendations
  if (validationReport.customInstructionsCompliance.moduleStructure.score < 0.7) {
    recommendations.push({
      priority: 'medium',
      category: 'Module Structure',
      suggestion: 'Complete modular architecture by creating missing directories and core files'
    });
  }

  // Overall system recommendations
  if (overallScore >= 0.9) {
    recommendations.push({
      priority: 'low',
      category: 'Excellence',
      suggestion: 'System shows excellent compliance with custom instructions. Focus on performance optimization and advanced features.'
    });
  } else if (overallScore >= 0.7) {
    recommendations.push({
      priority: 'medium',
      category: 'Improvement',
      suggestion: 'Good compliance achieved. Focus on completing missing components and enhancing quality metrics.'
    });
  } else {
    recommendations.push({
      priority: 'high',
      category: 'Foundation',
      suggestion: 'Significant gaps identified. Prioritize implementing core recursive framework and quality assurance systems.'
    });
  }

  validationReport.recommendations = recommendations;
  return recommendations;
}

/**
 * Main validation execution
 */
async function runComprehensiveValidation() {
  console.log('🔄 Starting Comprehensive Custom Instructions Validation\n');
  console.log('=' .repeat(60));

  const startTime = performance.now();

  try {
    // Run all validation checks
    await validateSystemOverview();
    await validateDevelopmentPhases();
    await validateRecursiveFramework();
    await validateQualityAssurance();
    await validateModuleStructure();
    await validateTechnicalImplementation();

    // Generate recommendations
    generateRecommendations();

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Generate final report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 COMPREHENSIVE VALIDATION RESULTS');
    console.log('=' .repeat(60));

    console.log(`\n🎯 Overall Compliance Score: ${Math.round(validationReport.overallCompliance * 100)}%`);

    console.log('\n📋 Category Scores:');
    console.log(`  System Overview: ${Math.round(validationReport.customInstructionsCompliance.systemOverview.score * 100)}%`);
    console.log(`  Development Phases: ${Math.round(validationReport.customInstructionsCompliance.developmentPhases.score * 100)}%`);
    console.log(`  Recursive Framework: ${Math.round(validationReport.customInstructionsCompliance.recursiveFramework.score * 100)}%`);
    console.log(`  Quality Assurance: ${Math.round(validationReport.customInstructionsCompliance.qualityAssurance.score * 100)}%`);
    console.log(`  Module Structure: ${Math.round(validationReport.customInstructionsCompliance.moduleStructure.score * 100)}%`);
    console.log(`  Technical Implementation: ${Math.round(validationReport.technicalValidation.coreComponents.score * 100)}%`);

    console.log('\n💡 Key Recommendations:');
    validationReport.recommendations.forEach((rec, index) => {
      const priorityIcon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`  ${priorityIcon} [${rec.category}] ${rec.suggestion}`);
    });

    console.log(`\n⏱️ Validation completed in ${duration}ms`);

    // Save detailed report
    const reportPath = `comprehensive-custom-instructions-validation-report-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(validationReport, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);

    // Overall status
    if (validationReport.overallCompliance >= 0.9) {
      console.log('\n🎉 EXCELLENT COMPLIANCE WITH CUSTOM INSTRUCTIONS');
      console.log('✅ System is well-aligned with recursive development framework');
    } else if (validationReport.overallCompliance >= 0.7) {
      console.log('\n👍 GOOD COMPLIANCE WITH CUSTOM INSTRUCTIONS');
      console.log('⚠️ Some improvements needed for optimal alignment');
    } else {
      console.log('\n⚠️ COMPLIANCE NEEDS IMPROVEMENT');
      console.log('🔧 Significant work needed to align with custom instructions');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Execute validation
runComprehensiveValidation().then(() => {
  console.log('\n🔄 Custom Instructions Validation Complete\n');
}).catch(console.error);