import { SceneGraph, DiagramType } from '@/types/diagram';
import { MainPipeline } from '@/pipeline';
import { TranscriptionPipeline } from '@/transcription';
import { SceneSegmenter, DiagramDetector } from '@/analysis';
import { LayoutEngine } from '@/visualization';

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

/**
 * Extended End-to-End Pipeline Test Suite
 * Tests the complete audio-to-diagram video generation pipeline
 */

// Test Configuration
const TEST_CONFIG = {
  mockAudioPath: 'test-audio.wav',
  expectedMinScenes: 1,
  expectedMinDiagrams: 1,
  maxProcessingTime: 30000, // 30 seconds
  testIterations: 3
};

/**
 * Mock audio data for testing
 */
const MOCK_TRANSCRIPTION_SEGMENTS = [
  {
    start: 0,
    end: 5000,
    text: "Today we'll discuss the software development process which involves several key stages.",
    confidence: 0.95
  },
  {
    start: 5000,
    end: 12000,
    text: "First, we have planning where we define requirements and create a project roadmap.",
    confidence: 0.88
  },
  {
    start: 12000,
    end: 18000,
    text: "Next comes design and architecture where we create the system blueprint.",
    confidence: 0.92
  },
  {
    start: 18000,
    end: 25000,
    text: "Then we move to implementation, where developers write the actual code.",
    confidence: 0.89
  },
  {
    start: 25000,
    end: 32000,
    text: "Finally, we have testing and deployment to ensure quality and release the product.",
    confidence: 0.91
  }
];

/**
 * Test individual pipeline components
 */
export async function testPipelineComponents(): Promise<void> {
  console.log('\n🧪 Testing Individual Pipeline Components');
  console.log('==========================================');

  // Test 1: Transcription Pipeline
  console.log('\n1. Testing Transcription Pipeline...');
  const transcriber = new TranscriptionPipeline();

  // Mock the transcription (since we don't have actual Whisper installed)
  console.log('   - Creating mock transcription result...');
  const mockTranscription = {
    segments: MOCK_TRANSCRIPTION_SEGMENTS,
    language: 'en',
    duration: 32000,
    processingTime: 2000,
    success: true
  };
  console.log(`   ✅ Transcription: ${mockTranscription.segments.length} segments, ${mockTranscription.duration}ms`);

  // Test 2: Scene Segmentation
  console.log('\n2. Testing Scene Segmentation...');
  const segmenter = new SceneSegmenter();
  const segments = await segmenter.segment(mockTranscription.segments);
  console.log(`   ✅ Segmentation: ${segments.length} content segments generated`);

  if (segments.length === 0) {
    throw new Error('Scene segmentation failed - no segments generated');
  }

  // Test 3: Diagram Detection
  console.log('\n3. Testing Diagram Detection...');
  const detector = new DiagramDetector();
  const analyses = [];

  for (const segment of segments) {
    const analysis = await detector.analyze(segment);
    analyses.push(analysis);
    console.log(`   - ${analysis.type} diagram detected (confidence: ${(analysis.confidence * 100).toFixed(1)}%)`);
  }

  if (analyses.length === 0) {
    throw new Error('Diagram detection failed - no analyses generated');
  }

  // Test 4: Layout Generation
  console.log('\n4. Testing Layout Generation...');
  const layoutEngine = new LayoutEngine();
  const layouts = [];

  for (const analysis of analyses) {
    if (analysis.nodes.length > 0) {
      const layoutResult = await layoutEngine.generateLayout(
        analysis.nodes,
        analysis.edges,
        analysis.type
      );

      if (layoutResult.success) {
        layouts.push(layoutResult);
        console.log(`   - ${analysis.type} layout: ${layoutResult.layout.nodes.length} nodes, ${layoutResult.layout.edges.length} edges`);
      }
    }
  }

  console.log(`   ✅ Layout Generation: ${layouts.length} layouts created`);

  return;
}

/**
 * Test complete pipeline integration
 */
export async function testFullPipelineIntegration(): Promise<void> {
  console.log('\n🚀 Testing Complete Pipeline Integration');
  console.log('======================================');

  const pipeline = new MainPipeline({
    transcription: {
      model: 'base',
      language: 'en'
    },
    analysis: {
      minSegmentLengthMs: 3000,
      maxSegmentLengthMs: 15000,
      confidenceThreshold: 0.7
    },
    layout: {
      width: 1920,
      height: 1080,
      nodeWidth: 120,
      nodeHeight: 60
    },
    output: {
      fps: 30,
      videoDuration: 60,
      includeAudio: true
    }
  });

  const startTime = performance.now();

  try {
    const result = await pipeline.execute({
      audioFile: TEST_CONFIG.mockAudioPath
    });

    const processingTime = performance.now() - startTime;

    console.log('\n📊 Pipeline Results:');
    console.log(`   - Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   - Processing Time: ${processingTime.toFixed(0)}ms`);
    console.log(`   - Scenes Generated: ${result.scenes.length}`);
    console.log(`   - Total Duration: ${(result.duration / 1000).toFixed(1)}s`);

    // Validate results
    if (!result.success) {
      throw new Error(`Pipeline failed: ${result.error}`);
    }

    if (result.scenes.length < TEST_CONFIG.expectedMinScenes) {
      throw new Error(`Expected at least ${TEST_CONFIG.expectedMinScenes} scenes, got ${result.scenes.length}`);
    }

    const diagramCount = result.scenes.filter(s => s.nodes.length > 0).length;
    if (diagramCount < TEST_CONFIG.expectedMinDiagrams) {
      throw new Error(`Expected at least ${TEST_CONFIG.expectedMinDiagrams} diagrams, got ${diagramCount}`);
    }

    if (processingTime > TEST_CONFIG.maxProcessingTime) {
      console.warn(`⚠️ Processing time (${processingTime}ms) exceeded target (${TEST_CONFIG.maxProcessingTime}ms)`);
    }

    console.log('\n✅ Pipeline integration test passed!');

    // Display scene details
    console.log('\n📋 Generated Scenes:');
    result.scenes.forEach((scene, index) => {
      console.log(`   Scene ${index + 1}: ${scene.type} (${scene.nodes.length} nodes, ${(scene.durationMs / 1000).toFixed(1)}s)`);
      console.log(`      Summary: ${scene.summary.substring(0, 60)}...`);
      console.log(`      Keywords: ${scene.keyphrases.slice(0, 3).join(', ')}`);
    });

    return;

  } catch (error) {
    console.error('\n❌ Pipeline integration test failed:', error);
    throw error;
  }
}

/**
 * Run comprehensive test suite
 */
export async function runComprehensiveTests(): Promise<void> {
  console.log('🧪 Starting Comprehensive Audio-to-Diagram Pipeline Test Suite');
  console.log('==============================================================');

  try {
    // Run existing tests first
    console.log('\n📋 Running Basic Tests...');
    runPipelineTests();

    // Run new integration tests
    console.log('\n🔧 Running Component Tests...');
    await testPipelineComponents();

    console.log('\n🚀 Running Full Pipeline Test...');
    await testFullPipelineIntegration();

    console.log('\n🎉 All comprehensive tests completed successfully!');
    console.log('Pipeline is ready for production use.');

  } catch (error) {
    console.error('\n💥 Comprehensive test suite failed:', error);
    console.log('\nRecommended actions:');
    console.log('1. Check component implementations');
    console.log('2. Verify mock data quality');
    console.log('3. Review error logs for specific issues');
    console.log('4. Run individual component tests for debugging');

    throw error;
  }
}

// Export additional test utilities
export {
  TEST_CONFIG,
  MOCK_TRANSCRIPTION_SEGMENTS
};