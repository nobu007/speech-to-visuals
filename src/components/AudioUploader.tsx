import { useState, useRef } from 'react';
import { Upload, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type AudioUploaderProps = {
  onUpload: (file: File) => void;
  isProcessing: boolean;
};

export const AudioUploader = ({ onUpload, isProcessing }: AudioUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(f => f.type.startsWith('audio/'));
    
    if (audioFile) {
      setSelectedFile(audioFile);
    } else {
      toast.error('音声ファイルを選択してください');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
      setSelectedFile(null);
    }
  };

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
                サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
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
                onClick={() => fileInputRef.current?.click()}
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
};
