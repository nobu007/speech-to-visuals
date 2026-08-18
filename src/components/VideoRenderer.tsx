import {useState, useRef, useEffect, memo, useCallback, useMemo} from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Download, ExternalLink, Settings } from 'lucide-react';
import { SceneGraph } from '@stv/core/types/diagram';
import { videoRenderer, VideoRenderProgress } from '@/components/videoRenderer';
import { Player } from '@remotion/player';
import { logger } from '@stv/core/utils/logger';
import { toast } from 'sonner';

type VideoQuality = 'low' | 'medium' | 'high';
type VideoRenderStage = VideoRenderProgress['stage'];

const QUALITY_LABELS: Record<VideoQuality, { label: string; description: string }> = {
  low: { label: '低画質 (720p)', description: '高速・小容量' },
  medium: { label: '中画質 (1080p)', description: 'バランス重視' },
  high: { label: '高画質 (1080p)', description: '高品質・時間長' },
};

const STAGE_LABELS: Record<VideoRenderStage, string> = {
  preparing: '準備中',
  rendering: 'レンダリング中',
  encoding: 'エンコード中',
  complete: '完了',
  error: 'エラー',
};

interface VideoRendererProps {
  scenes: SceneGraph[];
  audioUrl: string;
}

export const VideoRenderer: React.FC<VideoRendererProps> = ({ scenes, audioUrl }) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState<VideoRenderProgress | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<VideoQuality>('medium');
  const [showSettings, setShowSettings] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const totalDuration = scenes.reduce((acc, scene) => acc + (Number.isFinite(scene.durationMs) ? scene.durationMs : 0), 0);
  const minutes = Math.floor(totalDuration / 60000);
  const seconds = Math.floor((totalDuration % 60000) / 1000);

  const handleRender = async () => {
    try {
      setIsRendering(true);
      setRenderProgress(null);
      setVideoUrl(null);

      toast.info('動画のレンダリングを開始しています...');

      const resultUrl = await videoRenderer.renderVideo(
        {
          scenes,
          audioUrl,
          quality,
          outputName: `diagram-video-${Date.now()}`
        },
        (progress) => {
          if (mountedRef.current) setRenderProgress(progress);
        }
      );

      if (mountedRef.current) {
        setVideoUrl(resultUrl);
        toast.success('動画のレンダリングが完了しました！');
      }

    } catch (error) {
      logger.error('Render error:', error);
      if (mountedRef.current) {
        toast.error('動画のレンダリング中にエラーが発生しました');
      }
    } finally {
      if (mountedRef.current) setIsRendering(false);
    }
  };

  return (
    <Card className="p-6 bg-card shadow-lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">動画出力</h3>
            <p className="text-muted-foreground text-sm">
              {scenes.length}シーン・{minutes}分{seconds}秒の動画を生成
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4 mr-2" />
            設定
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">画質設定</label>
              <Select value={quality} onValueChange={(value: string) => setQuality(value as VideoQuality)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUALITY_LABELS).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Render Progress */}
        {renderProgress && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {STAGE_LABELS[renderProgress.stage]}
              </span>
              <Badge variant={renderProgress.stage === 'error' ? 'destructive' : 'default'}>
                {renderProgress.progress.toFixed(0)}%
              </Badge>
            </div>

            <Progress value={renderProgress.progress} className="h-2" />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{renderProgress.message}</span>
              <span>
                {renderProgress.currentFrame} / {renderProgress.totalFrames} フレーム
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleRender}
            disabled={isRendering || scenes.length === 0}
            className="flex-1 bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
          >
            {isRendering ? (
              <>
                <Play className="w-4 h-4 mr-2 animate-spin" />
                レンダリング中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                動画を生成
              </>
            )}
          </Button>

          {videoUrl && (
            <Button
              variant="outline"
              onClick={() => {
                // In a real implementation, this would trigger a download
                window.open(videoUrl, '_blank');
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              ダウンロード
            </Button>
          )}
        </div>

        {/* Video Preview */}
        {videoUrl && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">生成された動画</span>
              <Badge variant="secondary">完了</Badge>
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden">
              <div className="aspect-video flex items-center justify-center text-white bg-gradient-to-br from-gray-800 to-gray-900">
                <div className="text-center space-y-2">
                  <Play className="w-16 h-16 mx-auto opacity-60" />
                  <p className="text-sm opacity-80">動画プレビュー</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(videoUrl, '_blank')}
                    className="text-white hover:text-white hover:bg-white/10"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    新しいタブで開く
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
          <p>💡 レンダリング時間は動画の長さと画質設定によって変わります。高画質設定では数分かかる場合があります。</p>
        </div>
      </div>
    </Card>
  );
};