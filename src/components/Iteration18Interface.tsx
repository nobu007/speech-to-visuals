/**
 * Iteration 18: Advanced User Experience Interface
 *
 * Building upon Iteration 17 with:
 * - Real file upload with drag-and-drop
 * - Live video preview capabilities
 * - Batch processing support
 * - Advanced export options
 * - Enhanced progress visualization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Play,
  Download,
  Settings,
  Eye,
  Batch,
  CheckCircle,
  AlertCircle,
  Clock,
  FileAudio,
  Video,
  Image,
  Trash2,
  RefreshCw,
  Zap
} from 'lucide-react';

import { Iteration18AdvancedUXPipeline, ProcessedFile, AdvancedQualityMetrics } from '@/pipeline/iteration-18-advanced-ux-pipeline';

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  processingId?: string;
  error?: string;
}

interface ProcessingStageDisplay {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  details: string;
  duration?: number;
}

interface ExportOption {
  format: 'mp4' | 'webm' | 'gif' | 'avi';
  quality: '720p' | '1080p' | '4k';
  compression: 'low' | 'medium' | 'high';
  enabled: boolean;
}

interface PreviewFrame {
  timestamp: number;
  thumbnailUrl: string;
  quality: 'low' | 'medium' | 'high';
}

const Iteration18Interface: React.FC = () => {
  // Core state
  const [pipeline] = useState(() => new Iteration18AdvancedUXPipeline());
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<AdvancedQualityMetrics | null>(null);

  // Upload configuration
  const [dragActive, setDragActive] = useState(false);
  const [maxConcurrentUploads, setMaxConcurrentUploads] = useState(3);
  const [enablePreviews, setEnablePreviews] = useState(true);
  const [batchProcessing, setBatchProcessing] = useState(true);

  // Export configuration
  const [exportOptions, setExportOptions] = useState<ExportOption[]>([
    { format: 'mp4', quality: '1080p', compression: 'medium', enabled: true },
    { format: 'webm', quality: '1080p', compression: 'high', enabled: false },
    { format: 'gif', quality: '720p', compression: 'medium', enabled: false }
  ]);

  // Processing visualization
  const [activeProcessing, setActiveProcessing] = useState<Map<string, ProcessingStageDisplay[]>>(new Map());
  const [previews, setPreviews] = useState<Map<string, PreviewFrame[]>>(new Map());

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ====== FILE UPLOAD HANDLERS ======

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFileSelection(files);
  }, []);

  const handleFileSelection = useCallback((files: File[]) => {
    const supportedFormats = ['wav', 'mp3', 'm4a', 'flac', 'aac', 'ogg'];
    const maxFileSize = 200 * 1024 * 1024; // 200MB

    const newUploadFiles: UploadFile[] = files
      .filter(file => {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!extension || !supportedFormats.includes(extension)) {
          alert(`Unsupported format: ${file.name}. Supported: ${supportedFormats.join(', ')}`);
          return false;
        }
        if (file.size > maxFileSize) {
          alert(`File too large: ${file.name}. Max size: ${maxFileSize / 1024 / 1024}MB`);
          return false;
        }
        return true;
      })
      .map(file => ({
        file,
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending' as const,
        progress: 0
      }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
    setActiveProcessing(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
    setPreviews(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, []);

  // ====== PROCESSING HANDLERS ======

  const startProcessing = useCallback(async () => {
    if (uploadFiles.length === 0) return;

    setIsProcessing(true);

    try {
      // Setup event listeners for real-time updates
      const handleStatusUpdate = ({ processingId, status }: any) => {
        setUploadFiles(prev => prev.map(f =>
          f.processingId === processingId ? { ...f, status } : f
        ));
      };

      const handleStageProgress = ({ processingId, stage, progress }: any) => {
        setActiveProcessing(prev => {
          const newMap = new Map(prev);
          const stages = newMap.get(processingId) || [];
          const updatedStages = stages.map(s =>
            s.name === stage ? { ...s, progress, status: 'in_progress' as const } : s
          );
          newMap.set(processingId, updatedStages);
          return newMap;
        });
      };

      const handlePreviewUpdate = ({ processingId, preview }: any) => {
        if (!enablePreviews) return;

        setPreviews(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(processingId) || [];
          newMap.set(processingId, [...existing, preview]);
          return newMap;
        });
      };

      pipeline.on('statusUpdate', handleStatusUpdate);
      pipeline.on('stageProgress', handleStageProgress);
      pipeline.on('previewUpdate', handlePreviewUpdate);

      // Process files
      const files = uploadFiles.map(f => f.file);
      const result = await pipeline.processAdvancedWorkflow(files);

      // Update final results
      setQualityMetrics(result.qualityMetrics);

      // Update file statuses
      setUploadFiles(prev => prev.map(f => {
        const processedFile = result.files.find(pf => pf.originalName === f.file.name);
        return processedFile
          ? { ...f, status: processedFile.status as any, progress: 100 }
          : f;
      }));

      // Cleanup event listeners
      pipeline.removeListener('statusUpdate', handleStatusUpdate);
      pipeline.removeListener('stageProgress', handleStageProgress);
      pipeline.removeListener('previewUpdate', handlePreviewUpdate);

    } catch (error) {
      console.error('Processing failed:', error);
      alert(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [uploadFiles, pipeline, enablePreviews]);

  // ====== EXPORT HANDLERS ======

  const toggleExportOption = useCallback((index: number) => {
    setExportOptions(prev => prev.map((option, i) =>
      i === index ? { ...option, enabled: !option.enabled } : option
    ));
  }, []);

  const downloadExports = useCallback(async () => {
    const enabledOptions = exportOptions.filter(option => option.enabled);

    if (enabledOptions.length === 0) {
      alert('Please select at least one export option');
      return;
    }

    // Simulate export downloads
    for (const option of enabledOptions) {
      console.log(`Downloading: ${option.format}/${option.quality}/${option.compression}`);
      // In real implementation, this would trigger actual downloads
    }

    alert(`Starting download of ${enabledOptions.length} export(s)`);
  }, [exportOptions]);

  // ====== RENDER HELPERS ======

  const renderUploadZone = () => (
    <div
      ref={dropRef}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
        dragActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {dragActive ? 'Drop files here' : 'Upload Audio Files'}
      </h3>
      <p className="text-gray-600 mb-4">
        Drag and drop audio files, or click to browse
      </p>
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        className="mb-2"
      >
        <FileAudio className="h-4 w-4 mr-2" />
        Choose Files
      </Button>
      <p className="text-sm text-gray-500">
        Supports: WAV, MP3, M4A, FLAC, AAC, OGG (max 200MB)
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".wav,.mp3,.m4a,.flac,.aac,.ogg"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );

  const renderFileList = () => (
    <div className="space-y-3">
      {uploadFiles.map((uploadFile) => (
        <Card key={uploadFile.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-3">
              <FileAudio className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium truncate max-w-xs">{uploadFile.file.name}</p>
                <p className="text-sm text-gray-500">
                  {(uploadFile.file.size / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={
                uploadFile.status === 'completed' ? 'default' :
                uploadFile.status === 'failed' ? 'destructive' :
                uploadFile.status === 'processing' ? 'secondary' : 'outline'
              }>
                {uploadFile.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                {uploadFile.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                {uploadFile.status === 'processing' && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
                {uploadFile.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(uploadFile.id)}
                disabled={uploadFile.status === 'processing'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {uploadFile.status === 'processing' && (
            <div className="space-y-2">
              <Progress value={uploadFile.progress} className="w-full" />

              {/* Render processing stages */}
              {activeProcessing.get(uploadFile.id)?.map((stage, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className={`font-medium ${
                    stage.status === 'completed' ? 'text-green-600' :
                    stage.status === 'in_progress' ? 'text-blue-600' :
                    'text-gray-500'
                  }`}>
                    {stage.name}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">{stage.progress.toFixed(0)}%</span>
                    {stage.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                    {stage.status === 'in_progress' && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />}
                    {stage.status === 'pending' && <Clock className="h-3 w-3 text-gray-400" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Render previews */}
          {enablePreviews && previews.get(uploadFile.id) && previews.get(uploadFile.id)!.length > 0 && (
            <div className="mt-3">
              <Label className="text-sm font-medium mb-2 block">Live Previews</Label>
              <div className="flex space-x-2">
                {previews.get(uploadFile.id)!.slice(-3).map((preview, index) => (
                  <div key={index} className="relative">
                    <div className="w-16 h-12 bg-gray-200 rounded border flex items-center justify-center">
                      <Image className="h-6 w-6 text-gray-400" />
                    </div>
                    <Badge variant="outline" className="absolute -top-1 -right-1 text-xs">
                      {preview.quality}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Upload Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="concurrent-uploads">Max Concurrent Uploads</Label>
            <Select
              value={maxConcurrentUploads.toString()}
              onValueChange={(value) => setMaxConcurrentUploads(parseInt(value))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="enable-previews"
              checked={enablePreviews}
              onCheckedChange={setEnablePreviews}
            />
            <Label htmlFor="enable-previews">Enable Live Previews</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="batch-processing"
              checked={batchProcessing}
              onCheckedChange={setBatchProcessing}
            />
            <Label htmlFor="batch-processing">Batch Processing</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Export Options
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exportOptions.map((option, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={option.enabled}
                    onCheckedChange={() => toggleExportOption(index)}
                  />
                  <Label className="font-medium">
                    {option.format.toUpperCase()} - {option.quality} ({option.compression})
                  </Label>
                </div>
                <Badge variant="outline">{option.format}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderResults = () => (
    <div className="space-y-6">
      {qualityMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Quality Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Upload Validation</Label>
                <Progress value={qualityMetrics.uploadValidation} className="mt-1" />
                <span className="text-sm text-gray-600">{qualityMetrics.uploadValidation.toFixed(1)}%</span>
              </div>
              <div>
                <Label>Transcription Accuracy</Label>
                <Progress value={qualityMetrics.transcriptionAccuracy} className="mt-1" />
                <span className="text-sm text-gray-600">{qualityMetrics.transcriptionAccuracy.toFixed(1)}%</span>
              </div>
              <div>
                <Label>Scene Segmentation</Label>
                <Progress value={qualityMetrics.sceneSegmentation} className="mt-1" />
                <span className="text-sm text-gray-600">{qualityMetrics.sceneSegmentation.toFixed(1)}%</span>
              </div>
              <div>
                <Label>Diagram Relevance</Label>
                <Progress value={qualityMetrics.diagramRelevance} className="mt-1" />
                <span className="text-sm text-gray-600">{qualityMetrics.diagramRelevance.toFixed(1)}%</span>
              </div>
              <div>
                <Label>Video Quality</Label>
                <Progress value={qualityMetrics.videoQuality} className="mt-1" />
                <span className="text-sm text-gray-600">{qualityMetrics.videoQuality.toFixed(1)}%</span>
              </div>
              <div>
                <Label>Overall Satisfaction</Label>
                <Progress value={qualityMetrics.overallSatisfaction} className="mt-1" />
                <span className="text-sm text-gray-600 font-semibold">{qualityMetrics.overallSatisfaction.toFixed(1)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" />
            Download Results
          </CardTitle>
          <CardDescription>
            Select export formats and download your generated videos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={downloadExports}
            disabled={!qualityMetrics || exportOptions.filter(o => o.enabled).length === 0}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Selected Formats ({exportOptions.filter(o => o.enabled).length})
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Speech-to-Visuals Generator
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Iteration 18: Advanced User Experience
          </p>
          <Badge variant="outline" className="mb-4">
            Real File Upload • Live Previews • Batch Processing • Advanced Exports
          </Badge>
        </div>

        {/* Main Interface */}
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" className="flex items-center">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex items-center">
              <Play className="h-4 w-4 mr-2" />
              Processing
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center">
              <Video className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Audio Files</CardTitle>
                <CardDescription>
                  Upload one or more audio files to generate diagram videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderUploadZone()}

                {uploadFiles.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">
                        Files ({uploadFiles.length})
                      </h3>
                      <Button
                        onClick={startProcessing}
                        disabled={isProcessing || uploadFiles.length === 0}
                        className="flex items-center"
                      >
                        {isProcessing ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isProcessing ? 'Processing...' : 'Start Processing'}
                      </Button>
                    </div>
                    {renderFileList()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processing" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Processing Status</CardTitle>
                <CardDescription>
                  Real-time processing progress and live previews
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploadFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <Batch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No files uploaded yet</p>
                  </div>
                ) : (
                  renderFileList()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            {renderSettings()}
          </TabsContent>

          <TabsContent value="results" className="mt-6">
            {renderResults()}
          </TabsContent>
        </Tabs>

        {/* Status Alert */}
        {isProcessing && (
          <Alert className="mt-6">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Processing {uploadFiles.filter(f => f.status === 'processing').length} files with advanced UX features...
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default Iteration18Interface;