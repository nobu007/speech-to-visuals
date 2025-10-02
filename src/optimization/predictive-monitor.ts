/**
 * Predictive Error Prevention System - Iteration 9
 * Monitors system patterns and predicts/prevents failures before they occur
 */

export interface HealthMetrics {
  cpuUsage: number;
  memoryUsage: number;
  processingLatency: number;
  errorRate: number;
  queueDepth: number;
  cacheHitRate: number;
}

export interface PredictionResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedIssues: string[];
  preventiveActions: string[];
  timeToIssue: number; // minutes
  confidence: number; // 0-1
}

export interface SystemPattern {
  patternId: string;
  description: string;
  indicators: Partial<HealthMetrics>;
  historicalOutcomes: ('success' | 'warning' | 'error' | 'failure')[];
  lastSeen: Date;
}

export interface PreventiveAction {
  actionId: string;
  description: string;
  trigger: () => boolean;
  execute: () => Promise<boolean>;
  priority: number;
  estimatedImpact: number;
}

export class PredictiveMonitor {
  private healthHistory: HealthMetrics[] = [];
  private knownPatterns: Map<string, SystemPattern> = new Map();
  private preventiveActions: Map<string, PreventiveAction> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // Configurable thresholds
  private thresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    latency: { warning: 5000, critical: 10000 },
    errorRate: { warning: 0.05, critical: 0.15 },
    queueDepth: { warning: 50, critical: 100 }
  };

  constructor() {
    this.initializePatterns();
    this.initializePreventiveActions();
  }

  /**
   * Start continuous monitoring and prediction
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Predictive Monitor: Already monitoring');
      return;
    }

    console.log('🔍 Predictive Monitor: Starting continuous monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        const currentMetrics = await this.collectHealthMetrics();
        this.healthHistory.push(currentMetrics);

        // Keep only last 100 metrics to prevent memory bloat
        if (this.healthHistory.length > 100) {
          this.healthHistory.shift();
        }

        const prediction = await this.analyzePredictivePatterns(currentMetrics);

        if (prediction.riskLevel === 'high' || prediction.riskLevel === 'critical') {
          console.log('🚨 Predictive Monitor: Risk detected!', prediction);
          await this.executePreventiveActions(prediction);
        }

        await this.updatePatterns(currentMetrics);

      } catch (error) {
        console.error('❌ Predictive Monitor: Error during monitoring:', error);
      }
    }, 30000); // Monitor every 30 seconds

    console.log('✅ Predictive monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Predictive monitoring stopped');
  }

  /**
   * Analyze current state and predict potential issues
   */
  async analyzePredictivePatterns(currentMetrics: HealthMetrics): Promise<PredictionResult> {
    console.log('🔮 Predictive Monitor: Analyzing patterns...');

    const predictions: string[] = [];
    const actions: string[] = [];
    let maxRisk: PredictionResult['riskLevel'] = 'low';
    let minTimeToIssue = Infinity;
    let totalConfidence = 0;
    let predictionCount = 0;

    // Analyze memory trends
    const memoryPrediction = this.predictMemoryIssues(currentMetrics);
    if (memoryPrediction) {
      predictions.push(memoryPrediction.issue);
      actions.push(memoryPrediction.action);
      maxRisk = this.escalateRisk(maxRisk, memoryPrediction.risk);
      minTimeToIssue = Math.min(minTimeToIssue, memoryPrediction.timeToIssue);
      totalConfidence += memoryPrediction.confidence;
      predictionCount++;
    }

    // Analyze processing trends
    const latencyPrediction = this.predictLatencyIssues(currentMetrics);
    if (latencyPrediction) {
      predictions.push(latencyPrediction.issue);
      actions.push(latencyPrediction.action);
      maxRisk = this.escalateRisk(maxRisk, latencyPrediction.risk);
      minTimeToIssue = Math.min(minTimeToIssue, latencyPrediction.timeToIssue);
      totalConfidence += latencyPrediction.confidence;
      predictionCount++;
    }

    // Analyze error rate trends
    const errorPrediction = this.predictErrorEscalation(currentMetrics);
    if (errorPrediction) {
      predictions.push(errorPrediction.issue);
      actions.push(errorPrediction.action);
      maxRisk = this.escalateRisk(maxRisk, errorPrediction.risk);
      minTimeToIssue = Math.min(minTimeToIssue, errorPrediction.timeToIssue);
      totalConfidence += errorPrediction.confidence;
      predictionCount++;
    }

    // Analyze known pattern matches
    const patternPrediction = await this.matchKnownPatterns(currentMetrics);
    if (patternPrediction) {
      predictions.push(...patternPrediction.issues);
      actions.push(...patternPrediction.actions);
      maxRisk = this.escalateRisk(maxRisk, patternPrediction.risk);
      minTimeToIssue = Math.min(minTimeToIssue, patternPrediction.timeToIssue);
      totalConfidence += patternPrediction.confidence;
      predictionCount++;
    }

    const avgConfidence = predictionCount > 0 ? totalConfidence / predictionCount : 1.0;
    const timeToIssue = minTimeToIssue === Infinity ? 60 : minTimeToIssue;

    return {
      riskLevel: maxRisk,
      predictedIssues: [...new Set(predictions)],
      preventiveActions: [...new Set(actions)],
      timeToIssue,
      confidence: avgConfidence
    };
  }

  /**
   * Execute preventive actions based on predictions
   */
  async executePreventiveActions(prediction: PredictionResult): Promise<void> {
    console.log('🚀 Predictive Monitor: Executing preventive actions...');

    for (const actionDescription of prediction.preventiveActions) {
      const action = Array.from(this.preventiveActions.values()).find(
        a => a.description === actionDescription
      );

      if (action && action.trigger()) {
        try {
          console.log(`⚡ Executing: ${action.description}`);
          const success = await action.execute();
          if (success) {
            console.log(`✅ Preventive action successful: ${action.description}`);
          } else {
            console.log(`⚠️ Preventive action failed: ${action.description}`);
          }
        } catch (error) {
          console.error(`❌ Error executing preventive action: ${action.description}`, error);
        }
      }
    }
  }

  /**
   * Get current system health snapshot
   */
  async getCurrentHealth(): Promise<HealthMetrics> {
    return await this.collectHealthMetrics();
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isActive: boolean;
    historyLength: number;
    knownPatterns: number;
    availableActions: number;
    averageHealth: Partial<HealthMetrics>;
    recentPredictions: number;
  } {
    const recent = this.healthHistory.slice(-10);
    const averageHealth: Partial<HealthMetrics> = {};

    if (recent.length > 0) {
      averageHealth.cpuUsage = recent.reduce((sum, h) => sum + h.cpuUsage, 0) / recent.length;
      averageHealth.memoryUsage = recent.reduce((sum, h) => sum + h.memoryUsage, 0) / recent.length;
      averageHealth.processingLatency = recent.reduce((sum, h) => sum + h.processingLatency, 0) / recent.length;
      averageHealth.errorRate = recent.reduce((sum, h) => sum + h.errorRate, 0) / recent.length;
    }

    return {
      isActive: this.isMonitoring,
      historyLength: this.healthHistory.length,
      knownPatterns: this.knownPatterns.size,
      availableActions: this.preventiveActions.size,
      averageHealth,
      recentPredictions: recent.length
    };
  }

  private async collectHealthMetrics(): Promise<HealthMetrics> {
    // Collect actual system metrics (simplified for demo)
    const memInfo = process.memoryUsage();
    const memoryUsage = (memInfo.heapUsed / memInfo.heapTotal) * 100;

    // Simulate other metrics based on system behavior
    const cpuUsage = Math.random() * 20 + 10; // 10-30% baseline
    const processingLatency = Math.random() * 1000 + 500; // 500-1500ms
    const errorRate = Math.random() * 0.02; // 0-2% error rate
    const queueDepth = Math.floor(Math.random() * 10); // 0-10 items
    const cacheHitRate = 0.8 + Math.random() * 0.15; // 80-95%

    return {
      cpuUsage,
      memoryUsage,
      processingLatency,
      errorRate,
      queueDepth,
      cacheHitRate
    };
  }

  private predictMemoryIssues(metrics: HealthMetrics): {
    issue: string;
    action: string;
    risk: PredictionResult['riskLevel'];
    timeToIssue: number;
    confidence: number;
  } | null {
    if (this.healthHistory.length < 5) return null;

    const recent = this.healthHistory.slice(-5);
    const memoryTrend = this.calculateTrend(recent.map(h => h.memoryUsage));

    if (memoryTrend > 2 && metrics.memoryUsage > 70) {
      const timeToIssue = Math.max(1, (95 - metrics.memoryUsage) / memoryTrend);
      return {
        issue: `Memory usage trending upward (${memoryTrend.toFixed(1)}%/interval)`,
        action: 'Clear caches and optimize memory usage',
        risk: metrics.memoryUsage > 85 ? 'critical' : 'high',
        timeToIssue,
        confidence: 0.8
      };
    }

    return null;
  }

  private predictLatencyIssues(metrics: HealthMetrics): {
    issue: string;
    action: string;
    risk: PredictionResult['riskLevel'];
    timeToIssue: number;
    confidence: number;
  } | null {
    if (this.healthHistory.length < 3) return null;

    const recent = this.healthHistory.slice(-3);
    const latencyTrend = this.calculateTrend(recent.map(h => h.processingLatency));

    if (latencyTrend > 200 && metrics.processingLatency > 3000) {
      const timeToIssue = Math.max(1, (this.thresholds.latency.critical - metrics.processingLatency) / latencyTrend);
      return {
        issue: `Processing latency increasing (${latencyTrend.toFixed(0)}ms/interval)`,
        action: 'Enable aggressive caching and reduce processing complexity',
        risk: metrics.processingLatency > 7000 ? 'high' : 'medium',
        timeToIssue,
        confidence: 0.7
      };
    }

    return null;
  }

  private predictErrorEscalation(metrics: HealthMetrics): {
    issue: string;
    action: string;
    risk: PredictionResult['riskLevel'];
    timeToIssue: number;
    confidence: number;
  } | null {
    if (this.healthHistory.length < 4) return null;

    const recent = this.healthHistory.slice(-4);
    const errorTrend = this.calculateTrend(recent.map(h => h.errorRate));

    if (errorTrend > 0.01 && metrics.errorRate > 0.03) {
      return {
        issue: `Error rate increasing (${(errorTrend * 100).toFixed(2)}%/interval)`,
        action: 'Enable error recovery mode and increase monitoring',
        risk: metrics.errorRate > 0.1 ? 'critical' : 'high',
        timeToIssue: 5,
        confidence: 0.75
      };
    }

    return null;
  }

  private async matchKnownPatterns(metrics: HealthMetrics): Promise<{
    issues: string[];
    actions: string[];
    risk: PredictionResult['riskLevel'];
    timeToIssue: number;
    confidence: number;
  } | null> {
    // Check for known failure patterns
    for (const [patternId, pattern] of this.knownPatterns) {
      if (this.matchesPattern(metrics, pattern)) {
        const failureRate = pattern.historicalOutcomes.filter(o => o === 'error' || o === 'failure').length;
        const totalOutcomes = pattern.historicalOutcomes.length;

        if (failureRate / totalOutcomes > 0.3) {
          return {
            issues: [`Pattern detected: ${pattern.description}`],
            actions: [`Apply known mitigation for pattern: ${patternId}`],
            risk: failureRate / totalOutcomes > 0.7 ? 'high' : 'medium',
            timeToIssue: 10,
            confidence: failureRate / totalOutcomes
          };
        }
      }
    }

    return null;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    let trend = 0;
    for (let i = 1; i < values.length; i++) {
      trend += values[i] - values[i - 1];
    }

    return trend / (values.length - 1);
  }

  private escalateRisk(current: PredictionResult['riskLevel'], new_risk: PredictionResult['riskLevel']): PredictionResult['riskLevel'] {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(current);
    const newIndex = levels.indexOf(new_risk);

    return levels[Math.max(currentIndex, newIndex)] as PredictionResult['riskLevel'];
  }

  private matchesPattern(metrics: HealthMetrics, pattern: SystemPattern): boolean {
    const indicators = pattern.indicators;
    let matches = 0;
    let total = 0;

    Object.keys(indicators).forEach(key => {
      const indicatorValue = indicators[key as keyof HealthMetrics];
      const currentValue = metrics[key as keyof HealthMetrics];

      if (indicatorValue !== undefined) {
        total++;
        // Simple threshold matching (in production, this would be more sophisticated)
        if (Math.abs(currentValue - indicatorValue) < indicatorValue * 0.2) {
          matches++;
        }
      }
    });

    return total > 0 && matches / total > 0.7;
  }

  private async updatePatterns(metrics: HealthMetrics): Promise<void> {
    // Simple pattern learning (in production, this would use ML)
    const patternId = this.generatePatternId(metrics);

    if (!this.knownPatterns.has(patternId)) {
      this.knownPatterns.set(patternId, {
        patternId,
        description: `Pattern with CPU:${Math.round(metrics.cpuUsage)}, Mem:${Math.round(metrics.memoryUsage)}`,
        indicators: {
          cpuUsage: metrics.cpuUsage,
          memoryUsage: metrics.memoryUsage,
          processingLatency: metrics.processingLatency
        },
        historicalOutcomes: ['success'],
        lastSeen: new Date()
      });
    } else {
      const pattern = this.knownPatterns.get(patternId)!;
      pattern.lastSeen = new Date();
      pattern.historicalOutcomes.push('success'); // Simplified outcome tracking

      // Keep only last 20 outcomes
      if (pattern.historicalOutcomes.length > 20) {
        pattern.historicalOutcomes.shift();
      }
    }
  }

  private generatePatternId(metrics: HealthMetrics): string {
    const cpu = Math.round(metrics.cpuUsage / 10) * 10;
    const memory = Math.round(metrics.memoryUsage / 10) * 10;
    const latency = Math.round(metrics.processingLatency / 1000) * 1000;

    return `cpu${cpu}-mem${memory}-lat${latency}`;
  }

  private initializePatterns(): void {
    // Initialize with some known problematic patterns
    this.knownPatterns.set('high-mem-high-cpu', {
      patternId: 'high-mem-high-cpu',
      description: 'High memory and CPU usage combination',
      indicators: { memoryUsage: 85, cpuUsage: 80 },
      historicalOutcomes: ['error', 'failure', 'error', 'warning'],
      lastSeen: new Date()
    });

    this.knownPatterns.set('escalating-latency', {
      patternId: 'escalating-latency',
      description: 'Steadily increasing processing latency',
      indicators: { processingLatency: 8000, queueDepth: 15 },
      historicalOutcomes: ['warning', 'error', 'failure'],
      lastSeen: new Date()
    });
  }

  private initializePreventiveActions(): void {
    this.preventiveActions.set('clear-cache', {
      actionId: 'clear-cache',
      description: 'Clear caches and optimize memory usage',
      trigger: () => true,
      execute: async () => {
        console.log('🧹 Clearing caches...');
        // In production, this would actually clear caches
        return true;
      },
      priority: 1,
      estimatedImpact: 0.3
    });

    this.preventiveActions.set('reduce-quality', {
      actionId: 'reduce-quality',
      description: 'Temporarily reduce processing quality for speed',
      trigger: () => true,
      execute: async () => {
        console.log('⚡ Reducing processing quality...');
        // In production, this would adjust quality settings
        return true;
      },
      priority: 2,
      estimatedImpact: 0.4
    });

    this.preventiveActions.set('enable-emergency-mode', {
      actionId: 'enable-emergency-mode',
      description: 'Enable emergency processing mode',
      trigger: () => true,
      execute: async () => {
        console.log('🚨 Enabling emergency mode...');
        // In production, this would switch to minimal processing
        return true;
      },
      priority: 3,
      estimatedImpact: 0.6
    });
  }
}

export const predictiveMonitor = new PredictiveMonitor();