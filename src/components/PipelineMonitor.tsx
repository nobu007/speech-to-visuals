import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  Square,
  CheckCircle,
  Clock,
  AlertCircle,
  Mic,
  Brain,
  Layout,
  Video,
  FileAudio
} from 'lucide-react';

interface PipelineStage {
  name: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: string;
  progress?: number;
}

interface PipelineState {
  isRunning: boolean;
  currentStage: string | null;
  stages: PipelineStage[];
  totalProgress: number;
  startTime?: number;
  estimatedTimeRemaining?: number;
}

interface PipelineMonitorProps {
  onStartPipeline?: (audioFile: File) => void;
  onStopPipeline?: () => void;
  audioFile?: File | null;
}

export function PipelineMonitor({ onStartPipeline, onStopPipeline, audioFile }: PipelineMonitorProps) {
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    isRunning: false,
    currentStage: null,
    stages: [],
    totalProgress: 0
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(audioFile || null);

  // Pipeline stage definitions
  const stageDefinitions = [
    {
      name: 'transcription',
      title: 'Audio Transcription',
      description: 'Converting speech to text with timestamps',
      icon: Mic,
      estimatedDuration: 15000, // 15 seconds
      color: 'blue'
    },
    {
      name: 'analysis',
      title: 'Content Analysis',
      description: 'Segmenting content and extracting entities',
      icon: Brain,
      estimatedDuration: 10000, // 10 seconds
      color: 'purple'
    },
    {
      name: 'layout',
      title: 'Layout Generation',
      description: 'Creating diagram layouts and positioning',
      icon: Layout,
      estimatedDuration: 8000, // 8 seconds
      color: 'green'
    },
    {
      name: 'preparation',
      title: 'Video Preparation',
      description: 'Assembling scenes for video rendering',
      icon: Video,
      estimatedDuration: 7000, // 7 seconds
      color: 'orange'
    }
  ];

  // Simulate pipeline execution
  const simulatePipeline = async () => {
    if (!selectedFile) return;

    setPipelineState(prev => ({
      ...prev,
      isRunning: true,
      currentStage: 'transcription',
      startTime: Date.now(),
      stages: stageDefinitions.map(stage => ({
        name: stage.name,
        status: stage.name === 'transcription' ? 'analyzing' : 'pending'
      })),
      totalProgress: 0
    }));

    // Execute each stage with realistic timing
    for (let i = 0; i < stageDefinitions.length; i++) {
      const stageDef = stageDefinitions[i];
      const duration = stageDef.estimatedDuration;

      // Update stage to analyzing
      setPipelineState(prev => ({
        ...prev,
        currentStage: stageDef.name,
        stages: prev.stages.map(stage =>
          stage.name === stageDef.name
            ? { ...stage, status: 'analyzing', startTime: Date.now(), progress: 0 }
            : stage
        )
      }));

      // Simulate progressive completion of the stage
      const steps = 20;
      for (let step = 0; step <= steps; step++) {
        await new Promise(resolve => setTimeout(resolve, duration / steps));

        setPipelineState(prev => ({
          ...prev,
          stages: prev.stages.map(stage =>
            stage.name === stageDef.name
              ? { ...stage, progress: (step / steps) * 100 }
              : stage
          ),
          totalProgress: ((i + step / steps) / stageDefinitions.length) * 100
        }));
      }

      // Complete the stage
      setPipelineState(prev => ({
        ...prev,
        stages: prev.stages.map(stage =>
          stage.name === stageDef.name
            ? {
                ...stage,
                status: 'complete',
                endTime: Date.now(),
                progress: 100,
                result: generateMockResult(stageDef.name)
              }
            : stage
        )
      }));

      // Start next stage
      if (i < stageDefinitions.length - 1) {
        const nextStage = stageDefinitions[i + 1];
        setPipelineState(prev => ({
          ...prev,
          currentStage: nextStage.name,
          stages: prev.stages.map(stage =>
            stage.name === nextStage.name
              ? { ...stage, status: 'analyzing' }
              : stage
          )
        }));
      }
    }

    // Pipeline completed
    setPipelineState(prev => ({
      ...prev,
      isRunning: false,
      currentStage: null,
      totalProgress: 100
    }));
  };

  const generateMockResult = (stageName: string) => {
    switch (stageName) {
      case 'transcription':
        return { segments: 12, duration: '3.2 minutes', accuracy: '94%' };
      case 'analysis':
        return { scenes: 4, entities: 18, confidence: '89%' };
      case 'layout':
        return { diagrams: 4, nodes: 24, layouts: 'optimized' };
      case 'preparation':
        return { scenes: 4, duration: '45 seconds', quality: '1080p' };
      default:
        return {};
    }
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }, [])
  };

  const handleStart = useCallback(() => {
    if (selectedFile) {
      onStartPipeline?.(selectedFile);
      simulatePipeline();
    }, [])
  };

  const handleStop = useCallback(() => {
    onStopPipeline?.();
    setPipelineState(prev => ({
      ...prev,
      isRunning: false,
      currentStage: null
    }, [])));
  };

  const getStageIcon = (stageName: string) => {
    const stageDef = stageDefinitions.find(s => s.name === stageName);
    const Icon = stageDef?.icon || Clock;
    return Icon;
  };

  const getStageColor = (stageName: string) => {
    const stageDef = stageDefinitions.find(s => s.name === stageName);
    return stageDef?.color || 'gray';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'analyzing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const formatDuration = (ms: number) => {
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getTotalDuration = () => {
    if (!pipelineState.startTime) return '0s';
    const now = Date.now();
    return formatDuration(now - pipelineState.startTime);
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileAudio className="h-5 w-5" />
            <span>Pipeline Control</span>
          </CardTitle>
          <CardDescription>
            Upload audio file and monitor processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* File Selection */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileSelect}
                  disabled={pipelineState.isRunning}
                  className="w-full p-2 border rounded-md file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              {selectedFile && (
                <Badge variant="outline">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                </Badge>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleStart}
                disabled={!selectedFile || pipelineState.isRunning}
                className="flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Start Pipeline</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleStop}
                disabled={!pipelineState.isRunning}
                className="flex items-center space-x-2"
              >
                <Square className="h-4 w-4" />
                <span>Stop</span>
              </Button>

              {pipelineState.isRunning && (
                <Badge variant="default" className="animate-pulse">
                  Processing...
                </Badge>
              )}
            </div>

            {/* Overall Progress */}
            {pipelineState.startTime && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{pipelineState.totalProgress.toFixed(0)}%</span>
                </div>
                <Progress value={pipelineState.totalProgress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Elapsed: {getTotalDuration()}</span>
                  <span>
                    Stage: {pipelineState.currentStage || 'Complete'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
          <CardDescription>
            Real-time monitoring of each processing stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stageDefinitions.map((stageDef, index) => {
              const stage = pipelineState.stages.find(s => s.name === stageDef.name);
              const Icon = stageDef.icon;

              return (
                <div
                  key={stageDef.name}
                  className={`p-4 border rounded-lg transition-all ${
                    stage?.status === 'analyzing'
                      ? 'border-blue-500 bg-blue-50'
                      : stage?.status === 'complete'
                      ? 'border-green-500 bg-green-50'
                      : stage?.status === 'error'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full bg-${stageDef.color}-100`}>
                        <Icon className={`h-4 w-4 text-${stageDef.color}-600`} />
                      </div>
                      <div>
                        <div className="font-medium">{stageDef.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {stageDef.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {stage?.result && (
                        <div className="text-xs text-muted-foreground text-right">
                          {Object.entries(stage.result).map(([key, value]) => (
                            <div key={key}>
                              {key}: {String(value)}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        {getStatusIcon(stage?.status || 'pending')}
                        <Badge
                          variant={
                            stage?.status === 'complete'
                              ? 'default'
                              : stage?.status === 'analyzing'
                              ? 'secondary'
                              : stage?.status === 'error'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {stage?.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Stage Progress */}
                  {stage?.status === 'analyzing' && stage.progress !== undefined && (
                    <div className="mt-3 space-y-1">
                      <Progress value={stage.progress} className="h-1" />
                      <div className="text-xs text-muted-foreground text-right">
                        {stage.progress.toFixed(0)}%
                      </div>
                    </div>
                  )}

                  {/* Stage Timing */}
                  {stage?.endTime && stage?.startTime && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Completed in {formatDuration(stage.endTime - stage.startTime)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {pipelineState.totalProgress === 100 && !pipelineState.isRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Pipeline Completed Successfully</span>
            </CardTitle>
            <CardDescription>
              Audio processing completed. Ready for video generation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pipelineState.stages.map(stage => {
                const stageDef = stageDefinitions.find(s => s.name === stage.name);
                return stage.result ? (
                  <div key={stage.name} className="text-center p-3 border rounded">
                    <div className="font-medium text-sm">{stageDef?.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {Object.entries(stage.result).map(([key, value]) => (
                        <div key={key}>
                          {key}: {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <Button className="flex items-center space-x-2">
                <Video className="h-4 w-4" />
                <span>Generate Video</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PipelineMonitor;