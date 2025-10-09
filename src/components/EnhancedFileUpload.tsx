/**
 * Enhanced File Upload Component - Iteration 66 Phase B
 * 直感的ファイルアップロード (ドラッグ&ドロップ・プレビュー・リアルタイム検証)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2, Info, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { realAudioOptimizer } from '@/transcription/real-audio-optimizer';
import type { AudioQualityAssessment } from '@/transcription/real-audio-optimizer';

export interface EnhancedFileUploadProps {
  onFileSelected: (file: File, quality: AudioQualityAssessment) => void;
  onFileRemoved?: () => void;
  acceptedFormats?: string[];
  maxFileSize?: number; // MB
  autoOptimize?: boolean;
}

interface FileState {
  file: File | null;
  isDragging: boolean;
  isValidating: boolean;
  isOptimizing: boolean;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  quality: AudioQualityAssessment | null;
  preview: {
    name: string;
    size: string;
    type: string;
    duration: string;
  } | null;
}

export const EnhancedFileUpload: React.FC<EnhancedFileUploadProps> = ({
  onFileSelected,
  onFileRemoved,
  acceptedFormats = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg', 'audio/flac', 'audio/aac'],
  maxFileSize = 100, // 100MB default
  autoOptimize = false
}) => {
  const [fileState, setFileState] = useState<FileState>({
    file: null,
    isDragging: false,
    isValidating: false,
    isOptimizing: false,
    validation: { isValid: false, errors: [], warnings: [] },
    quality: null,
    preview: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  /**
   * Validate file (Stage 1: Validation)
   */
  const validateFile = useCallback(async (file: File): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file type
    const formatValidation = realAudioOptimizer.validateFormat(file);
    if (!formatValidation.supported) {
      errors.push(formatValidation.message);
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      errors.push(`File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum (${maxFileSize}MB)`);
    } else if (fileSizeMB > maxFileSize * 0.8) {
      warnings.push(`Large file size (${fileSizeMB.toFixed(1)}MB) may take longer to process`);
    }

    // Check file name
    if (file.name.length > 100) {
      warnings.push('Long filename may cause issues on some systems');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }, [maxFileSize]);

  /**
   * Assess audio quality (Stage 2: Quality Assessment)
   */
  const assessQuality = useCallback(async (file: File): Promise<AudioQualityAssessment> => {
    console.log('🔍 Assessing audio quality...');
    return await realAudioOptimizer.assessQuality(file);
  }, []);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(async (file: File) => {
    console.log('📁 File selected:', file.name);

    // Reset state
    setFileState(prev => ({
      ...prev,
      file,
      isValidating: true,
      validation: { isValid: false, errors: [], warnings: [] },
      quality: null,
      preview: {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: file.type || 'Unknown',
        duration: 'Analyzing...'
      }
    }));

    try {
      // Stage 1: Validate
      const validation = await validateFile(file);

      if (!validation.isValid) {
        setFileState(prev => ({
          ...prev,
          isValidating: false,
          validation
        }));

        toast.error(`File validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Stage 2: Assess quality
      const quality = await assessQuality(file);

      // Update preview with duration
      setFileState(prev => ({
        ...prev,
        isValidating: false,
        validation,
        quality,
        preview: prev.preview ? {
          ...prev.preview,
          duration: `${(quality.duration / 1000).toFixed(1)}s`
        } : null
      }));

      // Show warnings if any
      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      }

      // Show quality assessment
      toast.success(`Audio quality assessed: ${quality.overallScore}/100`);

      // Call parent callback
      onFileSelected(file, quality);

      console.log('✅ File processed successfully');

    } catch (error) {
      console.error('❌ File processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'File processing failed';

      setFileState(prev => ({
        ...prev,
        isValidating: false,
        validation: {
          isValid: false,
          errors: [errorMessage],
          warnings: []
        }
      }));

      toast.error(errorMessage);
    }
  }, [validateFile, assessQuality, onFileSelected]);

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only stop dragging if leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setFileState(prev => ({ ...prev, isDragging: false }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setFileState(prev => ({ ...prev, isDragging: false }));

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /**
   * Handle file removal
   */
  const handleRemove = useCallback(() => {
    setFileState({
      file: null,
      isDragging: false,
      isValidating: false,
      isOptimizing: false,
      validation: { isValid: false, errors: [], warnings: [] },
      quality: null,
      preview: null
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (onFileRemoved) {
      onFileRemoved();
    }

    toast.info('File removed');
  }, [onFileRemoved]);

  /**
   * Render quality score badge
   */
  const renderQualityBadge = () => {
    if (!fileState.quality) return null;

    const score = fileState.quality.overallScore;
    const variant = score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive';
    const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
      <Badge variant={variant} className="ml-2">
        <span className={color}>Quality: {score}/100</span>
      </Badge>
    );
  };

  /**
   * Render validation messages
   */
  const renderValidationMessages = () => {
    if (fileState.isValidating) return null;

    const { errors, warnings } = fileState.validation;

    return (
      <>
        {errors.map((error, index) => (
          <Alert key={`error-${index}`} variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ))}

        {warnings.map((warning, index) => (
          <Alert key={`warning-${index}`} className="mt-2">
            <Info className="h-4 w-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}
      </>
    );
  };

  /**
   * Render quality recommendations
   */
  const renderRecommendations = () => {
    if (!fileState.quality || !fileState.quality.needsOptimization) return null;

    return (
      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Optimization Recommended
          </span>
        </div>
        <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
          {fileState.quality.recommendations.slice(0, 3).map((rec, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <span className="text-blue-500">•</span>
              <span>{rec}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Estimated processing time: {(fileState.quality.estimatedProcessingTime / 1000).toFixed(1)}s
        </div>
      </div>
    );
  };

  // Render component
  if (fileState.file && fileState.preview) {
    // File selected - show preview
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* File Preview */}
            <div className="flex items-start justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
                  <FileAudio className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{fileState.preview.name}</h3>
                    {fileState.isValidating && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    )}
                    {!fileState.isValidating && fileState.validation.isValid && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                    {!fileState.isValidating && !fileState.validation.isValid && (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    )}
                    {renderQualityBadge()}
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-muted-foreground">
                    <div>
                      <span className="text-xs text-muted-foreground/70">Size:</span>
                      <div>{fileState.preview.size}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground/70">Type:</span>
                      <div>{fileState.preview.type.split('/')[1]?.toUpperCase() || 'Unknown'}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground/70">Duration:</span>
                      <div>{fileState.preview.duration}</div>
                    </div>
                  </div>

                  {/* Quality Details */}
                  {fileState.quality && !fileState.isValidating && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-muted-foreground/20">
                      <div className="text-xs">
                        <span className="text-muted-foreground/70">Sample Rate:</span>
                        <div className="font-medium">{(fileState.quality.sampleRate / 1000).toFixed(1)}kHz</div>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground/70">Channels:</span>
                        <div className="font-medium">{fileState.quality.channels === 1 ? 'Mono' : 'Stereo'}</div>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground/70">Bitrate:</span>
                        <div className="font-medium">{(fileState.quality.bitrate / 1000).toFixed(0)}kbps</div>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground/70">SNR:</span>
                        <div className="font-medium">{fileState.quality.snr.toFixed(1)}dB</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Validation Messages */}
            {renderValidationMessages()}

            {/* Recommendations */}
            {renderRecommendations()}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No file selected - show drop zone
  return (
    <Card>
      <CardContent className="pt-6">
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${fileState.isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 scale-[1.02]'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`
              p-4 rounded-full transition-all duration-200
              ${fileState.isDragging
                ? 'bg-blue-100 dark:bg-blue-900 scale-110'
                : 'bg-muted'
              }
            `}>
              <Upload className={`w-8 h-8 ${fileState.isDragging ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">
                {fileState.isDragging ? 'Drop your audio file here' : 'Upload Audio File'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {fileState.isDragging
                  ? 'Release to select this file'
                  : 'Drag & drop or click to browse'
                }
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFormats.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
              />

              {!fileState.isDragging && (
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                Supported formats: MP3, WAV, M4A, OGG, FLAC, AAC
              </div>
              <div>
                Maximum file size: {maxFileSize}MB
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedFileUpload;
