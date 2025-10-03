#!/usr/bin/env node

/**
 * Systematic Commit Strategy
 * Implements custom instruction's commit protocol with proper tagging and messaging
 */

import fs from 'fs';
import path from 'path';

console.log('📝 AutoDiagram Video Generator - Commit Strategy Framework');
console.log('='.repeat(65));

class CommitStrategy {
  constructor() {
    this.commitRules = {
      triggers: {
        immediate: [
          'before_destructive_changes',
          'after_successful_operation',
          'after_30_minutes_work'
        ],
        checkpoint: [
          'iteration_completion',
          'test_passage',
          'performance_improvement'
        ],
        review: [
          'phase_completion',
          'major_design_change',
          'before_external_review'
        ]
      },

      messageFormat: {
        types: ['feat', 'fix', 'perf', 'refactor', 'test', 'docs'],
        scopes: ['transcription', 'analysis', 'visualization', 'pipeline', 'remotion', 'ui'],
        structure: '<type>(<scope>): <subject> [iteration-N]'
      },

      safety: {
        neverUpdateGitConfig: true,
        neverForceOperations: true,
        neverSkipHooks: true,
        neverForcePushMain: true,
        alwaysCheckAuthorship: true
      }
    };

    this.tagSystem = {
      phases: ['foundation', 'mvp', 'enhancement', 'optimization', 'production'],
      format: 'phase-{phase}-iteration-{iteration}',
      releaseFormat: 'v{major}.{minor}.{patch}-{phase}'
    };

    this.workingState = {
      currentPhase: 'enhancement',
      currentIteration: 1,
      lastCommit: null,
      changesSinceLastCommit: []
    };
  }

  async analyzeCurrentState() {
    console.log('🔍 Analyzing current repository state...');

    const state = {
      gitStatus: await this.getGitStatus(),
      lastCommit: await this.getLastCommit(),
      unstagedChanges: await this.getUnstagedChanges(),
      stagedChanges: await this.getStagedChanges(),
      recentCommits: await this.getRecentCommits(5),
      currentBranch: await this.getCurrentBranch()
    };

    console.log('📊 Repository Status:');
    console.log(`  📍 Current Branch: ${state.currentBranch}`);
    console.log(`  📝 Last Commit: ${state.lastCommit}`);
    console.log(`  📋 Unstaged Changes: ${state.unstagedChanges.length} files`);
    console.log(`  ✅ Staged Changes: ${state.stagedChanges.length} files`);

    return state;
  }

  async determineCommitTrigger(changes, context = {}) {
    console.log('🎯 Determining commit trigger...');

    const triggers = [];

    // Check for immediate triggers
    if (context.beforeDestructiveChange) {
      triggers.push({ type: 'immediate', reason: 'before_destructive_changes', priority: 'high' });
    }

    if (context.successfulOperation) {
      triggers.push({ type: 'immediate', reason: 'after_successful_operation', priority: 'medium' });
    }

    if (context.workTimeMinutes && context.workTimeMinutes >= 30) {
      triggers.push({ type: 'immediate', reason: 'after_30_minutes_work', priority: 'medium' });
    }

    // Check for checkpoint triggers
    if (context.iterationComplete) {
      triggers.push({ type: 'checkpoint', reason: 'iteration_completion', priority: 'high' });
    }

    if (context.testsPass) {
      triggers.push({ type: 'checkpoint', reason: 'test_passage', priority: 'medium' });
    }

    if (context.performanceImprovement) {
      triggers.push({ type: 'checkpoint', reason: 'performance_improvement', priority: 'medium' });
    }

    // Check for review triggers
    if (context.phaseComplete) {
      triggers.push({ type: 'review', reason: 'phase_completion', priority: 'high' });
    }

    if (context.majorDesignChange) {
      triggers.push({ type: 'review', reason: 'major_design_change', priority: 'high' });
    }

    // Default trigger based on changes
    if (triggers.length === 0 && changes.length > 0) {
      triggers.push({ type: 'checkpoint', reason: 'accumulated_changes', priority: 'low' });
    }

    const highestPriorityTrigger = triggers
      .sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority))[0];

    if (highestPriorityTrigger) {
      console.log(`✅ Commit trigger: ${highestPriorityTrigger.type} (${highestPriorityTrigger.reason})`);
    } else {
      console.log('ℹ️ No commit trigger detected');
    }

    return highestPriorityTrigger || null;
  }

  async generateCommitMessage(changes, context = {}) {
    console.log('📝 Generating commit message...');

    // Analyze changes to determine type and scope
    const analysis = this.analyzeChanges(changes);

    const commitType = context.type || analysis.suggestedType;
    const scope = context.scope || analysis.suggestedScope;
    const iteration = context.iteration || this.workingState.currentIteration;

    // Generate subject line
    const subject = this.generateSubject(analysis, context);

    // Build commit message
    const message = this.buildCommitMessage(commitType, scope, subject, iteration, analysis, context);

    console.log('📋 Generated commit message:');
    console.log(message);

    return message;
  }

  analyzeChanges(changes) {
    const analysis = {
      modifiedFiles: changes.filter(c => c.status === 'modified'),
      newFiles: changes.filter(c => c.status === 'new'),
      deletedFiles: changes.filter(c => c.status === 'deleted'),
      suggestedType: 'feat',
      suggestedScope: 'pipeline'
    };

    // Determine type based on file patterns
    const filePatterns = {
      feat: [/src\/.*\.ts$/, /src\/.*\.tsx$/, /\.mjs$/],
      fix: [/test/, /spec/, /\.test\./],
      docs: [/\.md$/, /README/, /docs\//],
      perf: [/optimization/, /performance/],
      refactor: [/refactor/, /cleanup/]
    };

    for (const [type, patterns] of Object.entries(filePatterns)) {
      for (const pattern of patterns) {
        if (changes.some(change => pattern.test(change.file))) {
          analysis.suggestedType = type;
          break;
        }
      }
    }

    // Determine scope based on directory structure
    const scopePatterns = {
      transcription: /src\/transcription/,
      analysis: /src\/analysis/,
      visualization: /src\/visualization/,
      remotion: /src\/remotion/,
      pipeline: /src\/pipeline/,
      ui: /src\/components/,
      test: /test|spec/
    };

    for (const [scope, pattern] of Object.entries(scopePatterns)) {
      if (changes.some(change => pattern.test(change.file))) {
        analysis.suggestedScope = scope;
        break;
      }
    }

    return analysis;
  }

  generateSubject(analysis, context) {
    if (context.customSubject) {
      return context.customSubject;
    }

    const templates = {
      feat: 'Add {feature} functionality',
      fix: 'Correct {issue} in {component}',
      perf: 'Optimize {component} performance by {improvement}',
      refactor: 'Restructure {component} for better maintainability',
      test: 'Add comprehensive tests for {component}',
      docs: 'Update {component} documentation'
    };

    const template = templates[analysis.suggestedType] || 'Update {component}';

    // Simple template substitution
    return template
      .replace('{feature}', context.feature || 'new')
      .replace('{issue}', context.issue || 'logic issues')
      .replace('{component}', analysis.suggestedScope)
      .replace('{improvement}', context.improvement || 'improved algorithms');
  }

  buildCommitMessage(type, scope, subject, iteration, analysis, context) {
    const lines = [];

    // Header line
    lines.push(`${type}(${scope}): ${subject} [iteration-${iteration}]`);

    // Blank line
    lines.push('');

    // Body with details
    if (analysis.newFiles.length > 0) {
      lines.push(`✨ Added: ${analysis.newFiles.length} new files`);
    }
    if (analysis.modifiedFiles.length > 0) {
      lines.push(`🔧 Modified: ${analysis.modifiedFiles.length} files`);
    }
    if (analysis.deletedFiles.length > 0) {
      lines.push(`🗑️ Removed: ${analysis.deletedFiles.length} files`);
    }

    // Performance metrics if available
    if (context.metrics) {
      lines.push('');
      lines.push('📊 Performance Metrics:');
      if (context.metrics.processingTime) {
        lines.push(`⏱️ Processing time: ${(context.metrics.processingTime / 1000).toFixed(2)}s`);
      }
      if (context.metrics.qualityScore) {
        lines.push(`🎯 Quality score: ${(context.metrics.qualityScore * 100).toFixed(1)}%`);
      }
      if (context.metrics.improvement) {
        lines.push(`📈 Improvement: ${context.metrics.improvement}`);
      }
    }

    // Test status
    if (context.testsPass !== undefined) {
      lines.push('');
      lines.push(`🧪 Tests: ${context.testsPass ? '✅ All passing' : '⚠️ Some failing'}`);
    }

    // Footer
    lines.push('');
    lines.push('🤖 Generated with [Claude Code](https://claude.com/claude-code)');
    lines.push('');
    lines.push('Co-Authored-By: Claude <noreply@anthropic.com>');

    return lines.join('\\n');
  }

  async safeCommit(message, options = {}) {
    console.log('🔒 Performing safe commit...');

    try {
      // Safety checks
      await this.performSafetyChecks();

      // Stage changes if not already staged
      if (options.autoStage) {
        await this.stageChanges(options.files);
      }

      // Create commit (dry run for now)
      const commitCommand = this.buildCommitCommand(message);
      console.log('📝 Commit command (dry run):');
      console.log(commitCommand);

      // Generate tag if this is a significant commit
      if (options.createTag) {
        const tag = this.generateTag();
        console.log(`🏷️ Tag would be created: ${tag}`);
      }

      console.log('✅ Safe commit prepared (not executed in demo mode)');

      return {
        success: true,
        message,
        dryRun: true,
        command: commitCommand
      };

    } catch (error) {
      console.log('❌ Commit safety check failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async performSafetyChecks() {
    console.log('🛡️ Performing safety checks...');

    const checks = [];

    // Check 1: Not on main/master with force operations
    const branch = await this.getCurrentBranch();
    if (['main', 'master'].includes(branch)) {
      checks.push('⚠️ On main branch - extra caution required');
    } else {
      checks.push('✅ Safe branch for commits');
    }

    // Check 2: No uncommitted critical files
    const criticalFiles = ['.env', 'credentials.json', 'secrets.yaml'];
    const stagedFiles = await this.getStagedChanges();
    const criticalStaged = stagedFiles.filter(file =>
      criticalFiles.some(critical => file.includes(critical))
    );

    if (criticalStaged.length > 0) {
      checks.push(`⚠️ Critical files staged: ${criticalStaged.join(', ')}`);
      throw new Error('Critical files detected in staged changes');
    } else {
      checks.push('✅ No critical files in staged changes');
    }

    // Check 3: Authorship verification
    const authorInfo = await this.getAuthorInfo();
    checks.push(`👤 Author: ${authorInfo}`);

    checks.forEach(check => console.log(`  ${check}`));

    return checks;
  }

  buildCommitCommand(message) {
    // Using heredoc format as specified in instructions
    return `git commit -m "$(cat <<'EOF'
${message}
EOF
)"`;
  }

  generateTag() {
    const phase = this.workingState.currentPhase;
    const iteration = this.workingState.currentIteration;
    return `${phase}-iteration-${iteration}`;
  }

  async stageChanges(files = null) {
    console.log('📋 Staging changes...');

    if (files && files.length > 0) {
      console.log(`  📁 Staging specific files: ${files.join(', ')}`);
    } else {
      console.log('  📁 Staging all changes');
    }

    // This would execute: git add [files] or git add .
    return { staged: files ? files.length : 'all' };
  }

  getPriorityValue(priority) {
    const values = { high: 3, medium: 2, low: 1 };
    return values[priority] || 0;
  }

  // Git operation simulators (these would use actual git commands in real implementation)
  async getGitStatus() {
    return 'M ai-enhanced-test-report.json\\n?? mvp-verification-test.mjs\\n?? iterative-development-framework.mjs';
  }

  async getLastCommit() {
    return '7149b8e feat: Add next-generation AI-enhanced pipeline with multimodal analysis';
  }

  async getUnstagedChanges() {
    return [
      { file: 'ai-enhanced-test-report.json', status: 'modified' },
      { file: 'mvp-verification-test.mjs', status: 'new' },
      { file: 'iterative-development-framework.mjs', status: 'new' },
      { file: 'troubleshooting-protocol.mjs', status: 'new' }
    ];
  }

  async getStagedChanges() {
    return []; // No staged changes currently
  }

  async getRecentCommits(count) {
    return [
      '7149b8e feat: Add next-generation AI-enhanced pipeline with multimodal analysis',
      '233a0e8 feat: Complete Iteration 10 Ultra-High Performance Processing [iteration-10]',
      'c1fa63d feat: Complete Iteration 9 Smart Self-Optimization System [iteration-9]',
      '855c2a7 feat: Complete advanced system enhancements with production-ready features [iteration-14]',
      'af41f39 feat: Complete Iteration 13 system optimizations [iteration-13]'
    ];
  }

  async getCurrentBranch() {
    return 'main';
  }

  async getAuthorInfo() {
    return 'Claude <noreply@anthropic.com>';
  }

  // Demo method for testing the commit strategy
  async demonstrateCommitWorkflow() {
    console.log('🎬 Demonstrating complete commit workflow...');

    try {
      // 1. Analyze current state
      const state = await this.analyzeCurrentState();

      // 2. Determine if commit is needed
      const context = {
        successfulOperation: true,
        iterationComplete: true,
        testsPass: true,
        metrics: {
          processingTime: 2840,
          qualityScore: 0.93,
          improvement: '+15% accuracy'
        }
      };

      const trigger = await this.determineCommitTrigger(state.unstagedChanges, context);

      if (!trigger) {
        console.log('ℹ️ No commit needed at this time');
        return;
      }

      // 3. Generate commit message
      const commitMessage = await this.generateCommitMessage(state.unstagedChanges, {
        ...context,
        type: 'feat',
        scope: 'framework',
        customSubject: 'Implement iterative development framework with quality monitoring',
        iteration: 1
      });

      // 4. Perform safe commit
      const commitResult = await this.safeCommit(commitMessage, {
        autoStage: true,
        createTag: true
      });

      console.log('\\n🎉 Commit workflow completed successfully!');
      return commitResult;

    } catch (error) {
      console.log('❌ Commit workflow failed:', error.message);
      throw error;
    }
  }
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0] || 'demo';

const strategy = new CommitStrategy();

switch (command) {
  case 'demo':
    console.log('🎬 Running commit strategy demonstration...');
    strategy.demonstrateCommitWorkflow().catch(console.error);
    break;
  case 'analyze':
    console.log('🔍 Analyzing current repository state...');
    strategy.analyzeCurrentState().catch(console.error);
    break;
  case 'status':
    console.log('📊 Checking commit status...');
    strategy.analyzeCurrentState().then(state => {
      console.log(JSON.stringify(state, null, 2));
    }).catch(console.error);
    break;
  default:
    console.log('📚 Available commands:');
    console.log('  demo - Run complete commit workflow demonstration');
    console.log('  analyze - Analyze current repository state');
    console.log('  status - Show detailed commit status');
}

export default CommitStrategy;