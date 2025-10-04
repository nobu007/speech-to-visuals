#!/usr/bin/env node

/**
 * Generate sample audio for testing SimplePipeline
 * Creates a synthetic voice sample for pipeline testing
 */

import fs from 'fs';
import path from 'path';

console.log('🎵 Audio Generator for SimplePipeline Testing');
console.log('===========================================');

// Create test audio directory
const testDir = './test-audio';
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Sample text content for testing
const testContent = {
  japanese: {
    text: "今日は音声から図解への変換システムについて説明します。まず、音声データを文字に変換し、次にその内容を分析してシーンに分割します。最後に、適切な図解タイプを選択してレイアウトを生成します。",
    filename: "sample-japanese.txt"
  },
  english: {
    text: "Today I will explain the audio-to-diagram conversion system. First, we convert audio data to text, then analyze the content and divide it into scenes. Finally, we select appropriate diagram types and generate layouts.",
    filename: "sample-english.txt"
  }
};

// Generate text files for testing (since we can't generate actual audio without external tools)
for (const [lang, data] of Object.entries(testContent)) {
  const filePath = path.join(testDir, data.filename);
  fs.writeFileSync(filePath, data.text, 'utf8');
  console.log(`✅ Generated text sample: ${filePath}`);
}

// Create a mock audio metadata file for testing
const mockAudioData = {
  testFiles: [
    {
      name: "sample-japanese.mp3",
      duration: 15,
      language: "ja",
      expectedScenes: 3,
      expectedDiagramTypes: ["flow", "process"]
    },
    {
      name: "sample-english.mp3",
      duration: 12,
      language: "en",
      expectedScenes: 2,
      expectedDiagramTypes: ["timeline", "concept"]
    }
  ],
  testInstructions: {
    manual: "Use any MP3/WAV file or record your voice explaining a process",
    online: "Download sample files from freesound.org or similar",
    generated: "Use text-to-speech tools to convert the provided text samples"
  }
};

fs.writeFileSync(
  path.join(testDir, 'test-metadata.json'),
  JSON.stringify(mockAudioData, null, 2)
);

console.log('\n📋 Test Files Created:');
console.log('======================');
console.log(`📁 Directory: ${testDir}/`);
console.log('📝 sample-japanese.txt - Japanese test content');
console.log('📝 sample-english.txt - English test content');
console.log('📄 test-metadata.json - Test file metadata');

console.log('\n🧪 Testing Instructions:');
console.log('========================');
console.log('1. Navigate to http://localhost:8088/simple');
console.log('2. Upload any audio file (MP3, WAV, OGG, M4A)');
console.log('3. Watch the pipeline process the file');
console.log('4. Check the generated scenes and confidence scores');
console.log('5. Download results for verification');

console.log('\n🎯 For Complete Testing:');
console.log('========================');
console.log('- Convert text files to audio using TTS tools');
console.log('- Record your own voice explaining a process');
console.log('- Use existing audio files for testing');

console.log('\n✅ Audio generator setup complete!');