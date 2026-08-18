/**
 * StageIndicator - Pipeline stage display component
 * Shows individual stage status with icon, name, progress, and elapsed time.
 * Uses shadcn/ui Badge and Tooltip.
 */

import { memo, useMemo, type FC } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  FileAudio,
  Brain,
  LayoutGrid,
  Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { cn } from '@stv/core/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

export type StageStatus = 'pending' | 'active' | 'completed' | 'error';
export type StageName = 'transcribe' | 'analyze' | 'layout' | 'render';

export interface StageInfo {
  name: StageName;
  status: StageStatus;
  progress: number; // 0-100 within this stage
  startedAt: number | null; // Unix ms
  completedAt: number | null; // Unix ms
  error: string | null;
}

export interface StageIndicatorProps {
  stage: StageInfo;
  className?: string;
}

// ─── Pure helpers (exported for testing) ────────────────────────────────────

export const STAGE_CONFIG: Record<
  StageName,
  { label: string; description: string; Icon: FC<{ className?: string }> }
> = {
  transcribe: {
    label: '文字起こし',
    description: '音声をテキストに変換',
    Icon: FileAudio,
  },
  analyze: {
    label: '分析',
    description: 'テキスト構造と関係を分析',
    Icon: Brain,
  },
  layout: {
    label: 'レイアウト',
    description: '図解レイアウトを生成',
    Icon: LayoutGrid,
  },
  render: {
    label: '動画生成',
    description: '最終動画をレンダリング',
    Icon: Video,
  },
};

export const STATUS_ICON_MAP: Record<
  StageStatus,
  FC<{ className?: string }> | null
> = {
  pending: null,
  active: Loader2,
  completed: CheckCircle2,
  error: XCircle,
};

export const STATUS_BADGE_VARIANT: Record<StageStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  completed: 'secondary',
  error: 'destructive',
};

export const STATUS_LABEL: Record<StageStatus, string> = {
  pending: '待機中',
  active: '処理中',
  completed: '完了',
  error: 'エラー',
};

/** Compute elapsed seconds for a stage (ongoing or finished). */
export function calcElapsed(stage: StageInfo, nowMs?: number): number {
  if (stage.startedAt == null) return 0;
  const end = stage.completedAt ?? nowMs ?? Date.now();
  return Math.max(0, (end - stage.startedAt) / 1000);
}

/**
 * Format elapsed seconds to human-readable string.
 *
 * Round-then-decompose: round the TOTAL to an integer BEFORE splitting into
 * minutes + seconds. Rounding the seconds remainder in isolation lets it reach
 * 60 (e.g. 119.5 s → "1分60秒"), and rounding under the <60 guard yields
 * "60秒" for a sub-minute input (59.5 s). `calcElapsed` returns fractional
 * seconds (a Date.now() delta / 1000), so these inputs occur in production.
 * Sibling of the animated-scene-renderer subtitle formatter; fixed identically.
 */
export function formatElapsed(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 60) {
    return `${total}秒`;
  }
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const StageIndicator: FC<StageIndicatorProps> = memo(
  ({ stage, className }) => {
    const config = useMemo(() => STAGE_CONFIG[stage.name], [stage.name]);
    const StageIcon = config.Icon;
    const StatusIcon = STATUS_ICON_MAP[stage.status];

    const elapsed = useMemo(
      () => calcElapsed(stage),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [stage.startedAt, stage.completedAt],
    );

    const elapsedLabel = useMemo(
      () => (stage.startedAt != null ? formatElapsed(elapsed) : null),
      [stage.startedAt, elapsed],
    );

    return (
      <TooltipProvider>
        <div
          className={cn(
            'flex items-center gap-2 sm:gap-3 rounded-lg border p-2 sm:p-3 transition-colors',
            stage.status === 'active' && 'border-primary bg-primary/5',
            stage.status === 'completed' && 'border-green-500/50 bg-green-500/5',
            stage.status === 'error' && 'border-destructive bg-destructive/5',
            stage.status === 'pending' && 'border-muted bg-muted/30',
            className,
          )}
        >
          {/* Stage icon */}
          <div className="relative flex-shrink-0">
            <StageIcon
              className={cn(
                'h-4 w-4 sm:h-5 sm:w-5',
                stage.status === 'pending' && 'text-muted-foreground',
                stage.status === 'active' && 'text-primary',
                stage.status === 'completed' && 'text-green-600',
                stage.status === 'error' && 'text-destructive',
              )}
            />
            {stage.status === 'active' && (
              <StatusIcon className="absolute -right-1 -top-1 h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary animate-spin" />
            )}
          </div>

          {/* Stage info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium truncate">
                {config.label}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={STATUS_BADGE_VARIANT[stage.status]} className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                    {STATUS_LABEL[stage.status]}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{config.description}</p>
                  {stage.error && (
                    <p className="text-destructive">{stage.error}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Intra-stage progress bar */}
            {(stage.status === 'active' || stage.status === 'completed') && (
              <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 sm:gap-2">
                <Progress value={stage.progress} className="h-1 sm:h-1.5 flex-1" />
                <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums w-7 sm:w-8 text-right">
                  {Math.round(stage.progress)}%
                </span>
              </div>
            )}
          </div>

          {/* Elapsed time */}
          {elapsedLabel && (
            <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums flex-shrink-0">
              {elapsedLabel}
            </span>
          )}
        </div>
      </TooltipProvider>
    );
  },
);

StageIndicator.displayName = 'StageIndicator';

export default StageIndicator;
