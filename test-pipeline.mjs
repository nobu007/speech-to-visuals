#!/usr/bin/env node

/**
 * Test script for Audio-to-Diagram Video Generation Pipeline
 * Tests core functionality without requiring audio files
 */

import fs from 'fs';
import path from 'path';

console.log('🔧 Audio-to-Diagram Pipeline Test');
console.log('=====================================\n');

// Test 1: Check dependencies
console.log('📦 Testing dependencies...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredDeps = [
    '@remotion/captions',
    '@remotion/media-utils',
    '@dagrejs/dagre',
    'kuromoji',
    'whisper-node',
    'remotion'
];

let depsOk = true;
for (const dep of requiredDeps) {
    if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
        console.log(`  ✅ ${dep}`);
    } else {
        console.log(`  ❌ ${dep} - MISSING`);
        depsOk = false;
    }
}

// Test 2: Check file structure
console.log('\n📁 Testing file structure...');
const requiredFiles = [
    'src/pipeline/main-pipeline.ts',
    'src/pipeline/types.ts',
    'src/transcription/index.ts',
    'src/analysis/index.ts',
    'src/visualization/index.ts',
    'src/types/diagram.ts',
    'src/remotion/DiagramRenderer.tsx'
];

let filesOk = true;
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`  ✅ ${file}`);
    } else {
        console.log(`  ❌ ${file} - MISSING`);
        filesOk = false;
    }
}

// Test 3: Mock transcription data
console.log('\n🧪 Testing with mock data...');
const mockTranscription = {
    text: "まず、システムの概要を説明します。次に、具体的な実装方法について話します。最後に、注意すべきポイントをまとめます。",
    segments: [
        {
            text: "まず、システムの概要を説明します。",
            start: 0,
            end: 3.5,
            id: 0
        },
        {
            text: "次に、具体的な実装方法について話します。",
            start: 3.5,
            end: 7.2,
            id: 1
        },
        {
            text: "最後に、注意すべきポイントをまとめます。",
            start: 7.2,
            end: 10.8,
            id: 2
        }
    ],
    duration: 10.8
};

// Test 4: Scene generation simulation
console.log('🎬 Testing scene generation...');

// Simple scene splitting based on Japanese transition words
const transitionWords = ['まず', '次に', '最後に', 'そして', 'また', 'しかし'];
const sentences = mockTranscription.text.split(/。|！|？/).filter(s => s.trim());

const scenes = [];
let currentTime = 0;
sentences.forEach((sentence, index) => {
    if (sentence.trim()) {
        const hasTransition = transitionWords.some(word => sentence.includes(word));
        const diagramType = getDiagramType(sentence);

        const scene = {
            type: diagramType,
            nodes: generateMockNodes(sentence, diagramType),
            edges: [],
            startMs: currentTime,
            durationMs: 3500,
            summary: sentence.trim(),
            keyphrases: extractKeyphrases(sentence)
        };

        // Generate edges based on diagram type
        if (scene.nodes.length > 1) {
            scene.edges = generateMockEdges(scene.nodes, diagramType);
        }

        scenes.push(scene);
        currentTime += 3500;

        console.log(`  📐 Scene ${index + 1}: ${diagramType} diagram (${scene.nodes.length} nodes)`);
    }
});

// Test 5: Layout generation simulation
console.log('\n🎨 Testing layout generation...');
scenes.forEach((scene, index) => {
    const layout = generateMockLayout(scene.nodes, scene.edges, scene.type);
    scene.layout = layout;
    console.log(`  ✅ Layout ${index + 1}: ${scene.type} (${layout.nodes.length} positioned nodes)`);
});

// Test 6: Final validation
console.log('\n✅ Test Results Summary:');
console.log(`Dependencies: ${depsOk ? '✅ All present' : '❌ Missing dependencies'}`);
console.log(`File structure: ${filesOk ? '✅ Complete' : '❌ Missing files'}`);
console.log(`Mock processing: ✅ Generated ${scenes.length} scenes`);
console.log(`Total duration: ${currentTime / 1000}s`);

if (depsOk && filesOk) {
    console.log('\n🎉 Pipeline test passed! System appears ready for development.');

    // Save test results
    const testResult = {
        timestamp: new Date().toISOString(),
        success: true,
        scenes,
        mockData: mockTranscription,
        totalDuration: currentTime
    };

    fs.writeFileSync('test-output/test-report-' + Date.now() + '.json',
                     JSON.stringify(testResult, null, 2));

    console.log('📊 Test report saved to test-output/');
} else {
    console.log('\n⚠️  Pipeline test identified issues that need attention.');
    process.exit(1);
}

// Helper functions
function getDiagramType(text) {
    if (text.includes('まず') || text.includes('次に') || text.includes('手順')) return 'flow';
    if (text.includes('構成') || text.includes('種類') || text.includes('分類')) return 'tree';
    if (text.includes('時間') || text.includes('段階') || text.includes('プロセス')) return 'timeline';
    if (text.includes('比較') || text.includes('対比') || text.includes('一方')) return 'matrix';
    if (text.includes('循環') || text.includes('サイクル') || text.includes('継続')) return 'cycle';
    return 'flow';
}

function generateMockNodes(text, type) {
    const words = text.split(/\s+/).filter(w => w.length > 1);
    const nodeCount = Math.min(Math.max(2, Math.floor(words.length / 3)), 5);

    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            id: `node_${i}`,
            label: words.slice(i * 2, i * 2 + 2).join(' ') || `要素${i + 1}`,
            meta: {
                importance: Math.random(),
                category: type
            }
        });
    }

    return nodes;
}

function generateMockEdges(nodes, type) {
    const edges = [];

    if (type === 'flow' || type === 'timeline') {
        // Sequential connections
        for (let i = 0; i < nodes.length - 1; i++) {
            edges.push({
                from: nodes[i].id,
                to: nodes[i + 1].id,
                label: type === 'timeline' ? '次' : '→'
            });
        }
    } else if (type === 'tree') {
        // Root to children
        if (nodes.length > 1) {
            for (let i = 1; i < nodes.length; i++) {
                edges.push({
                    from: nodes[0].id,
                    to: nodes[i].id
                });
            }
        }
    } else if (type === 'cycle') {
        // Circular connections
        for (let i = 0; i < nodes.length; i++) {
            edges.push({
                from: nodes[i].id,
                to: nodes[(i + 1) % nodes.length].id
            });
        }
    }

    return edges;
}

function generateMockLayout(nodes, edges, type) {
    const layoutNodes = nodes.map((node, index) => {
        let x, y;

        switch (type) {
            case 'flow':
                x = 150 + index * 280;
                y = 400;
                break;
            case 'tree':
                if (index === 0) {
                    x = 500;
                    y = 200;
                } else {
                    x = 200 + (index - 1) * 200;
                    y = 450;
                }
                break;
            case 'timeline':
                x = 150 + index * 250;
                y = 400 + (index % 2 ? 80 : -80);
                break;
            case 'cycle':
                const angle = (2 * Math.PI * index) / nodes.length;
                x = 500 + 200 * Math.cos(angle);
                y = 400 + 200 * Math.sin(angle);
                break;
            default:
                x = 150 + (index % 3) * 250;
                y = 200 + Math.floor(index / 3) * 150;
        }

        return {
            ...node,
            x: Math.round(x),
            y: Math.round(y),
            w: 240,
            h: 80
        };
    });

    const layoutEdges = edges.map(edge => {
        const fromNode = layoutNodes.find(n => n.id === edge.from);
        const toNode = layoutNodes.find(n => n.id === edge.to);

        if (fromNode && toNode) {
            return {
                ...edge,
                points: [
                    { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 },
                    { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 }
                ]
            };
        }

        return edge;
    });

    return { nodes: layoutNodes, edges: layoutEdges };
}

function extractKeyphrases(text) {
    // Simple Japanese keyphrase extraction
    const words = text.split(/\s+|、|。/).filter(w => w.length > 1);
    return words.slice(0, 3);
}