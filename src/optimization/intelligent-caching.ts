/**
 * 🧠 Iteration 9: Smart Self-Optimization System
 * Intelligent Caching Module
 *
 * セマンティック類似性マッチングによる高度キャッシング
 * - 類似コンテンツのレイアウト再利用
 * - パターンライブラリの構築
 * - 50%以上のパフォーマンス向上を目標
 */

export interface ContentFingerprint {
  semanticHash: string;      // セマンティックハッシュ
  structurePattern: string;  // 構造パターン
  keyTerms: string[];        // キーワード
  complexity: number;        // 複雑度
  diagramHint: string;       // 図解ヒント
}

export interface CachedLayout {
  fingerprint: ContentFingerprint;
  layoutData: LayoutData;
  qualityScore: number;
  usageCount: number;
  lastUsed: Date;
  processingTime: number;
  metadata: {
    originalContent: string;
    diagramType: string;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface LayoutData {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    type: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    points?: Array<{ x: number; y: number }>;
  }>;
  bounds: {
    width: number;
    height: number;
    marginX: number;
    marginY: number;
  };
}

export interface SemanticSimilarity {
  score: number;           // 類似度スコア (0-1)
  matchingTerms: string[]; // 一致するキーワード
  structureMatch: number;  // 構造的類似度 (0-1)
  confidence: number;      // 信頼度 (0-1)
}

/**
 * Intelligent Layout Caching System
 * セマンティック類似性に基づく高度なキャッシング
 */
export class IntelligentCacheSystem {
  private layoutCache: Map<string, CachedLayout> = new Map();
  private patternLibrary: Map<string, LayoutData[]> = new Map();
  private maxCacheSize = 100;
  private similarityThreshold = 0.7;

  constructor() {
    console.log('🧠 Intelligent Cache System initialized - Iteration 9');
    this.initializePatternLibrary();
  }

  /**
   * 段階1: コンテンツフィンガープリント生成
   */
  async generateContentFingerprint(content: string): Promise<ContentFingerprint> {
    console.log('[Cache 9.1] Generating content fingerprint...');

    try {
      const startTime = performance.now();

      // セマンティックハッシュ生成
      const semanticHash = await this.computeSemanticHash(content);

      // 構造パターン抽出
      const structurePattern = this.extractStructurePattern(content);

      // キーワード抽出
      const keyTerms = this.extractKeyTerms(content);

      // 複雑度計算
      const complexity = this.calculateComplexity(content);

      // 図解ヒント生成
      const diagramHint = this.generateDiagramHint(content, keyTerms);

      const fingerprint: ContentFingerprint = {
        semanticHash,
        structurePattern,
        keyTerms,
        complexity,
        diagramHint
      };

      const fingerprintTime = performance.now() - startTime;
      console.log(`✅ Fingerprint generated in ${fingerprintTime.toFixed(2)}ms`);
      console.log('🔍 Fingerprint:', {
        hash: semanticHash.substring(0, 8) + '...',
        pattern: structurePattern,
        terms: keyTerms.slice(0, 3),
        complexity: complexity.toFixed(2)
      });

      return fingerprint;
    } catch (error) {
      console.error('❌ Fingerprint generation failed:', error);
      throw error;
    }
  }

  /**
   * 段階2: キャッシュ検索とマッチング
   */
  async findSimilarLayout(fingerprint: ContentFingerprint): Promise<{
    layout: LayoutData | null;
    similarity: SemanticSimilarity | null;
    cacheHit: boolean;
  }> {
    console.log('[Cache 9.2] Searching for similar layouts...');

    try {
      const startTime = performance.now();

      // 完全一致チェック
      const exactMatch = this.layoutCache.get(fingerprint.semanticHash);
      if (exactMatch) {
        exactMatch.usageCount++;
        exactMatch.lastUsed = new Date();
        console.log('🎯 Exact cache hit found!');

        return {
          layout: exactMatch.layoutData,
          similarity: {
            score: 1.0,
            matchingTerms: fingerprint.keyTerms,
            structureMatch: 1.0,
            confidence: 1.0
          },
          cacheHit: true
        };
      }

      // セマンティック類似性検索
      let bestMatch: CachedLayout | null = null;
      let bestSimilarity: SemanticSimilarity | null = null;

      for (const [hash, cachedLayout] of this.layoutCache) {
        const similarity = await this.calculateSemanticSimilarity(
          fingerprint,
          cachedLayout.fingerprint
        );

        if (similarity.score > this.similarityThreshold &&
            (!bestSimilarity || similarity.score > bestSimilarity.score)) {
          bestMatch = cachedLayout;
          bestSimilarity = similarity;
        }
      }

      const searchTime = performance.now() - startTime;

      if (bestMatch && bestSimilarity) {
        bestMatch.usageCount++;
        bestMatch.lastUsed = new Date();
        console.log(`🔍 Similar layout found (similarity: ${bestSimilarity.score.toFixed(3)}) in ${searchTime.toFixed(2)}ms`);

        return {
          layout: await this.adaptLayoutToFingerprint(bestMatch.layoutData, fingerprint),
          similarity: bestSimilarity,
          cacheHit: true
        };
      }

      console.log(`❌ No similar layout found in ${searchTime.toFixed(2)}ms`);
      return {
        layout: null,
        similarity: null,
        cacheHit: false
      };

    } catch (error) {
      console.error('❌ Cache search failed:', error);
      return { layout: null, similarity: null, cacheHit: false };
    }
  }

  /**
   * 段階3: レイアウトキャッシュ保存
   */
  async cacheLayout(
    fingerprint: ContentFingerprint,
    layoutData: LayoutData,
    qualityScore: number,
    processingTime: number,
    originalContent: string
  ): Promise<void> {
    console.log('[Cache 9.3] Caching layout...');

    try {
      const cachedLayout: CachedLayout = {
        fingerprint,
        layoutData: this.deepCloneLayout(layoutData),
        qualityScore,
        usageCount: 1,
        lastUsed: new Date(),
        processingTime,
        metadata: {
          originalContent: originalContent.substring(0, 100) + '...',
          diagramType: this.detectDiagramType(layoutData),
          nodeCount: layoutData.nodes.length,
          edgeCount: layoutData.edges.length
        }
      };

      // キャッシュに追加
      this.layoutCache.set(fingerprint.semanticHash, cachedLayout);

      // パターンライブラリに追加
      this.addToPatternLibrary(fingerprint.diagramHint, layoutData);

      // キャッシュサイズ管理
      await this.manageCacheSize();

      console.log(`✅ Layout cached. Cache size: ${this.layoutCache.size}`);
      console.log('📊 Cached layout stats:', {
        quality: qualityScore,
        nodes: layoutData.nodes.length,
        edges: layoutData.edges.length,
        type: cachedLayout.metadata.diagramType
      });

    } catch (error) {
      console.error('❌ Layout caching failed:', error);
    }
  }

  /**
   * 段階4: キャッシュ効率の評価
   */
  async evaluateCacheEfficiency(): Promise<{
    hitRate: number;
    avgSpeedGain: number;
    memoryUsage: number;
    qualityConsistency: number;
  }> {
    console.log('[Cache 9.4] Evaluating cache efficiency...');

    const cacheEntries = Array.from(this.layoutCache.values());

    if (cacheEntries.length === 0) {
      return {
        hitRate: 0,
        avgSpeedGain: 0,
        memoryUsage: 0,
        qualityConsistency: 0
      };
    }

    // ヒット率計算（使用回数が2回以上のエントリ）
    const hitEntries = cacheEntries.filter(entry => entry.usageCount > 1);
    const hitRate = (hitEntries.length / cacheEntries.length) * 100;

    // 平均速度向上計算
    const avgOriginalTime = cacheEntries.reduce((sum, entry) => sum + entry.processingTime, 0) / cacheEntries.length;
    const estimatedCacheTime = 100; // キャッシュアクセス時間
    const avgSpeedGain = ((avgOriginalTime - estimatedCacheTime) / avgOriginalTime) * 100;

    // メモリ使用量推定
    const avgLayoutSize = this.estimateLayoutSize(cacheEntries[0].layoutData);
    const memoryUsage = (cacheEntries.length * avgLayoutSize) / (1024 * 1024); // MB

    // 品質一貫性評価
    const qualityScores = cacheEntries.map(entry => entry.qualityScore);
    const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    const qualityVariance = qualityScores.reduce((sum, score) => sum + Math.pow(score - avgQuality, 2), 0) / qualityScores.length;
    const qualityConsistency = Math.max(0, 100 - (qualityVariance * 100));

    const efficiency = {
      hitRate,
      avgSpeedGain,
      memoryUsage,
      qualityConsistency
    };

    console.log('📈 Cache Efficiency Results:', efficiency);
    return efficiency;
  }

  // ===== Helper Methods =====

  private async computeSemanticHash(content: string): Promise<string> {
    // 簡易実装: セマンティックハッシュ生成
    // 実際の実装では word embeddings や transformer models を使用
    const words = content.toLowerCase().match(/\w+/g) || [];
    const keyWords = words.filter(word => word.length > 3);
    const sortedKeys = keyWords.sort().slice(0, 10);

    const hashInput = sortedKeys.join('|');
    const hash = this.simpleHash(hashInput);

    return hash.toString(16);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit制限
    }
    return Math.abs(hash);
  }

  private extractStructurePattern(content: string): string {
    // 構造パターンの抽出
    const patterns = [];

    if (content.match(/first|then|next|finally/i)) patterns.push('sequential');
    if (content.match(/if|when|case|condition/i)) patterns.push('conditional');
    if (content.match(/compare|versus|vs|difference/i)) patterns.push('comparison');
    if (content.match(/process|step|phase|stage/i)) patterns.push('process');
    if (content.match(/hierarchy|parent|child|tree/i)) patterns.push('hierarchical');

    return patterns.length > 0 ? patterns[0] : 'general';
  }

  private extractKeyTerms(content: string): string[] {
    // キーワード抽出
    const words = content.toLowerCase().match(/\w+/g) || [];
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'with', 'for']);

    const significantWords = words.filter(word =>
      word.length > 3 && !stopWords.has(word)
    );

    // 頻度カウント
    const wordCount = new Map<string, number>();
    significantWords.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // 頻度順でソートして上位10個を返す
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateComplexity(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / sentences.length;
    const uniqueWords = new Set(content.toLowerCase().match(/\w+/g) || []).size;
    const totalWords = (content.match(/\w+/g) || []).length;
    const vocabularyRichness = totalWords > 0 ? uniqueWords / totalWords : 0;

    // 0-1スケールで複雑度を計算
    const lengthComplexity = Math.min(avgSentenceLength / 100, 1);
    const vocabularyComplexity = vocabularyRichness;

    return (lengthComplexity + vocabularyComplexity) / 2;
  }

  private generateDiagramHint(content: string, keyTerms: string[]): string {
    // 図解タイプのヒント生成
    const flowKeywords = ['process', 'flow', 'step', 'procedure'];
    const treeKeywords = ['hierarchy', 'structure', 'organization', 'taxonomy'];
    const matrixKeywords = ['compare', 'matrix', 'table', 'grid'];
    const timelineKeywords = ['timeline', 'history', 'sequence', 'chronology'];

    const hasFlow = keyTerms.some(term => flowKeywords.some(kw => term.includes(kw)));
    const hasTree = keyTerms.some(term => treeKeywords.some(kw => term.includes(kw)));
    const hasMatrix = keyTerms.some(term => matrixKeywords.some(kw => term.includes(kw)));
    const hasTimeline = keyTerms.some(term => timelineKeywords.some(kw => term.includes(kw)));

    if (hasFlow) return 'flow';
    if (hasTree) return 'tree';
    if (hasMatrix) return 'matrix';
    if (hasTimeline) return 'timeline';

    return 'general';
  }

  private async calculateSemanticSimilarity(
    fp1: ContentFingerprint,
    fp2: ContentFingerprint
  ): Promise<SemanticSimilarity> {
    // キーワードの一致度
    const commonTerms = fp1.keyTerms.filter(term => fp2.keyTerms.includes(term));
    const termSimilarity = commonTerms.length / Math.max(fp1.keyTerms.length, fp2.keyTerms.length);

    // 構造パターンの一致度
    const structureMatch = fp1.structurePattern === fp2.structurePattern ? 1.0 : 0.5;

    // 複雑度の類似性
    const complexityDiff = Math.abs(fp1.complexity - fp2.complexity);
    const complexitySimilarity = 1 - complexityDiff;

    // 図解ヒントの一致度
    const diagramMatch = fp1.diagramHint === fp2.diagramHint ? 1.0 : 0.3;

    // 総合類似度計算（重み付き平均）
    const score = (
      termSimilarity * 0.4 +
      structureMatch * 0.3 +
      complexitySimilarity * 0.2 +
      diagramMatch * 0.1
    );

    // 信頼度計算
    const confidence = Math.min(1.0, score + (commonTerms.length > 3 ? 0.1 : 0));

    return {
      score,
      matchingTerms: commonTerms,
      structureMatch,
      confidence
    };
  }

  private async adaptLayoutToFingerprint(layout: LayoutData, fingerprint: ContentFingerprint): Promise<LayoutData> {
    // レイアウトをフィンガープリントに適応
    const adaptedLayout = this.deepCloneLayout(layout);

    // キーワードに基づいてラベルを調整（簡易実装）
    adaptedLayout.nodes.forEach((node, index) => {
      if (index < fingerprint.keyTerms.length) {
        node.label = fingerprint.keyTerms[index];
      }
    });

    return adaptedLayout;
  }

  private deepCloneLayout(layout: LayoutData): LayoutData {
    return JSON.parse(JSON.stringify(layout));
  }

  private detectDiagramType(layout: LayoutData): string {
    // レイアウトから図解タイプを推定
    const nodeCount = layout.nodes.length;
    const edgeCount = layout.edges.length;
    const ratio = edgeCount / nodeCount;

    if (ratio < 0.5) return 'tree';
    if (ratio > 1.5) return 'complex-flow';
    return 'flow';
  }

  private addToPatternLibrary(diagramHint: string, layout: LayoutData): void {
    if (!this.patternLibrary.has(diagramHint)) {
      this.patternLibrary.set(diagramHint, []);
    }

    const patterns = this.patternLibrary.get(diagramHint)!;
    patterns.push(this.deepCloneLayout(layout));

    // パターンライブラリのサイズ制限
    if (patterns.length > 20) {
      patterns.splice(0, patterns.length - 20);
    }
  }

  private async manageCacheSize(): Promise<void> {
    if (this.layoutCache.size <= this.maxCacheSize) return;

    // LRU eviction: 最も古く、使用頻度の低いエントリを削除
    const entries = Array.from(this.layoutCache.entries());
    entries.sort((a, b) => {
      const scoreA = a[1].usageCount / ((Date.now() - a[1].lastUsed.getTime()) / 86400000); // 日単位
      const scoreB = b[1].usageCount / ((Date.now() - b[1].lastUsed.getTime()) / 86400000);
      return scoreA - scoreB;
    });

    // 下位25%を削除
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.layoutCache.delete(entries[i][0]);
    }

    console.log(`🧹 Cache cleaned. Removed ${toRemove} entries. New size: ${this.layoutCache.size}`);
  }

  private estimateLayoutSize(layout: LayoutData): number {
    // レイアウトのメモリサイズを推定（バイト）
    return JSON.stringify(layout).length * 2; // UTF-16想定
  }

  private initializePatternLibrary(): void {
    // 基本的なパターンライブラリを初期化
    const basicPatterns = {
      flow: this.createBasicFlowPattern(),
      tree: this.createBasicTreePattern(),
      matrix: this.createBasicMatrixPattern()
    };

    Object.entries(basicPatterns).forEach(([type, pattern]) => {
      this.patternLibrary.set(type, [pattern]);
    });

    console.log('📚 Pattern library initialized with basic patterns');
  }

  private createBasicFlowPattern(): LayoutData {
    return {
      nodes: [
        { id: '1', x: 100, y: 100, width: 120, height: 60, label: 'Start', type: 'start' },
        { id: '2', x: 300, y: 100, width: 120, height: 60, label: 'Process', type: 'process' },
        { id: '3', x: 500, y: 100, width: 120, height: 60, label: 'End', type: 'end' }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', type: 'arrow' },
        { id: 'e2', source: '2', target: '3', type: 'arrow' }
      ],
      bounds: { width: 720, height: 260, marginX: 50, marginY: 50 }
    };
  }

  private createBasicTreePattern(): LayoutData {
    return {
      nodes: [
        { id: '1', x: 300, y: 50, width: 120, height: 60, label: 'Root', type: 'root' },
        { id: '2', x: 150, y: 150, width: 120, height: 60, label: 'Child 1', type: 'child' },
        { id: '3', x: 450, y: 150, width: 120, height: 60, label: 'Child 2', type: 'child' }
      ],
      edges: [
        { id: 'e1', source: '1', target: '2', type: 'line' },
        { id: 'e2', source: '1', target: '3', type: 'line' }
      ],
      bounds: { width: 720, height: 260, marginX: 50, marginY: 50 }
    };
  }

  private createBasicMatrixPattern(): LayoutData {
    return {
      nodes: [
        { id: '1', x: 100, y: 100, width: 100, height: 60, label: 'A1', type: 'cell' },
        { id: '2', x: 250, y: 100, width: 100, height: 60, label: 'B1', type: 'cell' },
        { id: '3', x: 100, y: 200, width: 100, height: 60, label: 'A2', type: 'cell' },
        { id: '4', x: 250, y: 200, width: 100, height: 60, label: 'B2', type: 'cell' }
      ],
      edges: [],
      bounds: { width: 500, height: 360, marginX: 50, marginY: 50 }
    };
  }
}

/**
 * デモンストレーション関数
 */
export async function demonstrateIntelligentCaching(): Promise<void> {
  console.log('\n🧠 === Intelligent Caching Demonstration ===\n');

  const cacheSystem = new IntelligentCacheSystem();

  try {
    // テストコンテンツ
    const testContents = [
      'This is a process flow for user registration. First, collect user information. Then, validate the data. Finally, create the account.',
      'The company hierarchy includes CEO at the top, followed by VPs, then managers, and finally individual contributors.',
      'User registration process: gather info, validate, create account, send confirmation.'
    ];

    for (let i = 0; i < testContents.length; i++) {
      console.log(`\n--- Processing Content ${i + 1} ---`);

      // 1. フィンガープリント生成
      const fingerprint = await cacheSystem.generateContentFingerprint(testContents[i]);

      // 2. キャッシュ検索
      const cacheResult = await cacheSystem.findSimilarLayout(fingerprint);

      if (cacheResult.cacheHit) {
        console.log('🎯 Cache hit! Layout reused.');
      } else {
        console.log('❌ Cache miss. Generating new layout...');

        // 3. 新しいレイアウト生成（模擬）
        const newLayout: LayoutData = {
          nodes: [
            { id: `n${i}1`, x: 100, y: 100, width: 120, height: 60, label: `Node ${i}1`, type: 'process' },
            { id: `n${i}2`, x: 300, y: 100, width: 120, height: 60, label: `Node ${i}2`, type: 'process' }
          ],
          edges: [
            { id: `e${i}1`, source: `n${i}1`, target: `n${i}2`, type: 'arrow' }
          ],
          bounds: { width: 520, height: 260, marginX: 50, marginY: 50 }
        };

        // 4. レイアウトをキャッシュ
        await cacheSystem.cacheLayout(fingerprint, newLayout, 0.85, 2000 + i * 500, testContents[i]);
      }
    }

    // 5. キャッシュ効率評価
    const efficiency = await cacheSystem.evaluateCacheEfficiency();
    console.log('\n📊 Final Cache Efficiency Results:', efficiency);

    console.log('\n✅ Intelligent Caching demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Caching demonstration failed:', error);
  }
}