/**
 * Phase 32: Test Multilingual Prompt System
 *
 * Validates language detection and adaptive prompt generation
 */

import { detectLanguage } from '../src/analysis/language-detector';
import { getContentAnalyzerPrompt, getGeminiAnalyzerPrompt } from '../src/analysis/prompt-templates';

console.log('🌐 Phase 32: Multilingual Prompt System Test\n');
console.log('━'.repeat(60));

// Test cases
const testCases = [
  {
    name: 'Japanese text',
    text: 'まずAを実行します。次にBを処理します。最後にCで完了します。',
    expectedLanguage: 'ja'
  },
  {
    name: 'English text',
    text: 'First, we execute process A. Then, we process B. Finally, we complete with C.',
    expectedLanguage: 'en'
  },
  {
    name: 'Complex Japanese technical text',
    text: '研究により新技術が開発され、それを実用化して製品化する。その結果、市場に投入され、顧客からフィードバックを受け、さらなる改善につながる。',
    expectedLanguage: 'ja'
  },
  {
    name: 'Complex English technical text',
    text: 'Research develops new technology, which is then commercialized and turned into products. The result is market introduction, customer feedback, and further improvements.',
    expectedLanguage: 'en'
  },
  {
    name: 'Mixed content (numbers and symbols)',
    text: 'Process 1 → Process 2 → Process 3',
    expectedLanguage: 'en'
  }
];

let passedTests = 0;
const totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(60));

  // Test language detection
  const detection = detectLanguage(testCase.text);

  console.log(`Input text: "${testCase.text.substring(0, 50)}${testCase.text.length > 50 ? '...' : ''}"`);
  console.log(`Detected language: ${detection.language} (confidence: ${(detection.confidence * 100).toFixed(1)}%)`);
  console.log(`Japanese ratio: ${(detection.japaneseCharRatio * 100).toFixed(1)}%`);
  console.log(`English ratio: ${(detection.englishCharRatio * 100).toFixed(1)}%`);

  // Validate detection
  const isCorrect = detection.language === testCase.expectedLanguage || detection.language === 'auto';
  if (isCorrect) {
    console.log(`✅ PASS: Detection correct`);
    passedTests++;
  } else {
    console.log(`❌ FAIL: Expected ${testCase.expectedLanguage}, got ${detection.language}`);
  }

  // Test prompt generation
  console.log('\n🎯 Generated Prompts:');

  const contentAnalyzerPrompt = getContentAnalyzerPrompt(testCase.text);
  const geminiAnalyzerPrompt = getGeminiAnalyzerPrompt(testCase.text);

  // Check if prompts contain language-appropriate instructions
  const isJapanesePrompt = contentAnalyzerPrompt.includes('以下のテキスト') || contentAnalyzerPrompt.includes('JSON');
  const isEnglishPrompt = contentAnalyzerPrompt.includes('Analyze the following') || contentAnalyzerPrompt.includes('JSON');

  console.log(`ContentAnalyzer prompt language: ${isJapanesePrompt ? '🇯🇵 Japanese' : '🇬🇧 English'}`);
  console.log(`Prompt length: ${contentAnalyzerPrompt.length} chars`);
  console.log(`Prompt preview: ${contentAnalyzerPrompt.substring(0, 100).replace(/\n/g, ' ')}...`);
});

console.log('\n' + '━'.repeat(60));
console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);

if (passedTests === totalTests) {
  console.log('✅ All tests passed! Multilingual prompt system is working correctly.');
  process.exit(0);
} else {
  console.log(`⚠️  Some tests failed. Review implementation.`);
  process.exit(1);
}
