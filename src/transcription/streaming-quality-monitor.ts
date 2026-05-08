/**
 * REQ-091: Streaming Quality Monitoring
 *
 * Integrates QualityMonitor into the streaming transcription pipeline,
 * recording per-chunk confidence scores and emitting warnings when
 * quality drops below configurable thresholds.
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamingQualityConfig {
  /** Minimum acceptable confidence for a single chunk (0..1, default 0.7) */
  minChunkConfidence: number;
  /** Rolling window size for average confidence calculation (default 5) */
  rollingWindowSize: number;
  /** If the rolling-average confidence drops below this, emit a warning (default 0.6) */
  warningThreshold: number;
  /** If the rolling-average confidence drops below this, emit a critical alert (default 0.4) */
  criticalThreshold: number;
}

export interface ChunkQualityRecord {
  /** Zero-based chunk index */
  chunkIndex: number;
  /** Confidence score of the chunk (0..1) */
  confidence: number;
  /** Timestamp when the chunk was evaluated */
  timestamp: Date;
  /** Whether the chunk was accepted or rejected */
  accepted: boolean;
}

export type QualityAlertSeverity = 'warning' | 'critical';

export interface QualityAlert {
  severity: QualityAlertSeverity;
  message: string;
  rollingAverage: number;
  chunkIndex: number;
  timestamp: Date;
}

export interface StreamingQualitySummary {
  /** Total chunks processed */
  totalChunks: number;
  /** Chunks accepted (above minChunkConfidence) */
  acceptedChunks: number;
  /** Chunks rejected (below minChunkConfidence) */
  rejectedChunks: number;
  /** Average confidence across all chunks */
  averageConfidence: number;
  /** Minimum confidence observed */
  minConfidence: number;
  /** Maximum confidence observed */
  maxConfidence: number;
  /** Alerts emitted during the session */
  alerts: QualityAlert[];
  /** Overall quality status */
  status: 'excellent' | 'good' | 'degraded' | 'poor';
}

export type QualityAlertCallback = (alert: QualityAlert) => void;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_STREAMING_QUALITY_CONFIG: StreamingQualityConfig = {
  minChunkConfidence: 0.7,
  rollingWindowSize: 5,
  warningThreshold: 0.6,
  criticalThreshold: 0.4,
};

// ---------------------------------------------------------------------------
// StreamingQualityMonitor
// ---------------------------------------------------------------------------

/**
 * Monitors streaming transcription quality on a per-chunk basis.
 *
 * Usage:
 *   const monitor = new StreamingQualityMonitor();
 *   monitor.onAlert(alert => showWarning(alert.message));
 *   for each chunk:
 *     const record = monitor.evaluateChunk(i, confidence);
 *   const summary = monitor.getSummary();
 */
export class StreamingQualityMonitor {
  private readonly config: StreamingQualityConfig;
  private readonly records: ChunkQualityRecord[] = [];
  private readonly alerts: QualityAlert[] = [];
  private readonly alertCallbacks: QualityAlertCallback[] = [];
  private completed = false;

  constructor(config: Partial<StreamingQualityConfig> = {}) {
    this.config = { ...DEFAULT_STREAMING_QUALITY_CONFIG, ...config };
  }

  /**
   * Register a callback to be invoked when a quality alert is emitted.
   */
  onAlert(callback: QualityAlertCallback): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Evaluate a single chunk's confidence score.
   * Records the result, checks thresholds, and emits alerts as needed.
   */
  evaluateChunk(chunkIndex: number, confidence: number): ChunkQualityRecord {
    const accepted = confidence >= this.config.minChunkConfidence;
    const record: ChunkQualityRecord = {
      chunkIndex,
      confidence,
      timestamp: new Date(),
      accepted,
    };
    this.records.push(record);

    // Check rolling average
    const rollingAvg = this.getRollingAverage();
    if (this.records.length >= this.config.rollingWindowSize) {
      if (rollingAvg < this.config.criticalThreshold) {
        this.emitAlert('critical', rollingAvg, chunkIndex);
      } else if (rollingAvg < this.config.warningThreshold) {
        this.emitAlert('warning', rollingAvg, chunkIndex);
      }
    }

    if (!accepted) {
      logger.warn('[StreamingQualityMonitor] Low confidence chunk', {
        chunkIndex,
        confidence: confidence.toFixed(3),
        threshold: this.config.minChunkConfidence,
      });
    }

    return record;
  }

  /**
   * Compute the rolling average confidence over the last N chunks.
   */
  getRollingAverage(): number {
    const window = this.records.slice(-this.config.rollingWindowSize);
    if (window.length === 0) return 0;
    return window.reduce((sum, r) => sum + r.confidence, 0) / window.length;
  }

  /**
   * Generate a final quality summary for the streaming session.
   * Call once after streaming completes.
   */
  getSummary(): StreamingQualitySummary {
    if (this.records.length === 0) {
      return {
        totalChunks: 0,
        acceptedChunks: 0,
        rejectedChunks: 0,
        averageConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0,
        alerts: [...this.alerts],
        status: 'excellent',
      };
    }

    const confidences = this.records.map(r => r.confidence);
    const acceptedCount = this.records.filter(r => r.accepted).length;
    const avg =
      confidences.reduce((s, c) => s + c, 0) / confidences.length;

    const status = this.determineStatus(avg);

    const summary: StreamingQualitySummary = {
      totalChunks: this.records.length,
      acceptedChunks: acceptedCount,
      rejectedChunks: this.records.length - acceptedCount,
      averageConfidence: avg,
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences),
      alerts: [...this.alerts],
      status,
    };

    if (!this.completed) {
      this.completed = true;
      logger.info('[StreamingQualityMonitor] Session summary', {
        total: summary.totalChunks,
        accepted: summary.acceptedChunks,
        rejected: summary.rejectedChunks,
        avgConfidence: avg.toFixed(3),
        status,
      });
    }

    return summary;
  }

  /**
   * Get all recorded chunk quality records.
   */
  getRecords(): ReadonlyArray<ChunkQualityRecord> {
    return this.records;
  }

  /**
   * Get all emitted alerts.
   */
  getAlerts(): ReadonlyArray<QualityAlert> {
    return this.alerts;
  }

  /**
   * Whether the session has been completed.
   */
  isCompleted(): boolean {
    return this.completed;
  }

  // -------
  // Private
  // -------

  private emitAlert(
    severity: QualityAlertSeverity,
    rollingAverage: number,
    chunkIndex: number,
  ): void {
    const alert: QualityAlert = {
      severity,
      message:
        severity === 'critical'
          ? `Streaming quality critically degraded (avg ${rollingAverage.toFixed(2)} < ${this.config.criticalThreshold})`
          : `Streaming quality degraded (avg ${rollingAverage.toFixed(2)} < ${this.config.warningThreshold})`,
      rollingAverage,
      chunkIndex,
      timestamp: new Date(),
    };

    this.alerts.push(alert);

    for (const cb of this.alertCallbacks) {
      try {
        cb(alert);
      } catch {
        // Prevent callback errors from disrupting the pipeline
      }
    }

    logger.warn('[StreamingQualityMonitor] Quality alert emitted', {
      severity,
      rollingAverage: rollingAverage.toFixed(3),
      chunkIndex,
    });
  }

  private determineStatus(avgConfidence: number): StreamingQualitySummary['status'] {
    if (avgConfidence >= 0.9) return 'excellent';
    if (avgConfidence >= 0.75) return 'good';
    if (avgConfidence >= 0.55) return 'degraded';
    return 'poor';
  }
}
