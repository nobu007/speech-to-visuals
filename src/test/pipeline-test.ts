import { SceneGraph, DiagramType } from '@/types/diagram';

// Test data generator
export function generateTestScenes(): SceneGraph[] {
  const testScenes: SceneGraph[] = [
    {
      type: 'flow' as DiagramType,
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
      type: 'tree' as DiagramType,
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
      type: 'cycle' as DiagramType,
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

  return testScenes;
}

export function testVideoRenderData() {
  const scenes = generateTestScenes();
  const totalDuration = scenes.reduce((acc, scene) => acc + scene.durationMs, 0);

  return {
    scenes,
    audioUrl: 'https://example.com/test-audio.mp3',
    totalDuration,
    metadata: {
      sceneCount: scenes.length,
      estimatedFrames: Math.ceil((totalDuration / 1000) * 30),
      diagramTypes: [...new Set(scenes.map(s => s.type))],
      createdAt: new Date().toISOString()
    }
  };
}

// Test functions
export function validateSceneData(scene: SceneGraph): string[] {
  const errors: string[] = [];

  if (!scene.type) errors.push('Scene type is required');
  if (!scene.nodes || scene.nodes.length === 0) errors.push('Scene must have at least one node');
  if (!scene.summary) errors.push('Scene summary is required');
  if (scene.durationMs <= 0) errors.push('Scene duration must be positive');
  if (scene.startMs < 0) errors.push('Scene start time cannot be negative');

  // Validate node references in edges
  const nodeIds = new Set(scene.nodes.map(n => n.id));
  scene.edges.forEach((edge, idx) => {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge ${idx}: 'from' node '${edge.from}' not found`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge ${idx}: 'to' node '${edge.to}' not found`);
    }
  });

  return errors;
}

export function validateAllScenes(scenes: SceneGraph[]): { isValid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  scenes.forEach((scene, idx) => {
    const errors = validateSceneData(scene);
    if (errors.length > 0) {
      allErrors.push(`Scene ${idx + 1}:`, ...errors.map(e => `  - ${e}`));
    }
  });

  // Check for timing overlaps
  for (let i = 0; i < scenes.length - 1; i++) {
    const current = scenes[i];
    const next = scenes[i + 1];
    const currentEnd = current.startMs + current.durationMs;

    if (currentEnd > next.startMs) {
      allErrors.push(`Timing overlap between scene ${i + 1} and ${i + 2}`);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

// Console test runner
export function runPipelineTests() {
  console.log('🧪 Running Speech-to-Visuals Pipeline Tests...\n');

  // Test 1: Generate test data
  console.log('Test 1: Generate test scenes');
  const testData = testVideoRenderData();
  console.log(`✅ Generated ${testData.scenes.length} test scenes`);
  console.log(`📊 Total duration: ${testData.totalDuration}ms`);
  console.log(`🎬 Estimated frames: ${testData.metadata.estimatedFrames}`);
  console.log(`📈 Diagram types: ${testData.metadata.diagramTypes.join(', ')}\n`);

  // Test 2: Validate scene data
  console.log('Test 2: Validate scene data');
  const validation = validateAllScenes(testData.scenes);
  if (validation.isValid) {
    console.log('✅ All scenes are valid\n');
  } else {
    console.log('❌ Scene validation errors:');
    validation.errors.forEach(error => console.log(`  ${error}`));
    console.log();
  }

  // Test 3: Check Remotion compatibility
  console.log('Test 3: Check Remotion compatibility');
  const fps = 30;
  const totalFrames = Math.ceil((testData.totalDuration / 1000) * fps);
  console.log(`✅ FPS: ${fps}, Total frames: ${totalFrames}`);

  testData.scenes.forEach((scene, idx) => {
    const startFrame = Math.floor((scene.startMs / 1000) * fps);
    const durationFrames = Math.floor((scene.durationMs / 1000) * fps);
    console.log(`  Scene ${idx + 1}: frames ${startFrame}-${startFrame + durationFrames} (${durationFrames} frames)`);
  });
  console.log();

  // Test 4: Layout validation
  console.log('Test 4: Layout validation');
  testData.scenes.forEach((scene, idx) => {
    if (scene.layout) {
      const layoutNodes = scene.layout.nodes.length;
      const layoutEdges = scene.layout.edges.length;
      console.log(`  Scene ${idx + 1}: ${layoutNodes} positioned nodes, ${layoutEdges} layout edges`);
    } else {
      console.log(`  Scene ${idx + 1}: No layout (will use default positioning)`);
    }
  });

  console.log('\n🎉 Pipeline tests completed!');
  return testData;
}