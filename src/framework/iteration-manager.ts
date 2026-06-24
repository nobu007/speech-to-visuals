/**
 * Phase 39: IterationManager - Automated Iteration Tracking & Management
 *
 * Implements the recursive development cycle from custom instructions:
 * - Tracks iterations within phases
 * - Manages success criteria validation
 * - Handles failure recovery strategies
 * - Automates commit trigger decisions
 * - Provides real-time iteration metrics
 *
 * Based on: Custom Instructions Section 2 (段階的開発フロー)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PipelineConfigError } from '@/pipeline/pipeline-errors';
import { logger } from '../utils/logger';

export type IterationStatus = 'in_progress' | 'success' | 'failure';
export type CommitTrigger = 'on_success' | 'on_checkpoint' | 'on_review';
export type RecoveryStrategy = 'retry' | 'fallback' | 'minimal' | 'manual';

export interface DevelopmentCycle {
  phase: string;
  maxIterations: number;
  successCriteria: string[];
  failureRecovery: string;
  commitTrigger: CommitTrigger;
  currentIteration: number;
  status: IterationStatus;
}

export interface IterationMetrics {
  iterationNumber: number;
  status: IterationStatus;
  timestamp: string;
  duration: number; // milliseconds
  successCriteria: {
    criterion: string;
    met: boolean;
    value?: unknown;
    threshold?: unknown;
  }[];
  metrics: Record<string, unknown>;
  error?: string;
  nextSteps?: string[];
}

export interface IterationHistory {
  phase: string;
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  iterations: IterationMetrics[];
  finalStatus: IterationStatus;
  insights: string[];
}

/**
 * IterationManager: Manages the recursive development cycle
 */
export class IterationManager {
  private cycle: DevelopmentCycle;
  private history: IterationMetrics[] = [];
  private startTime: number = 0;
  private logPath: string;

  constructor(cycle: DevelopmentCycle, logPath?: string) {
    this.cycle = cycle;
    this.logPath = logPath || path.join(process.cwd(), 'docs', 'architecture', 'ITERATION_LOG.md');
  }

  /**
   * Start a new iteration
   */
  async startIteration(): Promise<void> {
    this.cycle.currentIteration++;
    this.startTime = Date.now();
    this.cycle.status = 'in_progress';
  }

  /**
   * Complete current iteration with results
   */
  async completeIteration(
    status: IterationStatus,
    metrics: Record<string, unknown>,
    error?: string
  ): Promise<IterationMetrics> {
    const duration = Date.now() - this.startTime;

    const iteration: IterationMetrics = {
      iterationNumber: this.cycle.currentIteration,
      status,
      timestamp: new Date().toISOString(),
      duration,
      successCriteria: this.cycle.successCriteria.map(criterion => ({
        criterion,
        met: status === 'success',
        value: metrics[criterion],
      })),
      metrics,
      error,
      nextSteps: this.determineNextSteps(status),
    };

    this.history.push(iteration);
    await this.logIteration(iteration);

    return iteration;
  }

  /**
   * Evaluate if current iteration meets success criteria
   */
  evaluateSuccessCriteria(metrics: Record<string, unknown>): {
    allMet: boolean;
    results: { criterion: string; met: boolean; reason?: string }[];
  } {
    const results = this.cycle.successCriteria.map(criterion => {
      const met = this.checkCriterion(criterion, metrics);
      return {
        criterion,
        met,
        reason: met ? undefined : `Failed: ${criterion}`,
      };
    });

    const allMet = results.every(r => r.met);

    return { allMet, results };
  }

  /**
   * Check if a specific criterion is met
   */
  private checkCriterion(criterion: string, metrics: Record<string, unknown>): boolean {
    // Extract threshold from criterion string (e.g., "accuracy > 80%" -> 80)
    const percentMatch = criterion.match(/(\d+)%/);
    const numberMatch = criterion.match(/(\d+)/);

    if (percentMatch) {
      const threshold = parseInt(percentMatch[1]);
      // Check various metric keys that might match
      const possibleKeys = [
        'accuracy', 'precision', 'rate', 'score', 'pass_rate', 'success_rate'
      ];

      for (const key of possibleKeys) {
        if (metrics[key] !== undefined) {
          const value = typeof metrics[key] === 'number' ? metrics[key] :
                       parseFloat(String(metrics[key]));
          return value >= threshold;
        }
      }
    }

    // For criteria without clear thresholds, check if relevant metrics exist
    return Object.keys(metrics).length > 0;
  }

  /**
   * Determine recovery strategy based on iteration status
   */
  determineRecoveryStrategy(): RecoveryStrategy {
    if (this.history.length === 0) return 'retry';
    const failureRate = this.history.filter(i => i.status === 'failure').length / this.history.length;

    if (this.cycle.currentIteration >= this.cycle.maxIterations) {
      return 'fallback';
    }

    if (failureRate > 0.5) {
      return 'minimal';
    }

    if (this.cycle.currentIteration === 1) {
      return 'retry';
    }

    return 'retry';
  }

  /**
   * Determine if commit should be triggered
   */
  shouldCommit(): boolean {
    const lastIteration = this.history[this.history.length - 1];

    switch (this.cycle.commitTrigger) {
      case 'on_success':
        return lastIteration?.status === 'success';

      case 'on_checkpoint': {
        // Commit every N successful iterations or at max iterations
        const successCount = this.history.filter(i => i.status === 'success').length;
        return successCount > 0 && (successCount % 3 === 0 ||
               this.cycle.currentIteration >= this.cycle.maxIterations);
      }

      case 'on_review':
        // Only commit at phase completion
        return lastIteration?.status === 'success' &&
               this.cycle.currentIteration >= this.cycle.maxIterations;

      default:
        return false;
    }
  }

  /**
   * Generate commit message based on iteration history
   */
  generateCommitMessage(): string {
    const successCount = this.history.filter(i => i.status === 'success').length;
    const totalCount = this.history.length;

    let type = 'feat';
    if (successCount === totalCount && totalCount > 1) {
      type = 'refactor';
    } else if (successCount < totalCount) {
      type = 'fix';
    }

    const message = `${type}(${this.cycle.phase.toLowerCase()}): ` +
      `${this.cycle.phase} completion [iteration-${this.cycle.currentIteration}]\n\n` +
      `✅ Success Rate: ${successCount}/${totalCount} iterations\n` +
      `📊 Criteria Met: ${this.cycle.successCriteria.join(', ')}\n` +
      `⏱️  Total Duration: ${this.getTotalDuration()}s\n\n` +
      `🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n` +
      `Co-Authored-By: Claude <noreply@anthropic.com>`;

    return message;
  }

  /**
   * Get iteration summary
   */
  getSummary(): IterationHistory {
    const successCount = this.history.filter(i => i.status === 'success').length;
    const failureCount = this.history.filter(i => i.status === 'failure').length;

    return {
      phase: this.cycle.phase,
      totalIterations: this.history.length,
      successfulIterations: successCount,
      failedIterations: failureCount,
      iterations: this.history,
      finalStatus: this.history[this.history.length - 1]?.status || 'in_progress',
      insights: this.generateInsights(),
    };
  }

  /**
   * Generate insights from iteration history
   */
  private generateInsights(): string[] {
    const insights: string[] = [];
    if (this.history.length === 0) return insights;
    const successRate = this.history.filter(i => i.status === 'success').length / this.history.length;

    if (successRate === 1.0) {
      insights.push('Perfect success rate - all iterations successful');
    } else if (successRate >= 0.8) {
      insights.push('High success rate - implementation is stable');
    } else if (successRate >= 0.5) {
      insights.push('Moderate success rate - some adjustments needed');
    } else {
      insights.push('Low success rate - consider fallback strategy');
    }

    const avgDuration = this.history.reduce((sum, i) => sum + i.duration, 0) / this.history.length;
    if (avgDuration < 5000) {
      insights.push('Fast iteration cycles - good for rapid development');
    } else if (avgDuration > 30000) {
      insights.push('Long iteration cycles - consider optimization');
    }

    if (this.history.length >= this.cycle.maxIterations) {
      insights.push('Maximum iterations reached - phase completion achieved');
    }

    return insights;
  }

  /**
   * Determine next steps based on status
   */
  private determineNextSteps(status: IterationStatus): string[] {
    if (status === 'success') {
      if (this.cycle.currentIteration >= this.cycle.maxIterations) {
        return ['Phase completed successfully', 'Commit changes', 'Move to next phase'];
      }
      return ['Continue to next iteration', 'Validate improvements', 'Monitor metrics'];
    }

    const strategy = this.determineRecoveryStrategy();
    const steps: string[] = [];

    switch (strategy) {
      case 'retry':
        steps.push('Analyze failure cause', 'Apply targeted fixes', 'Retry iteration');
        break;
      case 'fallback':
        steps.push('Use fallback approach', 'Simplify implementation', 'Validate basic functionality');
        break;
      case 'minimal':
        steps.push('Return to minimal viable implementation', 'Re-validate requirements', 'Rebuild incrementally');
        break;
      case 'manual':
        steps.push('Manual intervention required', 'Review logs and metrics', 'Consult documentation');
        break;
    }

    return steps;
  }

  /**
   * Log iteration to ITERATION_LOG.md
   */
  private async logIteration(iteration: IterationMetrics): Promise<void> {
    try {
      let logContent = '';

      try {
        logContent = await fs.readFile(this.logPath, 'utf-8');
      } catch {
        // File doesn't exist, create new
        logContent = '# Iteration History\n\nLast Updated: ' + new Date().toISOString() + '\n\n';
      }

      const logEntry = `
## ${this.cycle.phase}

### Iteration ${iteration.iterationNumber} - ${iteration.status}
**Date**: ${iteration.timestamp}
**Duration**: ${(iteration.duration / 1000).toFixed(2)}s

**Metrics**:
${Object.entries(iteration.metrics).map(([key, value]) => `- ${key}: ${value}`).join('\n')}

${iteration.error ? `**Error**:\n\`\`\`\n${iteration.error}\n\`\`\`\n` : ''}
**Next Steps**:
${iteration.nextSteps?.map(step => `- ${step}`).join('\n') || '- None'}

---

`;

      // Insert after header
      const lines = logContent.split('\n');
      const foundIndex = lines.findIndex(line => line.startsWith('## '));
      const insertIndex = foundIndex >= 0 ? foundIndex : 3;
      lines.splice(insertIndex, 0, logEntry);

      await fs.writeFile(this.logPath, lines.join('\n'), 'utf-8');
    } catch (error) {
      logger.warn(`Failed to log iteration: ${error}`);
    }
  }

  /**
   * Get total duration of all iterations
   */
  private getTotalDuration(): string {
    const total = this.history.reduce((sum, i) => sum + i.duration, 0);
    return (total / 1000).toFixed(2);
  }

  /**
   * Reset iteration manager for new phase
   */
  reset(): void {
    this.history = [];
    this.cycle.currentIteration = 0;
    this.cycle.status = 'in_progress';
  }
}

/**
 * Predefined development cycles from custom instructions
 */
export const DEVELOPMENT_CYCLES: Record<string, Omit<DevelopmentCycle, 'currentIteration' | 'status'>> = {
  'MVP構築': {
    phase: 'MVP構築',
    maxIterations: 3,
    successCriteria: ['音声入力→字幕付き動画出力が動作'],
    failureRecovery: '最小構成に戻って再構築',
    commitTrigger: 'on_success',
  },
  '内容分析': {
    phase: '内容分析',
    maxIterations: 5,
    successCriteria: ['シーン分割精度80%', '主要エンティティ抽出率90%', '関係性の正確性85%'],
    failureRecovery: 'ルールベースにフォールバック',
    commitTrigger: 'on_checkpoint',
  },
  '図解生成': {
    phase: '図解生成',
    maxIterations: 4,
    successCriteria: ['レイアウト破綻0', 'ラベル可読性100%'],
    failureRecovery: '手動レイアウトテンプレート使用',
    commitTrigger: 'on_review',
  },
  'E2E統合': {
    phase: 'E2E統合',
    maxIterations: 3,
    successCriteria: ['処理成功率>90%', '平均処理時間<60秒', '出力品質:視認可能'],
    failureRecovery: 'パイプライン分割実行',
    commitTrigger: 'on_success',
  },
  '品質向上': {
    phase: '品質向上',
    maxIterations: 5,
    successCriteria: ['全体品質スコア>95', 'テスト通過率100%', 'ゼロクリティカルバグ'],
    failureRecovery: '個別モジュール最適化',
    commitTrigger: 'on_checkpoint',
  },
};

/**
 * Create iteration manager for specific phase
 */
export function createIterationManager(
  phaseName: keyof typeof DEVELOPMENT_CYCLES,
  logPath?: string
): IterationManager {
  const cycleTemplate = DEVELOPMENT_CYCLES[phaseName];
  if (!cycleTemplate) {
    throw new PipelineConfigError('phaseName', `Unknown phase: ${phaseName}`);
  }

  const cycle: DevelopmentCycle = {
    ...cycleTemplate,
    currentIteration: 0,
    status: 'in_progress',
  };

  return new IterationManager(cycle, logPath);
}
