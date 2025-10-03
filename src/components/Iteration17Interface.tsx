/**
 * Iteration 17 User Interface Component
 * Focus: Practical, user-friendly workflow
 * Philosophy: Simple upload → clear progress → video download
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  PlayCircle,
  Download,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock,
  BarChart3,
  Video,
  Sparkles
} from 'lucide-react';

interface ProcessingStage {
  name: string;
  displayName: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  duration?: number;
  error?: string;
}

interface ProcessingResult {
  success: boolean;
  transcription: string;
  scenes: any[];
  videoPath?: string;
  processingTime: number;
  qualityMetrics: {
    transcriptionAccuracy: number;
    sceneSegmentationScore: number;
    diagramRelevance: number;
    overallUsability: number;
  };
  userFriendlyReport: string;
}

export const Iteration17Interface: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [overallProgress, setOverallProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string>('');

  // Processing stages with user-friendly names
  const [stages, setStages] = useState<ProcessingStage[]>([
    { name: 'audio-validation', displayName: 'Audio Validation', status: 'pending', progress: 0 },
    { name: 'transcription', displayName: 'Speech to Text', status: 'pending', progress: 0 },
    { name: 'analysis', displayName: 'Content Analysis', status: 'pending', progress: 0 },
    { name: 'visualization', displayName: 'Diagram Generation', status: 'pending', progress: 0 },
    { name: 'optimization', displayName: 'Quality Enhancement', status: 'pending', progress: 0 },
    { name: 'video-generation', displayName: 'Video Rendering', status: 'pending', progress: 0 }
  ]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setResult(null);
      // Reset stages
      setStages(prev => prev.map(s => ({
        ...s,
        status: 'pending' as const,
        progress: 0,
        duration: undefined,
        error: undefined
      })));
    }
  }, []);

  const simulateProcessing = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError('');
    setCurrentStage('Initializing...');
    setOverallProgress(0);

    try {
      // Simulate Iteration 17 processing with realistic timing
      const totalStages = stages.length;

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];

        // Update current stage
        setCurrentStage(stage.displayName);

        // Mark stage as active
        setStages(prev => prev.map((s, idx) =>
          idx === i ? { ...s, status: 'active', progress: 0 } : s
        ));

        // Simulate stage processing with progress updates
        const stageStartTime = performance.now();
        const stageDuration = [2000, 8000, 5000, 6000, 4000, 10000][i]; // Realistic timings

        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, stageDuration / 10));

          // Update stage progress
          setStages(prev => prev.map((s, idx) =>
            idx === i ? { ...s, progress } : s
          ));

          // Update overall progress
          const stageWeight = 100 / totalStages;
          const currentOverall = i * stageWeight + (progress / 100) * stageWeight;
          setOverallProgress(currentOverall);
        }

        // Mark stage as completed
        const stageDurationActual = performance.now() - stageStartTime;
        setStages(prev => prev.map((s, idx) =>
          idx === i ? {
            ...s,
            status: 'completed',
            progress: 100,
            duration: stageDurationActual
          } : s
        ));
      }

      // Generate mock result
      const mockResult: ProcessingResult = {
        success: true,
        transcription: generateMockTranscription(selectedFile.name),
        scenes: [
          { id: 1, text: 'Introduction to the topic', type: 'flowchart', duration: 8 },
          { id: 2, text: 'Main concepts explanation', type: 'process', duration: 12 },
          { id: 3, text: 'Conclusion and summary', type: 'hierarchy', duration: 6 }
        ],
        videoPath: `output/iteration-17-${Date.now()}.mp4`,
        processingTime: 35000, // 35 seconds
        qualityMetrics: {
          transcriptionAccuracy: 0.95,
          sceneSegmentationScore: 0.92,
          diagramRelevance: 0.88,
          overallUsability: 0.94
        },
        userFriendlyReport: generateUserReport()
      };

      setResult(mockResult);
      setCurrentStage('Complete!');
      setOverallProgress(100);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setCurrentStage('Failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, stages.length]);

  const generateMockTranscription = (filename: string): string => {
    if (filename.includes('business') || filename.includes('meeting')) {
      return 'Our quarterly results show strong growth in three key areas. Revenue increased by 25% compared to last quarter. Customer acquisition improved with 40% more sign-ups.';
    } else if (filename.includes('technical') || filename.includes('system')) {
      return 'The system architecture consists of three main components. The data layer handles storage operations. The business logic layer processes user requests.';
    }
    return 'Welcome to our tutorial on machine learning algorithms. We will explore supervised learning, unsupervised learning, and reinforcement learning techniques.';
  };

  const generateUserReport = (): string => {
    return `🎉 Video Generation Complete!
📊 Processing Success: 100% (6/6 stages completed)
⏱️ Total Time: 35s
🎯 Quality Level: Professional
📁 Output Location: Ready for download

✅ All systems performed optimally!`;
  };

  const getStageIcon = (status: ProcessingStage['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'active': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusColor = (status: ProcessingStage['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">Iteration 17 - Practical Workflow</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Audio to Video Generator
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upload your audio file and watch as AI creates a professional diagram video in under 60 seconds
        </p>
      </div>

      {/* File Upload Section */}
      {!selectedFile && !isProcessing && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Select Audio File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
                id="audio-upload"
              />
              <label htmlFor="audio-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  Choose an audio file
                </p>
                <p className="text-gray-500">
                  Supports WAV, MP3, M4A and other audio formats
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected File */}
      {selectedFile && !isProcessing && !result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PlayCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              </div>
              <Button onClick={simulateProcessing} className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                Generate Video
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Section */}
      {isProcessing && (
        <div className="space-y-6">
          {/* Overall Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing: {currentStage}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{Math.round(overallProgress)}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
                <p className="text-sm text-gray-500">
                  Estimated time remaining: {Math.max(0, Math.round((100 - overallProgress) * 0.6))}s
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stage Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Processing Stages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stages.map((stage, index) => (
                  <div key={stage.name} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getStageIcon(stage.status)}
                      <span className="font-medium text-gray-900">
                        {stage.displayName}
                      </span>
                      <Badge variant="secondary" className={getStatusColor(stage.status)}>
                        {stage.status === 'active' ? `${Math.round(stage.progress)}%` : stage.status}
                      </Badge>
                    </div>
                    {stage.status === 'active' && (
                      <div className="w-24">
                        <Progress value={stage.progress} className="h-1" />
                      </div>
                    )}
                    {stage.duration && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="w-3 h-3" />
                        {(stage.duration / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-6">
          {/* Success Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                Video Generated Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">35s</div>
                  <div className="text-sm text-gray-500">Processing Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">95%</div>
                  <div className="text-sm text-gray-500">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{result.scenes.length}</div>
                  <div className="text-sm text-gray-500">Scenes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">HD</div>
                  <div className="text-sm text-gray-500">Quality</div>
                </div>
              </div>

              <Button className="w-full flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Download Video (1920x1080)
              </Button>
            </CardContent>
          </Card>

          {/* Quality Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Quality Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { label: 'Transcription Accuracy', value: result.qualityMetrics.transcriptionAccuracy, color: 'bg-green-500' },
                  { label: 'Scene Segmentation', value: result.qualityMetrics.sceneSegmentationScore, color: 'bg-blue-500' },
                  { label: 'Diagram Relevance', value: result.qualityMetrics.diagramRelevance, color: 'bg-purple-500' },
                  { label: 'Overall Usability', value: result.qualityMetrics.overallUsability, color: 'bg-orange-500' }
                ].map((metric) => (
                  <div key={metric.label} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{metric.label}</span>
                      <span className="font-medium">{Math.round(metric.value * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${metric.color} transition-all duration-1000`}
                        style={{ width: `${metric.value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transcript Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Transcript</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg text-sm">
                    {result.transcription}
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Generated Scenes</h4>
                  <div className="space-y-2">
                    {result.scenes.map((scene) => (
                      <div key={scene.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <Badge variant="outline">{scene.type}</Badge>
                        <span className="text-sm text-gray-700 flex-1">{scene.text}</span>
                        <span className="text-xs text-gray-500">{scene.duration}s</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Start Over */}
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setResult(null);
                setError('');
                setStages(prev => prev.map(s => ({
                  ...s,
                  status: 'pending' as const,
                  progress: 0,
                  duration: undefined,
                  error: undefined
                })));
              }}
            >
              Process Another Audio File
            </Button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default Iteration17Interface;