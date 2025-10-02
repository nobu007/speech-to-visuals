import { Composition } from 'remotion';
import { DiagramVideo } from './DiagramVideo';
import { SceneGraph } from '@/types/diagram';

export interface VideoProps {
  scenes: SceneGraph[];
  audioUrl: string;
  totalDuration: number;
}

export const RemotionRoot: React.FC = () => {
  // Test data for preview
  const testScenes: SceneGraph[] = [
    {
      type: 'flow',
      nodes: [
        { id: 'start', label: 'プロジェクト開始' },
        { id: 'plan', label: '計画立案' },
        { id: 'execute', label: '実行' },
        { id: 'review', label: 'レビュー' },
        { id: 'complete', label: '完了' }
      ],
      edges: [
        { from: 'start', to: 'plan' },
        { from: 'plan', to: 'execute' },
        { from: 'execute', to: 'review' },
        { from: 'review', to: 'complete' }
      ],
      layout: {
        nodes: [
          { id: 'start', label: 'プロジェクト開始', x: 150, y: 400, w: 200, h: 80 },
          { id: 'plan', label: '計画立案', x: 430, y: 400, w: 200, h: 80 },
          { id: 'execute', label: '実行', x: 710, y: 400, w: 200, h: 80 },
          { id: 'review', label: 'レビュー', x: 990, y: 400, w: 200, h: 80 },
          { id: 'complete', label: '完了', x: 1270, y: 400, w: 200, h: 80 }
        ],
        edges: [
          { from: 'start', to: 'plan', points: [{ x: 350, y: 440 }, { x: 430, y: 440 }] },
          { from: 'plan', to: 'execute', points: [{ x: 630, y: 440 }, { x: 710, y: 440 }] },
          { from: 'execute', to: 'review', points: [{ x: 910, y: 440 }, { x: 990, y: 440 }] },
          { from: 'review', to: 'complete', points: [{ x: 1190, y: 440 }, { x: 1270, y: 440 }] }
        ]
      },
      startMs: 0,
      durationMs: 8000,
      summary: 'プロジェクトの進行フロー',
      keyphrases: ['開始', '計画', '実行', 'レビュー', '完了']
    },
    {
      type: 'tree',
      nodes: [
        { id: 'root', label: 'システム構成' },
        { id: 'frontend', label: 'フロントエンド' },
        { id: 'backend', label: 'バックエンド' },
        { id: 'database', label: 'データベース' }
      ],
      edges: [
        { from: 'root', to: 'frontend' },
        { from: 'root', to: 'backend' },
        { from: 'root', to: 'database' }
      ],
      layout: {
        nodes: [
          { id: 'root', label: 'システム構成', x: 960, y: 200, w: 280, h: 80 },
          { id: 'frontend', label: 'フロントエンド', x: 640, y: 450, w: 260, h: 70 },
          { id: 'backend', label: 'バックエンド', x: 960, y: 450, w: 260, h: 70 },
          { id: 'database', label: 'データベース', x: 1280, y: 450, w: 260, h: 70 }
        ],
        edges: [
          { from: 'root', to: 'frontend', points: [{ x: 960, y: 280 }, { x: 640, y: 450 }] },
          { from: 'root', to: 'backend', points: [{ x: 960, y: 280 }, { x: 960, y: 450 }] },
          { from: 'root', to: 'database', points: [{ x: 960, y: 280 }, { x: 1280, y: 450 }] }
        ]
      },
      startMs: 8000,
      durationMs: 6000,
      summary: 'システム全体の構成要素',
      keyphrases: ['システム', 'フロントエンド', 'バックエンド', 'データベース']
    },
    {
      type: 'cycle',
      nodes: [
        { id: 'plan', label: 'Plan' },
        { id: 'do', label: 'Do' },
        { id: 'check', label: 'Check' },
        { id: 'act', label: 'Act' }
      ],
      edges: [
        { from: 'plan', to: 'do' },
        { from: 'do', to: 'check' },
        { from: 'check', to: 'act' },
        { from: 'act', to: 'plan' }
      ],
      layout: {
        nodes: [
          { id: 'plan', label: 'Plan', x: 960, y: 140, w: 200, h: 70 },
          { id: 'do', label: 'Do', x: 1220, y: 400, w: 200, h: 70 },
          { id: 'check', label: 'Check', x: 960, y: 660, w: 200, h: 70 },
          { id: 'act', label: 'Act', x: 700, y: 400, w: 200, h: 70 }
        ],
        edges: [
          { from: 'plan', to: 'do', points: [{ x: 960, y: 140 }, { x: 1220, y: 400 }] },
          { from: 'do', to: 'check', points: [{ x: 1220, y: 400 }, { x: 960, y: 660 }] },
          { from: 'check', to: 'act', points: [{ x: 960, y: 660 }, { x: 700, y: 400 }] },
          { from: 'act', to: 'plan', points: [{ x: 700, y: 400 }, { x: 960, y: 140 }] }
        ]
      },
      startMs: 14000,
      durationMs: 7000,
      summary: 'PDCAサイクルの継続的改善',
      keyphrases: ['Plan', 'Do', 'Check', 'Act', 'PDCA']
    }
  ];

  const totalDuration = testScenes.reduce((acc, scene) => acc + scene.durationMs, 0);
  const totalFrames = Math.ceil((totalDuration / 1000) * 30);

  return (
    <>
      <Composition
        id="DiagramVideo"
        component={DiagramVideo}
        durationInFrames={totalFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          scenes: testScenes,
          audioUrl: '',
          totalDuration: totalDuration,
        } as VideoProps}
      />
    </>
  );
};