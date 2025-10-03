/**
 * 🎯 Iteration 45: Real-Time Streaming Processor Component
 * Provides live audio processing with progressive visualization updates
 * Following custom instructions methodology for incremental enhancement
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Download,
  BarChart3,
  Clock,
  Zap,
  Activity
} from 'lucide-react';
import {
  StreamingTranscriber,
  StreamingProgress,
  StreamingTranscriptionConfig,
  validateStreamingSupport
} from '@/transcription/streaming-transcriber';
import { TranscriptionSegment } from '@/transcription/types';
import { SceneGraph } from '@/types/diagram';

export interface StreamingProcessorProps {
  onSceneGenerated?: (scene: SceneGraph) => void;
  onComplete?: (scenes: SceneGraph[]) => void;
  className?: string;
}

type ProcessingMode = 'file' | 'live' | 'idle';
type StreamingStatus = 'idle' | 'recording' | 'processing' | 'paused' | 'complete' | 'error';

interface RealtimeStats {
  segmentCount: number;
  averageConfidence: number;
  processingSpeed: number; // segments per second
  currentSegment: TranscriptionSegment | null;
  elapsedTime: number;
}

export const StreamingProcessor: React.FC<StreamingProcessorProps> = ({
  onSceneGenerated,
  onComplete,
  className
}) => {
  // Core state
  const [mode, setMode] = useState<ProcessingMode>('idle');
  const [status, setStatus] = useState<StreamingStatus>('idle');
  const [progress, setProgress] = useState<StreamingProgress | null>(null);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [scenes, setScenes] = useState<SceneGraph[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Real-time statistics
  const [stats, setStats] = useState<RealtimeStats>({
    segmentCount: 0,
    averageConfidence: 0,
    processingSpeed: 0,
    currentSegment: null,
    elapsedTime: 0
  });

  // Component refs
  const transcriber = useRef<StreamingTranscriber | null>(null);
  const startTime = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statsTimer = useRef<NodeJS.Timeout | null>(null);

  // Browser capability validation
  const [browserSupport] = useState(() => validateStreamingSupport());

  // Configuration
  const [config, setConfig] = useState<StreamingTranscriptionConfig>({
    chunkSizeMs: 3000,
    overlapMs: 500,
    minConfidence: 0.7,
    enableLiveUpdate: true
  });

  // Initialize transcriber
  useEffect(() => {
    transcriber.current = new StreamingTranscriber(config);

    return () => {
      stopAllProcessing();
    };
  }, [config]);

  // Statistics update timer
  useEffect(() => {
    if (status === 'recording' || status === 'processing') {
      statsTimer.current = setInterval(() => {
        setStats(prev => ({
          ...prev,
          elapsedTime: startTime.current ? (performance.now() - startTime.current) / 1000 : 0,
          processingSpeed: prev.elapsedTime > 0 ? prev.segmentCount / prev.elapsedTime : 0
        }));
      }, 500);
    } else {
      if (statsTimer.current) {
        clearInterval(statsTimer.current);
        statsTimer.current = null;
      }
    }

    return () => {
      if (statsTimer.current) {
        clearInterval(statsTimer.current);
      }
    };
  }, [status]);

  /**
   * Handle file-based streaming processing
   */
  const handleFileProcessing = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Please select an audio file first');
      return;
    }

    if (!transcriber.current) {
      setError('Transcriber not initialized');
      return;
    }

    try {
      setMode('file');
      setStatus('processing');
      setError(null);
      setSegments([]);
      setScenes([]);
      startTime.current = performance.now();

      console.log('🚀 Starting file streaming processing...');

      // Progress callback for real-time updates
      const onProgress = (progressData: StreamingProgress) => {
        setProgress(progressData);
        setStats(prev => ({
          ...prev,
          segmentCount: progressData.segmentCount,
          averageConfidence: progressData.averageConfidence,
          currentSegment: progressData.currentSegment
        }));
      };

      // Segment callback for incremental building
      const onSegment = (segment: TranscriptionSegment) => {
        setSegments(prev => {
          const updated = [...prev, segment];

          // Process segment for diagram generation
          processSegmentForDiagram(segment, updated);

          return updated;
        });
      };

      // Execute streaming transcription
      const result = await transcriber.current.transcribeStream(file, onProgress, onSegment);

      if (result.segments.length > 0) {
        setStatus('complete');
        console.log(`✅ Streaming processing complete: ${result.segments.length} segments`);

        if (onComplete) {
          onComplete(scenes);
        }
      } else {
        setStatus('error');
        setError('No segments were generated from the audio');
      }

    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Processing failed');
      console.error('Streaming processing error:', err);
    }
  }, [scenes, onComplete]);

  /**
   * Handle live microphone processing
   */
  const handleLiveProcessing = useCallback(async () => {
    if (!transcriber.current) {
      setError('Transcriber not initialized');
      return;
    }

    if (!browserSupport.webSpeechAPI) {
      setError('Web Speech API not supported in this browser. ' + browserSupport.recommendation);
      return;
    }

    try {
      setMode('live');
      setStatus('recording');
      setError(null);
      setSegments([]);
      setScenes([]);
      startTime.current = performance.now();

      console.log('🎤 Starting live transcription...');

      // Progress callback for live updates
      const onProgress = (progressData: StreamingProgress) => {
        setProgress(progressData);
        setStats(prev => ({
          ...prev,
          segmentCount: progressData.segmentCount,
          averageConfidence: progressData.averageConfidence,
          currentSegment: progressData.currentSegment
        }));
      };

      // Segment callback for real-time processing
      const onSegment = (segment: TranscriptionSegment) => {
        setSegments(prev => {
          const updated = [...prev, segment];

          // Process segment for real-time diagram updates
          processSegmentForDiagram(segment, updated);

          return updated;
        });
      };

      // Start live transcription
      await transcriber.current.startLiveTranscription(onSegment, onProgress);

      console.log('✅ Live transcription started');

    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Live processing failed');
      console.error('Live processing error:', err);
    }
  }, [browserSupport, scenes]);

  /**
   * Process individual segment for diagram generation
   * Implements progressive scene building
   */
  const processSegmentForDiagram = useCallback((
    segment: TranscriptionSegment,
    allSegments: TranscriptionSegment[]
  ) => {
    // Combine recent segments for context (last 3 segments)
    const recentSegments = allSegments.slice(-3);
    const combinedText = recentSegments.map(s => s.text).join(' ');

    // Simple diagram type detection for real-time processing
    const diagramType = detectDiagramType(combinedText);

    if (diagramType !== 'unknown') {
      const scene: SceneGraph = {
        id: `scene-${Date.now()}`,
        type: diagramType,
        title: `Scene ${allSegments.length}`,
        summary: segment.text.substring(0, 100) + '...',
        nodes: extractNodes(combinedText),
        edges: extractEdges(combinedText),
        startTime: segment.start,
        endTime: segment.end,
        durationMs: (segment.end - segment.start) * 1000,
        keyphrases: extractKeyphrases(segment.text),
        confidence: segment.confidence,
        metadata: {
          segmentIndex: allSegments.length - 1,
          processingTime: performance.now() - startTime.current,
          realtime: true
        }
      };

      setScenes(prev => {
        const updated = [...prev, scene];

        if (onSceneGenerated) {
          onSceneGenerated(scene);
        }

        return updated;
      });
    }
  }, [onSceneGenerated]);

  /**
   * Stop all processing activities
   */
  const stopAllProcessing = useCallback(() => {
    if (transcriber.current) {
      transcriber.current.stopLiveTranscription();
    }

    setStatus('idle');
    setMode('idle');
    setProgress(null);

    if (statsTimer.current) {
      clearInterval(statsTimer.current);
      statsTimer.current = null;
    }

    console.log('🛑 All processing stopped');
  }, []);

  /**
   * Pause/resume processing
   */
  const togglePause = useCallback(() => {
    if (status === 'recording' || status === 'processing') {
      setStatus('paused');
      console.log('⏸️ Processing paused');
    } else if (status === 'paused') {
      setStatus(mode === 'live' ? 'recording' : 'processing');
      console.log('▶️ Processing resumed');
    }
  }, [status, mode]);

  /**
   * Reset all state
   */
  const resetProcessor = useCallback(() => {
    stopAllProcessing();
    setSegments([]);
    setScenes([]);
    setError(null);
    setProgress(null);
    setStats({
      segmentCount: 0,
      averageConfidence: 0,
      processingSpeed: 0,
      currentSegment: null,
      elapsedTime: 0
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('🔄 Processor reset');
  }, [stopAllProcessing]);

  /**
   * Get status display color
   */
  const getStatusColor = (currentStatus: StreamingStatus): string => {
    switch (currentStatus) {
      case 'recording': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-400';
    }
  };

  /**
   * Format time duration
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Audio Processing
          </CardTitle>
          <CardDescription>
            Stream audio processing with live diagram generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Browser Support Info */}
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Browser Capabilities</span>
              <div className="flex gap-2">
                <Badge variant={browserSupport.webSpeechAPI ? 'default' : 'secondary'}>
                  Speech API: {browserSupport.webSpeechAPI ? '✅' : '❌'}
                </Badge>
                <Badge variant={browserSupport.mediaDevices ? 'default' : 'secondary'}>
                  Media: {browserSupport.mediaDevices ? '✅' : '❌'}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {browserSupport.recommendation}
            </p>
          </div>

          {/* Input Methods */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* File Processing */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">File Processing</h4>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="w-full p-2 border rounded text-sm"
                disabled={status !== 'idle'}
              />
              <Button
                onClick={handleFileProcessing}
                disabled={status !== 'idle'}
                size="sm"
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Stream Process File
              </Button>
            </div>

            {/* Live Processing */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Live Recording</h4>
              <div className="p-3 border rounded bg-muted text-center">
                <p className="text-sm text-muted-foreground">
                  Real-time microphone processing
                </p>
              </div>
              <Button
                onClick={handleLiveProcessing}
                disabled={status !== 'idle' || !browserSupport.webSpeechAPI}
                size="sm"
                className="w-full"
                variant={status === 'recording' ? 'destructive' : 'default'}
              >
                {status === 'recording' ? (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Recording...
                  </>
                ) : (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Start Live Processing
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Control Buttons */}
          {status !== 'idle' && (
            <div className="flex gap-2 mt-4">
              <Button
                onClick={togglePause}
                size="sm"
                variant="outline"
                disabled={status === 'complete' || status === 'error'}
              >
                {status === 'paused' ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={stopAllProcessing}
                size="sm"
                variant="outline"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
              <Button
                onClick={resetProcessor}
                size="sm"
                variant="outline"
              >
                Reset
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Status */}
      {status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
              Streaming Status
              <Badge variant="outline" className="ml-auto">
                {status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress Bar */}
            {progress && progress.totalDuration > 0 && (
              <div className="space-y-2 mb-4">
                <Progress
                  value={(progress.processedDuration / progress.totalDuration) * 100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTime(progress.processedDuration / 1000)}</span>
                  <span>{formatTime(progress.totalDuration / 1000)}</span>
                </div>
              </div>
            )}

            {/* Real-time Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.segmentCount}</div>
                <div className="text-xs text-blue-600">Segments</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {(stats.averageConfidence * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-green-600">Confidence</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.processingSpeed.toFixed(1)}
                </div>
                <div className="text-xs text-purple-600">Seg/s</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {formatTime(stats.elapsedTime)}
                </div>
                <div className="text-xs text-orange-600">Elapsed</div>
              </div>
            </div>

            {/* Current Segment */}
            {stats.currentSegment && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Current Segment</span>
                  <Badge variant="outline">
                    {(stats.currentSegment.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                <p className="text-sm">{stats.currentSegment.text}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Processing Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Live Results */}
      {scenes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Live Scene Generation
              <Badge variant="outline" className="ml-auto">
                {scenes.length} scenes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {scenes.slice(-5).map((scene, index) => (
                <div key={scene.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{scene.type}</Badge>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(scene.startTime)}
                    </div>
                  </div>
                  <p className="text-sm">{scene.summary}</p>
                  <div className="flex gap-1 mt-2">
                    {scene.keyphrases.slice(0, 3).map((phrase, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper functions for diagram processing
function detectDiagramType(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('hierarchy') || lowerText.includes('organization') ||
      lowerText.includes('structure') || lowerText.includes('parent') ||
      lowerText.includes('child')) {
    return 'tree';
  }

  if (lowerText.includes('process') || lowerText.includes('workflow') ||
      lowerText.includes('step') || lowerText.includes('flow')) {
    return 'flow';
  }

  if (lowerText.includes('timeline') || lowerText.includes('chronology') ||
      lowerText.includes('schedule') || lowerText.includes('time')) {
    return 'timeline';
  }

  if (lowerText.includes('cycle') || lowerText.includes('loop') ||
      lowerText.includes('repeat') || lowerText.includes('circular')) {
    return 'cycle';
  }

  return 'unknown';
}

function extractNodes(text: string): Array<{ id: string; label: string; type?: string }> {
  // Simple node extraction based on keywords
  const words = text.split(/\s+/);
  const nodes: Array<{ id: string; label: string; type?: string }> = [];

  // Extract potential node labels (capitalized words, certain patterns)
  words.forEach((word, index) => {
    if (word.length > 3 && (word[0] === word[0].toUpperCase() || word.includes('_'))) {
      nodes.push({
        id: `node-${index}`,
        label: word.replace(/[.,!?]$/, ''),
        type: 'default'
      });
    }
  });

  return nodes.slice(0, 6); // Limit to 6 nodes for real-time processing
}

function extractEdges(text: string): Array<{ source: string; target: string; label?: string }> {
  // Simple edge extraction - this would be more sophisticated in production
  return [];
}

function extractKeyphrases(text: string): string[] {
  // Extract important words/phrases
  const words = text.split(/\s+/);
  const keyphrases: string[] = [];

  words.forEach(word => {
    const clean = word.replace(/[.,!?]$/, '').toLowerCase();
    if (clean.length > 4 && !['that', 'this', 'with', 'have', 'will', 'from', 'they', 'been'].includes(clean)) {
      keyphrases.push(clean);
    }
  });

  return keyphrases.slice(0, 5); // Top 5 keyphrases
}