import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Loader2, Video, Activity, TrendingUp, Clock, Target, Eye, Layers, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { simplePipeline, SimplePipelineResult } from '@/pipeline/simple-pipeline';
import { SceneGraph } from '@/types/diagram';
import { toast } from 'sonner';

interface ProcessingStep {
  name: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
  duration?: number;
  quality?: number;
}

interface ProgressMetrics {
  currentStage: string;
  qualityScore: number;
  processingSpeed: number;
  timeElapsed: number;
  estimatedRemaining: number;
  confidence: number;
}

export const SimplePipelineInterface: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimplePipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeVideo, setIncludeVideo] = useState(true);

  // Real-time preview states (リアルタイムプレビュー状態)
  const [realtimePreview, setRealtimePreview] = useState({
    transcript: '',
    currentScene: null as SceneGraph | null,
    detectedDiagramTypes: [] as Array<{type: string, confidence: number}>,
    processingStages: [] as ProcessingStep[],
    showPreview: false
  });

  // Enhanced real-time metrics (段階的改善メトリクス)
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    currentStage: '',
    qualityScore: 0,
    processingSpeed: 0,
    timeElapsed: 0,
    estimatedRemaining: 0,
    confidence: 0
  });
  const [startTime, setStartTime] = useState<number>(0);
  const [stageStartTime, setStageStartTime] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time metrics update timer (リアルタイムメトリクス更新)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isProcessing && startTime > 0) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;
        const stageElapsed = now - stageStartTime;

        // Calculate processing speed and estimated remaining time
        const progressRate = progress > 0 ? elapsed / progress : 0;
        const estimatedTotal = progressRate * 100;
        const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

        // Calculate dynamic quality score based on progress
        const dynamicQuality = calculateDynamicQuality(progress, elapsed, currentStep);

        setMetrics(prev => ({
          ...prev,
          timeElapsed: elapsed,
          estimatedRemaining: estimatedRemaining,
          processingSpeed: progress > 0 ? (progress / elapsed) * 1000 : 0, // progress per second
          qualityScore: dynamicQuality,
          confidence: Math.min(0.95, 0.7 + (progress / 100) * 0.25) // Increasing confidence
        }));
      }, 100); // Update every 100ms for smooth animations
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, startTime, stageStartTime, progress, currentStep]);

  // Calculate dynamic quality score (動的品質スコア計算)
  const calculateDynamicQuality = (currentProgress: number, elapsed: number, stage: string): number => {
    const baseScore = 70; // Base quality score

    // Progress bonus (smooth progress indicates good processing)
    const progressBonus = Math.min(20, currentProgress / 5);

    // Speed bonus (reasonable speed indicates good performance)
    const speedScore = elapsed > 0 ? Math.min(10, (currentProgress / elapsed) * 1000) : 0;

    // Stage-specific bonuses
    const stageBonus = stage.includes('Transcription') || stage.includes('音声認識') ? 5 :
                     stage.includes('Analysis') || stage.includes('分析') ? 8 :
                     stage.includes('Video') || stage.includes('動画') ? 7 : 0;

    return Math.min(100, baseScore + progressBonus + speedScore + stageBonus);
  };

  const processingSteps: ProcessingStep[] = [
    { name: 'Audio Upload', progress: 10, status: 'pending' },
    { name: 'Transcription', progress: 30, status: 'pending' },
    { name: 'Scene Analysis', progress: 60, status: 'pending' },
    { name: 'Diagram Generation', progress: 80, status: 'pending' },
    ...(includeVideo ? [{ name: 'Video Generation', progress: 100, status: 'pending' as const }] : [])
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('サポートされていないファイル形式です。MP3, WAV, OGG, M4A形式をご利用ください。');
        return;
      }

      // Validate file size (max 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('ファイルサイズが大きすぎます。50MB以下のファイルをご利用ください。');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResult(null);
      toast.success(`ファイル「${selectedFile.name}」が選択されました`);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error('音声ファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentStep('処理を開始しています...');

    // Initialize enhanced metrics (拡張メトリクス初期化)
    const processingStartTime = Date.now();
    setStartTime(processingStartTime);
    setStageStartTime(processingStartTime);
    setMetrics({
      currentStage: '初期化中...',
      qualityScore: 70,
      processingSpeed: 0,
      timeElapsed: 0,
      estimatedRemaining: 0,
      confidence: 0.7
    });

    // Initialize real-time preview (リアルタイムプレビュー初期化)
    setRealtimePreview({
      transcript: '',
      currentScene: null,
      detectedDiagramTypes: [],
      processingStages: [
        { name: '音声認識', progress: 0, status: 'pending' },
        { name: 'シーン分析', progress: 0, status: 'pending' },
        { name: '図解検出', progress: 0, status: 'pending' },
        { name: 'レイアウト生成', progress: 0, status: 'pending' },
        { name: '動画生成', progress: 0, status: 'pending' }
      ],
      showPreview: true
    });

    try {
      console.log('🚀 Starting pipeline processing with SimplePipeline');

      const result = await simplePipeline.processWithRetry(
        {
          audioFile: file,
          options: {
            includeVideoGeneration: includeVideo
          }
        },
        (step: string, progressValue: number) => {
          // Update stage timing when stage changes (ステージ変更時のタイミング更新)
          if (step !== currentStep) {
            setStageStartTime(Date.now());
            setMetrics(prev => ({
              ...prev,
              currentStage: step
            }));

            // Update real-time preview stages (リアルタイムプレビューステージ更新)
            setRealtimePreview(prev => ({
              ...prev,
              processingStages: prev.processingStages.map(stage => {
                if (step.includes('音声') || step.includes('Transcrib')) {
                  return stage.name === '音声認識' ?
                    { ...stage, status: 'active', progress: progressValue } : stage;
                } else if (step.includes('分析') || step.includes('Analysis')) {
                  return stage.name === 'シーン分析' ?
                    { ...stage, status: 'active', progress: progressValue } : stage;
                } else if (step.includes('図解') || step.includes('Detect')) {
                  return stage.name === '図解検出' ?
                    { ...stage, status: 'active', progress: progressValue } : stage;
                } else if (step.includes('レイアウト') || step.includes('Layout')) {
                  return stage.name === 'レイアウト生成' ?
                    { ...stage, status: 'active', progress: progressValue } : stage;
                } else if (step.includes('動画') || step.includes('Video')) {
                  return stage.name === '動画生成' ?
                    { ...stage, status: 'active', progress: progressValue } : stage;
                }
                return stage;
              })
            }));
          }

          setCurrentStep(step);
          setProgress(progressValue);
          console.log(`📊 Progress: ${step} (${progressValue}%)`);
        },
        3 // max retries
      );

      if (result.success) {
        setResult(result);
        setCurrentStep('処理完了！');
        setProgress(100);
        toast.success(`処理が完了しました！${result.scenes?.length || 0}個のシーンが生成されました。`);

        // Get progressive enhancement metrics from SimplePipeline (段階的改善メトリクス取得)
        const pipelineMetrics = simplePipeline.getProgressiveMetrics();
        console.log('📈 Progressive Enhancement Metrics:', pipelineMetrics);

        console.log('✅ Pipeline processing completed successfully:', {
          processingTime: result.processingTime,
          sceneCount: result.scenes?.length,
          transcriptLength: result.transcript?.length
        });
      } else {
        throw new Error(result.error || '処理に失敗しました');
      }

    } catch (error) {
      console.error('❌ Pipeline processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const data = {
      timestamp: new Date().toISOString(),
      file: file?.name,
      processingTime: result.processingTime,
      transcript: result.transcript,
      scenes: result.scenes,
      summary: {
        sceneCount: result.scenes?.length || 0,
        averageConfidence: result.scenes?.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / (result.scenes?.length || 1)
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-to-visuals-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('結果をダウンロードしました');
  };

  const resetPipeline = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep('');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Demo functionality (デモ機能)
  const runDemo = async () => {
    console.log('🎯 Running demo with mock data...');

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentStep('デモを開始しています...');

    // Initialize enhanced metrics (拡張メトリクス初期化)
    const processingStartTime = Date.now();
    setStartTime(processingStartTime);
    setStageStartTime(processingStartTime);
    setMetrics({
      currentStage: 'デモ初期化中...',
      qualityScore: 80,
      processingSpeed: 0,
      timeElapsed: 0,
      estimatedRemaining: 15000, // 15 seconds for demo
      confidence: 0.9
    });

    // Initialize real-time preview (リアルタイムプレビュー初期化)
    setRealtimePreview({
      transcript: '',
      currentScene: null,
      detectedDiagramTypes: [],
      processingStages: [
        { name: '音声認識', progress: 0, status: 'pending' },
        { name: 'シーン分析', progress: 0, status: 'pending' },
        { name: '図解検出', progress: 0, status: 'pending' },
        { name: 'レイアウト生成', progress: 0, status: 'pending' },
        { name: '動画生成', progress: 0, status: 'pending' }
      ],
      showPreview: true
    });

    try {
      // Simulate transcription stage (音声認識シミュレーション)
      setCurrentStep('音声を認識中...');
      setProgress(10);
      await new Promise(resolve => setTimeout(resolve, 1500));

      setRealtimePreview(prev => ({
        ...prev,
        transcript: 'フローチャートについて説明します。まず開始点があり、その後条件分岐があります。',
        processingStages: prev.processingStages.map((stage, idx) =>
          idx === 0 ? { ...stage, status: 'completed', progress: 100 } : stage
        )
      }));

      // Simulate scene analysis (シーン分析シミュレーション)
      setCurrentStep('シーンを分析中...');
      setProgress(30);
      await new Promise(resolve => setTimeout(resolve, 1000));

      setRealtimePreview(prev => ({
        ...prev,
        processingStages: prev.processingStages.map((stage, idx) =>
          idx === 1 ? { ...stage, status: 'completed', progress: 100 } : stage
        )
      }));

      // Simulate diagram detection (図解検出シミュレーション)
      setCurrentStep('図解タイプを検出中...');
      setProgress(50);
      await new Promise(resolve => setTimeout(resolve, 1200));

      setRealtimePreview(prev => ({
        ...prev,
        detectedDiagramTypes: [
          { type: 'フローチャート', confidence: 0.95 },
          { type: 'プロセス図', confidence: 0.88 }
        ],
        processingStages: prev.processingStages.map((stage, idx) =>
          idx === 2 ? { ...stage, status: 'completed', progress: 100 } : stage
        )
      }));

      // Simulate layout generation (レイアウト生成シミュレーション)
      setCurrentStep('レイアウトを生成中...');
      setProgress(70);
      await new Promise(resolve => setTimeout(resolve, 800));

      const mockScene: SceneGraph = {
        id: 'demo-scene-1',
        startTime: 0,
        endTime: 30,
        content: 'フローチャートについて説明します。まず開始点があり、その後条件分岐があります。条件に応じて異なる処理が実行されます。',
        type: 'flow',
        confidence: 0.92,
        layout: {
          nodes: [
            { id: '開始', x: 200, y: 300, width: 120, height: 60, label: '開始' },
            { id: '条件分岐', x: 400, y: 300, width: 120, height: 60, label: '条件分岐' },
            { id: '処理A', x: 300, y: 450, width: 120, height: 60, label: '処理A' },
            { id: '処理B', x: 500, y: 450, width: 120, height: 60, label: '処理B' }
          ],
          edges: [
            { id: 'edge-1', from: '開始', to: '条件分岐', type: 'flow' },
            { id: 'edge-2', from: '条件分岐', to: '処理A', type: 'conditional', label: 'Yes' },
            { id: 'edge-3', from: '条件分岐', to: '処理B', type: 'conditional', label: 'No' }
          ]
        }
      };

      setRealtimePreview(prev => ({
        ...prev,
        currentScene: mockScene,
        processingStages: prev.processingStages.map((stage, idx) =>
          idx === 3 ? { ...stage, status: 'completed', progress: 100 } : stage
        )
      }));

      // Simulate video generation if enabled
      if (includeVideo) {
        setCurrentStep('動画を生成中...');
        setProgress(85);
        await new Promise(resolve => setTimeout(resolve, 2000));

        setRealtimePreview(prev => ({
          ...prev,
          processingStages: prev.processingStages.map((stage, idx) =>
            idx === 4 ? { ...stage, status: 'completed', progress: 100 } : stage
          )
        }));
      }

      // Complete demo
      setCurrentStep('デモ完了！');
      setProgress(100);

      const processingTime = Date.now() - processingStartTime;

      // Create mock result
      const demoResult: SimplePipelineResult = {
        success: true,
        audioUrl: 'demo://sample-audio',
        transcript: 'フローチャートについて説明します。まず開始点があり、その後条件分岐があります。条件に応じて異なる処理が実行されます。',
        scenes: [mockScene],
        processingTime,
        ...(includeVideo && { videoUrl: 'demo://sample-video.mp4' })
      };

      setResult(demoResult);
      toast.success(`デモが完了しました！処理時間: ${(processingTime / 1000).toFixed(1)}秒`);

      // Get progressive enhancement metrics from SimplePipeline
      const pipelineMetrics = simplePipeline.getProgressiveMetrics();
      console.log('📈 Demo Progressive Enhancement Metrics:', pipelineMetrics);

    } catch (error) {
      console.error('❌ Demo failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'デモの実行に失敗しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Simple Pipeline - 音声から図解動画への変換
          </CardTitle>
          <CardDescription>
            音声ファイルをアップロードして、自動的に図解付きの構造化されたシーンを生成します
          </CardDescription>
        </CardHeader>
      </Card>

      {/* File Upload */}
      {!file && !isProcessing && (
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
              <div className="space-y-3">
                <Button onClick={() => fileInputRef.current?.click()}>
                  ファイルを選択
                </Button>

                {/* Demo Button (デモボタン) */}
                <div className="flex items-center justify-center gap-4 pt-4 border-t border-muted-foreground/20">
                  <span className="text-sm text-muted-foreground">または</span>
                </div>
                <Button
                  variant="outline"
                  onClick={runDemo}
                  className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-dashed border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900 dark:hover:to-purple-900"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
                  デモを実行する
                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(サンプルデータで試す)</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Info and Process Button */}
      {file && !isProcessing && !result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{file.name}</h3>
                <p className="text-sm text-muted-foreground">
                  サイズ: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeVideo"
                    checked={includeVideo}
                    onCheckedChange={(checked) => setIncludeVideo(checked as boolean)}
                  />
                  <label htmlFor="includeVideo" className="text-sm font-medium">
                    動画を生成する (MP4形式)
                  </label>
                  <Video className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetPipeline}>
                    キャンセル
                  </Button>
                  <Button onClick={handleProcess}>
                    <Play className="w-4 h-4 mr-2" />
                    処理開始
                  </Button>
                </div>
              </div>
            </div>
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
                <span className="font-medium">処理中...</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>

              {/* Real-time Processing Stages (リアルタイム処理ステージ) */}
              <div className="grid grid-cols-5 gap-2">
                {realtimePreview.processingStages.map((stage, index) => (
                  <div key={index} className="text-center">
                    <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-medium transition-all duration-300
                      ${stage.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : stage.status === 'active'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                      {stage.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : stage.status === 'active' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{stage.name}</div>
                    {stage.status === 'active' && (
                      <div className="text-xs text-blue-600 font-medium">
                        {stage.progress}%
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Real-time Preview Content (リアルタイムプレビューコンテンツ) */}
              {realtimePreview.showPreview && (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">リアルタイムプレビュー</span>
                  </div>

                  {/* Transcript Preview */}
                  {realtimePreview.transcript && (
                    <div className="mb-3">
                      <Badge variant="outline" className="mb-2">音声認識結果</Badge>
                      <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border max-h-20 overflow-y-auto">
                        {realtimePreview.transcript}
                      </div>
                    </div>
                  )}

                  {/* Detected Diagram Types */}
                  {realtimePreview.detectedDiagramTypes.length > 0 && (
                    <div className="mb-3">
                      <Badge variant="outline" className="mb-2">検出された図解タイプ</Badge>
                      <div className="flex flex-wrap gap-2">
                        {realtimePreview.detectedDiagramTypes.map((type, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm">
                            <Layers className="w-3 h-3" />
                            {type.type}
                            <span className="text-blue-600">({(type.confidence * 100).toFixed(0)}%)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Scene Preview */}
                  {realtimePreview.currentScene && (
                    <div>
                      <Badge variant="outline" className="mb-2">現在のシーン</Badge>
                      <div className="text-sm p-2 bg-white dark:bg-gray-800 rounded border">
                        <div className="font-medium mb-1">タイプ: {realtimePreview.currentScene.type}</div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          信頼度: {((realtimePreview.currentScene.confidence || 0) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Enhanced Real-time Metrics (段階的改善メトリクス表示) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t">
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Activity className="w-3 h-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">品質スコア</span>
                  </div>
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {metrics.qualityScore.toFixed(0)}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">/100</div>
                </div>

                <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-green-600" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">経過時間</span>
                  </div>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">
                    {(metrics.timeElapsed / 1000).toFixed(1)}s
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    残り: {(metrics.estimatedRemaining / 1000).toFixed(0)}s
                  </div>
                </div>

                <div className="text-center p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-300">処理速度</span>
                  </div>
                  <div className="text-lg font-bold text-purple-800 dark:text-purple-200">
                    {metrics.processingSpeed.toFixed(1)}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">%/秒</div>
                </div>

                <div className="text-center p-2 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-orange-600" />
                    <span className="text-xs font-medium text-orange-700 dark:text-orange-300">信頼度</span>
                  </div>
                  <div className="text-lg font-bold text-orange-800 dark:text-orange-200">
                    {(metrics.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">確信度</div>
                </div>
              </div>

              {/* Current stage details */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-1">現在のステージ</div>
                <div className="text-xs text-muted-foreground">{metrics.currentStage}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              処理完了
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Enhanced Summary with Progressive Metrics (段階的改善メトリクス付きサマリー) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.scenes?.length || 0}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">生成シーン</div>
                <div className="text-xs text-blue-500 dark:text-blue-500 mt-1">
                  {(() => {
                    const pipelineMetrics = simplePipeline.getProgressiveMetrics();
                    return `イテレーション: ${pipelineMetrics.iterationCount}`;
                  })()}
                </div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {result.processingTime ? Math.round(result.processingTime / 1000) : 0}s
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">処理時間</div>
                <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                  {(() => {
                    const pipelineMetrics = simplePipeline.getProgressiveMetrics();
                    const avgTime = pipelineMetrics.qualityMetrics?.averageProcessingTime || 0;
                    return `平均: ${(avgTime / 1000).toFixed(1)}s`;
                  })()}
                </div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {result.transcript?.split(' ').length || 0}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">単語数</div>
                <div className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                  {(() => {
                    const wordsPerMinute = result.transcript && result.processingTime ?
                      ((result.transcript.split(' ').length * 60000) / result.processingTime).toFixed(0) : 0;
                    return `${wordsPerMinute} 語/分`;
                  })()}
                </div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {result.scenes ?
                    Math.round((result.scenes.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / result.scenes.length) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">平均信頼度</div>
                <div className="text-xs text-orange-500 dark:text-orange-500 mt-1">
                  {(() => {
                    const pipelineMetrics = simplePipeline.getProgressiveMetrics();
                    return `品質: ${pipelineMetrics.averageQuality?.toFixed(1) || 0}/100`;
                  })()}
                </div>
              </div>
            </div>

            {/* Progressive Enhancement Status (段階的改善ステータス) */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Progressive Enhancement Status (段階的改善状況)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(() => {
                  const pipelineMetrics = simplePipeline.getProgressiveMetrics();
                  return (
                    <>
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                          {pipelineMetrics.successRate?.toFixed(1) || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">成功率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                          {pipelineMetrics.averageQuality?.toFixed(1) || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">平均品質スコア</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-700 dark:text-green-300">
                          {pipelineMetrics.iterationCount || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">改善イテレーション</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Video Preview */}
            {result.videoUrl && (
              <div>
                <h4 className="font-medium mb-2">生成された動画</h4>
                <div className="p-3 bg-muted rounded-lg">
                  <video
                    controls
                    className="w-full max-w-md mx-auto rounded"
                    src={result.videoUrl}
                  >
                    お使いのブラウザは動画の再生に対応していません。
                  </video>
                </div>
              </div>
            )}

            {/* Transcript Preview */}
            {result.transcript && (
              <div>
                <h4 className="font-medium mb-2">文字起こし結果</h4>
                <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto">
                  {result.transcript}
                </div>
              </div>
            )}

            {/* Scenes Preview */}
            {result.scenes && result.scenes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">生成されたシーン</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.scenes.map((scene, index) => (
                    <div key={scene.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">シーン {index + 1}: {scene.type}</span>
                        <span className="text-sm text-muted-foreground">
                          信頼度: {Math.round((scene.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {scene.content.substring(0, 100)}
                        {scene.content.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={downloadResults}>
                <Download className="w-4 h-4 mr-2" />
                データをダウンロード
              </Button>
              {result.videoUrl && (
                <Button variant="secondary" onClick={() => {
                  const a = document.createElement('a');
                  a.href = result.videoUrl!;
                  a.download = `diagram-video-${Date.now()}.mp4`;
                  a.click();
                  toast.success('動画をダウンロードしました');
                }}>
                  <Video className="w-4 h-4 mr-2" />
                  動画をダウンロード
                </Button>
              )}
              <Button variant="outline" onClick={resetPipeline}>
                新しいファイルを処理
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimplePipelineInterface;