/**
 * Adaptive Quality Gates System
 * Phase 20: Production Excellence
 *
 * Implements dynamic quality thresholds that adapt based on historical performance
 * Provides automated deployment validation and continuous quality assessment
 */

import { realTimeMonitor, PerformanceSnapshot } from '@/monitoring/real-time-performance-monitor';

export interface QualityGate {
  name: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  severity: 'blocker' | 'critical' | 'major' | 'minor';
  adaptable: boolean;
  currentValue?: number;
  passed?: boolean;
  message?: string;
}

export interface QualityGateResult {
  passed: boolean;
  timestamp: number;
  gates: QualityGate[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    blockers: number;
  };
  recommendations: string[];
  deploymentReady: boolean;
}

export interface AdaptiveThreshold {
  metric: string;
  baselineValue: number;
  currentValue: number;
  adaptedThreshold: number;
  confidence: number;
  historicalValues: number[];
  lastUpdated: number;
}

class AdaptiveQualityGatesSystem {
  private gates: QualityGate[] = [];
  private adaptiveThresholds: Map<string, AdaptiveThreshold> = new Map();
  private qualityHistory: QualityGateResult[] = [];
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    this.initializeDefaultGates();
  }

  /**
   * Initialize default quality gates
   */
  private initializeDefaultGates(): void {
    // Performance Gates
    this.addGate({
      name: 'Processing Time SLA',
      metric: 'avgProcessingTime',
      threshold: 60000, // 60 seconds
      operator: 'lt',
      severity: 'critical',
      adaptable: true
    });

    this.addGate({
      name: 'P95 Processing Time',
      metric: 'p95ProcessingTime',
      threshold: 120000, // 2 minutes
      operator: 'lt',
      severity: 'major',
      adaptable: true
    });

    // Reliability Gates
    this.addGate({
      name: 'Success Rate',
      metric: 'successRate',
      threshold: 0.95, // 95%
      operator: 'gte',
      severity: 'blocker',
      adaptable: true
    });

    this.addGate({
      name: 'Error Rate',
      metric: 'errorRate',
      threshold: 0.05, // 5%
      operator: 'lte',
      severity: 'critical',
      adaptable: true
    });

    this.addGate({
      name: 'Recovery Success Rate',
      metric: 'recoverySuccessRate',
      threshold: 0.80, // 80%
      operator: 'gte',
      severity: 'major',
      adaptable: true
    });

    // Resource Gates
    this.addGate({
      name: 'Memory Usage',
      metric: 'memoryUsagePercent',
      threshold: 85, // 85%
      operator: 'lt',
      severity: 'critical',
      adaptable: false
    });

    // LLM Integration Gates
    this.addGate({
      name: 'LLM Cache Hit Rate',
      metric: 'cacheHitRate',
      threshold: 0.30, // 30%
      operator: 'gte',
      severity: 'minor',
      adaptable: true
    });

    this.addGate({
      name: 'LLM Response Time',
      metric: 'avgFlashResponseTime',
      threshold: 15000, // 15 seconds
      operator: 'lt',
      severity: 'major',
      adaptable: true
    });

    // Quality Gates
    this.addGate({
      name: 'Transcription Accuracy',
      metric: 'transcriptionAccuracy',
      threshold: 0.85, // 85%
      operator: 'gte',
      severity: 'blocker',
      adaptable: true
    });

    this.addGate({
      name: 'Layout Overlap Rate',
      metric: 'layoutOverlapRate',
      threshold: 0, // Zero tolerance
      operator: 'eq',
      severity: 'blocker',
      adaptable: false
    });
  }

  /**
   * Add a quality gate
   */
  public addGate(gate: Omit<QualityGate, 'currentValue' | 'passed' | 'message'>): void {
    this.gates.push(gate as QualityGate);
  }

  /**
   * Remove a quality gate
   */
  public removeGate(name: string): boolean {
    const initialLength = this.gates.length;
    this.gates = this.gates.filter(g => g.name !== name);
    return this.gates.length < initialLength;
  }

  /**
   * Update gate threshold
   */
  public updateGateThreshold(name: string, newThreshold: number): boolean {
    const gate = this.gates.find(g => g.name === name);
    if (gate) {
      gate.threshold = newThreshold;
      return true;
    }
    return false;
  }

  /**
   * Evaluate all quality gates
   */
  public async evaluateGates(): Promise<QualityGateResult> {
    const snapshot = realTimeMonitor.getSnapshot();
    const evaluatedGates: QualityGate[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let blockersCount = 0;

    for (const gate of this.gates) {
      const evaluatedGate = await this.evaluateGate(gate, snapshot);
      evaluatedGates.push(evaluatedGate);

      if (evaluatedGate.passed) {
        passedCount++;
      } else {
        failedCount++;
        if (evaluatedGate.severity === 'blocker') {
          blockersCount++;
        }
      }
    }

    const passed = blockersCount === 0 && (passedCount / this.gates.length) >= 0.80; // 80% must pass
    const deploymentReady = blockersCount === 0 && (passedCount / this.gates.length) >= 0.90; // 90% for deployment

    const result: QualityGateResult = {
      passed,
      timestamp: Date.now(),
      gates: evaluatedGates,
      summary: {
        total: this.gates.length,
        passed: passedCount,
        failed: failedCount,
        blockers: blockersCount
      },
      recommendations: this.generateRecommendations(evaluatedGates),
      deploymentReady
    };

    // Store in history
    this.qualityHistory.push(result);
    if (this.qualityHistory.length > this.MAX_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }

    // Update adaptive thresholds
    await this.updateAdaptiveThresholds(snapshot);

    return result;
  }

  /**
   * Evaluate a single quality gate
   */
  private async evaluateGate(gate: QualityGate, snapshot: PerformanceSnapshot): Promise<QualityGate> {
    const currentValue = this.extractMetricValue(gate.metric, snapshot);
    const threshold = gate.adaptable
      ? this.getAdaptiveThreshold(gate.metric, gate.threshold)
      : gate.threshold;

    let passed = false;
    let message = '';

    switch (gate.operator) {
      case 'gt':
        passed = currentValue > threshold;
        message = `${gate.metric}: ${currentValue.toFixed(2)} ${passed ? '>' : '≤'} ${threshold.toFixed(2)}`;
        break;
      case 'lt':
        passed = currentValue < threshold;
        message = `${gate.metric}: ${currentValue.toFixed(2)} ${passed ? '<' : '≥'} ${threshold.toFixed(2)}`;
        break;
      case 'gte':
        passed = currentValue >= threshold;
        message = `${gate.metric}: ${currentValue.toFixed(2)} ${passed ? '≥' : '<'} ${threshold.toFixed(2)}`;
        break;
      case 'lte':
        passed = currentValue <= threshold;
        message = `${gate.metric}: ${currentValue.toFixed(2)} ${passed ? '≤' : '>'} ${threshold.toFixed(2)}`;
        break;
      case 'eq':
        passed = Math.abs(currentValue - threshold) < 0.001;
        message = `${gate.metric}: ${currentValue.toFixed(2)} ${passed ? '=' : '≠'} ${threshold.toFixed(2)}`;
        break;
    }

    return {
      ...gate,
      threshold, // Use adapted threshold if applicable
      currentValue,
      passed,
      message: `${passed ? '✅' : '❌'} ${gate.name}: ${message}`
    };
  }

  /**
   * Extract metric value from performance snapshot
   */
  private extractMetricValue(metric: string, snapshot: PerformanceSnapshot): number {
    // Pipeline metrics
    if (metric === 'avgProcessingTime') return snapshot.pipeline.avgProcessingTime;
    if (metric === 'p95ProcessingTime') return snapshot.pipeline.p95ProcessingTime;
    if (metric === 'p99ProcessingTime') return snapshot.pipeline.p99ProcessingTime;
    if (metric === 'successRate') return snapshot.pipeline.successRate;
    if (metric === 'activeRequests') return snapshot.pipeline.activeRequests;

    // LLM metrics
    if (metric === 'cacheHitRate') return snapshot.llm.cacheHitRate;
    if (metric === 'avgFlashResponseTime') return snapshot.llm.avgFlashResponseTime;
    if (metric === 'avgProResponseTime') return snapshot.llm.avgProResponseTime;
    if (metric === 'flashUsagePercent') return snapshot.llm.flashUsagePercent;

    // System metrics
    if (metric === 'memoryUsagePercent') return snapshot.system.memoryUsagePercent;
    if (metric === 'memoryUsageMB') return snapshot.system.memoryUsageMB;
    if (metric === 'cpuUsagePercent') return snapshot.system.cpuUsagePercent;

    // Error metrics
    if (metric === 'errorRate') return snapshot.errors.errorRate;
    if (metric === 'recoverySuccessRate') return snapshot.errors.recoverySuccessRate;
    if (metric === 'totalErrors') return snapshot.errors.totalErrors;

    // Quality metrics
    if (metric === 'transcriptionAccuracy') return snapshot.quality.transcriptionAccuracy;
    if (metric === 'layoutOverlapRate') return snapshot.quality.layoutOverlapRate;
    if (metric === 'avgSceneQuality') return snapshot.quality.avgSceneQuality;

    return 0;
  }

  /**
   * Get adaptive threshold for a metric
   */
  private getAdaptiveThreshold(metric: string, baseThreshold: number): number {
    const adaptive = this.adaptiveThresholds.get(metric);
    if (!adaptive || adaptive.confidence < 0.7) {
      return baseThreshold; // Use base threshold if not enough data
    }

    return adaptive.adaptedThreshold;
  }

  /**
   * Update adaptive thresholds based on historical performance
   */
  private async updateAdaptiveThresholds(snapshot: PerformanceSnapshot): Promise<void> {
    const adaptableGates = this.gates.filter(g => g.adaptable);

    for (const gate of adaptableGates) {
      const currentValue = this.extractMetricValue(gate.metric, snapshot);
      let adaptive = this.adaptiveThresholds.get(gate.metric);

      if (!adaptive) {
        // Initialize adaptive threshold
        adaptive = {
          metric: gate.metric,
          baselineValue: currentValue,
          currentValue,
          adaptedThreshold: gate.threshold,
          confidence: 0.1,
          historicalValues: [currentValue],
          lastUpdated: Date.now()
        };
        this.adaptiveThresholds.set(gate.metric, adaptive);
        continue;
      }

      // Update historical values
      adaptive.historicalValues.push(currentValue);
      if (adaptive.historicalValues.length > 100) {
        adaptive.historicalValues.shift();
      }

      // Calculate adaptive threshold
      adaptive.currentValue = currentValue;
      adaptive.adaptedThreshold = this.calculateAdaptiveThreshold(
        adaptive.historicalValues,
        gate.threshold,
        gate.operator
      );

      // Update confidence based on sample size and variance
      adaptive.confidence = Math.min(0.95, adaptive.historicalValues.length / 100);
      adaptive.lastUpdated = Date.now();
    }
  }

  /**
   * Calculate adaptive threshold based on historical data
   */
  private calculateAdaptiveThreshold(
    historicalValues: number[],
    baseThreshold: number,
    operator: QualityGate['operator']
  ): number {
    if (historicalValues.length < 10) {
      return baseThreshold; // Not enough data
    }

    // Calculate statistics
    const sorted = [...historicalValues].sort((a, b) => a - b);
    const mean = sorted.reduce((sum, val) => sum + val, 0) / sorted.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p90 = sorted[Math.floor(sorted.length * 0.90)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    // Adapt threshold based on operator and historical performance
    switch (operator) {
      case 'lt': // For metrics where lower is better (e.g., processing time)
        // Use P90 as adaptive threshold (allows for some variance)
        return Math.max(baseThreshold * 0.8, p90 * 1.1); // At least 80% of base, but allow 10% above P90

      case 'lte': // For metrics where lower or equal is better (e.g., error rate)
        return Math.max(baseThreshold * 0.8, p90 * 1.1);

      case 'gt': // For metrics where higher is better (e.g., cache hit rate)
        // Use P10 as adaptive threshold (allows for some variance)
        return Math.min(baseThreshold * 1.2, sorted[Math.floor(sorted.length * 0.1)] * 0.9);

      case 'gte': // For metrics where higher or equal is better (e.g., success rate)
        const p10 = sorted[Math.floor(sorted.length * 0.1)];
        return Math.min(baseThreshold * 1.2, p10 * 0.9); // At most 120% of base, but allow 10% below P10

      case 'eq': // For metrics that must equal a specific value
        return baseThreshold; // No adaptation for equality checks

      default:
        return baseThreshold;
    }
  }

  /**
   * Generate recommendations based on gate results
   */
  private generateRecommendations(gates: QualityGate[]): string[] {
    const recommendations: string[] = [];
    const failedGates = gates.filter(g => !g.passed);

    if (failedGates.length === 0) {
      recommendations.push('All quality gates passed - system ready for deployment');
      return recommendations;
    }

    // Group by severity
    const blockers = failedGates.filter(g => g.severity === 'blocker');
    const critical = failedGates.filter(g => g.severity === 'critical');
    const major = failedGates.filter(g => g.severity === 'major');
    const minor = failedGates.filter(g => g.severity === 'minor');

    // Blocker recommendations
    if (blockers.length > 0) {
      recommendations.push(`🚫 BLOCKER: ${blockers.length} critical gate(s) failed - deployment blocked`);
      blockers.forEach(gate => {
        recommendations.push(`  - Fix: ${gate.name} (${gate.message})`);
      });
    }

    // Critical recommendations
    if (critical.length > 0) {
      recommendations.push(`⚠️ CRITICAL: ${critical.length} gate(s) need immediate attention`);
      critical.forEach(gate => {
        recommendations.push(`  - Address: ${gate.name} (${gate.message})`);
      });
    }

    // Major recommendations
    if (major.length > 0) {
      recommendations.push(`📋 MAJOR: ${major.length} gate(s) require optimization`);
      major.slice(0, 3).forEach(gate => {
        recommendations.push(`  - Optimize: ${gate.name}`);
      });
    }

    // Minor recommendations
    if (minor.length > 0) {
      recommendations.push(`ℹ️ MINOR: ${minor.length} gate(s) can be improved`);
    }

    return recommendations;
  }

  /**
   * Get quality gate history
   */
  public getHistory(limit: number = 10): QualityGateResult[] {
    return this.qualityHistory.slice(-limit);
  }

  /**
   * Get quality trend over time
   */
  public getQualityTrend(): {
    trend: 'improving' | 'stable' | 'degrading';
    passRate: number[];
    timestamps: number[];
  } {
    if (this.qualityHistory.length < 5) {
      return {
        trend: 'stable',
        passRate: [],
        timestamps: []
      };
    }

    const recent = this.qualityHistory.slice(-20);
    const passRates = recent.map(h => h.summary.passed / h.summary.total);
    const timestamps = recent.map(h => h.timestamp);

    // Calculate trend
    const firstHalf = passRates.slice(0, Math.floor(passRates.length / 2));
    const secondHalf = passRates.slice(Math.floor(passRates.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const improvement = (secondAvg - firstAvg) / firstAvg;

    let trend: 'improving' | 'stable' | 'degrading';
    if (improvement > 0.05) {
      trend = 'improving';
    } else if (improvement < -0.05) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    return { trend, passRate: passRates, timestamps };
  }

  /**
   * Get adaptive threshold for a metric
   */
  public getAdaptiveThresholdInfo(metric: string): AdaptiveThreshold | null {
    return this.adaptiveThresholds.get(metric) || null;
  }

  /**
   * Get all gates
   */
  public getGates(): QualityGate[] {
    return [...this.gates];
  }

  /**
   * Reset all adaptive thresholds
   */
  public resetAdaptiveThresholds(): void {
    this.adaptiveThresholds.clear();
  }

  /**
   * Check if system is ready for deployment
   */
  public async isDeploymentReady(): Promise<{
    ready: boolean;
    reason: string;
    blockers: string[];
  }> {
    const result = await this.evaluateGates();

    if (result.deploymentReady) {
      return {
        ready: true,
        reason: 'All deployment gates passed',
        blockers: []
      };
    }

    const blockers = result.gates
      .filter(g => !g.passed && (g.severity === 'blocker' || g.severity === 'critical'))
      .map(g => g.message || g.name);

    return {
      ready: false,
      reason: `Deployment blocked by ${blockers.length} critical issues`,
      blockers
    };
  }
}

// Global singleton instance
export const adaptiveQualityGates = new AdaptiveQualityGatesSystem();

// Export types
export type { AdaptiveQualityGatesSystem };
