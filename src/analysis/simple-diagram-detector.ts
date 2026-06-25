/**
 * Simple Diagram Type Detector
 * MVP implementation following custom instructions
 * 🔄 Focus: 小さく作り、確実に動作確認
 */

export type DiagramType = 'flow' | 'tree' | 'timeline' | 'cycle' | 'network';

export interface SimpleNode {
  id: string;
  label: string;
  type?: string;
}

export interface SimpleEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: 'flow' | 'conditional' | 'timeline';
}

export interface SimpleDiagramAnalysis {
  type: DiagramType;
  confidence: number;
  nodes: SimpleNode[];
  edges: SimpleEdge[];
  reasoning: string;
}

export interface TextSegment {
  text: string;
  startMs: number;
  endMs: number;
  summary?: string;
}

/**
 * Simple rule-based diagram detection
 * MVP: Fast, predictable, easy to debug
 */
export class SimpleDiagramDetector {
  private flowKeywords = [
    'process', 'step', 'then', 'next', 'first', 'second', 'finally',
    'start', 'begin', 'end', 'finish', 'workflow', 'procedure'
  ];

  private treeKeywords = [
    'hierarchy', 'parent', 'child', 'branch', 'root', 'leaf',
    'organization', 'structure', 'level', 'category', 'classification'
  ];

  private timelineKeywords = [
    'timeline', 'chronology', 'history', 'year', 'month', 'period',
    'before', 'after', 'when', 'during', 'time', 'sequence',
    '2020', '2021', '2022', '2023', '2024', '2025', // Add year patterns
    'started', 'developed', 'launched' // Common timeline verbs
  ];

  private cycleKeywords = [
    'cycle', 'loop', 'repeat', 'circular', 'return', 'again',
    'continuous', 'recurring', 'iterate', 'back to'
  ];

  private networkKeywords = [
    'network', 'connection', 'linked', 'relationship', 'interconnected',
    'node', 'edge', 'graph', 'web', 'connect'
  ];

  private readonly CONFIDENCE_SCALE_FACTOR = 2;
  private readonly MAX_CONFIDENCE_CAP = 0.95;

  private readonly NORMALIZATION_FACTOR = 0.1;
  private readonly MIN_NORMALIZATION_DIVISOR = 1;

  private readonly TEST_START_MS = 0;
  private readonly TEST_END_MS = 5000;

  /**
   * Analyze text segment and detect diagram type
   * 🔄 Custom Instructions: 最小実装で動作確認
   */
  async analyze(segment: TextSegment): Promise<SimpleDiagramAnalysis> {

    const text = segment.text.toLowerCase();

    // Calculate keyword scores
    const scores = {
      flow: this.calculateScore(text, this.flowKeywords),
      tree: this.calculateScore(text, this.treeKeywords),
      timeline: this.calculateScore(text, this.timelineKeywords),
      cycle: this.calculateScore(text, this.cycleKeywords),
      network: this.calculateScore(text, this.networkKeywords)
    };

    // Find best match
    const bestType = Object.entries(scores).reduce((best, current) =>
      current[1] > best[1] ? current : best
    )[0] as DiagramType;

    const confidence = Math.min(scores[bestType] * this.CONFIDENCE_SCALE_FACTOR, this.MAX_CONFIDENCE_CAP); // Scale up confidence

    // When no keywords match at all, use default elements instead of
    // falsely presenting hardcoded flow-chart elements for unknown content
    const isUnrecognized = scores[bestType] === 0;
    const { nodes, edges } = isUnrecognized
      ? this.generateDefaultElements(text)
      : this.generateSimpleElements(text, bestType);

    const reasoning = this.explainReasoning(bestType, scores[bestType], text);

    return {
      type: bestType,
      confidence,
      nodes,
      edges,
      reasoning
    };
  }

  /**
   * Calculate keyword match score
   */
  private calculateScore(text: string, keywords: string[]): number {
    let matches = 0;
    const totalWords = text.split(/\s+/).length;

    for (const keyword of keywords) {
      // ISS-013: Escape special regex chars to prevent ReDoS
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const keywordMatches = (text.match(regex) || []).length;
      matches += keywordMatches;
    }

    // Normalize by text length
    return Math.min(matches / Math.max(totalWords * this.NORMALIZATION_FACTOR, this.MIN_NORMALIZATION_DIVISOR), 1);
  }

  /**
   * Generate simple diagram elements
   * 🔄 Custom Instructions: 段階的実装
   */
  private generateSimpleElements(text: string, type: DiagramType): {
    nodes: SimpleNode[];
    edges: SimpleEdge[];
  } {
    const nodes: SimpleNode[] = [];
    const edges: SimpleEdge[] = [];

    switch (type) {
      case 'flow':
        return this.generateFlowElements(text);
      case 'tree':
        return this.generateTreeElements(text);
      case 'timeline':
        return this.generateTimelineElements(text);
      case 'cycle':
        return this.generateCycleElements(text);
      case 'network':
        return this.generateNetworkElements(text);
      default:
        return this.generateDefaultElements(text);
    }
  }

  /**
   * Generate flow chart elements
   */
  private generateFlowElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'start', label: '開始', type: 'start' },
      { id: 'process1', label: 'プロセス1', type: 'process' },
      { id: 'decision', label: '判断', type: 'decision' },
      { id: 'process2', label: 'プロセス2', type: 'process' },
      { id: 'end', label: '終了', type: 'end' }
    ];

    const edges: SimpleEdge[] = [
      { id: 'e1', from: 'start', to: 'process1', type: 'flow' },
      { id: 'e2', from: 'process1', to: 'decision', type: 'flow' },
      { id: 'e3', from: 'decision', to: 'process2', type: 'conditional', label: 'Yes' },
      { id: 'e4', from: 'decision', to: 'end', type: 'conditional', label: 'No' },
      { id: 'e5', from: 'process2', to: 'end', type: 'flow' }
    ];

    return { nodes, edges };
  }

  /**
   * Generate tree structure elements
   */
  private generateTreeElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'root', label: '組織', type: 'root' },
      { id: 'branch1', label: '開発部', type: 'branch' },
      { id: 'branch2', label: '営業部', type: 'branch' },
      { id: 'leaf1', label: 'チーム1', type: 'leaf' },
      { id: 'leaf2', label: 'チーム2', type: 'leaf' }
    ];

    const edges: SimpleEdge[] = [
      { id: 'e1', from: 'root', to: 'branch1', type: 'flow' },
      { id: 'e2', from: 'root', to: 'branch2', type: 'flow' },
      { id: 'e3', from: 'branch1', to: 'leaf1', type: 'flow' },
      { id: 'e4', from: 'branch1', to: 'leaf2', type: 'flow' }
    ];

    return { nodes, edges };
  }

  /**
   * Generate timeline elements
   */
  private generateTimelineElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'event1', label: '開始', type: 'event' },
      { id: 'event2', label: '計画', type: 'event' },
      { id: 'event3', label: '実行', type: 'event' },
      { id: 'event4', label: '完了', type: 'event' }
    ];

    const edges: SimpleEdge[] = [
      { id: 'e1', from: 'event1', to: 'event2', type: 'timeline' },
      { id: 'e2', from: 'event2', to: 'event3', type: 'timeline' },
      { id: 'e3', from: 'event3', to: 'event4', type: 'timeline' }
    ];

    return { nodes, edges };
  }

  /**
   * Generate cycle elements
   */
  private generateCycleElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'step1', label: 'ステップ1', type: 'process' },
      { id: 'step2', label: 'ステップ2', type: 'process' },
      { id: 'step3', label: 'ステップ3', type: 'process' },
      { id: 'step4', label: 'ステップ4', type: 'process' }
    ];

    const edges: SimpleEdge[] = [
      { id: 'e1', from: 'step1', to: 'step2', type: 'flow' },
      { id: 'e2', from: 'step2', to: 'step3', type: 'flow' },
      { id: 'e3', from: 'step3', to: 'step4', type: 'flow' },
      { id: 'e4', from: 'step4', to: 'step1', type: 'flow' } // Cycle back
    ];

    return { nodes, edges };
  }

  /**
   * Generate network elements
   */
  private generateNetworkElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'node1', label: 'ノード1', type: 'node' },
      { id: 'node2', label: 'ノード2', type: 'node' },
      { id: 'node3', label: 'ノード3', type: 'node' },
      { id: 'node4', label: 'ノード4', type: 'node' }
    ];

    const edges: SimpleEdge[] = [
      { id: 'e1', from: 'node1', to: 'node2', type: 'flow' },
      { id: 'e2', from: 'node1', to: 'node3', type: 'flow' },
      { id: 'e3', from: 'node2', to: 'node4', type: 'flow' },
      { id: 'e4', from: 'node3', to: 'node4', type: 'flow' }
    ];

    return { nodes, edges };
  }

  /**
   * Generate default elements
   */
  private generateDefaultElements(text: string): { nodes: SimpleNode[]; edges: SimpleEdge[] } {
    const nodes: SimpleNode[] = [
      { id: 'concept', label: 'コンセプト', type: 'concept' }
    ];

    const edges: SimpleEdge[] = [];

    return { nodes, edges };
  }

  /**
   * Explain reasoning for detected type
   */
  private explainReasoning(type: DiagramType, score: number, text: string): string {
    const reasons = [];

    switch (type) {
      case 'flow':
        reasons.push('プロセスや手順を示すキーワードが検出されました');
        if (text.includes('then') || text.includes('next')) {
          reasons.push('順序性を示す語句が含まれています');
        }
        break;
      case 'tree':
        reasons.push('階層構造を示すキーワードが検出されました');
        if (text.includes('parent') || text.includes('child')) {
          reasons.push('親子関係を示す語句が含まれています');
        }
        break;
      case 'timeline':
        reasons.push('時系列を示すキーワードが検出されました');
        if (text.match(/\d{4}|\byear\b|\bmonth\b/)) {
          reasons.push('時間に関する具体的な表現が含まれています');
        }
        break;
      case 'cycle':
        reasons.push('循環や反復を示すキーワードが検出されました');
        if (text.includes('loop') || text.includes('cycle')) {
          reasons.push('明確な循環表現が含まれています');
        }
        break;
      case 'network':
        reasons.push('ネットワークや関係性を示すキーワードが検出されました');
        break;
    }

    reasons.push(`キーワード一致スコア: ${(score * 100).toFixed(1)}%`);

    return reasons.join(' / ');
  }

  /**
   * Get detector capabilities
   */
  getCapabilities() {
    return {
      supportedTypes: ['flow', 'tree', 'timeline', 'cycle', 'network'],
      detectionMethod: 'keyword-based',
      language: 'ja/en',
      features: [
        'Simple keyword matching',
        'Confidence scoring',
        'Basic element generation',
        'Reasoning explanation'
      ]
    };
  }

  /**
   * Test detector with sample texts
   * 🔄 Custom Instructions: テスト機能内蔵
   * Returns a summary of pass/fail results.
   */
  async testDetector(): Promise<{ total: number; passed: number; failures: { text: string; expected: string; got: string }[] }> {

    const testCases = [
      {
        text: "First, we start the process. Then we check the condition. Finally, we complete the workflow.",
        expected: 'flow' as DiagramType
      },
      {
        text: "The organization has a CEO at the top, with departments below and teams under each department.",
        expected: 'tree' as DiagramType
      },
      {
        text: "In 2020, we started the project. In 2021, we completed development. In 2022, we launched.",
        expected: 'timeline' as DiagramType
      },
      {
        text: "This process repeats continuously. After the final step, it loops back to the beginning.",
        expected: 'cycle' as DiagramType
      }
    ];

    const failures: { text: string; expected: string; got: string }[] = [];

    for (const testCase of testCases) {
      const result = await this.analyze({
        text: testCase.text,
        startMs: this.TEST_START_MS,
        endMs: this.TEST_END_MS
      });

      if (result.type !== testCase.expected) {
        failures.push({
          text: testCase.text.slice(0, 60),
          expected: testCase.expected,
          got: result.type
        });
      }
    }

    return {
      total: testCases.length,
      passed: testCases.length - failures.length,
      failures
    };
  }
}

export const simpleDiagramDetector = new SimpleDiagramDetector();