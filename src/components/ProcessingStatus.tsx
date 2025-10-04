import { memo, useMemo } from 'react';
import { ProcessingStatus as Status } from '@/types/diagram';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileAudio, Brain, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProcessingStatusProps = {
  status: Status;
  progress: number;
  currentStep?: string;
};

const statusConfig = {
  idle: { icon: FileAudio, label: '待機中', color: 'text-muted-foreground' },
  uploading: { icon: Loader2, label: 'アップロード中...', color: 'text-primary' },
  transcribing: { icon: FileAudio, label: '文字起こし中...', color: 'text-diagram-flow' },
  analyzing: { icon: Brain, label: '分析中...', color: 'text-diagram-tree' },
  generating: { icon: Sparkles, label: '図解生成中...', color: 'text-accent' },
  complete: { icon: CheckCircle2, label: '完了！', color: 'text-green-500' },
  error: { icon: XCircle, label: 'エラーが発生しました', color: 'text-destructive' },
} as const;

export const ProcessingStatus = memo(({ status, progress, currentStep }: ProcessingStatusProps) => {
  const config = useMemo(() => statusConfig[status], [status]);
  const Icon = config.icon;

  const isAnimated = useMemo(() => status !== 'complete' && status !== 'error', [status]);
  const showProgress = useMemo(() => status !== 'complete' && status !== 'error', [status]);
  const roundedProgress = useMemo(() => Math.round(progress), [progress]);

  if (status === 'idle') return null;

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 bg-card shadow-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className={cn('relative', config.color)}>
            {isAnimated ? (
              <Icon className="w-8 h-8 animate-spin" />
            ) : (
              <Icon className="w-8 h-8" />
            )}
            {isAnimated && (
              <div className="absolute inset-0 animate-ping opacity-20">
                <Icon className="w-8 h-8" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{config.label}</h3>
            {currentStep && (
              <p className="text-sm text-muted-foreground">{currentStep}</p>
            )}
          </div>
          <div className="text-2xl font-bold text-primary">
            {roundedProgress}%
          </div>
        </div>

        {showProgress && (
          <Progress
            value={progress}
            className="h-2 bg-muted"
          />
        )}
      </div>
    </Card>
  );
});
