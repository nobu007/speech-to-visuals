/**
 * Advanced Content Understanding Module
 * Next-Level Enhancement - Iteration 59
 *
 * Multi-modal content analysis with semantic understanding
 * より深い文脈理解とセマンティック分析システム
 *
 * Following custom instructions:
 * - Progressive enhancement with quality monitoring
 * - Modular design with clear interfaces
 * - Recursive improvement capability
 */

import { aiContentSuggestions, ContentAnalysis } from './ai-content-suggestions';

export interface SemanticEntity {
  id: string;
  text: string;
  type: 'concept' | 'process' | 'relationship' | 'attribute' | 'entity';
  importance: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  position: {
    start: number;
    end: number;
  };
  metadata?: Record<string, any>;
}

export interface ContextualRelationship {
  id: string;
  source: string;
  target: string;
  type: 'causal' | 'temporal' | 'hierarchical' | 'comparative' | 'associative';
  strength: number; // 0.0 - 1.0
  direction: 'unidirectional' | 'bidirectional';
  confidence: number; // 0.0 - 1.0
}

export interface SemanticStructure {
  entities: SemanticEntity[];
  relationships: ContextualRelationship[];
  topics: {
    primary: string[];
    secondary: string[];
  };
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number; // -1.0 to 1.0
  };
  complexity: {
    lexical: number; // 0-100
    syntactic: number; // 0-100
    semantic: number; // 0-100
  };
  domain: {
    detected: string[];
    confidence: number;
  };
}

export interface ContentUnderstanding {
  semantic: SemanticStructure;
  contextual: {
    purpose: 'explanation' | 'instruction' | 'description' | 'analysis' | 'narrative';
    audience: 'general' | 'technical' | 'academic' | 'business';
    formality: number; // 0.0 (casual) - 1.0 (formal)
  };
  structural: {
    coherence: number; // 0-100
    organization: 'linear' | 'hierarchical' | 'network' | 'mixed';
    flow: number; // 0-100
  };
  enhancement_opportunities: {
    immediate: string[];
    suggested: string[];
    advanced: string[];
  };
}

/**
 * Advanced Content Understanding Engine
 * 高度なコンテンツ理解エンジン
 */
export class AdvancedContentUnderstanding {
  private domainKeywords = {
    technology: ['システム', 'アプリ', 'ソフトウェア', 'AI', 'データ', 'technology', 'system', 'software', 'data'],
    business: ['戦略', '経営', 'マーケティング', '売上', '利益', 'business', 'strategy', 'marketing', 'profit'],
    education: ['学習', '教育', '理解', '知識', '学生', 'learning', 'education', 'knowledge', 'student'],
    science: ['研究', '実験', '理論', '仮説', '結果', 'research', 'experiment', 'theory', 'hypothesis'],
    healthcare: ['健康', '医療', '治療', '患者', '症状', 'health', 'medical', 'treatment', 'patient']
  };

  private relationshipPatterns = {
    causal: ['原因', '結果', 'because', 'therefore', 'causes', 'results in'],
    temporal: ['前', '後', '次', 'before', 'after', 'then', 'subsequently'],
    hierarchical: ['上位', '下位', '親', '子', 'parent', 'child', 'super', 'sub'],
    comparative: ['比較', '対比', '違い', 'compared to', 'versus', 'different from'],
    associative: ['関連', '関係', '繋がり', 'related to', 'associated with', 'connected to']
  };

  /**
   * 高度なコンテンツ理解分析の実行
   * Perform advanced content understanding analysis
   */
  async analyzeContent(text: string, options?: {
    includeSemantics?: boolean;
    includeContextual?: boolean;
    includeStructural?: boolean;
    language?: 'ja' | 'en' | 'auto';
  }): Promise<ContentUnderstanding> {
    console.log('🧠 Advanced Content Understanding: Starting deep analysis...');

    const startTime = performance.now();
    const opts = {
      includeSemantics: true,
      includeContextual: true,
      includeStructural: true,
      language: 'auto' as const,
      ...options
    };

    try {
      // Step 1: Semantic Structure Analysis (セマンティック構造分析)
      const semantic = opts.includeSemantics ?
        await this.analyzeSemanticStructure(text) :
        this.getDefaultSemanticStructure();

      // Step 2: Contextual Analysis (文脈分析)
      const contextual = opts.includeContextual ?
        await this.analyzeContextualFactors(text, semantic) :
        this.getDefaultContextualAnalysis();

      // Step 3: Structural Analysis (構造分析)
      const structural = opts.includeStructural ?
        await this.analyzeStructuralFactors(text, semantic) :
        this.getDefaultStructuralAnalysis();

      // Step 4: Enhancement Opportunities (改善機会の特定)
      const enhancement_opportunities = await this.identifyEnhancementOpportunities(
        text, semantic, contextual, structural
      );

      const processingTime = performance.now() - startTime;

      console.log(`✅ Advanced understanding completed in ${processingTime.toFixed(1)}ms`);
      console.log(`🎯 Detected ${semantic.entities.length} entities and ${semantic.relationships.length} relationships`);
      console.log(`📊 Primary topics: ${semantic.topics.primary.join(', ')}`);
      console.log(`🎨 Content purpose: ${contextual.purpose}`);

      return {
        semantic,
        contextual,
        structural,
        enhancement_opportunities
      };

    } catch (error) {
      console.error('❌ Advanced content understanding failed:', error);

      // Fallback to basic analysis (基本分析へのフォールバック)
      return this.getBasicUnderstanding(text);
    }
  }

  /**
   * セマンティック構造分析
   * Analyze semantic structure of content
   */
  private async analyzeSemanticStructure(text: string): Promise<SemanticStructure> {
    console.log('🔍 Analyzing semantic structure...');

    // Extract entities (エンティティ抽出)
    const entities = await this.extractSemanticEntities(text);

    // Identify relationships (関係性特定)
    const relationships = await this.identifyRelationships(text, entities);

    // Extract topics (トピック抽出)
    const topics = this.extractTopics(text, entities);

    // Analyze sentiment (感情分析)
    const sentiment = this.analyzeSentiment(text);

    // Calculate complexity (複雑度計算)
    const complexity = this.calculateComplexity(text, entities);

    // Detect domain (ドメイン検出)
    const domain = this.detectDomain(text, entities);

    return {
      entities,
      relationships,
      topics,
      sentiment,
      complexity,
      domain
    };
  }

  /**
   * セマンティックエンティティの抽出
   * Extract semantic entities from text
   */
  private async extractSemanticEntities(text: string): Promise<SemanticEntity[]> {
    const entities: SemanticEntity[] = [];
    let currentId = 1;

    // Split into sentences for analysis
    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0);

    for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
      const sentence = sentences[sentenceIndex].trim();

      // Extract concepts (概念抽出)
      const concepts = this.extractConcepts(sentence);
      concepts.forEach(concept => {
        entities.push({
          id: `entity-${currentId++}`,
          text: concept.text,
          type: 'concept',
          importance: concept.importance,
          confidence: concept.confidence,
          position: {
            start: text.indexOf(concept.text),
            end: text.indexOf(concept.text) + concept.text.length
          },
          metadata: {
            sentence: sentenceIndex,
            context: sentence
          }
        });
      });

      // Extract processes (プロセス抽出)
      const processes = this.extractProcesses(sentence);
      processes.forEach(process => {
        entities.push({
          id: `entity-${currentId++}`,
          text: process.text,
          type: 'process',
          importance: process.importance,
          confidence: process.confidence,
          position: {
            start: text.indexOf(process.text),
            end: text.indexOf(process.text) + process.text.length
          },
          metadata: {
            sentence: sentenceIndex,
            processType: process.processType
          }
        });
      });
    }

    // Filter and rank entities by importance
    return entities
      .filter(entity => entity.confidence > 0.5)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20); // Top 20 most important entities
  }

  /**
   * 概念の抽出
   * Extract concepts from text
   */
  private extractConcepts(text: string): Array<{
    text: string;
    importance: number;
    confidence: number;
  }> {
    const concepts: Array<{ text: string; importance: number; confidence: number }> = [];

    // Technical terms (専門用語)
    const technicalTerms = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    technicalTerms.forEach(term => {
      if (term.length > 3) {
        concepts.push({
          text: term,
          importance: 0.8,
          confidence: 0.7
        });
      }
    });

    // Japanese key terms (日本語キーワード)
    const japaneseKeyTerms = text.match(/[一-龯]+/g) || [];
    japaneseKeyTerms.forEach(term => {
      if (term.length >= 2) {
        concepts.push({
          text: term,
          importance: 0.6,
          confidence: 0.6
        });
      }
    });

    // Domain-specific terms (ドメイン固有用語)
    Object.values(this.domainKeywords).flat().forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        concepts.push({
          text: keyword,
          importance: 0.9,
          confidence: 0.8
        });
      }
    });

    return concepts.filter((concept, index, array) =>
      array.findIndex(c => c.text.toLowerCase() === concept.text.toLowerCase()) === index
    );
  }

  /**
   * プロセスの抽出
   * Extract processes from text
   */
  private extractProcesses(text: string): Array<{
    text: string;
    importance: number;
    confidence: number;
    processType: string;
  }> {
    const processes: Array<{
      text: string;
      importance: number;
      confidence: number;
      processType: string;
    }> = [];

    // Action verbs (動作動詞)
    const actionPatterns = [
      { pattern: /[一-龯]*する/g, type: 'action', confidence: 0.7 },
      { pattern: /[一-龯]*される/g, type: 'passive_action', confidence: 0.6 },
      { pattern: /\b\w+ing\b/g, type: 'continuous_action', confidence: 0.6 },
      { pattern: /\b\w+ed\b/g, type: 'completed_action', confidence: 0.5 }
    ];

    actionPatterns.forEach(({ pattern, type, confidence }) => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        if (match.length > 2) {
          processes.push({
            text: match,
            importance: 0.6,
            confidence,
            processType: type
          });
        }
      });
    });

    return processes;
  }

  /**
   * 関係性の特定
   * Identify relationships between entities
   */
  private async identifyRelationships(text: string, entities: SemanticEntity[]): Promise<ContextualRelationship[]> {
    const relationships: ContextualRelationship[] = [];
    let currentId = 1;

    for (const [type, patterns] of Object.entries(this.relationshipPatterns)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          // Find entities near this relationship pattern
          const nearbyEntities = entities.filter(entity => {
            const patternIndex = text.indexOf(pattern);
            const distance = Math.abs(entity.position.start - patternIndex);
            return distance < 100; // Within 100 characters
          });

          // Create relationships between nearby entities
          for (let i = 0; i < nearbyEntities.length - 1; i++) {
            for (let j = i + 1; j < nearbyEntities.length; j++) {
              relationships.push({
                id: `rel-${currentId++}`,
                source: nearbyEntities[i].id,
                target: nearbyEntities[j].id,
                type: type as any,
                strength: 0.7,
                direction: this.determineDirection(type),
                confidence: 0.6
              });
            }
          }
        }
      }
    }

    return relationships.slice(0, 15); // Limit to top 15 relationships
  }

  /**
   * 関係の方向性を決定
   * Determine relationship direction
   */
  private determineDirection(relationshipType: string): 'unidirectional' | 'bidirectional' {
    switch (relationshipType) {
      case 'causal':
      case 'temporal':
      case 'hierarchical':
        return 'unidirectional';
      case 'comparative':
      case 'associative':
        return 'bidirectional';
      default:
        return 'bidirectional';
    }
  }

  /**
   * トピック抽出
   * Extract topics from content
   */
  private extractTopics(text: string, entities: SemanticEntity[]): {
    primary: string[];
    secondary: string[];
  } {
    // Primary topics from high-importance entities (主要トピック)
    const primary = entities
      .filter(entity => entity.importance > 0.7)
      .map(entity => entity.text)
      .slice(0, 3);

    // Secondary topics from medium-importance entities (副次トピック)
    const secondary = entities
      .filter(entity => entity.importance > 0.5 && entity.importance <= 0.7)
      .map(entity => entity.text)
      .slice(0, 5);

    return { primary, secondary };
  }

  /**
   * 感情分析
   * Analyze sentiment
   */
  private analyzeSentiment(text: string): {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;
  } {
    const positiveWords = ['良い', '素晴らしい', '優秀', '成功', 'good', 'great', 'excellent', 'success'];
    const negativeWords = ['悪い', '問題', '失敗', '困難', 'bad', 'problem', 'failure', 'difficult'];

    let score = 0;
    const totalWords = text.split(/\s+/).length;

    positiveWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'gi')) || []).length;
      score += matches / totalWords;
    });

    negativeWords.forEach(word => {
      const matches = (text.match(new RegExp(word, 'gi')) || []).length;
      score -= matches / totalWords;
    });

    let overall: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (score > 0.1) overall = 'positive';
    else if (score < -0.1) overall = 'negative';

    return {
      overall,
      score: Math.max(-1, Math.min(1, score * 10)) // Normalize to -1 to 1
    };
  }

  /**
   * 複雑度計算
   * Calculate content complexity
   */
  private calculateComplexity(text: string, entities: SemanticEntity[]): {
    lexical: number;
    syntactic: number;
    semantic: number;
  } {
    // Lexical complexity (語彙の複雑さ)
    const words = text.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const lexical = Math.min(100, (uniqueWords.size / words.length) * 100);

    // Syntactic complexity (構文の複雑さ)
    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;
    const syntactic = Math.min(100, (avgSentenceLength / 20) * 100);

    // Semantic complexity (意味の複雑さ)
    const conceptEntities = entities.filter(e => e.type === 'concept');
    const semantic = Math.min(100, (conceptEntities.length / 10) * 100);

    return { lexical, syntactic, semantic };
  }

  /**
   * ドメイン検出
   * Detect content domain
   */
  private detectDomain(text: string, entities: SemanticEntity[]): {
    detected: string[];
    confidence: number;
  } {
    const domainScores: Record<string, number> = {};

    // Check keywords in text
    Object.entries(this.domainKeywords).forEach(([domain, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        const matches = (text.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        score += matches;
      });
      domainScores[domain] = score;
    });

    // Check entities
    entities.forEach(entity => {
      Object.entries(this.domainKeywords).forEach(([domain, keywords]) => {
        if (keywords.some(keyword => entity.text.toLowerCase().includes(keyword.toLowerCase()))) {
          domainScores[domain] = (domainScores[domain] || 0) + entity.importance;
        }
      });
    });

    // Sort by score and get top domains
    const sortedDomains = Object.entries(domainScores)
      .sort(([, a], [, b]) => b - a)
      .filter(([, score]) => score > 0);

    const detected = sortedDomains.slice(0, 2).map(([domain]) => domain);
    const confidence = sortedDomains.length > 0 ?
      Math.min(1, sortedDomains[0][1] / 5) : 0.5;

    return { detected, confidence };
  }

  /**
   * 文脈要因の分析
   * Analyze contextual factors
   */
  private async analyzeContextualFactors(text: string, semantic: SemanticStructure): Promise<{
    purpose: 'explanation' | 'instruction' | 'description' | 'analysis' | 'narrative';
    audience: 'general' | 'technical' | 'academic' | 'business';
    formality: number;
  }> {
    // Determine purpose (目的判定)
    const purpose = this.determinePurpose(text);

    // Determine audience (対象者判定)
    const audience = this.determineAudience(text, semantic);

    // Calculate formality (フォーマル度計算)
    const formality = this.calculateFormality(text);

    return { purpose, audience, formality };
  }

  private determinePurpose(text: string): 'explanation' | 'instruction' | 'description' | 'analysis' | 'narrative' {
    const instructionIndicators = ['手順', 'ステップ', '方法', 'step', 'how to', 'procedure'];
    const explanationIndicators = ['説明', '理由', 'なぜ', 'explain', 'because', 'reason'];
    const analysisIndicators = ['分析', '評価', '比較', 'analysis', 'evaluation', 'comparison'];
    const narrativeIndicators = ['物語', 'ストーリー', '経験', 'story', 'experience', 'narrative'];

    if (instructionIndicators.some(ind => text.includes(ind))) return 'instruction';
    if (explanationIndicators.some(ind => text.includes(ind))) return 'explanation';
    if (analysisIndicators.some(ind => text.includes(ind))) return 'analysis';
    if (narrativeIndicators.some(ind => text.includes(ind))) return 'narrative';

    return 'description'; // Default
  }

  private determineAudience(text: string, semantic: SemanticStructure): 'general' | 'technical' | 'academic' | 'business' {
    const technicalScore = semantic.entities.filter(e =>
      this.domainKeywords.technology.some(k => e.text.toLowerCase().includes(k.toLowerCase()))
    ).length;

    const businessScore = semantic.entities.filter(e =>
      this.domainKeywords.business.some(k => e.text.toLowerCase().includes(k.toLowerCase()))
    ).length;

    const academicIndicators = ['研究', '論文', '仮説', 'research', 'paper', 'hypothesis'];
    const academicScore = academicIndicators.reduce((score, indicator) =>
      score + (text.includes(indicator) ? 1 : 0), 0);

    if (technicalScore > 2) return 'technical';
    if (businessScore > 2) return 'business';
    if (academicScore > 1) return 'academic';

    return 'general';
  }

  private calculateFormality(text: string): number {
    const formalIndicators = ['である', 'であり', 'については', 'に関して', 'therefore', 'furthermore'];
    const informalIndicators = ['だよ', 'ですね', 'かな', 'って', 'okay', 'yeah'];

    let formalScore = 0;
    let informalScore = 0;

    formalIndicators.forEach(indicator => {
      formalScore += (text.match(new RegExp(indicator, 'g')) || []).length;
    });

    informalIndicators.forEach(indicator => {
      informalScore += (text.match(new RegExp(indicator, 'g')) || []).length;
    });

    const totalIndicators = formalScore + informalScore;
    if (totalIndicators === 0) return 0.6; // Neutral default

    return formalScore / totalIndicators;
  }

  /**
   * 構造要因の分析
   * Analyze structural factors
   */
  private async analyzeStructuralFactors(text: string, semantic: SemanticStructure): Promise<{
    coherence: number;
    organization: 'linear' | 'hierarchical' | 'network' | 'mixed';
    flow: number;
  }> {
    // Calculate coherence (一貫性計算)
    const coherence = this.calculateCoherence(text, semantic);

    // Determine organization pattern (組織パターン判定)
    const organization = this.determineOrganization(semantic);

    // Calculate flow (流れ計算)
    const flow = this.calculateFlow(text, semantic);

    return { coherence, organization, flow };
  }

  private calculateCoherence(text: string, semantic: SemanticStructure): number {
    // Topic consistency across content
    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    let coherenceScore = 70; // Base score

    // Check for topic consistency
    const primaryTopics = semantic.topics.primary;
    const topicMentions = sentences.map(sentence => {
      return primaryTopics.filter(topic =>
        sentence.toLowerCase().includes(topic.toLowerCase())
      ).length;
    });

    const avgTopicMentions = topicMentions.reduce((sum, count) => sum + count, 0) / sentences.length;
    coherenceScore += Math.min(30, avgTopicMentions * 15);

    return Math.min(100, coherenceScore);
  }

  private determineOrganization(semantic: SemanticStructure): 'linear' | 'hierarchical' | 'network' | 'mixed' {
    const hierarchicalRels = semantic.relationships.filter(r => r.type === 'hierarchical').length;
    const temporalRels = semantic.relationships.filter(r => r.type === 'temporal').length;
    const associativeRels = semantic.relationships.filter(r => r.type === 'associative').length;

    if (hierarchicalRels > temporalRels && hierarchicalRels > associativeRels) return 'hierarchical';
    if (temporalRels > hierarchicalRels && temporalRels > associativeRels) return 'linear';
    if (associativeRels > hierarchicalRels && associativeRels > temporalRels) return 'network';

    return 'mixed';
  }

  private calculateFlow(text: string, semantic: SemanticStructure): number {
    // Check for transition words and logical flow
    const transitionWords = ['まず', 'つぎに', '最後に', 'そして', 'しかし', 'first', 'next', 'then', 'however'];
    let flowScore = 60; // Base score

    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
    const transitionCount = transitionWords.reduce((count, word) =>
      count + (text.includes(word) ? 1 : 0), 0
    );

    flowScore += Math.min(30, (transitionCount / sentences.length) * 100);

    // Check temporal relationships for flow
    const temporalRels = semantic.relationships.filter(r => r.type === 'temporal');
    flowScore += Math.min(10, temporalRels.length * 2);

    return Math.min(100, flowScore);
  }

  /**
   * 改善機会の特定
   * Identify enhancement opportunities
   */
  private async identifyEnhancementOpportunities(
    text: string,
    semantic: SemanticStructure,
    contextual: any,
    structural: any
  ): Promise<{
    immediate: string[];
    suggested: string[];
    advanced: string[];
  }> {
    const opportunities = {
      immediate: [] as string[],
      suggested: [] as string[],
      advanced: [] as string[]
    };

    // Immediate improvements (即座の改善)
    if (structural.coherence < 70) {
      opportunities.immediate.push('トピックの一貫性を向上させる');
    }
    if (semantic.complexity.semantic > 80) {
      opportunities.immediate.push('概念の複雑さを簡素化する');
    }

    // Suggested improvements (推奨改善)
    if (contextual.formality < 0.3 && contextual.audience === 'business') {
      opportunities.suggested.push('ビジネス向けのフォーマルな表現に調整');
    }
    if (semantic.relationships.length < 3) {
      opportunities.suggested.push('概念間の関係性をより明確に表現');
    }

    // Advanced improvements (高度な改善)
    if (semantic.domain.confidence < 0.7) {
      opportunities.advanced.push('ドメイン特化型の専門用語を追加');
    }
    if (structural.organization === 'mixed') {
      opportunities.advanced.push('構造的な組織化パターンを統一');
    }

    return opportunities;
  }

  // Fallback methods (フォールバック メソッド)

  private getDefaultSemanticStructure(): SemanticStructure {
    return {
      entities: [],
      relationships: [],
      topics: { primary: [], secondary: [] },
      sentiment: { overall: 'neutral', score: 0 },
      complexity: { lexical: 50, syntactic: 50, semantic: 50 },
      domain: { detected: [], confidence: 0.5 }
    };
  }

  private getDefaultContextualAnalysis() {
    return {
      purpose: 'description' as const,
      audience: 'general' as const,
      formality: 0.5
    };
  }

  private getDefaultStructuralAnalysis() {
    return {
      coherence: 70,
      organization: 'mixed' as const,
      flow: 70
    };
  }

  private getBasicUnderstanding(text: string): ContentUnderstanding {
    return {
      semantic: this.getDefaultSemanticStructure(),
      contextual: this.getDefaultContextualAnalysis(),
      structural: this.getDefaultStructuralAnalysis(),
      enhancement_opportunities: {
        immediate: ['基本的な内容構造の改善'],
        suggested: ['図解表現の最適化'],
        advanced: ['AI支援による高度な分析']
      }
    };
  }

  /**
   * Get enhancement recommendations based on understanding
   * 理解に基づく改善推奨事項の取得
   */
  async getEnhancementRecommendations(understanding: ContentUnderstanding): Promise<string[]> {
    const recommendations: string[] = [];

    // Based on semantic analysis
    if (understanding.semantic.entities.length < 5) {
      recommendations.push('より多くの重要概念を明確に表現することで、図解の情報密度を向上');
    }

    // Based on contextual analysis
    if (understanding.contextual.audience === 'technical' && understanding.contextual.formality < 0.7) {
      recommendations.push('技術的な内容により適したフォーマルな表現を使用');
    }

    // Based on structural analysis
    if (understanding.structural.flow < 70) {
      recommendations.push('論理的な流れを改善するため移行語句を追加');
    }

    return recommendations;
  }
}

// Export singleton instance
export const advancedContentUnderstanding = new AdvancedContentUnderstanding();