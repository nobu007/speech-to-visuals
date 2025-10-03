#!/usr/bin/env node

/**
 * Custom Instructions Validation Test
 * Validates that the system meets the requirements defined in the custom instructions
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CustomInstructionsValidator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      systemStatus: 'unknown',
      validationResults: {},
      recommendations: []
    };
  }

  async validateSystemArchitecture() {
    console.log('🏗️ Validating System Architecture...');

    const requiredModules = [
      'src/transcription',
      'src/analysis',
      'src/visualization',
      'src/animation',
      'src/pipeline'
    ];

    const moduleChecks = {};

    for (const module of requiredModules) {
      try {
        const modulePath = join(__dirname, module);
        const stats = await fs.stat(modulePath);
        moduleChecks[module] = {
          exists: stats.isDirectory(),
          status: '✅ Present'
        };
      } catch (error) {
        moduleChecks[module] = {
          exists: false,
          status: '❌ Missing',
          error: error.message
        };
      }
    }

    this.results.validationResults.architecture = moduleChecks;

    const allModulesPresent = Object.values(moduleChecks).every(check => check.exists);
    console.log(`Architecture: ${allModulesPresent ? '✅ Complete' : '❌ Incomplete'}`);

    return allModulesPresent;
  }

  async validatePipelineIntegration() {
    console.log('🔄 Validating Pipeline Integration...');

    try {
      // Check for main pipeline file
      const pipelinePath = join(__dirname, 'src/pipeline/main-pipeline.ts');
      await fs.access(pipelinePath);

      const pipelineContent = await fs.readFile(pipelinePath, 'utf-8');

      const integrationChecks = {
        transcriptionIntegration: pipelineContent.includes('TranscriptionPipeline'),
        analysisIntegration: pipelineContent.includes('SceneSegmenter') || pipelineContent.includes('DiagramDetector'),
        visualizationIntegration: pipelineContent.includes('LayoutEngine'),
        errorHandling: pipelineContent.includes('try') && pipelineContent.includes('catch'),
        qualityMonitoring: pipelineContent.includes('qualityMonitor') || pipelineContent.includes('QualityAssessment')
      };

      this.results.validationResults.pipelineIntegration = integrationChecks;

      const integrationScore = Object.values(integrationChecks).filter(Boolean).length / Object.keys(integrationChecks).length;
      console.log(`Pipeline Integration: ${integrationScore >= 0.8 ? '✅' : '⚠️'} ${(integrationScore * 100).toFixed(1)}%`);

      return integrationScore >= 0.8;
    } catch (error) {
      console.log(`Pipeline Integration: ❌ Failed (${error.message})`);
      return false;
    }
  }

  async validateWebInterface() {
    console.log('🌐 Validating Web Interface...');

    try {
      // Check for UI components
      const uiComponents = [
        'src/components/AudioUploader.tsx',
        'src/components/ProcessingStatus.tsx',
        'src/components/DiagramPreview.tsx',
        'src/components/VideoRenderer.tsx',
        'src/components/pipeline-interface.tsx'
      ];

      const componentChecks = {};

      for (const component of uiComponents) {
        try {
          await fs.access(join(__dirname, component));
          componentChecks[component] = '✅ Present';
        } catch {
          componentChecks[component] = '❌ Missing';
        }
      }

      this.results.validationResults.webInterface = componentChecks;

      const presentComponents = Object.values(componentChecks).filter(status => status.includes('✅')).length;
      const uiScore = presentComponents / uiComponents.length;

      console.log(`Web Interface: ${uiScore >= 0.8 ? '✅' : '⚠️'} ${presentComponents}/${uiComponents.length} components`);

      return uiScore >= 0.8;
    } catch (error) {
      console.log(`Web Interface: ❌ Failed (${error.message})`);
      return false;
    }
  }

  async validateDependencies() {
    console.log('📦 Validating Dependencies...');

    try {
      const packagePath = join(__dirname, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const requiredDeps = [
        'remotion',
        '@remotion/captions',
        '@remotion/media-utils',
        '@dagrejs/dagre',
        'react',
        'typescript'
      ];

      const depChecks = {};

      for (const dep of requiredDeps) {
        const hasInDeps = packageJson.dependencies?.[dep];
        const hasInDevDeps = packageJson.devDependencies?.[dep];
        depChecks[dep] = hasInDeps || hasInDevDeps ? '✅ Installed' : '❌ Missing';
      }

      this.results.validationResults.dependencies = depChecks;

      const installedDeps = Object.values(depChecks).filter(status => status.includes('✅')).length;
      const depScore = installedDeps / requiredDeps.length;

      console.log(`Dependencies: ${depScore === 1 ? '✅' : '⚠️'} ${installedDeps}/${requiredDeps.length} required`);

      return depScore === 1;
    } catch (error) {
      console.log(`Dependencies: ❌ Failed (${error.message})`);
      return false;
    }
  }

  async validateIterationHistory() {
    console.log('📊 Validating Iteration History...');

    try {
      const iterationLogPath = join(__dirname, '.module/ITERATION_LOG.md');
      await fs.access(iterationLogPath);

      const logContent = await fs.readFile(iterationLogPath, 'utf-8');

      const historyChecks = {
        hasIterationLog: true,
        tracksMVP: logContent.includes('MVP構築'),
        tracksAnalysis: logContent.includes('内容分析'),
        tracksVisualization: logContent.includes('図解生成'),
        tracksQuality: logContent.includes('品質向上'),
        hasMetrics: logContent.includes('成功率') || logContent.includes('精度'),
        currentIteration: logContent.match(/Iteration[:\s]*(\d+)/)?.[1] || 'unknown'
      };

      this.results.validationResults.iterationHistory = historyChecks;

      console.log(`Iteration History: ✅ Current iteration ${historyChecks.currentIteration}`);

      return true;
    } catch (error) {
      console.log(`Iteration History: ⚠️ Limited tracking (${error.message})`);
      return false;
    }
  }

  generateRecommendations(validationResults) {
    const recommendations = [];

    if (!validationResults.architecture) {
      recommendations.push('🏗️ Complete missing module directories according to custom instructions');
    }

    if (!validationResults.pipelineIntegration) {
      recommendations.push('🔄 Enhance pipeline integration with error handling and quality monitoring');
    }

    if (!validationResults.webInterface) {
      recommendations.push('🌐 Implement missing UI components for complete user experience');
    }

    if (!validationResults.dependencies) {
      recommendations.push('📦 Install missing dependencies required by custom instructions');
    }

    // Always suggest next iteration improvement
    recommendations.push('🚀 Continue recursive development process with next iteration focus');
    recommendations.push('📈 Run comprehensive system demonstration as per custom instructions');

    return recommendations;
  }

  async runValidation() {
    console.log('🎯 Custom Instructions Validation Started\n');

    const validationResults = {
      architecture: await this.validateSystemArchitecture(),
      pipelineIntegration: await this.validatePipelineIntegration(),
      webInterface: await this.validateWebInterface(),
      dependencies: await this.validateDependencies(),
      iterationHistory: await this.validateIterationHistory()
    };

    const passedChecks = Object.values(validationResults).filter(Boolean).length;
    const totalChecks = Object.keys(validationResults).length;
    const overallScore = (passedChecks / totalChecks) * 100;

    this.results.systemStatus = overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs-improvement';
    this.results.validationResults = validationResults;
    this.results.recommendations = this.generateRecommendations(validationResults);
    this.results.overallScore = overallScore;

    console.log('\n📋 Validation Summary:');
    console.log(`Overall Score: ${overallScore.toFixed(1)}% (${passedChecks}/${totalChecks} checks passed)`);
    console.log(`System Status: ${this.results.systemStatus.toUpperCase()}`);

    if (this.results.recommendations.length > 0) {
      console.log('\n🎯 Recommendations:');
      this.results.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    // Save results
    const reportPath = join(__dirname, `custom-instructions-validation-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    return this.results;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new CustomInstructionsValidator();
  validator.runValidation()
    .then(results => {
      process.exit(results.overallScore >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { CustomInstructionsValidator };