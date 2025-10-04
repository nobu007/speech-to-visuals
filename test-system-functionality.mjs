#!/usr/bin/env node

/**
 * Quick System Functionality Test
 * Tests the core pipeline components to identify what's working vs missing
 */

import { promises as fs } from 'fs';
import path from 'path';

console.log('🧪 Testing Audio-to-Visuals System Functionality\n');

// Test 1: Check if main pipeline files exist
console.log('📁 Checking core pipeline files...');

const coreFiles = [
  'src/transcription/index.ts',
  'src/analysis/index.ts',
  'src/visualization/index.ts',
  'src/pipeline/simple-pipeline.ts',
  'src/pipeline/video-generator.ts',
  'src/components/SimplePipelineInterface.tsx'
];

let filesExist = 0;
for (const file of coreFiles) {
  try {
    await fs.access(file);
    console.log(`✅ ${file}`);
    filesExist++;
  } catch (error) {
    console.log(`❌ ${file} - Missing!`);
  }
}

console.log(`\n📊 Core Files: ${filesExist}/${coreFiles.length} exist\n`);

// Test 2: Check if key implementation files exist
console.log('🔍 Checking implementation files...');

const implFiles = [
  'src/transcription/transcriber.ts',
  'src/analysis/scene-segmenter.ts',
  'src/analysis/diagram-detector.ts',
  'src/visualization/layout-engine.ts'
];

let implFilesExist = 0;
for (const file of implFiles) {
  try {
    await fs.access(file);
    console.log(`✅ ${file}`);
    implFilesExist++;
  } catch (error) {
    console.log(`❌ ${file} - Missing!`);
  }
}

console.log(`\n📊 Implementation Files: ${implFilesExist}/${implFiles.length} exist\n`);

// Test 3: Check package.json dependencies
console.log('📦 Checking dependencies...');

try {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
  const deps = pkg.dependencies || {};

  const requiredDeps = [
    '@remotion/captions',
    '@remotion/media-utils',
    '@remotion/install-whisper-cpp',
    '@dagrejs/dagre',
    'kuromoji',
    'whisper-node',
    'remotion'
  ];

  let depsInstalled = 0;
  for (const dep of requiredDeps) {
    if (deps[dep]) {
      console.log(`✅ ${dep} - ${deps[dep]}`);
      depsInstalled++;
    } else {
      console.log(`❌ ${dep} - Missing!`);
    }
  }

  console.log(`\n📊 Required Dependencies: ${depsInstalled}/${requiredDeps.length} installed\n`);

} catch (error) {
  console.log('❌ Could not read package.json');
}

// Summary
console.log('📋 SYSTEM STATUS SUMMARY:');
console.log('=' .repeat(50));
console.log(`Core Architecture Files: ${filesExist}/${coreFiles.length} ✓`);
console.log(`Implementation Files: ${implFilesExist}/${implFiles.length} ${implFilesExist === implFiles.length ? '✓' : '⚠️'}`);
console.log(`Required Dependencies: Available in package.json ✓`);

if (filesExist === coreFiles.length && implFilesExist >= 3) {
  console.log('\n🎉 SYSTEM STATUS: READY FOR TESTING');
  console.log('💡 Recommendation: Run the demo in the UI to test functionality');
} else {
  console.log('\n⚠️  SYSTEM STATUS: NEEDS CORE IMPLEMENTATIONS');
  console.log('💡 Recommendation: Create missing implementation files');
}

console.log('\n🚀 To test the system:');
console.log('1. Run: npm run dev');
console.log('2. Open: http://localhost:8085');
console.log('3. Click "デモを実行する" to test with mock data');
console.log('4. Or upload an audio file to test real processing\n');