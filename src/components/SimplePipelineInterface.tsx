import React, { useReducer, useRef, useCallback, useEffect, useState } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Loader2, Video, HelpCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { bytesToMb } from '@stv/core/lib/metrics-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  pipelineReducer,
  initialPipelineState,
  SimplePipelineResult,
} from './SimplePipelineStateMachine';
import { getAudioDuration, formatDuration } from '@stv/core/utils/audio-duration';
import { validateAudioFile, validateAudioDuration } from '@stv/core/utils/audio-validation';
import { AUDIO_LIMITS } from '@stv/core/config/limits';
import { logger } from '@stv/core/utils/logger';

// ========================================
// Pipeline Stage Configuration
// ========================================

const PIPELINE_STAGES = [
  { key: 'uploading', label: 'アップロード', progress: 10 },
  { key: 'transcribing', label: '文字起こし', progress: 30 },
  { key: 'analyzing', label: '図解分析', progress: 60 },
  { key: 'generating', label: '動画生成', progress: 85 },
] as const;

// ========================================
// Valid audio types
// ========================================

const VALID_AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'];

// ========================================
// Component
// ========================================

export const SimplePipelineInterface: React.FC = () => {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);

  const { status, file, progress, currentStep, error, result } = state;

  // ---- File selection handler ----
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setDurationWarning(null);

    // Validate file using centralized validation (EDGE-001/EDGE-101)
    const fileValidation = validateAudioFile(selectedFile);
    if (!fileValidation.valid) {
      dispatch({ type: 'PROCESSING_ERROR', error: fileValidation.errors[0] });
      return;
    }

    dispatch({ type: 'SELECT_FILE', file: selectedFile });

    // Check duration asynchronously (EDGE-102 reject / EDGE-103 warn)
    getAudioDuration(selectedFile)
      .then((duration) => {
        const durValidation = validateAudioDuration(duration);
        if (!durValidation.valid) {
          dispatch({ type: 'PROCESSING_ERROR', error: `音声が短すぎます（${duration.toFixed(2)}秒）。1秒以上の音声ファイルをご利用ください。` });
          return;
        }
        if (durValidation.warnings.length > 0) {
          setDurationWarning(
            `この音声ファイルは${formatDuration(duration)}です。1時間を超えるため、処理に時間がかかる場合があります。`,
          );
        }
      })
      .catch((err) => {
        logger.warn('[SimplePipeline] Audio duration check failed — backend will still validate', err);
      });
  }, []);

  // ---- Process handler (simulates full pipeline) ----
  const handleProcess = useCallback(async () => {
    if (!file) return;

    dispatch({ type: 'START_PROCESSING' });

    try {
      // Stage 1: Upload
      dispatch({ type: 'UPLOAD_START' });
      dispatch({ type: 'SET_PROGRESS', step: 'ファイルをアップロード中...', progress: 15 });
      await simulateDelay(500);

      // Stage 2: Transcribe
      dispatch({ type: 'TRANSCRIBE_START' });
      dispatch({ type: 'SET_PROGRESS', step: '音声を文字起こし中...', progress: 40 });
      await simulateDelay(800);

      // Stage 3: Analyze
      dispatch({ type: 'ANALYZE_START' });
      dispatch({ type: 'SET_PROGRESS', step: '図解分析中...', progress: 70 });
      await simulateDelay(600);

      // Stage 4: Generate
      dispatch({ type: 'GENERATE_START' });
      dispatch({ type: 'SET_PROGRESS', step: '動画生成中...', progress: 90 });
      await simulateDelay(500);

      // Complete
      dispatch({
        type: 'PROCESSING_COMPLETE',
        result: {
          success: true,
          audioUrl: `blob:${file.name}`,
          transcript: 'サンプルの文字起こし結果です。',
          scenes: [{ id: 'scene-1', type: 'flow', content: 'サンプルシーン', confidence: 0.9 }],
          processingTime: 2400,
          videoUrl: 'blob:sample-video.mp4',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      logger.error(`[SimplePipeline] Processing error: ${message}`);
      dispatch({ type: 'PROCESSING_ERROR', error: message });
    }
  }, [file]);

  // ---- Reset handler ----
  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setDurationWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ---- Retry handler ----
  const handleRetry = useCallback(() => {
    dispatch({ type: 'RETRY' });
    setDurationWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && file && status === 'idle') {
        event.preventDefault();
        handleProcess();
      }
      if (event.key === 'Escape' && !['uploading', 'transcribing', 'analyzing', 'generating'].includes(status)) {
        event.preventDefault();
        handleReset();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'o' && status === 'idle') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, status, handleProcess, handleReset]);

  // ---- Download handler ----
  const handleDownload = useCallback(() => {
    if (!result) return;
    const data = {
      timestamp: new Date().toISOString(),
      transcript: result.transcript,
      scenes: result.scenes,
      processingTime: result.processingTime,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  // ---- Get active stage index ----
  const getActiveStageIndex = (): number => {
    const order: Array<typeof status> = ['idle', 'uploading', 'transcribing', 'analyzing', 'generating', 'complete'];
    return order.indexOf(status);
  };

  const activeStageIndex = getActiveStageIndex();
  const isProcessing = ['uploading', 'transcribing', 'analyzing', 'generating'].includes(status);

  return (
    <div className="w-full max-w-4xl mx-auto px-2 py-3 sm:px-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary" aria-hidden="true" />
                Speech to Visuals Pipeline
              </CardTitle>
              <CardDescription className="mt-1 sm:mt-2 text-xs sm:text-sm">
                音声ファイルをアップロードして、自動的に図解付きの構造化されたシーンを生成します
              </CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="キーボードショートカット" className="min-h-[44px] min-w-[44px]">
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[200px] sm:max-w-xs">
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">キーボードショートカット:</p>
                  <div><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+O</kbd> ファイルを選択</div>
                  <div><kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Enter</kbd> 処理開始</div>
                  <div><kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> リセット</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
      </Card>

      {/* Stage Progress Indicator */}
      {(isProcessing || status === 'complete') && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              {PIPELINE_STAGES.map((stage, index) => {
                const stageIndex = index + 1; // +1 because idle=0
                const isCompleted = activeStageIndex > stageIndex;
                const isActive = activeStageIndex === stageIndex;
                const isPending = activeStageIndex < stageIndex;

                return (
                  <div key={stage.key} className="flex-1 text-center">
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-medium transition-all duration-300
                        ${isCompleted ? 'bg-green-500 text-white' : ''}
                        ${isActive ? 'bg-blue-500 text-white animate-pulse' : ''}
                        ${isPending ? 'bg-muted text-muted-foreground' : ''}
                      `}
                      role="status"
                      aria-label={`${stage.label}: ${isCompleted ? '完了' : isActive ? '処理中' : '待機中'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{stage.label}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Idle: File Upload */}
      {status === 'idle' && !file && (
        <Card>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-8 text-center">
              <Upload className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <h3 className="text-base sm:text-lg font-medium mb-2">音声ファイルをアップロード</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                MP3, WAV, OGG, M4A形式 (最大50MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="音声ファイルを選択"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                aria-label="ファイルを選択"
                className="min-h-[44px]"
              >
                ファイルを選択
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File selected, ready to process */}
      {status === 'idle' && file && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{file.name}</h3>
                <p className="text-sm text-muted-foreground">
                  サイズ: {bytesToMb(file.size).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleReset} aria-label="キャンセル" className="flex-1 sm:flex-none min-h-[44px]">
                  キャンセル
                </Button>
                <Button onClick={handleProcess} aria-label="処理を開始" className="flex-1 sm:flex-none min-h-[44px]">
                  <Play className="w-4 h-4 mr-2" />
                  処理開始
                </Button>
              </div>
            </div>
            {durationWarning && (
              <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                  {durationWarning}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm sm:text-base font-medium">処理中...</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <Badge variant="outline">
                  {status === 'uploading' && 'アップロード中'}
                  {status === 'transcribing' && '文字起こし中'}
                  {status === 'analyzing' && '図解分析中'}
                  {status === 'generating' && '動画生成中'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {status === 'error' && error && (
        <Alert variant="destructive" className="border-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <AlertDescription className="font-medium">{error}</AlertDescription>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={handleRetry} aria-label="リトライ">
                リトライ
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} aria-label="リセット">
                リセット
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Complete State */}
      {status === 'complete' && result && result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              処理完了
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <div className="text-center p-2 sm:p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {result.scenes?.length || 0}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400">生成シーン</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-300">
                  {result.processingTime ? Math.round(result.processingTime / 1000) : 0}s
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">処理時間</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {result.transcript?.split(' ').length || 0}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400">単語数</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {result.videoUrl ? 'あり' : 'なし'}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-400">動画</div>
              </div>
            </div>

            {/* Transcript Preview */}
            {result.transcript && (
              <div>
                <h4 className="font-medium mb-2">文字起こし結果</h4>
                <div className="p-2 sm:p-3 bg-muted rounded-lg text-xs sm:text-sm max-h-32 overflow-y-auto">
                  {result.transcript}
                </div>
              </div>
            )}

            {/* Scenes Preview */}
            {result.scenes && result.scenes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">生成されたシーン</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.scenes.map((scene: Record<string, unknown>, index: number) => (
                    <div key={(scene.id as React.Key) || index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">シーン {index + 1}: {scene.type as React.ReactNode}</span>
                        {scene.confidence && (
                          <span className="text-sm text-muted-foreground">
                            信頼度: {Math.round(scene.confidence as number * 100)}%
                          </span>
                        )}
                      </div>
                      {scene.content && (
                        <p className="text-sm text-muted-foreground">
                          {(scene.content as string).substring(0, 100)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleDownload} className="sm:w-auto" aria-label="データをダウンロード">
                <Download className="w-4 h-4 mr-2" />
                データをダウンロード
              </Button>
              <Button variant="outline" onClick={handleReset} className="sm:w-auto" aria-label="新しいファイルを処理">
                新しいファイルを処理
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper to simulate async delay
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default SimplePipelineInterface;
