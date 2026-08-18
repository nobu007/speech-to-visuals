/**
 * PipelineProgress - Real-time pipeline progress display
 * Shows all four stages (Transcribe → Analyze → Layout → Render) with a
 * global progress bar, ETA, quality score, and WebSocket integration.
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type FC,
} from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  StageIndicator,
  type StageInfo,
  type StageName,
  type StageStatus,
} from '@/components/StageIndicator';
import { cn } from '@stv/core/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PipelineProgressProps {
  /** Unique pipeline run id – used to subscribe to WebSocket events. */
  pipelineId?: string;
  /** Optional initial stages (useful for SSR / testing). */
  initialStages?: StageInfo[];
  /** Optional initial quality score. */
  initialQualityScore?: number | null;
  /** External WebSocket-like event emitter. If provided, the component
   *  subscribes on mount and unsubscribes on unmount. */
  eventEmitter?: EventEmitterLike | null;
  className?: string;
}

/** Minimal EventEmitter interface the component needs. */
export interface EventEmitterLike {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

// ─── WebSocket event payloads ───────────────────────────────────────────────

export interface PipelineProgressEvent {
  pipelineId: string;
  stage: StageName;
  stageProgress: number; // 0-100 within stage
  overallProgress: number; // 0-100
}

export interface PipelineStageCompleteEvent {
  pipelineId: string;
  stage: StageName;
  qualityScore?: number;
}

export interface PipelineCompleteEvent {
  pipelineId: string;
  qualityScore: number;
  totalTimeMs: number;
}

export interface PipelineErrorEvent {
  pipelineId: string;
  stage: StageName;
  error: string;
}

// ─── Pure helpers (exported for testing) ────────────────────────────────────

export const STAGE_NAMES: StageName[] = [
  'transcribe',
  'analyze',
  'layout',
  'render',
];

export const STAGE_WEIGHTS: Record<StageName, number> = {
  transcribe: 25,
  analyze: 25,
  layout: 25,
  render: 25,
};

export function createInitialStages(): StageInfo[] {
  return STAGE_NAMES.map((name) => ({
    name,
    status: 'pending' as StageStatus,
    progress: 0,
    startedAt: null,
    completedAt: null,
    error: null,
  }));
}

/**
 * Calculate overall progress (0-100) from stage progresses + weights.
 * Completed stages contribute their full weight.
 */
export function calcOverallProgress(stages: StageInfo[]): number {
  let total = 0;
  for (const stage of stages) {
    if (stage.status === 'completed') {
      total += STAGE_WEIGHTS[stage.name];
    } else if (stage.status === 'active') {
      total += (STAGE_WEIGHTS[stage.name] * stage.progress) / 100;
    }
  }
  return Math.min(100, Math.round(total));
}

/**
 * Estimate remaining time in seconds.
 * Uses elapsed time vs overall progress to extrapolate.
 */
export function calcETA(
  stages: StageInfo[],
  startedAtMs: number | null,
  nowMs?: number,
): number | null {
  if (startedAtMs == null) return null;

  const now = nowMs ?? Date.now();
  const elapsedSec = (now - startedAtMs) / 1000;
  if (elapsedSec <= 0) return null;

  const overall = calcOverallProgress(stages);
  if (overall <= 0) return null;
  if (overall >= 100) return 0;

  const estimatedTotal = (elapsedSec / overall) * 100;
  return Math.max(0, estimatedTotal - elapsedSec);
}

/**
 * Format ETA to human-readable Japanese string.
 * Returns null when eta is null or zero (complete).
 */
export function formatETA(etaSec: number | null): string | null {
  if (etaSec == null) return null;
  if (etaSec <= 0) return null;

  if (etaSec < 60) {
    return `残り約${Math.round(etaSec)}秒`;
  }
  const mins = Math.round(etaSec / 60);
  return `残り約${mins}分`;
}

/**
 * Get quality score color class.
 */
export function qualityScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

/**
 * Get quality badge variant.
 */
export function qualityBadgeVariant(
  score: number,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'secondary';
  if (score >= 60) return 'outline';
  if (score >= 40) return 'outline';
  return 'destructive';
}

// ─── State reducer (pure, exported for testing) ─────────────────────────────

export type PipelineAction =
  | { type: 'STAGE_PROGRESS'; stage: StageName; stageProgress: number }
  | { type: 'STAGE_COMPLETE'; stage: StageName; qualityScore?: number }
  | { type: 'PIPELINE_COMPLETE'; qualityScore: number }
  | { type: 'PIPELINE_ERROR'; stage: StageName; error: string }
  | { type: 'RESET' };

export interface PipelineProgressState {
  stages: StageInfo[];
  qualityScore: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

export const initialPipelineProgressState: PipelineProgressState = {
  stages: createInitialStages(),
  qualityScore: null,
  startedAt: null,
  completedAt: null,
};

export function pipelineProgressReducer(
  state: PipelineProgressState,
  action: PipelineAction,
): PipelineProgressState {
  switch (action.type) {
    case 'STAGE_PROGRESS': {
      const now = Date.now();
      const stages = state.stages.map((s) => {
        if (s.name !== action.stage) return s;
        const isActive = s.status === 'active';
        const isPending = s.status === 'pending';
        if (!isActive && !isPending) return s;
        return {
          ...s,
          status: 'active' as StageStatus,
          progress: action.stageProgress,
          startedAt: s.startedAt ?? now,
        };
      });
      return {
        ...state,
        stages,
        startedAt: state.startedAt ?? now,
      };
    }

    case 'STAGE_COMPLETE': {
      const now = Date.now();
      const nextStageIdx = STAGE_NAMES.indexOf(action.stage) + 1;
      const stages = state.stages.map((s, idx) => {
        if (s.name === action.stage) {
          return {
            ...s,
            status: 'completed' as StageStatus,
            progress: 100,
            completedAt: now,
          };
        }
        // Activate the next pending stage
        if (idx === nextStageIdx && s.status === 'pending') {
          return { ...s, status: 'active' as StageStatus, startedAt: now };
        }
        return s;
      });

      const qualityScore =
        action.qualityScore ?? state.qualityScore;

      return { ...state, stages, qualityScore };
    }

    case 'PIPELINE_COMPLETE': {
      const now = Date.now();
      const stages = state.stages.map((s) => ({
        ...s,
        status: 'completed' as StageStatus,
        progress: 100,
        completedAt: s.completedAt ?? now,
      }));
      return {
        ...state,
        stages,
        qualityScore: action.qualityScore,
        completedAt: now,
      };
    }

    case 'PIPELINE_ERROR': {
      const stages = state.stages.map((s) => {
        if (s.name !== action.stage) return s;
        return { ...s, status: 'error' as StageStatus, error: action.error };
      });
      return { ...state, stages };
    }

    case 'RESET':
      return { ...initialPipelineProgressState };

    default:
      return state;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export const PipelineProgress: FC<PipelineProgressProps> = ({
  pipelineId,
  initialStages,
  initialQualityScore,
  eventEmitter,
  className,
}) => {
  const [state, setState] = useState<PipelineProgressState>({
    stages: initialStages ?? createInitialStages(),
    qualityScore: initialQualityScore ?? null,
    startedAt: null,
    completedAt: null,
  });

  const dispatch = useCallback((action: PipelineAction) => {
    setState((prev) => pipelineProgressReducer(prev, action));
  }, []);

  // ── WebSocket integration ────────────────────────────────────────────────
  const handlerRef = useRef<Record<string, (...args: unknown[]) => void>>({});

  useEffect(() => {
    if (!eventEmitter) return;

    const handlers = handlerRef.current;

    handlers['pipeline:progress'] = (...args: unknown[]) => {
      const data = args[0] as PipelineProgressEvent;
      dispatch({
        type: 'STAGE_PROGRESS',
        stage: data.stage,
        stageProgress: data.stageProgress,
      });
    };

    handlers['pipeline:stage-complete'] = (...args: unknown[]) => {
      const data = args[0] as PipelineStageCompleteEvent;
      dispatch({
        type: 'STAGE_COMPLETE',
        stage: data.stage,
        qualityScore: data.qualityScore,
      });
    };

    handlers['pipeline:complete'] = (...args: unknown[]) => {
      const data = args[0] as PipelineCompleteEvent;
      dispatch({
        type: 'PIPELINE_COMPLETE',
        qualityScore: data.qualityScore,
      });
    };

    handlers['pipeline:error'] = (...args: unknown[]) => {
      const data = args[0] as PipelineErrorEvent;
      dispatch({
        type: 'PIPELINE_ERROR',
        stage: data.stage,
        error: data.error,
      });
    };

    // Subscribe
    for (const [event, handler] of Object.entries(handlers)) {
      eventEmitter.on(event, handler);
    }

    // Cleanup
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        eventEmitter.off(event, handler);
      }
    };
  }, [eventEmitter, dispatch]);

  // ── Derived values ───────────────────────────────────────────────────────

  const overallProgress = useMemo(
    () => calcOverallProgress(state.stages),
    [state.stages],
  );

  const eta = useMemo(
    () => calcETA(state.stages, state.startedAt),
    [state.stages, state.startedAt],
  );

  const etaLabel = useMemo(() => formatETA(eta), [eta]);

  const hasError = useMemo(
    () => state.stages.some((s) => s.status === 'error'),
    [state.stages],
  );

  const isComplete = useMemo(
    () => state.completedAt != null,
    [state.completedAt],
  );

  return (
    <Card className={cn('w-full max-w-2xl mx-auto p-3 sm:p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-base sm:text-lg font-semibold">
          {isComplete
            ? '処理完了'
            : hasError
              ? 'エラーが発生しました'
              : 'パイプライン処理中'}
        </h3>
        {state.qualityScore != null && (
          <Badge
            variant={qualityBadgeVariant(state.qualityScore)}
            className={cn(
              'text-xs sm:text-sm tabular-nums',
              qualityScoreColor(state.qualityScore),
            )}
          >
            品質スコア: {state.qualityScore}
          </Badge>
        )}
      </div>

      {/* Overall progress bar */}
      <div className="mb-3 sm:mb-4 space-y-1">
        <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
          <span>全体進捗</span>
          <span className="tabular-nums">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2 sm:h-2" />
      </div>

      {/* ETA */}
      {etaLabel && (
        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground text-center">
          {etaLabel}
        </div>
      )}
      {isComplete && (
        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-green-600 text-center">
          処理が完了しました
        </div>
      )}

      {/* Stage indicators */}
      <div className="space-y-1.5 sm:space-y-2">
        {state.stages.map((stage) => (
          <StageIndicator key={stage.name} stage={stage} />
        ))}
      </div>
    </Card>
  );
};

PipelineProgress.displayName = 'PipelineProgress';

export default PipelineProgress;
