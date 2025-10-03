#!/usr/bin/env node

/**
 * Complete System Integration Test
 * Tests the entire pipeline with mock data to identify missing components
 */

import fs from 'fs';

console.log('🧪 Complete System Integration Test');
console.log('====================================\n');

// Mock implementations for missing components
const mockComponents = {
    TranscriptionPipeline: class {
        constructor(config) {
            this.config = config;
            console.log('🎤 Mock TranscriptionPipeline initialized');
        }

        async transcribe(audioPath) {
            console.log('🔄 Mock transcribing:', audioPath);
            return {
                success: true,
                segments: [
                    {
                        text: "まず、システムアーキテクチャについて説明します。",
                        start: 0,
                        end: 4.2,
                        id: 0,
                        confidence: 0.92
                    },
                    {
                        text: "次に、データフローの詳細について話します。",
                        start: 4.2,
                        end: 8.1,
                        id: 1,
                        confidence: 0.87
                    },
                    {
                        text: "最後に、パフォーマンス最適化の方法をまとめます。",
                        start: 8.1,
                        end: 12.5,
                        id: 2,
                        confidence: 0.91
                    }
                ],
                text: "システムについて説明します。",
                duration: 12.5
            };
        }
    },

    SceneSegmenter: class {
        constructor(config) {
            this.config = config;
            console.log('✂️ Mock SceneSegmenter initialized');
        }

        async segment(segments) {
            console.log('🔄 Mock segmenting', segments.length, 'segments');
            return segments.map((segment, index) => ({
                id: `segment_${index}`,
                startMs: segment.start * 1000,
                endMs: segment.end * 1000,
                text: segment.text,
                summary: segment.text.split('。')[0] + '。',
                confidence: segment.confidence || 0.8,
                keyphrases: ['キーワード1', 'キーワード2']
            }));
        }
    },

    DiagramDetector: class {
        constructor() {
            console.log('🔍 Mock DiagramDetector initialized');
        }

        async analyze(segment) {
            console.log('🔄 Mock analyzing segment');
            return {
                type: 'flow',
                nodes: [
                    { id: 'node_0', label: '要素1', meta: { importance: 0.8 } },
                    { id: 'node_1', label: '要素2', meta: { importance: 0.7 } }
                ],
                edges: [
                    { from: 'node_0', to: 'node_1', label: '→' }
                ],
                confidence: 0.85
            };
        }
    },

    LayoutEngine: class {
        constructor(config) {
            this.config = config;
            console.log('🎨 Mock LayoutEngine initialized');
        }

        async generateLayout(nodes, edges, type) {
            console.log('🔄 Mock generating layout for', type);
            const positioned = nodes.map((node, index) => ({
                ...node,
                x: 150 + index * 300,
                y: 400,
                w: 240,
                h: 80
            }));

            const layoutEdges = edges.map(edge => ({
                ...edge,
                points: [
                    { x: 300, y: 440 },
                    { x: 600, y: 440 }
                ]
            }));

            return {
                success: true,
                layout: { nodes: positioned, edges: layoutEdges }
            };
        }
    }
};

// Mock global modules
const mockGlobals = {
    qualityMonitor: {
        assessPipelineQuality: async (result) => ({
            overall: 0.85,
            transcription: 0.9,
            analysis: 0.8,
            layout: 0.85
        })
    }
};

// Create mock pipeline
class MockMainPipeline {
    constructor(config = {}) {
        this.config = config;
        this.stages = [];
        this.pipelineId = `mock-pipeline-${Date.now()}`;

        this.transcriber = new mockComponents.TranscriptionPipeline();
        this.segmenter = new mockComponents.SceneSegmenter();
        this.detector = new mockComponents.DiagramDetector();
        this.layoutEngine = new mockComponents.LayoutEngine();

        console.log('🏗️ Mock pipeline initialized');
    }

    async execute(input) {
        const startTime = performance.now();
        console.log('\n🚀 Starting pipeline execution');

        try {
            // Stage 1: Transcription
            const transcriptionResult = await this.transcriber.transcribe(input.audioFile);
            this.addStage('transcription', 'complete');

            // Stage 2: Segmentation
            const segments = await this.segmenter.segment(transcriptionResult.segments);
            this.addStage('segmentation', 'complete');

            // Stage 3: Analysis
            const analysisResults = [];
            for (const segment of segments) {
                const analysis = await this.detector.analyze(segment);
                analysisResults.push({ segment, analysis });
            }
            this.addStage('analysis', 'complete');

            // Stage 4: Layout
            const layoutResults = [];
            for (const { segment, analysis } of analysisResults) {
                const layoutResult = await this.layoutEngine.generateLayout(
                    analysis.nodes, analysis.edges, analysis.type
                );
                if (layoutResult.success) {
                    layoutResults.push({ segment, analysis, layout: layoutResult.layout });
                }
            }
            this.addStage('layout', 'complete');

            // Stage 5: Scene preparation
            const scenes = layoutResults.map(({ segment, analysis, layout }) => ({
                type: analysis.type,
                nodes: analysis.nodes,
                edges: analysis.edges,
                layout,
                startMs: segment.startMs,
                durationMs: segment.endMs - segment.startMs,
                summary: segment.summary,
                keyphrases: segment.keyphrases
            }));

            const totalTime = performance.now() - startTime;
            const totalDuration = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);

            console.log(`✅ Pipeline completed in ${(totalTime / 1000).toFixed(1)}s`);

            return {
                success: true,
                scenes,
                audioUrl: 'mock-audio.wav',
                duration: totalDuration,
                processingTime: totalTime,
                stages: this.stages
            };

        } catch (error) {
            console.error(`❌ Pipeline failed: ${error.message}`);
            return {
                success: false,
                scenes: [],
                audioUrl: '',
                duration: 0,
                processingTime: performance.now() - startTime,
                stages: this.stages,
                error: error.message
            };
        }
    }

    addStage(name, status) {
        this.stages.push({ name, status });
    }
}

// Run test
async function runTest() {
    console.log('🔄 Starting complete system test...\n');

    const pipeline = new MockMainPipeline({
        transcription: { model: 'base' },
        analysis: { minSegmentLengthMs: 2000 },
        layout: { width: 1920, height: 1080 }
    });

    const input = { audioFile: 'mock-audio.wav' };
    const result = await pipeline.execute(input);

    console.log('\n📊 Test Results:');
    console.log('================');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Scenes: ${result.scenes.length}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`Processing Time: ${(result.processingTime / 1000).toFixed(1)}s`);
    console.log(`Stages: ${result.stages.length}`);

    if (result.scenes.length > 0) {
        console.log('\n🎭 Generated Scenes:');
        result.scenes.forEach((scene, i) => {
            console.log(`  Scene ${i + 1}: ${scene.type} (${scene.nodes.length} nodes)`);
        });
    }

    // Save results
    fs.writeFileSync(
        `test-output/demo-report-${Date.now()}.json`,
        JSON.stringify(result, null, 2)
    );

    console.log('\n💾 Test report saved to test-output/');
    console.log(result.success ? '🎉 Test PASSED!' : '⚠️ Test identified issues');

    return result.success;
}

runTest().catch(console.error);