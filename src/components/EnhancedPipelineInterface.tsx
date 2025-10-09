/**
 * Enhanced Pipeline Interface Component
 * 🔄 Custom Instructions Phase 1: MVP基盤強化
 *
 * Advanced user interface with comprehensive feedback, quality monitoring,
 * and iterative improvement tracking following custom instructions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  Play,
  Pause,
  Square,
  Settings,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
  FileAudio,
  Brain,
  Layers,
  Video,
  BarChart3,
  TrendingUp,
  Cpu,
  MemoryStick
} from 'lucide-react';

import { MainPipeline } from '@/pipeline/main-pipeline';
import { PipelineInput, PipelineResult, PipelineConfig } from '@/pipeline/types';
import { QualityMonitoringDashboard } from './QualityMonitoringDashboard';
import { useToast } from '@/hooks/use-toast';

interface ProcessingStage {
  name: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  progress: number;
  duration?: number;
  details?: string;
  metrics?: Record<string, any>;
}

interface IterationLog {
  iteration: number;
  timestamp: Date;
  success: boolean;
  duration: number;
  qualityScore: number;
  improvements: string[];
  issues: string[];
}

interface EnhancedPipelineInterfaceProps {
  className?: string;
  onResultReady?: (result: PipelineResult) => void;
  onQualityAssessment?: (assessment: any) => void;
}

/**
 * Enhanced Pipeline Interface
 * Provides comprehensive control and monitoring for the speech-to-visuals pipeline
 */
export const EnhancedPipelineInterface: React.FC<EnhancedPipelineInterfaceProps> = ({
  className,
  onResultReady,
  onQualityAssessment
}) => {
  // Core state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<PipelineResult | null>(null);
  const [pipeline] = useState(() => new MainPipeline());

  // Processing state
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState(0);
  const [processingTime, setProcessingTime] = useState(0);

  // Configuration state
  const [config, setConfig] = useState<Partial<PipelineConfig>>({
    transcription: {
      model: 'base',
      language: 'ja'
    },
    analysis: {
      minSegmentLengthMs: 3000,
      maxSegmentLengthMs: 15000,
      confidenceThreshold: 0.7
    },
    layout: {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60
    }
  });

  // Iteration tracking state
  const [currentIteration, setCurrentIteration] = useState(1);
  const [iterationHistory, setIterationHistory] = useState<IterationLog[]>([]);
  const [showQualityMonitoring, setShowQualityMonitoring] = useState(false);
  const [enableAutoImprovement, setEnableAutoImprovement] = useState(true);

  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalProcessingTime: 0,
    averageQualityScore: 0,
    successRate: 0,
    improvementRate: 0
  });

  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    initializeStages();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const initializeStages = () => {
    const initialStages: ProcessingStage[] = [
      {
        name: 'audio-upload',
        status: 'pending',
        progress: 0,
        details: 'Audio file upload and validation'
      },
      {
        name: 'transcription',
        status: 'pending',
        progress: 0,
        details: 'Speech-to-text conversion with Whisper'
      },
      {
        name: 'analysis',
        status: 'pending',
        progress: 0,
        details: 'Content analysis and scene segmentation'
      },
      {
        name: 'visualization',
        status: 'pending',
        progress: 0,
        details: 'Diagram layout generation'
      },
      {
        name: 'rendering',
        status: 'pending',
        progress: 0,
        details: 'Video composition and output'
      }
    ];

    setStages(initialStages);
  };

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast({
        title: "ファイル形式エラー",
        description: "音声ファイルを選択してください",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "ファイルサイズエラー",
        description: "ファイルサイズは100MB以下にしてください",
        variant: "destructive",
      });
      return;
    }

    setAudioFile(file);
    updateStageStatus('audio-upload', 'complete', 100);

    toast({
      title: "ファイルアップロード完了",
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
    });
  }, [toast]);

  const updateStageStatus = (stageName: string, status: ProcessingStage['status'], progress: number, details?: string, metrics?: Record<string, any>) => {
    setStages(prev => prev.map(stage =>
      stage.name === stageName
        ? { ...stage, status, progress, details: details || stage.details, metrics }
        : stage
    ));

    if (status === 'active') {
      setCurrentStage(stageName);
    }

    // Update overall progress
    setStages(current => {
      const completedStages = current.filter(s => s.status === 'complete').length;
      const activeStageProgress = current.find(s => s.status === 'active')?.progress || 0;
      const newOverallProgress = (completedStages * 100 + activeStageProgress) / current.length;
      setOverallProgress(newOverallProgress);
      return current;
    });
  };

  const startProcessing = async () => {
    if (!audioFile) {
      toast({
        title: "エラー",
        description: "音声ファイルを選択してください",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    startTimeRef.current = performance.now();

    // Start timer for processing time display
    intervalRef.current = setInterval(() => {
      setProcessingTime(performance.now() - startTimeRef.current);
    }, 100);

    try {
      console.log(`🚀 Starting Enhanced Pipeline Interface - Iteration ${currentIteration}`);

      // Reset stages
      initializeStages();
      updateStageStatus('audio-upload', 'complete', 100);

      // Create pipeline input
      const input: PipelineInput = {
        audioFile,
        options: {
          priority: 'balanced',
          qualityLevel: 'high',
          enableIterativeImprovement: enableAutoImprovement
        }
      };

      // Stage 1: Transcription
      updateStageStatus('transcription', 'active', 0, 'Initializing Whisper transcription...');

      // Simulate progressive updates (in real implementation, this would come from pipeline events)
      await simulateStageProgress('transcription', [
        { progress: 25, details: 'Loading audio file...' },
        { progress: 50, details: 'Processing speech recognition...' },
        { progress: 75, details: 'Generating timestamps...' },
        { progress: 100, details: 'Transcription complete' }
      ]);

      updateStageStatus('transcription', 'complete', 100, 'Speech-to-text completed successfully');

      // Stage 2: Analysis
      updateStageStatus('analysis', 'active', 0, 'Starting content analysis...');

      await simulateStageProgress('analysis', [
        { progress: 20, details: 'Segmenting content...' },
        { progress: 40, details: 'Detecting diagram types...' },
        { progress: 60, details: 'Extracting entities...' },
        { progress: 80, details: 'Analyzing relationships...' },
        { progress: 100, details: 'Analysis complete' }
      ]);

      updateStageStatus('analysis', 'complete', 100, 'Content analysis completed');

      // Stage 3: Visualization
      updateStageStatus('visualization', 'active', 0, 'Generating diagram layouts...');

      await simulateStageProgress('visualization', [
        { progress: 30, details: 'Creating node layouts...' },
        { progress: 60, details: 'Optimizing positioning...' },
        { progress: 90, details: 'Applying zero-overlap algorithm...' },
        { progress: 100, details: 'Layout generation complete' }
      ]);

      updateStageStatus('visualization', 'complete', 100, 'Diagram layouts generated');

      // Stage 4: Rendering
      updateStageStatus('rendering', 'active', 0, 'Composing video output...');

      await simulateStageProgress('rendering', [
        { progress: 25, details: 'Initializing Remotion renderer...' },
        { progress: 50, details: 'Generating scene transitions...' },
        { progress: 75, details: 'Compositing final video...' },
        { progress: 100, details: 'Video rendering complete' }
      ]);

      updateStageStatus('rendering', 'complete', 100, 'Video composition completed');

      // Execute the actual pipeline
      const result = await pipeline.execute(input);

      // Process results
      setCurrentResult(result);
      onResultReady?.(result);

      // Record iteration
      const iterationDuration = performance.now() - startTimeRef.current;
      const qualityScore = calculateQualityScore(result);

      recordIteration(result.success, iterationDuration, qualityScore);

      if (result.success) {
        toast({
          title: "処理完了",
          description: `動画の生成が完了しました (${(iterationDuration / 1000).toFixed(1)}秒)`,
        });
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error('❌ Pipeline processing failed:', error);

      updateStageStatus(currentStage, 'error', 0, `Error: ${error.message}`);

      recordIteration(false, performance.now() - startTimeRef.current, 0, [], [error.message]);

      toast({
        title: "処理エラー",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }
  };

  const simulateStageProgress = async (stageName: string, progressSteps: { progress: number; details: string }[]) => {
    for (const step of progressSteps) {
      updateStageStatus(stageName, 'active', step.progress, step.details);
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    }
  };

  const calculateQualityScore = (result: PipelineResult): number => {
    if (!result.success) return 0;

    // Mock quality score calculation
    let score = 0.8; // Base score

    if (result.scenes.length > 0) score += 0.1;
    if (result.processingTime < 30000) score += 0.1; // Under 30 seconds

    return Math.min(1.0, score);
  };

  const recordIteration = (success: boolean, duration: number, qualityScore: number, improvements: string[] = [], issues: string[] = []) => {
    const newIteration: IterationLog = {
      iteration: currentIteration,
      timestamp: new Date(),
      success,
      duration,
      qualityScore,
      improvements,
      issues
    };

    setIterationHistory(prev => [...prev, newIteration]);
    setCurrentIteration(prev => prev + 1);

    // Update performance metrics
    const allIterations = [...iterationHistory, newIteration];
    const successfulIterations = allIterations.filter(i => i.success);

    setPerformanceMetrics({
      totalProcessingTime: allIterations.reduce((sum, i) => sum + i.duration, 0),
      averageQualityScore: successfulIterations.reduce((sum, i) => sum + i.qualityScore, 0) / successfulIterations.length || 0,
      successRate: successfulIterations.length / allIterations.length,
      improvementRate: allIterations.length > 1 ?
        (allIterations[allIterations.length - 1].qualityScore - allIterations[0].qualityScore) / allIterations.length : 0
    });
  };

  const getStageIcon = (stageName: string) => {
    switch (stageName) {
      case 'audio-upload': return <FileAudio className="h-4 w-4" />;
      case 'transcription': return <Brain className="h-4 w-4" />;
      case 'analysis': return <Activity className="h-4 w-4" />;
      case 'visualization': return <Layers className="h-4 w-4" />;
      case 'rendering': return <Video className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStageStatusIcon = (status: ProcessingStage['status']) => {
    switch (status) {
      case 'complete': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active': return <Activity className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMemoryUsage = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Enhanced Pipeline Interface</h2>
          <p className="text-muted-foreground">
            🔄 Iterative improvement system with comprehensive monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Iteration {currentIteration}
          </Badge>
          <Badge variant={performanceMetrics.successRate > 0.8 ? 'default' : 'secondary'}>
            {(performanceMetrics.successRate * 100).toFixed(0)}% Success Rate
          </Badge>
        </div>
      </div>

      {/* Main Interface Tabs */}
      <Tabs defaultValue="processing" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="processing">Processing</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="monitoring">Quality Monitoring</TabsTrigger>
          <TabsTrigger value="iterations">Iteration History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Processing Tab */}
        <TabsContent value="processing" className="space-y-6">
          {/* File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="h-5 h-5" />
                Audio Input
              </CardTitle>
              <CardDescription>
                Upload an audio file to begin the speech-to-visuals conversion process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  audioFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                {audioFile ? (
                  <div className="space-y-2">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                    <p className="font-medium">{audioFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p>Drop an audio file here or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      Supports WAV, MP3, M4A (max 100MB)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="auto-improvement"
                    checked={enableAutoImprovement}
                    onCheckedChange={setEnableAutoImprovement}
                  />
                  <Label htmlFor="auto-improvement">Enable Auto-Improvement</Label>
                </div>

                <Button
                  onClick={startProcessing}
                  disabled={!audioFile || isProcessing}
                  className="px-8"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Processing
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Processing Progress */}
          {(isProcessing || stages.some(s => s.status !== 'pending')) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Processing Pipeline
                  </span>
                  <div className="text-sm text-muted-foreground">
                    {formatDuration(processingTime)}
                  </div>
                </CardTitle>
                <CardDescription>
                  Real-time progress through the speech-to-visuals pipeline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Overall Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span>{overallProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>

                {/* Stage Details */}
                <div className="space-y-3">
                  {stages.map((stage) => (
                    <div key={stage.name} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 w-48">
                        {getStageIcon(stage.name)}
                        <span className="font-medium capitalize">
                          {stage.name.replace('-', ' ')}
                        </span>
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {stage.details}
                          </span>
                          {getStageStatusIcon(stage.status)}
                        </div>
                        {stage.status !== 'pending' && (
                          <Progress value={stage.progress} className="h-1" />
                        )}
                      </div>

                      {stage.duration && (
                        <div className="text-sm text-muted-foreground w-16 text-right">
                          {formatDuration(stage.duration)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {currentResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Processing Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Scenes Generated</p>
                    <p className="text-2xl font-bold">{currentResult.scenes.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Processing Time</p>
                    <p className="text-2xl font-bold">{formatDuration(currentResult.processingTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Video Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(currentResult.duration)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Configuration</CardTitle>
              <CardDescription>
                Adjust processing parameters for optimal results
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Transcription Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Transcription Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Whisper Model</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={config.transcription?.model || 'base'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        transcription: { ...prev.transcription, model: e.target.value as any }
                      }))}
                    >
                      <option value="tiny">Tiny (fastest)</option>
                      <option value="base">Base (balanced)</option>
                      <option value="small">Small (better quality)</option>
                      <option value="medium">Medium (high quality)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <select
                      className="w-full p-2 border rounded"
                      value={config.transcription?.language || 'ja'}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        transcription: { ...prev.transcription, language: e.target.value }
                      }))}
                    >
                      <option value="ja">Japanese</option>
                      <option value="en">English</option>
                      <option value="auto">Auto-detect</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Analysis Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Content Analysis</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Confidence Threshold: {config.analysis?.confidenceThreshold || 0.7}</Label>
                    <Slider
                      value={[config.analysis?.confidenceThreshold || 0.7]}
                      onValueChange={(value) => setConfig(prev => ({
                        ...prev,
                        analysis: { ...prev.analysis, confidenceThreshold: value[0] }
                      }))}
                      min={0.5}
                      max={0.9}
                      step={0.05}
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Segment Length (ms)</Label>
                      <input
                        type="number"
                        className="w-full p-2 border rounded"
                        value={config.analysis?.minSegmentLengthMs || 3000}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          analysis: { ...prev.analysis, minSegmentLengthMs: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Segment Length (ms)</Label>
                      <input
                        type="number"
                        className="w-full p-2 border rounded"
                        value={config.analysis?.maxSegmentLengthMs || 15000}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          analysis: { ...prev.analysis, maxSegmentLengthMs: parseInt(e.target.value) }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Layout Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Canvas Width</Label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded"
                      value={config.layout?.width || 1920}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, width: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Canvas Height</Label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded"
                      value={config.layout?.height || 1080}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, height: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Node Width</Label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded"
                      value={config.layout?.nodeWidth || 120}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, nodeWidth: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Node Height</Label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded"
                      value={config.layout?.nodeHeight || 60}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, nodeHeight: parseInt(e.target.value) }
                      }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Monitoring Tab */}
        <TabsContent value="monitoring">
          <QualityMonitoringDashboard
            isEnabled={showQualityMonitoring}
            refreshInterval={5000}
            onExportReport={() => {
              toast({
                title: "Report Export",
                description: "Quality report exported successfully",
              });
            }}
            onConfigureAlerts={() => {
              toast({
                title: "Alert Configuration",
                description: "Alert settings opened",
              });
            }}
          />
        </TabsContent>

        {/* Iteration History Tab */}
        <TabsContent value="iterations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Iteration History</CardTitle>
              <CardDescription>
                Track improvements across processing iterations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {iterationHistory.map((iteration) => (
                    <div key={iteration.iteration} className="flex items-center justify-between p-3 bg-muted/30 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">#{iteration.iteration}</Badge>
                        {iteration.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">{iteration.timestamp.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Quality: {(iteration.qualityScore * 100).toFixed(0)}%</span>
                        <span>Duration: {formatDuration(iteration.duration)}</span>
                      </div>
                    </div>
                  ))}
                  {iterationHistory.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No iterations recorded yet
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">
                      {(performanceMetrics.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Quality Score</p>
                    <p className="text-2xl font-bold">
                      {(performanceMetrics.averageQualityScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Processing Time</p>
                    <p className="text-2xl font-bold">
                      {formatDuration(performanceMetrics.totalProcessingTime)}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Improvement Rate</p>
                    <p className="text-2xl font-bold">
                      {(performanceMetrics.improvementRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedPipelineInterface;