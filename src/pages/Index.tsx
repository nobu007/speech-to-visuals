import { useState } from 'react';
import { AudioUploader } from '@/components/AudioUploader';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { DiagramPreview } from '@/components/DiagramPreview';
import { VideoRenderer } from '@/components/VideoRenderer';
import { PipelineInterface } from '@/components/pipeline-interface';
import { ProcessingStatus as StatusType, ProcessingResult } from '@/types/diagram';
import { MainPipeline } from '@/pipeline';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

const Index = () => {
  const [status, setStatus] = useState<StatusType>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [useNewPipeline, setUseNewPipeline] = useState(true);

  const handleUpload = async (file: File) => {
    try {
      setStatus('uploading');
      setProgress(10);
      setCurrentStep('ファイルをアップロード中...');

      // Upload to storage (anonymous upload)
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('ファイルのアップロードに失敗しました');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);

      console.log('File uploaded:', publicUrl);

      setStatus('transcribing');
      setProgress(30);
      setCurrentStep('音声を文字起こし中...');

      // Call transcription function
      const transcriptResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioUrl: publicUrl }),
        }
      );

      if (!transcriptResponse.ok) {
        throw new Error('文字起こしに失敗しました');
      }

      const transcriptData = await transcriptResponse.json();
      console.log('Transcription complete:', transcriptData);

      setStatus('analyzing');
      setProgress(60);
      setCurrentStep('内容を分析中...');

      // Call scene generation function
      const scenesResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scenes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transcript: transcriptData.transcript }),
        }
      );

      if (!scenesResponse.ok) {
        throw new Error('シーン生成に失敗しました');
      }

      const scenesData = await scenesResponse.json();
      console.log('Scenes generated:', scenesData);

      setStatus('generating');
      setProgress(90);
      setCurrentStep('図解を生成中...');

      // Simulate final processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      setResult({
        scenes: scenesData.scenes,
        audioUrl: publicUrl,
        duration: transcriptData.duration || 0,
      });

      setStatus('complete');
      setProgress(100);
      toast.success('図解の生成が完了しました！');

    } catch (error) {
      console.error('Processing error:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : '処理中にエラーが発生しました';
      toast.error(errorMessage);
    }
  };

  const handleRender = async () => {
    // This will be handled by the VideoRenderer component now
    toast.info('動画レンダリングコンポーネントをご利用ください');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-12 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-primary">AI解説図解ジェネレーター</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            音声から自動で図解を生成
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            解説音声をアップロードすると、AIが内容を分析し、
            <br />
            わかりやすい図解レイアウトを自動生成します
          </p>
        </div>

        {/* Main Content */}
        {useNewPipeline ? (
          <PipelineInterface />
        ) : (
          <>
            {status === 'idle' && (
              <AudioUploader onUpload={handleUpload} isProcessing={false} />
            )}

            {(status !== 'idle' && status !== 'complete') && (
              <ProcessingStatus
                status={status}
                progress={progress}
                currentStep={currentStep}
              />
            )}

            {result && status === 'complete' && (
              <>
                <DiagramPreview
                  scenes={result.scenes}
                  onRender={handleRender}
                  isRendering={false}
                />
                <VideoRenderer
                  scenes={result.scenes}
                  audioUrl={result.audioUrl}
                />
              </>
            )}
          </>
        )}

        {/* Features */}
        {status === 'idle' && (
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {[
              {
                title: '自動文字起こし',
                description: 'AIが音声を高精度で文字起こし',
                icon: '🎤',
              },
              {
                title: 'シーン分割',
                description: 'トピックごとに自動で段落を抽出',
                icon: '✂️',
              },
              {
                title: '図解生成',
                description: 'フロー・ツリー・タイムラインなど最適な図を選択',
                icon: '📊',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-md"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
