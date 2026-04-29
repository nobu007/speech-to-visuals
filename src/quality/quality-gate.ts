/**
 * TASK-0044: Quality Gate and Quality Monitoring Module
 *
 * Per-stage quality gate evaluation for the pipeline orchestrator.
 * Each gate defines specific criteria per stage:
 *   Stage 1 (Transcription): audio duration, sample rate, noise level
 *   Stage 2 (Analysis): entity extraction rate, relation completeness, schema conformance
 *   Stage 3 (Layout): zero overlap, timeline continuity, segment normalization
 *   Stage 4 (Render preparation): caption sync, layout consistency
 *   Stage 5 (Render final): resolution, fps, audio sync
 *
 * Includes regression detection that blocks if quality degrades >5% from baseline.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface QualityResult {
  passed: boolean;
  score: number;
  threshold: number;
  details: string;
}

export interface QualityCriterion {
  name: string;
  evaluate: (input: any) => QualityResult;
  threshold: number;
}

export interface QualityGateConfig {
  stage: number;
  name: string;
  criteria: QualityCriterion[];
  blockingOnFailure: boolean;
  fallbackAction?: 'retry' | 'skip' | 'abort';
}

export interface RegressionResult {
  isRegression: boolean;
  previousScore: number;
  currentScore: number;
  degradationPercent: number;
  shouldBlock: boolean;
}

export interface StageCriterionResult {
  criterionName: string;
  passed: boolean;
  score: number;
  threshold: number;
  details: string;
}

export interface StageEvaluationResult {
  stage: number;
  passed: boolean;
  results: StageCriterionResult[];
  blocking: boolean;
  fallbackAction?: 'retry' | 'skip' | 'abort';
}

export interface StageMetricEntry {
  stage: number;
  score: number;
  passed: boolean;
}

export interface JobQualityReport {
  jobId: string;
  stageMetrics: StageMetricEntry[];
}

// ---------------------------------------------------------------------------
// StageQualityGate - Evaluates a single stage against its criteria
// ---------------------------------------------------------------------------

export class StageQualityGate {
  private config: QualityGateConfig;

  constructor(config: QualityGateConfig) {
    this.config = config;
  }

  get stage(): number {
    return this.config.stage;
  }

  get name(): string {
    return this.config.name;
  }

  get blocking(): boolean {
    return this.config.blockingOnFailure;
  }

  get fallbackAction(): 'retry' | 'skip' | 'abort' | undefined {
    return this.config.fallbackAction;
  }

  evaluate(input: any): StageEvaluationResult {
    const results: StageCriterionResult[] = this.config.criteria.map(
      (criterion) => {
        const r = criterion.evaluate(input);
        return {
          criterionName: criterion.name,
          passed: r.passed,
          score: r.score,
          threshold: r.threshold,
          details: r.details,
        };
      }
    );

    const passed = results.every((r) => r.passed);

    return {
      stage: this.config.stage,
      passed,
      results,
      blocking: this.config.blockingOnFailure,
      fallbackAction: this.config.fallbackAction,
    };
  }
}

// ---------------------------------------------------------------------------
// QualityGateEvaluator - Orchestrates evaluation across stages
// ---------------------------------------------------------------------------

export class QualityGateEvaluator {
  private gates: Map<number, StageQualityGate> = new Map();
  private baselines: Map<string, number> = new Map();
  private jobMetrics: Map<string, StageMetricEntry[]> = new Map();

  constructor() {
    // Register default quality gates for all 5 stages
    const defaults = createDefaultQualityGates();
    for (const cfg of defaults) {
      this.gates.set(cfg.stage, new StageQualityGate(cfg));
    }
  }

  /**
   * Register or replace a quality gate for a specific stage.
   */
  registerGate(config: QualityGateConfig): void {
    this.gates.set(config.stage, new StageQualityGate(config));
  }

  /**
   * Evaluate quality for a given stage (1-5).
   */
  evaluateStage(stage: number, input: any): StageEvaluationResult {
    const gate = this.gates.get(stage);
    if (!gate) {
      return {
        stage,
        passed: false,
        results: [
          {
            criterionName: 'gateNotFound',
            passed: false,
            score: 0,
            threshold: 0,
            details: `No quality gate registered for stage ${stage}`,
          },
        ],
        blocking: true,
      };
    }
    return gate.evaluate(input);
  }

  // ------- Regression Detection -------

  /**
   * Set a baseline score for a given job identifier.
   */
  setBaselineScore(jobId: string, score: number): void {
    this.baselines.set(jobId, score);
  }

  /**
   * Detect regression by comparing current score against baseline.
   * Blocks if quality degrades >5% from baseline.
   */
  detectRegression(jobId: string, currentScore: number): RegressionResult {
    const previousScore = this.baselines.get(jobId) ?? 0;

    if (previousScore === 0) {
      // No baseline recorded yet - not a regression
      return {
        isRegression: false,
        previousScore: 0,
        currentScore,
        degradationPercent: 0,
        shouldBlock: false,
      };
    }

    const degradationPercent =
      ((previousScore - currentScore) / previousScore) * 100;

    const isRegression = degradationPercent > 5;

    return {
      isRegression,
      previousScore,
      currentScore,
      degradationPercent: Math.max(0, degradationPercent),
      shouldBlock: isRegression,
    };
  }

  // ------- Per-Stage Metrics Recording -------

  /**
   * Record quality metrics for a specific stage of a job.
   */
  recordStageMetrics(
    jobId: string,
    stage: number,
    metrics: { score: number; passed: boolean }
  ): void {
    if (!this.jobMetrics.has(jobId)) {
      this.jobMetrics.set(jobId, []);
    }
    this.jobMetrics.get(jobId)!.push({
      stage,
      score: metrics.score,
      passed: metrics.passed,
    });
  }

  /**
   * Get the accumulated quality report for a specific job.
   */
  getQualityReport(jobId: string): JobQualityReport {
    const stageMetrics = this.jobMetrics.get(jobId) ?? [];
    return { jobId, stageMetrics };
  }
}

// ---------------------------------------------------------------------------
// Default Quality Gate Definitions
// ---------------------------------------------------------------------------

/**
 * Helper: check if two axis-aligned rectangles overlap.
 */
function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  margin = 10
): boolean {
  return !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );
}

/**
 * Stage 1 criteria - Transcription quality
 */
function createTranscriptionCriteria(): QualityCriterion[] {
  return [
    {
      name: 'audioDuration',
      threshold: 1.0,
      evaluate: (input: any): QualityResult => {
        const duration = input.audioDuration ?? 0;
        return {
          passed: duration >= 1.0,
          score: duration,
          threshold: 1.0,
          details: `Audio duration ${duration}s (threshold >= 1.0s)`,
        };
      },
    },
    {
      name: 'sampleRate',
      threshold: 16000,
      evaluate: (input: any): QualityResult => {
        const rate = input.sampleRate ?? 0;
        return {
          passed: rate >= 16000,
          score: rate,
          threshold: 16000,
          details: `Sample rate ${rate}Hz (threshold >= 16000Hz)`,
        };
      },
    },
    {
      name: 'noiseLevel',
      threshold: -30,
      evaluate: (input: any): QualityResult => {
        const noise = input.noiseLevelDb ?? 0;
        return {
          passed: noise < -30,
          score: noise,
          threshold: -30,
          details: `Noise level ${noise}dB (threshold < -30dB)`,
        };
      },
    },
  ];
}

/**
 * Stage 2 criteria - Analysis quality
 */
function createAnalysisCriteria(): QualityCriterion[] {
  return [
    {
      name: 'entityExtractionRate',
      threshold: 0.8,
      evaluate: (input: any): QualityResult => {
        const entities = input.entities ?? [];
        const expected = input.expectedEntities ?? entities.length;
        if (expected === 0) {
          return {
            passed: true,
            score: 1.0,
            threshold: 0.8,
            details: 'No expected entities to check',
          };
        }
        const rate = entities.length / expected;
        return {
          passed: rate >= 0.8,
          score: rate,
          threshold: 0.8,
          details: `Entity extraction rate ${(rate * 100).toFixed(1)}% (${entities.length}/${expected}, threshold >= 80%)`,
        };
      },
    },
    {
      name: 'relationCompleteness',
      threshold: 0.7,
      evaluate: (input: any): QualityResult => {
        const relations = input.relations ?? [];
        const expected = input.expectedRelations ?? relations.length;
        if (expected === 0) {
          return {
            passed: true,
            score: 1.0,
            threshold: 0.7,
            details: 'No expected relations to check',
          };
        }
        const completeness = relations.length / expected;
        return {
          passed: completeness >= 0.7,
          score: completeness,
          threshold: 0.7,
          details: `Relation completeness ${(completeness * 100).toFixed(1)}% (${relations.length}/${expected}, threshold >= 70%)`,
        };
      },
    },
    {
      name: 'schemaConformance',
      threshold: 1.0,
      evaluate: (input: any): QualityResult => {
        const valid = input.schemaValid ?? false;
        return {
          passed: valid,
          score: valid ? 1.0 : 0.0,
          threshold: 1.0,
          details: valid
            ? 'JSON schema conformance: valid'
            : 'JSON schema conformance: invalid',
        };
      },
    },
  ];
}

/**
 * Stage 3 criteria - Layout quality
 */
function createLayoutCriteria(): QualityCriterion[] {
  return [
    {
      name: 'zeroOverlap',
      threshold: 0,
      evaluate: (input: any): QualityResult => {
        const nodes = input.nodes ?? [];
        let overlapCount = 0;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            if (rectsOverlap(nodes[i], nodes[j])) {
              overlapCount++;
            }
          }
        }
        return {
          passed: overlapCount === 0,
          score: overlapCount,
          threshold: 0,
          details:
            overlapCount === 0
              ? 'Zero overlaps detected'
              : `${overlapCount} overlap(s) detected`,
        };
      },
    },
    {
      name: 'timelineContinuity',
      threshold: 1.0,
      evaluate: (input: any): QualityResult => {
        const segments = input.segments ?? [];
        if (segments.length <= 1) {
          return {
            passed: true,
            score: 1.0,
            threshold: 1.0,
            details: 'Single or no segment - continuity trivially satisfied',
          };
        }
        // Sort by startMs and check for gaps
        const sorted = [...segments].sort(
          (a: any, b: any) => (a.startMs ?? 0) - (b.startMs ?? 0)
        );
        let gaps = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prevEnd = sorted[i - 1].endMs ?? 0;
          const currStart = sorted[i].startMs ?? 0;
          // Allow 100ms tolerance for floating-point / rounding
          if (currStart - prevEnd > 100) {
            gaps++;
          }
        }
        return {
          passed: gaps === 0,
          score: gaps === 0 ? 1.0 : 0.0,
          threshold: 1.0,
          details:
            gaps === 0
              ? 'Timeline is continuous'
              : `${gaps} gap(s) detected in timeline`,
        };
      },
    },
    {
      name: 'segmentNormalization',
      threshold: 1.0,
      evaluate: (input: any): QualityResult => {
        const segments = input.segments ?? [];
        if (segments.length === 0) {
          return {
            passed: true,
            score: 1.0,
            threshold: 1.0,
            details: 'No segments to validate',
          };
        }
        const invalid = segments.filter((s: any) => {
          const dur = s.durationMs ?? (s.endMs != null && s.startMs != null ? s.endMs - s.startMs : 0);
          return dur <= 0;
        });
        return {
          passed: invalid.length === 0,
          score: invalid.length === 0 ? 1.0 : 0.0,
          threshold: 1.0,
          details:
            invalid.length === 0
              ? 'All segments are properly normalized'
              : `${invalid.length} segment(s) have zero or negative duration`,
        };
      },
    },
  ];
}

/**
 * Stage 4 criteria - Render preparation (caption sync, layout consistency)
 */
function createRenderPrepCriteria(): QualityCriterion[] {
  return [
    {
      name: 'captionSync',
      threshold: 50,
      evaluate: (input: any): QualityResult => {
        const offset = Math.abs(input.captionSyncOffsetMs ?? 0);
        return {
          passed: offset <= 50,
          score: offset,
          threshold: 50,
          details: `Caption sync offset ${offset}ms (threshold +/-50ms)`,
        };
      },
    },
    {
      name: 'layoutConsistency',
      threshold: 0.9,
      evaluate: (input: any): QualityResult => {
        const score = input.layoutConsistencyScore ?? 0;
        return {
          passed: score >= 0.9,
          score,
          threshold: 0.9,
          details: `Layout consistency ${score} (threshold >= 0.9)`,
        };
      },
    },
  ];
}

/**
 * Stage 5 criteria - Render final (resolution, fps, audio sync)
 */
function createRenderFinalCriteria(): QualityCriterion[] {
  return [
    {
      name: 'resolution',
      threshold: 720,
      evaluate: (input: any): QualityResult => {
        const height = input.resolution?.height ?? 0;
        const width = input.resolution?.width ?? 0;
        // 720p = height >= 720 (also covers 1080p etc.)
        return {
          passed: height >= 720,
          score: height,
          threshold: 720,
          details: `Resolution ${width}x${height} (threshold height >= 720p)`,
        };
      },
    },
    {
      name: 'fps',
      threshold: 30,
      evaluate: (input: any): QualityResult => {
        const fps = input.fps ?? 0;
        return {
          passed: fps === 30,
          score: fps,
          threshold: 30,
          details: `FPS ${fps} (threshold = 30)`,
        };
      },
    },
    {
      name: 'audioSync',
      threshold: 50,
      evaluate: (input: any): QualityResult => {
        const offset = Math.abs(input.audioSyncOffsetMs ?? 0);
        return {
          passed: offset <= 50,
          score: offset,
          threshold: 50,
          details: `Audio sync offset ${offset}ms (threshold +/-50ms)`,
        };
      },
    },
  ];
}

/**
 * Factory: create the default quality gate configs for all 5 pipeline stages.
 */
export function createDefaultQualityGates(): QualityGateConfig[] {
  return [
    {
      stage: 1,
      name: 'Transcription Quality Gate',
      criteria: createTranscriptionCriteria(),
      blockingOnFailure: true,
      fallbackAction: 'retry',
    },
    {
      stage: 2,
      name: 'Analysis Quality Gate',
      criteria: createAnalysisCriteria(),
      blockingOnFailure: true,
      fallbackAction: 'retry',
    },
    {
      stage: 3,
      name: 'Layout Quality Gate',
      criteria: createLayoutCriteria(),
      blockingOnFailure: true,
      fallbackAction: 'abort',
    },
    {
      stage: 4,
      name: 'Render Preparation Quality Gate',
      criteria: createRenderPrepCriteria(),
      blockingOnFailure: true,
      fallbackAction: 'retry',
    },
    {
      stage: 5,
      name: 'Render Final Quality Gate',
      criteria: createRenderFinalCriteria(),
      blockingOnFailure: true,
      fallbackAction: 'abort',
    },
  ];
}
