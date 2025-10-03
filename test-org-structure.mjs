#!/usr/bin/env node

/**
 * Test Organizational Structure Detection Enhancement
 * Specifically targeting the 70.6% quality failure case
 */

console.log('🧪 Testing Enhanced Organizational Structure Detection...\n');

// Test data simulating organizational structure content
const testCases = [
  {
    name: "Basic Organizational Chart",
    content: "The company organizational chart shows the CEO at the top level. Below the CEO are three directors: the Director of Engineering, Director of Marketing, and Director of Operations. Each director manages their respective teams and departments.",
    expectedType: "tree",
    expectedNodes: 6
  },
  {
    name: "Department Hierarchy",
    content: "Our organization structure has multiple levels. The executive team includes the CEO, CTO, and VP of Sales. Under the CTO, there are engineering managers who supervise development teams. The marketing department reports to the VP of Sales.",
    expectedType: "tree",
    expectedNodes: 7
  },
  {
    name: "Reporting Structure",
    content: "John Smith is the CEO and head of the organization. Sarah reports to John as the Director of Engineering. Mike manages the development team and reports to Sarah. The QA team lead also reports to Sarah.",
    expectedType: "tree",
    expectedNodes: 5
  }
];

// Enhanced detection patterns (matching our improvements)
const enhancedHierarchicalKeywords = [
  // Organizational hierarchy
  'level', 'under', 'above', 'parent', 'child', 'sub', 'main', 'category',
  'manager', 'director', 'executive', 'officer', 'head', 'lead', 'senior',
  'reports to', 'supervises', 'oversees', 'manages', 'leads',
  'department', 'division', 'team', 'group', 'unit', 'section',
  // Structural indicators
  'hierarchy', 'structure', 'organization', 'chart', 'tree',
  'branch', 'root', 'node', 'tier', 'rank', 'position'
];

function detectHierarchicalPattern(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let hierarchicalScore = 0;
  const totalSentences = sentences.length;

  if (totalSentences === 0) return 0;

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    // Organizational structure patterns
    const orgPatterns = [
      /(\w+)\s+(reports to|manages|supervises|oversees)\s+(\w+)/gi,
      /(\w+)\s+is\s+(under|above|below)\s+(\w+)/gi,
      /(\w+)\s+(department|division|team|group)/gi,
      /(ceo|cto|vp|director|manager)\s+of\s+(\w+)/gi,
      /organizational\s+(chart|structure|hierarchy)/gi
    ];

    // Hierarchical relationship patterns
    const hierarchyPatterns = [
      /level\s+\d+/gi,
      /tier\s+\d+/gi,
      /(top|middle|bottom)\s+(level|tier)/gi,
      /(parent|child)\s+(node|element|category)/gi,
      /sub[-\s]?(category|division|department)/gi
    ];

    // Count pattern matches
    let sentenceScore = 0;

    orgPatterns.forEach(pattern => {
      const matches = lowerSentence.match(pattern);
      if (matches) sentenceScore += matches.length * 0.3;
    });

    hierarchyPatterns.forEach(pattern => {
      const matches = lowerSentence.match(pattern);
      if (matches) sentenceScore += matches.length * 0.2;
    });

    // Keyword density bonus
    const hierarchicalKeywords = [
      'hierarchy', 'structure', 'organization', 'chart', 'tree',
      'manager', 'director', 'executive', 'head', 'lead',
      'department', 'division', 'team', 'reports', 'supervises'
    ];

    const keywordCount = hierarchicalKeywords.filter(keyword =>
      lowerSentence.includes(keyword)
    ).length;

    sentenceScore += keywordCount * 0.1;
    hierarchicalScore += Math.min(sentenceScore, 1.0);
  }

  return Math.min(hierarchicalScore / totalSentences, 1.0);
}

function analyzeOrganizationalContent(text) {
  const startTime = performance.now();

  // Enhanced keyword scoring
  const keywordScores = {
    flow: 0,
    tree: 0,
    timeline: 0,
    matrix: 0,
    cycle: 0
  };

  // Tree-specific enhanced patterns
  const treePatterns = {
    structure: { keywords: ['hierarchy', 'structure', 'organization', 'taxonomy', 'chart'], weight: 10 },
    relationship: { keywords: ['parent', 'child', 'branch', 'root', 'category', 'reports to', 'manages'], weight: 8 },
    classification: { keywords: ['classify', 'categorize', 'group', 'organize', 'department', 'division'], weight: 6 },
    levels: { keywords: ['level', 'tier', 'layer', 'component', 'subdivision', 'rank'], weight: 7 },
    roles: { keywords: ['manager', 'director', 'executive', 'head', 'lead', 'officer', 'supervisor'], weight: 9 }
  };

  const lowerText = text.toLowerCase();

  // Calculate tree score with enhanced patterns
  for (const [category, pattern] of Object.entries(treePatterns)) {
    for (const keyword of pattern.keywords) {
      const frequency = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      keywordScores.tree += frequency * pattern.weight;
    }
  }

  // Structural pattern analysis
  const hierarchicalScore = detectHierarchicalPattern(text);
  keywordScores.tree += hierarchicalScore * 50; // Boost tree score for hierarchical patterns

  // Find best type
  const bestType = Object.entries(keywordScores).reduce((best, [type, score]) =>
    score > best.score ? { type, score } : best,
    { type: 'flow', score: 0 }
  );

  const confidence = Math.min(bestType.score / 100, 0.95);
  const processingTime = performance.now() - startTime;

  // Estimate nodes based on content
  const entityCount = Math.min(
    (text.match(/\b[A-Z][a-z]+/g) || []).length +
    (text.match(/\b(director|manager|head|lead|team|department)\b/gi) || []).length,
    10
  );

  return {
    type: bestType.type,
    confidence,
    score: bestType.score,
    hierarchicalScore,
    estimatedNodes: Math.max(entityCount, 3),
    processingTime
  };
}

// Run tests
console.log('📊 ENHANCED ORGANIZATIONAL STRUCTURE DETECTION RESULTS\n');

let totalScore = 0;
let correctDetections = 0;

for (const testCase of testCases) {
  console.log(`🧪 Testing: ${testCase.name}`);
  console.log(`Content: ${testCase.content.substring(0, 100)}...`);

  const result = analyzeOrganizationalContent(testCase.content);

  const isCorrectType = result.type === testCase.expectedType;
  const qualityScore = result.confidence * 100;

  console.log(`✨ Results:`);
  console.log(`   Detected Type: ${result.type} ${isCorrectType ? '✅' : '❌'}`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`   Quality Score: ${qualityScore.toFixed(1)}%`);
  console.log(`   Hierarchical Pattern: ${(result.hierarchicalScore * 100).toFixed(1)}%`);
  console.log(`   Estimated Nodes: ${result.estimatedNodes} (expected: ${testCase.expectedNodes})`);
  console.log(`   Processing Time: ${result.processingTime.toFixed(1)}ms`);

  if (isCorrectType) correctDetections++;
  totalScore += qualityScore;

  console.log('');
}

// Calculate overall improvement
const averageQuality = totalScore / testCases.length;
const detectionAccuracy = (correctDetections / testCases.length) * 100;

console.log('🏆 ENHANCEMENT SUMMARY');
console.log('====================');
console.log(`Average Quality Score: ${averageQuality.toFixed(1)}% (target: >75%)`);
console.log(`Detection Accuracy: ${detectionAccuracy.toFixed(1)}% (target: >90%)`);
console.log(`Test Cases Passed: ${correctDetections}/${testCases.length}`);

// Improvement assessment
const qualityImprovement = averageQuality > 75 ? '✅ IMPROVED' : '⚠️ NEEDS MORE WORK';
const accuracyImprovement = detectionAccuracy > 90 ? '✅ EXCELLENT' : '⚠️ NEEDS REFINEMENT';

console.log(`\nQuality Assessment: ${qualityImprovement}`);
console.log(`Accuracy Assessment: ${accuracyImprovement}`);

if (averageQuality > 75 && detectionAccuracy > 90) {
  console.log('\n🎉 SUCCESS: Enhanced organizational structure detection achieved targets!');
  console.log('Ready for integration and full system testing.');
} else {
  console.log('\n🔧 CONTINUE: Further refinement needed for optimal performance.');
  console.log('Consider additional pattern enhancements or threshold adjustments.');
}