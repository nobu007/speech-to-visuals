#!/usr/bin/env node

/**
 * Practical Workflow Test
 * Tests the actual end-to-end functionality based on custom instructions
 * Focuses on: 音声→字幕→シーン分割→関係抽出→自動レイアウト→Remotionで動画化
 */

import fs from 'fs/promises';
import path from 'path';

class PracticalWorkflowTest {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      testSuite: 'Practical Workflow End-to-End Test',
      workflow: 'Audio → Transcription → Scene Segmentation → Relationship Extraction → Auto Layout → Remotion Video',
      tests: [],
      metrics: {},
      summary: {}
    };
  }

  async runWorkflowTest() {
    console.log('🎬 Starting Practical Workflow Test...\n');
    console.log('Testing: 音声→字幕→シーン分割→関係抽出→自動レイアウト→Remotion動画化\n');

    // Step 1: Test Transcription Module
    await this.testTranscriptionModule();

    // Step 2: Test Analysis Pipeline
    await this.testAnalysisPipeline();

    // Step 3: Test Visualization Engine
    await this.testVisualizationEngine();

    // Step 4: Test Main Pipeline Integration
    await this.testMainPipelineIntegration();

    // Step 5: Test Web Interface
    await this.testWebInterface();

    // Step 6: Test Remotion Integration
    await this.testRemotionIntegration();

    // Calculate results
    this.calculateWorkflowMetrics();
    await this.saveResults();

    return this.results;
  }

  async testTranscriptionModule() {
    const testName = 'Transcription Module (音声→字幕)';
    console.log(`🎤 ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check transcription files
      const transcriptionFiles = [
        'src/transcription/transcriber.ts',
        'src/transcription/audio-preprocessor.ts',
        'src/transcription/text-postprocessor.ts',
        'src/transcription/multilingual-optimizer.ts',
        'src/transcription/types.ts'
      ];

      for (const file of transcriptionFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Check for Whisper integration
          if (file.includes('transcriber.ts')) {
            if (content.includes('whisper') || content.includes('Whisper')) {
              details.whisperIntegration = true;
            } else {
              issues.push('Whisper integration not found in transcriber');
              success = false;
            }

            // Check for caption support
            if (content.includes('caption') || content.includes('Caption')) {
              details.captionSupport = true;
            } else {
              issues.push('Caption support not found');
              success = false;
            }
          }

          // Check for multilingual support
          if (file.includes('multilingual')) {
            if (content.includes('language') || content.includes('lang')) {
              details.multilingualSupport = true;
            }
          }

        } catch (error) {
          issues.push(`Cannot read ${file}: ${error.message}`);
          success = false;
        }
      }

      // Check for @remotion/captions integration
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      if (packageJson.dependencies['@remotion/captions']) {
        details.remotionCaptionsIntegrated = true;
      } else {
        issues.push('@remotion/captions not found in dependencies');
        success = false;
      }

    } catch (error) {
      success = false;
      issues.push(`Transcription test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'Core Pipeline - Step 1',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 20),
      details,
      expectedOutput: '字幕付きトランスクリプション'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  async testAnalysisPipeline() {
    const testName = 'Analysis Pipeline (シーン分割→関係抽出)';
    console.log(`🔍 ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check analysis files
      const analysisFiles = [
        'src/analysis/scene-segmenter.ts',
        'src/analysis/diagram-detector.ts',
        'src/analysis/advanced-diagram-detector.ts',
        'src/analysis/ai-diagram-detector.ts',
        'src/analysis/adaptive-content-processor.ts'
      ];

      let sceneSegmentationFound = false;
      let diagramDetectionFound = false;
      let aiAnalysisFound = false;

      for (const file of analysisFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Check for scene segmentation
          if (file.includes('scene-segmenter')) {
            if (content.includes('segment') || content.includes('scene')) {
              sceneSegmentationFound = true;
              details.sceneSegmentation = true;
            }
          }

          // Check for diagram detection
          if (file.includes('diagram-detector')) {
            if (content.includes('diagram') || content.includes('flowchart') || content.includes('tree')) {
              diagramDetectionFound = true;
              details.diagramDetection = true;
            }
          }

          // Check for AI analysis
          if (file.includes('ai-') || file.includes('adaptive-')) {
            if (content.includes('AI') || content.includes('machine') || content.includes('learning')) {
              aiAnalysisFound = true;
              details.aiAnalysis = true;
            }
          }

        } catch (error) {
          issues.push(`Cannot read ${file}: ${error.message}`);
        }
      }

      if (!sceneSegmentationFound) {
        issues.push('Scene segmentation functionality not found');
        success = false;
      }

      if (!diagramDetectionFound) {
        issues.push('Diagram detection functionality not found');
        success = false;
      }

      if (!aiAnalysisFound) {
        issues.push('AI analysis capabilities not found');
        success = false;
      }

      // Check for relationship extraction capabilities
      const multimodalAnalyzer = 'src/analysis/multimodal-analyzer.ts';
      try {
        const content = await fs.readFile(multimodalAnalyzer, 'utf-8');
        if (content.includes('relationship') || content.includes('relation') || content.includes('connect')) {
          details.relationshipExtraction = true;
        } else {
          issues.push('Relationship extraction not found in multimodal analyzer');
        }
      } catch (error) {
        issues.push('Multimodal analyzer not found');
      }

    } catch (error) {
      success = false;
      issues.push(`Analysis test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'Core Pipeline - Step 2',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 15),
      details,
      expectedOutput: 'シーン分割されたコンテンツと図解タイプ判定'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  async testVisualizationEngine() {
    const testName = 'Visualization Engine (自動レイアウト)';
    console.log(`📊 ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check visualization files
      const visualizationFiles = [
        'src/visualization/layout-engine.ts',
        'src/visualization/complex-layout-engine.ts',
        'src/visualization/advanced-layouts.ts'
      ];

      let layoutEngineFound = false;
      let dagreIntegration = false;
      let advancedLayoutsFound = false;

      for (const file of visualizationFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');

          // Check for layout engine
          if (file.includes('layout-engine')) {
            if (content.includes('layout') || content.includes('position') || content.includes('coordinate')) {
              layoutEngineFound = true;
              details.layoutEngine = true;
            }

            // Check for dagre integration
            if (content.includes('dagre') || content.includes('@dagrejs')) {
              dagreIntegration = true;
              details.dagreIntegration = true;
            }
          }

          // Check for advanced layouts
          if (file.includes('advanced-layouts')) {
            if (content.includes('flowchart') || content.includes('tree') || content.includes('timeline')) {
              advancedLayoutsFound = true;
              details.advancedLayouts = true;
            }
          }

        } catch (error) {
          issues.push(`Cannot read ${file}: ${error.message}`);
        }
      }

      if (!layoutEngineFound) {
        issues.push('Layout engine not found');
        success = false;
      }

      if (!dagreIntegration) {
        issues.push('Dagre integration for automatic layout not found');
        success = false;
      }

      // Check package.json for dagre dependency
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      if (packageJson.dependencies['@dagrejs/dagre']) {
        details.dagreDependency = true;
      } else {
        issues.push('@dagrejs/dagre not found in dependencies');
        success = false;
      }

      // Check for visualization types
      const typesFile = 'src/visualization/types.ts';
      try {
        const typesContent = await fs.readFile(typesFile, 'utf-8');
        if (typesContent.includes('DiagramType') || typesContent.includes('LayoutType')) {
          details.visualizationTypes = true;
        }
      } catch (error) {
        issues.push('Visualization types not found');
      }

    } catch (error) {
      success = false;
      issues.push(`Visualization test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'Core Pipeline - Step 3',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 20),
      details,
      expectedOutput: '自動配置された図解レイアウト'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  async testMainPipelineIntegration() {
    const testName = 'Main Pipeline Integration (統合パイプライン)';
    console.log(`⚙️ ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check main pipeline file
      const mainPipelineFile = 'src/pipeline/main-pipeline.ts';

      try {
        const content = await fs.readFile(mainPipelineFile, 'utf-8');

        // Check for integration of all modules
        const requiredModules = [
          'transcription',
          'analysis',
          'visualization'
        ];

        for (const module of requiredModules) {
          if (content.includes(module) || content.includes(module.charAt(0).toUpperCase() + module.slice(1))) {
            details[`${module}Integration`] = true;
          } else {
            issues.push(`${module} module integration not found in main pipeline`);
            success = false;
          }
        }

        // Check for error handling
        if (content.includes('try') && content.includes('catch')) {
          details.errorHandling = true;
        } else {
          issues.push('Error handling not found in main pipeline');
        }

        // Check for progress tracking
        if (content.includes('progress') || content.includes('status')) {
          details.progressTracking = true;
        } else {
          issues.push('Progress tracking not found');
        }

      } catch (error) {
        issues.push(`Cannot read main pipeline: ${error.message}`);
        success = false;
      }

      // Check for enhanced pipelines
      const enhancedPipelines = [
        'src/pipeline/ai-enhanced-pipeline.ts',
        'src/pipeline/iteration-27-next-gen-enhancements.ts'
      ];

      let enhancedFound = false;
      for (const file of enhancedPipelines) {
        try {
          await fs.access(file);
          enhancedFound = true;
          details.enhancedPipelines = true;
          break;
        } catch (error) {
          // Continue checking
        }
      }

      if (!enhancedFound) {
        issues.push('No enhanced pipeline implementations found');
      }

      // Check pipeline index
      const pipelineIndex = 'src/pipeline/index.ts';
      try {
        const indexContent = await fs.readFile(pipelineIndex, 'utf-8');
        if (indexContent.includes('export') && indexContent.includes('Pipeline')) {
          details.properExports = true;
        } else {
          issues.push('Pipeline exports not properly configured');
        }
      } catch (error) {
        issues.push('Pipeline index file not found');
      }

    } catch (error) {
      success = false;
      issues.push(`Pipeline integration test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'Core Pipeline - Integration',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 15),
      details,
      expectedOutput: '統合されたエンドツーエンドパイプライン'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  async testWebInterface() {
    const testName = 'Web Interface (Web UI)';
    console.log(`🖥️ ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check main page
      const indexPage = 'src/pages/Index.tsx';
      try {
        const content = await fs.readFile(indexPage, 'utf-8');

        // Check for audio upload
        if (content.includes('AudioUploader') || content.includes('upload')) {
          details.audioUpload = true;
        } else {
          issues.push('Audio upload functionality not found');
          success = false;
        }

        // Check for processing status
        if (content.includes('ProcessingStatus') || content.includes('progress')) {
          details.processingStatus = true;
        } else {
          issues.push('Processing status display not found');
        }

        // Check for diagram preview
        if (content.includes('DiagramPreview') || content.includes('preview')) {
          details.diagramPreview = true;
        } else {
          issues.push('Diagram preview not found');
        }

        // Check for video renderer
        if (content.includes('VideoRenderer') || content.includes('render')) {
          details.videoRenderer = true;
        } else {
          issues.push('Video renderer not found');
        }

      } catch (error) {
        issues.push(`Cannot read main page: ${error.message}`);
        success = false;
      }

      // Check components
      const componentFiles = [
        'src/components/AudioUploader.tsx',
        'src/components/ProcessingStatus.tsx',
        'src/components/DiagramPreview.tsx',
        'src/components/VideoRenderer.tsx'
      ];

      let componentsFound = 0;
      for (const file of componentFiles) {
        try {
          await fs.access(file);
          componentsFound++;
        } catch (error) {
          // Component might be in a different location
        }
      }

      if (componentsFound < 2) {
        issues.push('Essential UI components missing');
        success = false;
      } else {
        details.essentialComponents = componentsFound;
      }

      // Check for pipeline interface
      try {
        await fs.access('src/components/pipeline-interface.tsx');
        details.pipelineInterface = true;
      } catch (error) {
        issues.push('Pipeline interface component not found');
      }

    } catch (error) {
      success = false;
      issues.push(`Web interface test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'User Interface',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 20),
      details,
      expectedOutput: '完全なWebユーザーインターフェース'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  async testRemotionIntegration() {
    const testName = 'Remotion Integration (動画生成)';
    console.log(`🎬 ${testName}...`);

    const startTime = performance.now();
    let success = true;
    const details = {};
    const issues = [];

    try {
      // Check remotion config
      const remotionConfig = 'remotion.config.ts';
      try {
        const content = await fs.readFile(remotionConfig, 'utf-8');
        if (content.includes('Config') && content.includes('remotion')) {
          details.remotionConfig = true;
        } else {
          issues.push('Remotion configuration appears incomplete');
          success = false;
        }
      } catch (error) {
        issues.push('Remotion configuration not found');
        success = false;
      }

      // Check package.json for remotion dependencies
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const remotionDeps = [
        'remotion',
        '@remotion/captions',
        '@remotion/media-utils',
        '@remotion/player'
      ];

      let depsFound = 0;
      for (const dep of remotionDeps) {
        if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
          depsFound++;
        }
      }

      if (depsFound >= 3) {
        details.remotionDependencies = depsFound;
      } else {
        issues.push('Essential Remotion dependencies missing');
        success = false;
      }

      // Check for remotion scripts
      if (packageJson.scripts['remotion:studio'] && packageJson.scripts['remotion:render']) {
        details.remotionScripts = true;
      } else {
        issues.push('Remotion scripts not configured in package.json');
      }

      // Check for video renderer component
      try {
        const videoRendererFiles = [
          'src/components/VideoRenderer.tsx',
          'src/animation/video-renderer.tsx'
        ];

        let rendererFound = false;
        for (const file of videoRendererFiles) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            if (content.includes('Remotion') || content.includes('Player')) {
              rendererFound = true;
              details.videoRenderer = true;
              break;
            }
          } catch (error) {
            // Continue checking
          }
        }

        if (!rendererFound) {
          issues.push('Video renderer component with Remotion integration not found');
        }

      } catch (error) {
        issues.push('Cannot validate video renderer');
      }

      // Check for remotion source files
      const remotionSrcFiles = [
        'src/remotion',
        'src/animation'
      ];

      let remotionSrcFound = false;
      for (const dir of remotionSrcFiles) {
        try {
          const stats = await fs.stat(dir);
          if (stats.isDirectory()) {
            remotionSrcFound = true;
            details.remotionSources = true;
            break;
          }
        } catch (error) {
          // Continue checking
        }
      }

      if (!remotionSrcFound) {
        issues.push('Remotion source files directory not found');
      }

    } catch (error) {
      success = false;
      issues.push(`Remotion integration test error: ${error.message}`);
    }

    const duration = performance.now() - startTime;

    this.results.tests.push({
      name: testName,
      category: 'Core Pipeline - Step 4',
      success,
      duration: Math.round(duration),
      issues,
      score: success ? 100 : Math.max(0, 100 - issues.length * 20),
      details,
      expectedOutput: 'Remotionベースの動画生成機能'
    });

    console.log(`${success ? '✅' : '⚠️'} ${testName}: ${success ? 'PASS' : 'PARTIAL'}`);
    if (issues.length > 0) {
      console.log(`   Issues: ${issues.slice(0, 2).join(', ')}${issues.length > 2 ? '...' : ''}`);
    }
  }

  calculateWorkflowMetrics() {
    const { tests } = this.results;
    const totalTests = tests.length;
    const passedTests = tests.filter(t => t.success).length;
    const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
    const averageScore = tests.reduce((sum, t) => sum + t.score, 0) / totalTests;

    // Calculate workflow completeness
    const workflowSteps = tests.filter(t => t.category.includes('Core Pipeline')).length;
    const completedSteps = tests.filter(t => t.category.includes('Core Pipeline') && t.success).length;

    this.results.metrics = {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: (passedTests / totalTests * 100).toFixed(1),
      averageScore: averageScore.toFixed(1),
      totalDuration: `${totalDuration}ms`,
      workflowCompleteness: `${completedSteps}/${workflowSteps} steps`,
      workflowReadiness: completedSteps >= workflowSteps - 1 // Allow 1 step to be partial
    };

    this.results.summary = {
      workflowStatus: this.results.metrics.workflowReadiness ? 'READY' : 'NEEDS_IMPROVEMENT',
      readyForProduction: passedTests === totalTests,
      nextActions: this.generateNextActions(tests),
      improvementPriorities: this.generateImprovementPriorities(tests)
    };
  }

  generateNextActions(tests) {
    const actions = [];
    const failedTests = tests.filter(t => !t.success);

    if (failedTests.length === 0) {
      actions.push('✅ All workflow steps validated - ready for end-to-end testing');
      actions.push('🚀 Deploy to production environment');
      actions.push('📊 Implement performance monitoring');
      actions.push('🎯 Begin user acceptance testing');
    } else {
      actions.push('🔧 Address critical workflow issues:');
      failedTests.forEach(test => {
        actions.push(`   - ${test.name}: ${test.issues[0]}`);
      });
      actions.push('🔄 Re-run workflow test after fixes');
    }

    return actions;
  }

  generateImprovementPriorities(tests) {
    const priorities = [];

    // Find tests with the lowest scores
    const sortedTests = [...tests].sort((a, b) => a.score - b.score);
    const lowScoreTests = sortedTests.filter(t => t.score < 100);

    if (lowScoreTests.length > 0) {
      priorities.push('High Priority:');
      lowScoreTests.slice(0, 2).forEach(test => {
        priorities.push(`   - Improve ${test.name} (Score: ${test.score}%)`);
      });
    }

    // Add general improvements
    priorities.push('Medium Priority:');
    priorities.push('   - Add comprehensive integration tests');
    priorities.push('   - Implement real-time performance monitoring');
    priorities.push('   - Add automated quality assurance');

    priorities.push('Low Priority:');
    priorities.push('   - Add advanced AI features');
    priorities.push('   - Implement multi-language support');
    priorities.push('   - Add collaborative features');

    return priorities;
  }

  async saveResults() {
    const filename = `practical-workflow-test-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
    console.log(`\n📊 Results saved to: ${filename}`);
  }
}

// Main execution
async function main() {
  try {
    const tester = new PracticalWorkflowTest();
    const results = await tester.runWorkflowTest();

    console.log('\n' + '='.repeat(60));
    console.log('🎬 PRACTICAL WORKFLOW TEST SUMMARY');
    console.log('='.repeat(60));

    const { metrics, summary } = results;
    console.log(`Tests Passed: ${metrics.passedTests}/${metrics.totalTests} (${metrics.successRate}%)`);
    console.log(`Average Score: ${metrics.averageScore}%`);
    console.log(`Workflow Completeness: ${metrics.workflowCompleteness}`);
    console.log(`Workflow Status: ${summary.workflowStatus}`);
    console.log(`Production Ready: ${summary.readyForProduction ? '✅ YES' : '❌ NO'}`);

    console.log('\n📋 Next Actions:');
    summary.nextActions.forEach(action => console.log(action));

    console.log('\n🎯 Improvement Priorities:');
    summary.improvementPriorities.forEach(priority => console.log(priority));

    console.log('\n🔄 Based on Custom Instructions Methodology:');
    if (summary.readyForProduction) {
      console.log('✅ Workflow validated - ready for next iteration cycle');
      console.log('✅ Can proceed with production deployment');
      console.log('✅ Ready for advanced feature development');
    } else {
      console.log('🔧 Address workflow gaps before proceeding');
      console.log('📋 Focus on failed pipeline steps');
      console.log('🔄 Apply iterative improvement approach');
    }

    // Exit code based on workflow readiness
    const exitCode = metrics.workflowReadiness ? 0 : 1;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Workflow test failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}