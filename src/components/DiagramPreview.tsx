import { SceneGraph } from '@/types/diagram';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Download } from 'lucide-react';

type DiagramPreviewProps = {
  scenes: SceneGraph[];
  onRender: () => void;
  isRendering: boolean;
};

const typeLabels = {
  flow: 'フローチャート',
  tree: 'ツリー構造',
  timeline: 'タイムライン',
  matrix: 'マトリクス',
  cycle: 'サイクル図',
};

const typeColors = {
  flow: 'bg-[hsl(var(--diagram-flow))]',
  tree: 'bg-[hsl(var(--diagram-tree))]',
  timeline: 'bg-[hsl(var(--diagram-timeline))]',
  matrix: 'bg-[hsl(var(--diagram-matrix))]',
  cycle: 'bg-[hsl(var(--diagram-cycle))]',
};

export const DiagramPreview = ({ scenes, onRender, isRendering }: DiagramPreviewProps) => {
  const totalDuration = scenes.reduce((acc, s) => acc + s.durationMs, 0);
  const minutes = Math.floor(totalDuration / 60000);
  const seconds = Math.floor((totalDuration % 60000) / 1000);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <Card className="p-6 bg-card shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">生成された図解</h2>
            <p className="text-muted-foreground mt-1">
              {scenes.length}個のシーン・合計 {minutes}分{seconds}秒
            </p>
          </div>
          <Button
            onClick={onRender}
            disabled={isRendering}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary-glow hover:shadow-glow"
          >
            {isRendering ? (
              <>
                <Play className="w-5 h-5 mr-2 animate-spin" />
                レンダリング中...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                動画を出力
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4">
          {scenes.map((scene, idx) => (
            <Card key={idx} className="p-5 border-2 border-border hover:border-primary/50 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-xl ${typeColors[scene.type]} flex items-center justify-center text-white font-bold text-lg`}>
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs font-semibold">
                      {typeLabels[scene.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(scene.durationMs / 1000).toFixed(1)}秒
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{scene.summary}</h3>
                  <div className="flex flex-wrap gap-2">
                    {scene.keyphrases.map((phrase, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {scene.nodes.length}個のノード・{scene.edges.length}個のエッジ
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
