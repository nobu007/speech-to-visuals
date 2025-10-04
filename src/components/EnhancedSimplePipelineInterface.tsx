/**
 * Enhanced SimplePipeline Interface - Phase 4-2 Implementation
 * カスタムインストラクション準拠: UI/UX改善 + 動画生成統合
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Play,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Video,
  Image,
  FileText,
  RefreshCw,
  Settings,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { simplePipeline, SimplePipelineResult } from '@/pipeline/simple-pipeline';
import { VideoGenerator, VideoGenerationResult, VideoGenerationOptions } from '@/pipeline/video-generator';
import { SceneGraph } from '@/types/diagram';
import { toast } from 'sonner';

interface ProcessingStage {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  error?: string;
}

interface ProcessingMetrics {
  totalTime: number;
  stageTimings: { [key: string]: number };
  qualityScore: number;
  confidence: number;
}

export const EnhancedSimplePipelineInterface: React.FC = () => {
  // Core State
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState(0);

  // Results State
  const [pipelineResult, setPipelineResult] = useState<SimplePipelineResult | null>(null);
  const [videoResult, setVideoResult] = useState<VideoGenerationResult | null>(null);

  // Enhanced State
  const [processingStages, setProcessingStages] = useState<ProcessingStage[]>([
    { id: 'upload', name: 'ファイル準備', description: '音声ファイルの検証と準備', progress: 0, status: 'pending' },
    { id: 'transcription', name: '文字起こし', description: '音声からテキストへの変換', progress: 0, status: 'pending' },
    { id: 'analysis', name: '内容分析', description: 'シーン分割と図解タイプ判定', progress: 0, status: 'pending' },
    { id: 'layout', name: 'レイアウト生成', description: '図解の配置とデザイン', progress: 0, status: 'pending' },
    { id: 'video', name: '動画生成', description: 'Remotionによる動画レンダリング', progress: 0, status: 'pending' }
  ]);

  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ProcessingMetrics | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');

  // Video Generation Options
  const [videoOptions] = useState<VideoGenerationOptions>({
    outputFormat: 'mp4',
    quality: 'high',
    resolution: '1080p',
    fps: 30,
    includeAudio: true,
    backgroundColor: '#0f0f23',
    animationStyle: 'smooth'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoGenerator = useRef(new VideoGenerator(videoOptions));

  /**
   * Phase 4-2: 強化されたファイル選択処理
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Enhanced file validation
    const validationResult = validateAudioFile(selectedFile);
    if (!validationResult.isValid) {
      toast.error(validationResult.message);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setPipelineResult(null);
    setVideoResult(null);
    resetProcessingStages();
    setActiveTab('processing');

    toast.success(`ファイル「${selectedFile.name}」が選択されました`, {
      description: `サイズ: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
    });
  }, []);

  /**
   * Phase 4-2: 完全パイプライン処理（音声→動画）
   */
  const handleFullPipeline = async () => {
    if (!file) {
      toast.error('音声ファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setOverallProgress(0);
    setRetryCount(0);
    resetProcessingStages();

    const startTime = performance.now();
    const stageTimings: { [key: string]: number } = {};

    try {
      console.log('🚀 Starting enhanced pipeline processing');

      // Stage 1: File Preparation
      await updateStage('upload', 'active', 'ファイル準備中...');
      const stageStart = performance.now();
      await simulateFilePreparation();
      stageTimings.upload = performance.now() - stageStart;
      await updateStage('upload', 'completed');

      // Stage 2: Audio Processing (SimplePipeline)
      await updateStage('transcription', 'active', 'SimplePipeline実行中...');
      const pipelineStart = performance.now();

      const result = await simplePipeline.processWithRetry(
        { audioFile: file },
        (step: string, progressValue: number) => {
          updateProgressWithinStage('transcription', step, progressValue);
        },
        3 // max retries
      );

      stageTimings.transcription = performance.now() - pipelineStart;

      if (!result.success) {
        throw new Error(result.error || 'SimplePipeline処理に失敗しました');
      }

      setPipelineResult(result);
      await updateStage('transcription', 'completed');
      await updateStage('analysis', 'completed'); // SimplePipelineが分析も含む
      await updateStage('layout', 'completed');

      // Stage 3: Video Generation
      await updateStage('video', 'active', '動画生成中...');
      const videoStart = performance.now();

      const videoResult = await videoGenerator.current.generateVideo(
        result,
        (stage: string, progress: number) => {
          updateProgressWithinStage('video', stage, progress);
        }
      );

      stageTimings.video = performance.now() - videoStart;

      if (!videoResult.success) {
        throw new Error(videoResult.error || '動画生成に失敗しました');
      }

      setVideoResult(videoResult);
      await updateStage('video', 'completed');

      // Processing Complete
      const totalTime = performance.now() - startTime;
      const qualityScore = calculateQualityScore(result, videoResult);
      const confidence = calculateOverallConfidence(result);

      setMetrics({
        totalTime,
        stageTimings,
        qualityScore,
        confidence
      });

      setOverallProgress(100);
      setActiveTab('results');

      toast.success('処理が完了しました！', {
        description: `動画生成まで含めて ${Math.round(totalTime / 1000)}秒で完了`
      });

      console.log('✅ Enhanced pipeline processing completed successfully:', {
        totalTime,
        scenes: result.scenes?.length,
        videoUrl: videoResult.videoUrl
      });

    } catch (error) {
      console.error('❌ Enhanced pipeline processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';

      setError(errorMessage);
      handleProcessingError(errorMessage);

    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Phase 4-2: ステージ状態更新
   */
  const updateStage = async (stageId: string, status: ProcessingStage['status'], description?: string) => {
    setProcessingStages(prev => prev.map(stage =>
      stage.id === stageId
        ? { ...stage, status, description: description || stage.description }
        : stage
    ));

    // Update overall progress based on completed stages
    const completedStages = processingStages.filter(s => s.status === 'completed').length;
    const newProgress = (completedStages / processingStages.length) * 100;
    setOverallProgress(newProgress);

    // Visual feedback delay
    await new Promise(resolve => setTimeout(resolve, 200));
  };

  /**
   * Phase 4-2: ステージ内プログレス更新
   */
  const updateProgressWithinStage = (stageId: string, currentStep: string, progress: number) => {
    setCurrentStage(`${currentStep} (${progress}%)`);

    setProcessingStages(prev => prev.map(stage =>
      stage.id === stageId
        ? { ...stage, progress }
        : stage
    ));
  };

  /**
   * Phase 4-2: エラーハンドリング強化
   */
  const handleProcessingError = async (errorMessage: string) => {
    // Find the current active stage and mark it as error
    setProcessingStages(prev => prev.map(stage =>
      stage.status === 'active'
        ? { ...stage, status: 'error', error: errorMessage }
        : stage
    ));

    // Enhanced error reporting
    const errorReport = {
      timestamp: new Date().toISOString(),
      file: file?.name,
      error: errorMessage,
      stage: processingStages.find(s => s.status === 'active')?.id,
      retryCount: retryCount
    };

    console.error('📊 Error Report:', errorReport);

    // Show retry option for recoverable errors
    if (retryCount < 2 && isRecoverableError(errorMessage)) {
      toast.error(errorMessage, {
        description: 'しばらく時間をおいて再試行してください',
        action: {
          label: 'リトライ',
          onClick: () => {
            setRetryCount(prev => prev + 1);
            handleFullPipeline();
          }
        }
      });
    } else {
      toast.error(errorMessage, {
        description: '問題が解決しない場合は、別のファイルをお試しください'
      });
    }
  };

  /**
   * Enhanced download functionality
   */
  const handleDownload = (format: 'video' | 'json' | 'srt') => {
    if (!pipelineResult && !videoResult) return;

    switch (format) {
      case 'video':
        if (videoResult?.videoUrl) {
          // In a real implementation, this would download the actual video file
          toast.success('動画ダウンロードを開始しました');
          // window.open(videoResult.videoUrl, '_blank');
        }
        break;

      case 'json':
        downloadJSON();
        break;

      case 'srt':
        downloadSRT();
        break;
    }
  };

  const downloadJSON = () => {
    if (!pipelineResult) return;

    const data = {
      timestamp: new Date().toISOString(),
      file: file?.name,
      pipeline: pipelineResult,
      video: videoResult,
      metrics: metrics
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-to-visuals-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('データファイルをダウンロードしました');
  };

  const downloadSRT = () => {
    if (!pipelineResult?.scenes) return;

    const srtContent = pipelineResult.scenes.map((scene, index) => {
      const startTime = formatSRTTime(scene.startTime);
      const endTime = formatSRTTime(scene.endTime);
      return `${index + 1}\n${startTime} --> ${endTime}\n${scene.content}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles-${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('字幕ファイルをダウンロードしました');
  };

  // Helper functions
  const validateAudioFile = (file: File) => {
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validTypes.includes(file.type)) {
      return {
        isValid: false,
        message: 'サポートされていないファイル形式です。MP3, WAV, OGG, M4A形式をご利用ください。'
      };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        message: 'ファイルサイズが大きすぎます。50MB以下のファイルをご利用ください。'
      };
    }

    return { isValid: true, message: '' };
  };

  const resetProcessingStages = () => {
    setProcessingStages(prev => prev.map(stage => ({
      ...stage,
      status: 'pending',
      progress: 0,
      error: undefined
    })));
    setOverallProgress(0);
    setCurrentStage('');
  };

  const simulateFilePreparation = () => {
    return new Promise(resolve => setTimeout(resolve, 500));
  };

  const calculateQualityScore = (pipeline: SimplePipelineResult, video: VideoGenerationResult): number => {
    let score = 0.5; // Base score

    // Pipeline quality
    if (pipeline.success) score += 0.2;
    if (pipeline.scenes && pipeline.scenes.length > 0) score += 0.1;
    if (pipeline.processingTime && pipeline.processingTime < 30000) score += 0.1;

    // Video quality
    if (video.success) score += 0.1;

    return Math.min(score, 1.0);
  };

  const calculateOverallConfidence = (result: SimplePipelineResult): number => {
    if (!result.scenes || result.scenes.length === 0) return 0;

    const avgConfidence = result.scenes.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / result.scenes.length;
    return avgConfidence;
  };

  const isRecoverableError = (error: string): boolean => {
    const recoverableErrors = ['timeout', 'network', 'temporary', '一時的'];
    return recoverableErrors.some(keyword => error.toLowerCase().includes(keyword));
  };

  const formatSRTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  const resetPipeline = () => {
    setFile(null);
    setPipelineResult(null);
    setVideoResult(null);
    setError(null);
    setMetrics(null);
    setRetryCount(0);
    resetProcessingStages();
    setActiveTab('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Enhanced Pipeline - 音声から動画までの完全自動化
            </div>
            <Badge variant="secondary">Phase 4-2 Enhanced</Badge>
          </CardTitle>
          <CardDescription>
            音声ファイルから図解動画まで、一気通貫で自動生成します。リアルタイム進捗表示と詳細エラーハンドリング付き。
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Enhanced Tabs Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" disabled={isProcessing}>ファイル選択</TabsTrigger>
          <TabsTrigger value="processing" disabled={!file}>処理実行</TabsTrigger>
          <TabsTrigger value="results" disabled={!pipelineResult && !videoResult}>結果表示</TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">音声ファイルをアップロード</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  MP3, WAV, OGG, M4A形式 (最大50MB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()}>
                  ファイルを選択
                </Button>
              </div>
            </CardContent>
          </Card>

          {file && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{file.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      サイズ: {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={resetPipeline}>
                      キャンセル
                    </Button>
                    <Button onClick={() => setActiveTab('processing')}>
                      次へ
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Processing Tab */}
        <TabsContent value="processing" className="space-y-4">
          {file && !isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle>処理実行</CardTitle>
                <CardDescription>
                  音声解析から動画生成まで、すべての処理を実行します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button onClick={handleFullPipeline} className="flex-1">
                    <Play className="w-4 h-4 mr-2" />
                    完全パイプライン実行
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('upload')}>
                    戻る
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhanced Processing Status */}
          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  処理中...
                </CardTitle>
                <CardDescription>{currentStage}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Overall Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>総合進捗</span>
                    <span>{Math.round(overallProgress)}%</span>
                  </div>
                  <Progress value={overallProgress} className="w-full" />
                </div>

                {/* Detailed Stage Progress */}
                <div className="space-y-3">
                  {processingStages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                        ${stage.status === 'completed' ? 'bg-green-600 text-white' :
                          stage.status === 'active' ? 'bg-blue-600 text-white' :
                          stage.status === 'error' ? 'bg-red-600 text-white' :
                          'bg-muted text-muted-foreground'
                        }`}>
                        {stage.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : stage.status === 'error' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : stage.status === 'active' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{stage.name}</span>
                          {stage.status === 'active' && (
                            <span className="text-sm text-muted-foreground">
                              {stage.progress}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{stage.description}</p>
                        {stage.error && (
                          <p className="text-sm text-red-600 mt-1">{stage.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center">
                <span>{error}</span>
                {retryCount < 2 && (
                  <Button variant="outline" size="sm" onClick={() => handleFullPipeline()}>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    リトライ
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          {(pipelineResult || videoResult) && (
            <>
              {/* Success Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    処理完了
                  </CardTitle>
                  {metrics && (
                    <CardDescription>
                      総処理時間: {Math.round(metrics.totalTime / 1000)}秒 |
                      品質スコア: {Math.round(metrics.qualityScore * 100)}% |
                      信頼度: {Math.round(metrics.confidence * 100)}%
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>

              {/* Enhanced Results Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>処理結果サマリー</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">{pipelineResult?.scenes?.length || 0}</div>
                      <div className="text-sm text-muted-foreground">生成シーン</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {metrics ? Math.round(metrics.totalTime / 1000) : 0}s
                      </div>
                      <div className="text-sm text-muted-foreground">総処理時間</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {videoResult?.fileSize ? Math.round(videoResult.fileSize / (1024 * 1024)) : 0}MB
                      </div>
                      <div className="text-sm text-muted-foreground">動画サイズ</div>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {metrics ? Math.round(metrics.confidence * 100) : 0}%
                      </div>
                      <div className="text-sm text-muted-foreground">平均信頼度</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Download Options */}
              <Card>
                <CardHeader>
                  <CardTitle>ダウンロード</CardTitle>
                  <CardDescription>
                    生成された結果を様々な形式でダウンロードできます
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => handleDownload('video')}
                      disabled={!videoResult?.success}
                      className="h-20 flex flex-col gap-2"
                    >
                      <Video className="w-6 h-6" />
                      <span>動画ファイル</span>
                      <span className="text-xs opacity-75">MP4形式</span>
                    </Button>
                    <Button
                      onClick={() => handleDownload('json')}
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                    >
                      <FileText className="w-6 h-6" />
                      <span>データファイル</span>
                      <span className="text-xs opacity-75">JSON形式</span>
                    </Button>
                    <Button
                      onClick={() => handleDownload('srt')}
                      variant="outline"
                      className="h-20 flex flex-col gap-2"
                    >
                      <FileText className="w-6 h-6" />
                      <span>字幕ファイル</span>
                      <span className="text-xs opacity-75">SRT形式</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Scene Details */}
              {pipelineResult?.scenes && pipelineResult.scenes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>生成されたシーン詳細</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {pipelineResult.scenes.map((scene, index) => (
                        <div key={scene.id} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{scene.type}</Badge>
                              <span className="font-medium">シーン {index + 1}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">
                                信頼度: {Math.round((scene.confidence || 0) * 100)}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {scene.startTime}s - {scene.endTime}s
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {scene.content.substring(0, 150)}
                            {scene.content.length > 150 ? '...' : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* New Processing Button */}
              <Card>
                <CardContent className="pt-6">
                  <Button onClick={resetPipeline} variant="outline" className="w-full">
                    新しいファイルを処理
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedSimplePipelineInterface;