import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Download, Settings, BarChart3 } from 'lucide-react';
import { MainPipeline } from '@/pipeline';
import { PipelineResult, PipelineStage } from '@/pipeline/types';
import { ProcessingStatus } from '@/types/diagram';

interface PipelineInterfaceProps {
  className?: string;
}

export const PipelineInterface: React.FC<PipelineInterfaceProps> = ({ className }) => {
  const [pipeline] = useState(() => new MainPipeline());
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleProcessAudio = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select an audio file first');
      return;
    }

    try {
      setStatus('transcribing');
      setProgress(0);
      setError(null);
      setResult(null);
      setStages([]);

      console.log('🚀 Starting pipeline processing...');

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + Math.random() * 10, 90);

          // Update stage based on progress
          if (newProgress < 25) {
            setCurrentStage('transcribing');
            setStatus('transcribing');
          } else if (newProgress < 50) {
            setCurrentStage('analyzing');
            setStatus('analyzing');
          } else if (newProgress < 75) {
            setCurrentStage('generating');
            setStatus('generating');
          } else {
            setCurrentStage('finalizing');
            setStatus('generating');
          }

          return newProgress;
        });
      }, 500);

      // Execute the pipeline
      const pipelineResult = await pipeline.execute({
        audioFile: selectedFile
      });

      clearInterval(progressInterval);

      if (pipelineResult.success) {
        setProgress(100);
        setStatus('complete');
        setResult(pipelineResult);
        setStages(pipelineResult.stages);
        setCurrentStage('Complete');
        console.log('✅ Pipeline completed successfully');
      } else {
        setStatus('error');
        setError(pipelineResult.error || 'Pipeline processing failed');
        setStages(pipelineResult.stages);
        console.error('❌ Pipeline failed:', pipelineResult.error);
      }

    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Pipeline error:', err);
    }
  }, [selectedFile, pipeline]);

  const handleDownloadVideo = useCallback(() => {
    if (result) {
      // TODO: Integrate with Remotion video rendering
      console.log('📹 Starting video render with scenes:', result.scenes);
      alert('Video rendering would start here. Integration with Remotion needed.');
    }
  }, [result]);

  const getStatusColor = (status: ProcessingStatus): string => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  };

  const getStageStatus = (stage: PipelineStage): string => {
    switch (stage.status) {
      case 'complete': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'analyzing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Audio to Diagram Video Generator
        </h1>
        <p className="text-gray-600">
          Upload an audio file to automatically generate explanatory diagram videos
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Audio Input
          </CardTitle>
          <CardDescription>
            Select an audio file (.mp3, .wav, .m4a) containing explanatory content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
            />

            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  onClick={handleProcessAudio}
                  disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Process Audio
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Status */}
      {status !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
              Processing Status
            </CardTitle>
            <CardDescription>
              Current stage: {currentStage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={progress} className="w-full" />

              {/* Stage Details */}
              {stages.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Pipeline Stages:</h4>
                  {stages.map((stage, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="capitalize">{stage.name}</span>
                      <Badge
                        variant={stage.status === 'complete' ? 'default' : 'secondary'}
                        className={getStageStatus(stage)}
                      >
                        {stage.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {/* Results */}
      {result && result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Processing Results
            </CardTitle>
            <CardDescription>
              Generated {result.scenes.length} diagram scenes in {(result.processingTime / 1000).toFixed(1)}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{result.scenes.length}</div>
                  <div className="text-sm text-blue-600">Scenes</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {result.scenes.filter(s => s.nodes.length > 0).length}
                  </div>
                  <div className="text-sm text-green-600">Diagrams</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {(result.duration / 1000).toFixed(0)}s
                  </div>
                  <div className="text-sm text-purple-600">Duration</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {(result.processingTime / 1000).toFixed(1)}s
                  </div>
                  <div className="text-sm text-orange-600">Process Time</div>
                </div>
              </div>

              {/* Scene Preview */}
              <div className="space-y-2">
                <h4 className="font-medium">Generated Scenes:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {result.scenes.map((scene, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{scene.type}</Badge>
                        <span className="text-sm text-gray-600">
                          {(scene.durationMs / 1000).toFixed(1)}s
                        </span>
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
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                <Button onClick={handleDownloadVideo} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Generate Video
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Adjust Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};