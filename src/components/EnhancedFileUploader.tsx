/**
 * Enhanced File Uploader Component with Drag-and-Drop
 * Phase 15: UI/UX Improvements
 *
 * Features:
 * - Visual drag-and-drop feedback
 * - File validation with clear error messages
 * - Progressive file upload animation
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Mobile-optimized touch support
 */

import React, { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface EnhancedFileUploaderProps {
  onFileSelect: (file: File) => void;
  acceptedFormats?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
}

interface FileValidationResult {
  isValid: boolean;
  error?: string;
  file?: File;
}

export const EnhancedFileUploader: React.FC<EnhancedFileUploaderProps> = ({
  onFileSelect,
  acceptedFormats = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'],
  maxSizeMB = 50,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // File validation
  const validateFile = useCallback((file: File): FileValidationResult => {
    // Check file type
    if (!acceptedFormats.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      return {
        isValid: false,
        error: `サポートされていないファイル形式です。\n対応形式: MP3, WAV, OGG, M4A`
      };
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      return {
        isValid: false,
        error: `ファイルサイズが制限を超えています。\n最大サイズ: ${maxSizeMB}MB (現在: ${fileSizeMB.toFixed(2)}MB)`
      };
    }

    // Check if file is empty
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'ファイルが空です。有効な音声ファイルを選択してください。'
      };
    }

    return {
      isValid: true,
      file
    };
  }, [acceptedFormats, maxSizeMB]);

  // Handle file selection
  const handleFileSelection = useCallback((file: File) => {
    setValidationError(null);
    setIsProcessing(true);

    // Simulate progressive upload animation
    setUploadProgress(0);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 50);

    // Validate file
    setTimeout(() => {
      const validation = validateFile(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!validation.isValid) {
        setValidationError(validation.error || 'ファイルの検証に失敗しました');
        setIsProcessing(false);
        toast.error(validation.error || 'ファイルの検証に失敗しました');
        return;
      }

      setSelectedFile(file);
      setIsProcessing(false);
      toast.success(`ファイル「${file.name}」が正常に読み込まれました`);
      onFileSelect(file);
    }, 500);
  }, [validateFile, onFileSelect]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Only set dragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      handleFileSelection(file);
    } else {
      toast.error('ファイルが見つかりません');
    }
  }, [disabled, handleFileSelection]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  // Open file picker
  const openFilePicker = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  // Reset uploader
  const resetUploader = useCallback(() => {
    setSelectedFile(null);
    setValidationError(null);
    setUploadProgress(0);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Keyboard navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  }, [openFilePicker]);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFilePicker}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="音声ファイルをアップロードするエリア。クリックまたはファイルをドラッグ&ドロップしてください"
          aria-disabled={disabled}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-300 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
            ${isDragging
              ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg'
              : selectedFile
              ? 'border-green-500 bg-green-50 dark:bg-green-950'
              : validationError
              ? 'border-red-500 bg-red-50 dark:bg-red-950'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleFileInputChange}
            disabled={disabled}
            className="hidden"
            aria-label="音声ファイルを選択"
          />

          {/* Upload icon with animation */}
          <div className="flex flex-col items-center justify-center space-y-4">
            {isProcessing ? (
              <Loader2 className="w-16 h-16 text-primary animate-spin" aria-hidden="true" />
            ) : selectedFile ? (
              <CheckCircle className="w-16 h-16 text-green-600 animate-bounce" aria-hidden="true" />
            ) : validationError ? (
              <AlertCircle className="w-16 h-16 text-red-600 animate-pulse" aria-hidden="true" />
            ) : (
              <Upload
                className={`w-16 h-16 transition-transform duration-300 ${
                  isDragging ? 'text-primary scale-110 animate-bounce' : 'text-muted-foreground'
                }`}
                aria-hidden="true"
              />
            )}

            {/* Status text */}
            <div className="space-y-2">
              {selectedFile ? (
                <>
                  <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 flex items-center gap-2 justify-center">
                    <FileAudio className="w-5 h-5" />
                    {selectedFile.name}
                  </h3>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUploader();
                    }}
                    className="mt-2"
                  >
                    <X className="w-4 h-4 mr-2" />
                    別のファイルを選択
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">
                    {isDragging
                      ? 'ファイルをドロップしてアップロード'
                      : '音声ファイルをアップロード'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isDragging
                      ? 'ここにファイルをドロップ'
                      : 'クリックしてファイルを選択、またはドラッグ&ドロップ'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    対応形式: MP3, WAV, OGG, M4A (最大 {maxSizeMB}MB)
                  </p>
                </>
              )}
            </div>

            {/* Progress bar */}
            {isProcessing && (
              <div className="w-full max-w-xs space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  ファイルを検証中... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-primary text-2xl font-bold animate-pulse">
                ドロップしてアップロード
              </div>
            </div>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-line">
              {validationError}
            </AlertDescription>
          </Alert>
        )}

        {/* Accessibility hints */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          <p>
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd> または{' '}
            <kbd className="px-2 py-1 bg-muted rounded text-xs">Space</kbd> でファイルを選択
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedFileUploader;
