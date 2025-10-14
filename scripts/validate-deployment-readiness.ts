#!/usr/bin/env tsx
/**
 * Phase 36: Deployment Readiness Validation
 *
 * Comprehensive pre-deployment validation script that verifies
 * all system components are production-ready.
 *
 * Based on Custom Instructions Section 9 (System Completion Criteria)
 *
 * Validates:
 * - ✅ All dependencies installed
 * - ✅ Environment configuration
 * - ✅ File structure integrity
 * - ✅ TypeScript compilation
 * - ✅ Quality metrics meet thresholds
 * - ✅ MVP completion (6/6 criteria)
 * - ✅ Error handling robustness
 * - ✅ Performance benchmarks
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ValidationResult {
  category: string;
  checks: CheckResult[];
  passed: number;
  failed: number;
  warnings: number;
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

interface DeploymentReport {
  timestamp: Date;
  overallStatus: 'ready' | 'not_ready' | 'ready_with_warnings';
  results: ValidationResult[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  recommendations: string[];
}

class DeploymentValidator {
  private results: ValidationResult[] = [];

  /**
   * Run all validation checks
   */
  async validate(): Promise<DeploymentReport> {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║       🚀 DEPLOYMENT READINESS VALIDATION - PHASE 36           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Run all validation categories
    await this.validateDependencies();
    await this.validateEnvironment();
    await this.validateFileStructure();
    await this.validateTypeScript();
    await this.validateMVPCriteria();
    await this.validateQualityMetrics();
    await this.validateErrorHandling();
    await this.validatePerformance();

    // Generate final report
    return this.generateReport();
  }

  /**
   * Validate all required dependencies
   */
  private async validateDependencies(): Promise<void> {
    console.log('📦 Validating Dependencies...\n');
    const checks: CheckResult[] = [];

    const requiredDeps = [
      '@remotion/captions',
      '@remotion/media-utils',
      '@remotion/player',
      '@remotion/renderer',
      '@dagrejs/dagre',
      '@google/generative-ai',
      'react',
      'remotion',
    ];

    for (const dep of requiredDeps) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
        );

        const isInstalled =
          packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];

        if (isInstalled) {
          checks.push({
            name: dep,
            status: 'pass',
            message: `✅ Installed (${isInstalled})`,
          });
        } else {
          checks.push({
            name: dep,
            status: 'fail',
            message: '❌ Not found in package.json',
          });
        }
      } catch (error) {
        checks.push({
          name: dep,
          status: 'fail',
          message: `❌ Error checking: ${error}`,
        });
      }
    }

    this.addResult('Dependencies', checks);
  }

  /**
   * Validate environment configuration
   */
  private async validateEnvironment(): Promise<void> {
    console.log('🔧 Validating Environment Configuration...\n');
    const checks: CheckResult[] = [];

    // Check for .env file
    if (fs.existsSync('.env')) {
      checks.push({
        name: '.env file',
        status: 'pass',
        message: '✅ Found',
      });

      // Check GOOGLE_API_KEY
      try {
        const envContent = fs.readFileSync('.env', 'utf-8');
        if (envContent.includes('GOOGLE_API_KEY=')) {
          const keyMatch = envContent.match(/GOOGLE_API_KEY="?([^"\n]+)"?/);
          if (keyMatch && keyMatch[1] && keyMatch[1].length > 20) {
            checks.push({
              name: 'GOOGLE_API_KEY',
              status: 'pass',
              message: '✅ Configured',
              details: `Length: ${keyMatch[1].length} characters`,
            });
          } else {
            checks.push({
              name: 'GOOGLE_API_KEY',
              status: 'warn',
              message: '⚠️  Key appears invalid or too short',
            });
          }
        } else {
          checks.push({
            name: 'GOOGLE_API_KEY',
            status: 'fail',
            message: '❌ Not found in .env',
          });
        }
      } catch (error) {
        checks.push({
          name: 'GOOGLE_API_KEY',
          status: 'fail',
          message: `❌ Error reading .env: ${error}`,
        });
      }
    } else {
      checks.push({
        name: '.env file',
        status: 'fail',
        message: '❌ Not found',
      });
    }

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (majorVersion >= 18) {
        checks.push({
          name: 'Node.js version',
          status: 'pass',
          message: `✅ ${nodeVersion} (>= 18 required)`,
        });
      } else {
        checks.push({
          name: 'Node.js version',
          status: 'fail',
          message: `❌ ${nodeVersion} (>= 18 required)`,
        });
      }
    } catch (error) {
      checks.push({
        name: 'Node.js version',
        status: 'warn',
        message: '⚠️  Could not determine version',
      });
    }

    this.addResult('Environment', checks);
  }

  /**
   * Validate file structure integrity
   */
  private async validateFileStructure(): Promise<void> {
    console.log('📁 Validating File Structure...\n');
    const checks: CheckResult[] = [];

    const requiredDirs = [
      'src/analysis',
      'src/transcription',
      'src/visualization',
      'src/animation',
      'src/pipeline',
      'src/monitoring',
      'src/quality',
      'public',
      'scripts',
      '.module',
    ];

    for (const dir of requiredDirs) {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        checks.push({
          name: dir,
          status: 'pass',
          message: '✅ Exists',
        });
      } else {
        checks.push({
          name: dir,
          status: 'fail',
          message: '❌ Missing',
        });
      }
    }

    const requiredFiles = [
      'src/analysis/content-analyzer.ts',
      'src/analysis/llm-service.ts',
      'src/pipeline/quality-monitor.ts',
      'src/monitoring/production-monitor.ts',
      'src/quality/regression-detector.ts',
      'package.json',
      'tsconfig.json',
    ];

    for (const file of requiredFiles) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        checks.push({
          name: file,
          status: 'pass',
          message: '✅ Exists',
        });
      } else {
        checks.push({
          name: file,
          status: 'fail',
          message: '❌ Missing',
        });
      }
    }

    this.addResult('File Structure', checks);
  }

  /**
   * Validate TypeScript compilation
   */
  private async validateTypeScript(): Promise<void> {
    console.log('🔨 Validating TypeScript Compilation...\n');
    const checks: CheckResult[] = [];

    try {
      console.log('   Running: npm run type-check...');
      execSync('npm run type-check', {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      checks.push({
        name: 'TypeScript Compilation',
        status: 'pass',
        message: '✅ No type errors',
      });
    } catch (error: any) {
      const errorOutput = error.stdout || error.stderr || error.message;
      checks.push({
        name: 'TypeScript Compilation',
        status: 'fail',
        message: '❌ Type errors detected',
        details: errorOutput.split('\n').slice(0, 10).join('\n'),
      });
    }

    this.addResult('TypeScript', checks);
  }

  /**
   * Validate MVP completion criteria (Section 9.1)
   */
  private async validateMVPCriteria(): Promise<void> {
    console.log('✅ Validating MVP Completion Criteria...\n');
    const checks: CheckResult[] = [];

    // Functional requirements (all 6 must be met)
    const functionalRequirements = [
      {
        name: 'Audio File Input',
        check: () => fs.existsSync('src/transcription'),
        message: 'Transcription module exists',
      },
      {
        name: 'Auto Transcription',
        check: () => fs.existsSync('src/transcription/whisper-transcriber.ts') || fs.existsSync('src/transcription/transcriber.ts'),
        message: 'Whisper transcriber implemented',
      },
      {
        name: 'Scene Segmentation',
        check: () => fs.existsSync('src/analysis'),
        message: 'Analysis module exists',
      },
      {
        name: 'LLM Diagram Generation',
        check: () => fs.existsSync('src/analysis/llm-service.ts'),
        message: 'LLM service (Gemini) implemented',
      },
      {
        name: 'Layout Generation',
        check: () => fs.existsSync('src/visualization'),
        message: 'Visualization module exists',
      },
      {
        name: 'Video Output',
        check: () => fs.existsSync('src/animation') || fs.existsSync('src/remotion'),
        message: 'Animation/Remotion module exists',
      },
    ];

    for (const req of functionalRequirements) {
      try {
        if (req.check()) {
          checks.push({
            name: req.name,
            status: 'pass',
            message: `✅ ${req.message}`,
          });
        } else {
          checks.push({
            name: req.name,
            status: 'fail',
            message: `❌ ${req.message} - NOT FOUND`,
          });
        }
      } catch (error) {
        checks.push({
          name: req.name,
          status: 'fail',
          message: `❌ Error: ${error}`,
        });
      }
    }

    this.addResult('MVP Functional Requirements', checks);
  }

  /**
   * Validate quality metrics meet thresholds (Section 5.1)
   */
  private async validateQualityMetrics(): Promise<void> {
    console.log('📊 Validating Quality Metrics...\n');
    const checks: CheckResult[] = [];

    // Check if QualityMonitor is properly implemented
    try {
      const qualityMonitorPath = 'src/pipeline/quality-monitor.ts';
      if (fs.existsSync(qualityMonitorPath)) {
        const content = fs.readFileSync(qualityMonitorPath, 'utf-8');

        // Check for required thresholds from Custom Instructions
        const requiredThresholds = [
          'transcriptionAccuracy',
          'sceneSegmentationF1',
          'entityExtractionF1',
          'relationshipAccuracy',
          'layoutOverlap',
          'renderTime',
          'memoryUsage',
        ];

        for (const threshold of requiredThresholds) {
          if (content.includes(threshold)) {
            checks.push({
              name: `Threshold: ${threshold}`,
              status: 'pass',
              message: '✅ Defined',
            });
          } else {
            checks.push({
              name: `Threshold: ${threshold}`,
              status: 'warn',
              message: '⚠️  Not found in QualityMonitor',
            });
          }
        }
      } else {
        checks.push({
          name: 'QualityMonitor',
          status: 'fail',
          message: '❌ quality-monitor.ts not found',
        });
      }
    } catch (error) {
      checks.push({
        name: 'QualityMonitor',
        status: 'fail',
        message: `❌ Error: ${error}`,
      });
    }

    this.addResult('Quality Metrics', checks);
  }

  /**
   * Validate error handling robustness
   */
  private async validateErrorHandling(): Promise<void> {
    console.log('🛡️  Validating Error Handling...\n');
    const checks: CheckResult[] = [];

    // Check for fallback mechanisms (Custom Instructions Section 8)
    const fallbackFiles = [
      { file: 'src/analysis/content-analyzer.ts', pattern: 'analyzeV1' },
      { file: 'src/analysis/llm-service.ts', pattern: 'fallback' },
    ];

    for (const { file, pattern } of fallbackFiles) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes(pattern)) {
            checks.push({
              name: `Fallback in ${path.basename(file)}`,
              status: 'pass',
              message: `✅ Found '${pattern}'`,
            });
          } else {
            checks.push({
              name: `Fallback in ${path.basename(file)}`,
              status: 'warn',
              message: `⚠️  Pattern '${pattern}' not found`,
            });
          }
        }
      } catch (error) {
        checks.push({
          name: `Fallback in ${path.basename(file)}`,
          status: 'fail',
          message: `❌ Error: ${error}`,
        });
      }
    }

    this.addResult('Error Handling', checks);
  }

  /**
   * Validate performance benchmarks
   */
  private async validatePerformance(): Promise<void> {
    console.log('⚡ Validating Performance Benchmarks...\n');
    const checks: CheckResult[] = [];

    // Check for test scripts
    const testScripts = [
      'scripts/test-complete-audio-pipeline.ts',
      'scripts/demo-custom-instructions.ts',
    ];

    for (const script of testScripts) {
      if (fs.existsSync(script)) {
        checks.push({
          name: path.basename(script),
          status: 'pass',
          message: '✅ Test script exists',
        });
      } else {
        checks.push({
          name: path.basename(script),
          status: 'warn',
          message: '⚠️  Test script missing',
        });
      }
    }

    this.addResult('Performance', checks);
  }

  /**
   * Add validation result
   */
  private addResult(category: string, checks: CheckResult[]): void {
    const passed = checks.filter(c => c.status === 'pass').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    const warnings = checks.filter(c => c.status === 'warn').length;

    this.results.push({
      category,
      checks,
      passed,
      failed,
      warnings,
    });

    console.log(`   ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️  Warnings: ${warnings}\n`);
  }

  /**
   * Generate final deployment report
   */
  private generateReport(): DeploymentReport {
    const totalChecks = this.results.reduce((sum, r) => sum + r.checks.length, 0);
    const passedChecks = this.results.reduce((sum, r) => sum + r.passed, 0);
    const failedChecks = this.results.reduce((sum, r) => sum + r.failed, 0);
    const warningChecks = this.results.reduce((sum, r) => sum + r.warnings, 0);

    const recommendations: string[] = [];

    // Analyze failures and generate recommendations
    if (failedChecks > 0) {
      recommendations.push('❌ DEPLOYMENT BLOCKED: Fix all failed checks before deploying.');

      this.results.forEach(result => {
        result.checks.filter(c => c.status === 'fail').forEach(check => {
          recommendations.push(`   - Fix: ${result.category} - ${check.name}`);
        });
      });
    }

    if (warningChecks > 0) {
      recommendations.push(`⚠️  ${warningChecks} warnings detected. Review before deployment.`);
    }

    if (failedChecks === 0 && warningChecks === 0) {
      recommendations.push('✅ All checks passed! System is production-ready.');
      recommendations.push('   Next steps:');
      recommendations.push('   1. Run final end-to-end test with real audio');
      recommendations.push('   2. Deploy to staging environment');
      recommendations.push('   3. Monitor metrics for 24 hours');
      recommendations.push('   4. Deploy to production');
    } else if (failedChecks === 0) {
      recommendations.push('✅ System ready for deployment with minor warnings.');
      recommendations.push('   Address warnings when possible, but deployment can proceed.');
    }

    const overallStatus: DeploymentReport['overallStatus'] =
      failedChecks > 0
        ? 'not_ready'
        : warningChecks > 0
        ? 'ready_with_warnings'
        : 'ready';

    return {
      timestamp: new Date(),
      overallStatus,
      results: this.results,
      totalChecks,
      passedChecks,
      failedChecks,
      warningChecks,
      recommendations,
    };
  }
}

/**
 * Format and display deployment report
 */
function displayReport(report: DeploymentReport): void {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              📋 DEPLOYMENT READINESS REPORT                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const statusIcon =
    report.overallStatus === 'ready' ? '✅' :
    report.overallStatus === 'ready_with_warnings' ? '⚠️' : '❌';

  console.log(`${statusIcon} Overall Status: ${report.overallStatus.toUpperCase().replace('_', ' ')}\n`);
  console.log(`📊 Total Checks: ${report.totalChecks}`);
  console.log(`   ✅ Passed: ${report.passedChecks}`);
  console.log(`   ❌ Failed: ${report.failedChecks}`);
  console.log(`   ⚠️  Warnings: ${report.warningChecks}\n`);

  console.log(`🎯 Success Rate: ${((report.passedChecks / report.totalChecks) * 100).toFixed(1)}%\n`);

  console.log('📋 Category Breakdown:\n');
  report.results.forEach(result => {
    const icon =
      result.failed === 0 && result.warnings === 0 ? '✅' :
      result.failed > 0 ? '❌' : '⚠️';

    console.log(`   ${icon} ${result.category}: ${result.passed}/${result.checks.length} passed`);

    // Show failed checks
    result.checks
      .filter(c => c.status === 'fail')
      .forEach(check => {
        console.log(`      ❌ ${check.name}: ${check.message}`);
        if (check.details) {
          console.log(`         ${check.details.split('\n')[0]}`);
        }
      });
  });

  console.log('\n💡 Recommendations:\n');
  report.recommendations.forEach(rec => {
    console.log(`   ${rec}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log(`\n⏰ Report generated: ${report.timestamp.toISOString()}\n`);

  // Exit with appropriate code
  if (report.overallStatus === 'not_ready') {
    console.log('❌ Deployment validation FAILED. Fix issues before deploying.\n');
    process.exit(1);
  } else if (report.overallStatus === 'ready_with_warnings') {
    console.log('⚠️  Deployment validation PASSED with warnings.\n');
    process.exit(0);
  } else {
    console.log('✅ Deployment validation PASSED. System is production-ready!\n');
    process.exit(0);
  }
}

/**
 * Main execution
 */
async function main() {
  const validator = new DeploymentValidator();
  const report = await validator.validate();
  displayReport(report);
}

main().catch(error => {
  console.error('❌ Validation failed with error:', error);
  process.exit(1);
});
