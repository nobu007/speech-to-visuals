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
 *
 * Supported formats: MP3 (audio/mpeg), WAV (audio/wav), OGG (audio/ogg), M4A (audio/mp4, audio/x-m4a)
 * Max file size: 50MB (52428800 bytes)
 */

import React, { useState, useCallback, useRef, DragEvent } from 'react';
import { Upload, FileAudio, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// Default accepted MIME types per specification
export const DEFAULT_ACCEPTED_FORMATS = [
  'audio/mpeg',   // MP3
  'audio/wav',    // WAV
  'audio/ogg',    // OGG
  'audio/mp4',    // M4A
  'audio/x-m4a',  // M4A (alternate)
];

// 50MB in bytes
export const MAX_FILE_SIZE_BYTES = 52428800;
export const DEFAULT_MAX_SIZE_MB = 50;

// Valid audio file extensions
const VALID_EXTENSIONS = /\.(mp3|wav|ogg|m4a)$/i;

interface EnhancedFileUploaderProps {
  /** Callback invoked when a valid file is selected (via drop or click) */
  onFileSelect?: (file: File) => void;
  /** Alias for onFileSelect - callback invoked when a valid file is selected */
  onFileSelected?: (file: File) => void;
  /** List of accepted MIME types. Defaults to audio/mpeg, audio/wav, audio/ogg, audio/mp4, audio/x-m4a */
  acceptedFormats?: string[];
  /** Maximum file size in MB. Defaults to 50 */
  maxSizeMB?: number;
  /** Whether the uploader is disabled */
  disabled?: boolean;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  file?: File;
}

/**
 * Standalone file validation function (exported for testing).
 * Validates file MIME type, extension, and size.
 */
export function validateAudioFile(
  file: File,
  acceptedFormats: string[] = DEFAULT_ACCEPTED_FORMATS,
  maxSizeMB: number = DEFAULT_MAX_SIZE_MB
): FileValidationResult {
  // Check file type by MIME and extension
  const isMimeTypeAccepted = acceptedFormats.includes(file.type);
  const isExtensionValid = VALID_EXTENSIONS.test(file.name);

  if (!isMimeTypeAccepted && !isExtensionValid) {
    return {
      isValid: false,
      error: `サポートされていないファイル形式です。\n対応形式: MP3, WAV, OGG, M4A`
    };
  }

  // Check file size (convert maxSizeMB to bytes for precise comparison)
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const fileSizeMB = file.size / (1024 * 1024);
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
}

export const EnhancedFileUploader: React.FC<EnhancedFileUploaderProps> = ({
  onFileSelect,
  onFileSelected,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Resolve callback: support both onFileSelect and onFileSelected
  const handleFileCallback = useCallback((file: File) => {
    onFileSelect?.(file);
    onFileSelected?.(file);
  }, [onFileSelect, onFileSelected]);

  // Handle file selection with validation and progress
  const handleFileSelection = useCallback((file: File) => {
    setValidationError(null);
    setIsProcessing(true);
    setUploadProgress(0);

    // Simulate progressive upload animation
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 50);

    // Validate file after brief delay for UX
    setTimeout(() => {
      const validation = validateAudioFile(file, acceptedFormats, maxSizeMB);

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
      handleFileCallback(file);
    }, 500);
  }, [acceptedFormats, maxSizeMB, handleFileCallback]);

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
      handleFileSelection(files[0]);
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
            relative border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer
            transition-all duration-300 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
            min-h-[120px] sm:min-h-0
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
          <div className="flex flex-col items-center justify-center space-y-2 sm:space-y-4">
            {isProcessing ? (
              <Loader2 className="w-10 h-10 sm:w-16 sm:h-16 text-primary animate-spin" aria-hidden="true" />
            ) : selectedFile ? (
              <CheckCircle className="w-10 h-10 sm:w-16 sm:h-16 text-green-600 animate-bounce" aria-hidden="true" />
            ) : validationError ? (
              <AlertCircle className="w-10 h-10 sm:w-16 sm:h-16 text-red-600 animate-pulse" aria-hidden="true" />
            ) : (
              <Upload
                className={`w-10 h-10 sm:w-16 sm:h-16 transition-transform duration-300 ${
                  isDragging ? 'text-primary scale-110 animate-bounce' : 'text-muted-foreground'
                }`}
                aria-hidden="true"
              />
            )}

            {/* Status text */}
            <div className="space-y-1 sm:space-y-2">
              {selectedFile ? (
                <>
                  <h3 className="text-sm sm:text-lg font-semibold text-green-700 dark:text-green-300 flex items-center gap-1 sm:gap-2 justify-center">
                    <FileAudio className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none">{selectedFile.name}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                    サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetUploader();
                    }}
                    className="mt-1 sm:mt-2 min-h-[44px]"
                  >
                    <X className="w-4 h-4 mr-1 sm:mr-2" />
                    別のファイルを選択
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base sm:text-lg font-semibold">
                    {isDragging
                      ? 'ファイルをドロップしてアップロード'
                      : '音声ファイルをアップロード'}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {isDragging
                      ? 'ここにファイルをドロップ'
                      : 'クリックしてファイルを選択、またはドラッグ&ドロップ'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-2">
                    対応形式: MP3, WAV, OGG, M4A (最大 {maxSizeMB}MB)
                  </p>
                </>
              )}
            </div>

            {/* Progress bar */}
            {isProcessing && (
              <div className="w-full max-w-[200px] sm:max-w-xs space-y-1 sm:space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  ファイルを検証中... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-primary text-lg sm:text-2xl font-bold animate-pulse">
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
