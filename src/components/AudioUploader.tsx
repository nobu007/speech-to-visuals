import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { bytesToMb } from '@/lib/metrics-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { validateAudioFile, validateAudioDuration } from '@/utils/audio-validation';
import { logger } from '@/utils/logger';

type AudioUploaderProps = {
  onUpload: (file: File) => void;
  isProcessing: boolean;
};

/**
 * Extract audio duration from a File using the browser Audio API.
 * Returns the duration in seconds.
 */
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    };
    audio.src = url;
  });
}

export const AudioUploader = memo(({ onUpload, isProcessing }: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // TASK-0220 sibling (REQ-300): async-setState-after-unmount guard.
  // `validateAndSelect` awaits `getAudioDuration` (browser metadata parse via
  // `new Audio()` + `onloadedmetadata`), which is non-trivial for large files.
  // If the user navigates away before it resolves, a naive post-await
  // setSelectedFile/validation-toast would fire on an unmounted component.
  // `mountedRef` is the single "still alive" flag; flip it in the unmount
  // cleanup and gate every post-await side effect on it. Mirrors the reference
  // pattern in InteractiveResultViewer.tsx / VideoRenderer.tsx.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const validateAndSelect = useCallback(async (file: File) => {
    // File-level validation (sync)
    const fileResult = validateAudioFile(file);
    if (!fileResult.valid) {
      fileResult.errors.forEach(err => toast.error(err));
      return;
    }
    fileResult.warnings.forEach(w => toast.warning(w));

    // Duration validation (async)
    try {
      const duration = await getAudioDuration(file);
      // Unmounted while the metadata parse was in flight: skip ALL post-await
      // work — no stray validation toasts for an abandoned file and no
      // setState on an unmounted component.
      if (!mountedRef.current) return;
      const durationResult = validateAudioDuration(duration);
      if (!durationResult.valid) {
        durationResult.errors.forEach(err => toast.error(err));
        return;
      }
      durationResult.warnings.forEach(w => toast.warning(w));
    } catch (error) {
      logger.warn('[AudioUploader] Could not determine audio duration, skipping duration validation:', error);
    }

    // Reachable from the catch fallthrough too; guard the setState.
    if (mountedRef.current) {
      setSelectedFile(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f => f.type.startsWith('audio/'));

    if (audioFile) {
      validateAndSelect(audioFile);
    } else {
      toast.error('音声ファイルを選択してください');
    }
  }, [validateAndSelect]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  }, [validateAndSelect]);

  const handleUpload = useCallback(() => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  }, [selectedFile, onUpload]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleCancelFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto p-8 bg-card shadow-lg">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-12 transition-all duration-300',
          isDragging
            ? 'border-primary bg-primary/5 scale-105'
            : 'border-border hover:border-primary/50',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isProcessing}
        />

        <div className="flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
            <div className="relative bg-gradient-to-br from-primary to-primary-glow p-6 rounded-2xl">
              {selectedFile ? (
                <FileAudio className="w-12 h-12 text-primary-foreground" />
              ) : (
                <Upload className="w-12 h-12 text-primary-foreground" />
              )}
            </div>
          </div>

          {selectedFile ? (
            <div className="text-center space-y-3">
              <p className="text-lg font-semibold text-foreground">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                サイズ: {bytesToMb(selectedFile.size).toFixed(2)} MB
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={handleCancelFile}
                  disabled={isProcessing}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
                >
                  処理を開始
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold text-foreground">
                音声ファイルをアップロード
              </h3>
              <p className="text-muted-foreground max-w-md">
                ドラッグ&ドロップ、またはクリックしてファイルを選択
              </p>
              <Button
                variant="outline"
                onClick={handleFileClick}
                disabled={isProcessing}
                className="mt-4"
              >
                ファイルを選択
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});
