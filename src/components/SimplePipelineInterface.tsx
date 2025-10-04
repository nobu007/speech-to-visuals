import React, { useState, useRef } from 'react';
import { Upload, Play, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { simplePipeline, SimplePipelineResult } from '@/pipeline/simple-pipeline';
import { SceneGraph } from '@/types/diagram';
import { toast } from 'sonner';

interface ProcessingStep {
  name: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export const SimplePipelineInterface: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SimplePipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processingSteps: ProcessingStep[] = [
    { name: 'Audio Upload', progress: 10, status: 'pending' },
    { name: 'Transcription', progress: 30, status: 'pending' },
    { name: 'Scene Analysis', progress: 60, status: 'pending' },
    { name: 'Diagram Generation', progress: 80, status: 'pending' },
    { name: 'Layout Optimization', progress: 100, status: 'pending' }
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mpeg'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('サポートされていないファイル形式です。MP3, WAV, OGG, M4A形式をご利用ください。');
        return;
      }

      // Validate file size (max 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error('ファイルサイズが大きすぎます。50MB以下のファイルをご利用ください。');
        return;
      }

      setFile(selectedFile);
      setError(null);
      setResult(null);
      toast.success(`ファイル「${selectedFile.name}」が選択されました`);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error('音声ファイルを選択してください');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentStep('処理を開始しています...');

    try {
      console.log('🚀 Starting pipeline processing with SimplePipeline');

      const result = await simplePipeline.processWithRetry(
        { audioFile: file },
        (step: string, progressValue: number) => {
          setCurrentStep(step);
          setProgress(progressValue);
          console.log(`📊 Progress: ${step} (${progressValue}%)`);
        },
        3 // max retries
      );

      if (result.success) {
        setResult(result);
        setCurrentStep('処理完了！');
        setProgress(100);
        toast.success(`処理が完了しました！${result.scenes?.length || 0}個のシーンが生成されました。`);

        console.log('✅ Pipeline processing completed successfully:', {
          processingTime: result.processingTime,
          sceneCount: result.scenes?.length,
          transcriptLength: result.transcript?.length
        });
      } else {
        throw new Error(result.error || '処理に失敗しました');
      }

    } catch (error) {
      console.error('❌ Pipeline processing failed:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResults = () => {
    if (!result) return;

    const data = {
      timestamp: new Date().toISOString(),
      file: file?.name,
      processingTime: result.processingTime,
      transcript: result.transcript,
      scenes: result.scenes,
      summary: {
        sceneCount: result.scenes?.length || 0,
        averageConfidence: result.scenes?.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / (result.scenes?.length || 1)
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech-to-visuals-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('結果をダウンロードしました');
  };

  const resetPipeline = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setCurrentStep('');
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Simple Pipeline - 音声から図解動画への変換
          </CardTitle>
          <CardDescription>
            音声ファイルをアップロードして、自動的に図解付きの構造化されたシーンを生成します
          </CardDescription>
        </CardHeader>
      </Card>

      {/* File Upload */}
      {!file && !isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">音声ファイルをアップロード</h3>
              <p className="text-sm text-muted-foreground mb-4">
                MP3, WAV, OGG, M4A形式 (最大50MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                ファイルを選択
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Info and Process Button */}
      {file && !isProcessing && !result && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{file.name}</h3>
                <p className="text-sm text-muted-foreground">
                  サイズ: {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetPipeline}>
                  キャンセル
                </Button>
                <Button onClick={handleProcess}>
                  <Play className="w-4 h-4 mr-2" />
                  処理開始
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium">処理中...</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>

              {/* Step indicators */}
              <div className="grid grid-cols-5 gap-2">
                {processingSteps.map((step, index) => (
                  <div key={index} className="text-center">
                    <div className={`w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-medium
                      ${progress >= step.progress
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                      {progress >= step.progress ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {result && result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              処理完了
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{result.scenes?.length || 0}</div>
                <div className="text-sm text-muted-foreground">生成シーン</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {result.processingTime ? Math.round(result.processingTime / 1000) : 0}s
                </div>
                <div className="text-sm text-muted-foreground">処理時間</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {result.transcript?.split(' ').length || 0}
                </div>
                <div className="text-sm text-muted-foreground">単語数</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {result.scenes ?
                    Math.round((result.scenes.reduce((acc, scene) => acc + (scene.confidence || 0), 0) / result.scenes.length) * 100)
                    : 0}%
                </div>
                <div className="text-sm text-muted-foreground">平均信頼度</div>
              </div>
            </div>

            {/* Transcript Preview */}
            {result.transcript && (
              <div>
                <h4 className="font-medium mb-2">文字起こし結果</h4>
                <div className="p-3 bg-muted rounded-lg text-sm max-h-32 overflow-y-auto">
                  {result.transcript}
                </div>
              </div>
            )}

            {/* Scenes Preview */}
            {result.scenes && result.scenes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">生成されたシーン</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {result.scenes.map((scene, index) => (
                    <div key={scene.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium">シーン {index + 1}: {scene.type}</span>
                        <span className="text-sm text-muted-foreground">
                          信頼度: {Math.round((scene.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {scene.content.substring(0, 100)}
                        {scene.content.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={downloadResults}>
                <Download className="w-4 h-4 mr-2" />
                結果をダウンロード
              </Button>
              <Button variant="outline" onClick={resetPipeline}>
                新しいファイルを処理
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimplePipelineInterface;