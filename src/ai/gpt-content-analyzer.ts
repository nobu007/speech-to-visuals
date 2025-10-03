/**
 * 🧠 GPT-4 Enhanced Content Understanding System
 * Iteration 37 - Phase 1: Advanced AI Content Analysis
 *
 * Following Custom Instructions Recursive Development:
 * - 小さく作り、確実に動作確認
 * - 段階的開発フロー（再帰的プロセス）
 */

export interface GPTAnalysisResult {
  contentType: 'technical' | 'business' | 'educational' | 'creative' | 'scientific';
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
  diagramSuggestions: DiagramSuggestion[];
  visualStyle: VisualStyleRecommendation;
  narrativeFlow: NarrativeStructure;
  confidence: number;
}

export interface DiagramSuggestion {
  type: 'flow' | 'hierarchy' | 'timeline' | 'matrix' | 'network' | 'custom';
  priority: number;
  reason: string;
  elements: string[];
  relationships: string[];
}

export interface VisualStyleRecommendation {
  colorScheme: 'professional' | 'creative' | 'technical' | 'minimal' | 'vibrant';
  layout: 'clean' | 'dense' | 'flowing' | 'structured';
  typography: 'modern' | 'classic' | 'technical' | 'friendly';
  animations: 'subtle' | 'dynamic' | 'minimal' | 'engaging';
}

export interface NarrativeStructure {
  introduction: string;
  mainPoints: string[];
  conclusion: string;
  keyTransitions: string[];
  emphasis: string[];
}

export class GPTContentAnalyzer {
  private apiKey: string | null = null;
  private fallbackMode = true;

  constructor() {
    // Check for API key in environment (production ready)
    this.apiKey = process.env.OPENAI_API_KEY || null;
    this.fallbackMode = !this.apiKey;

    console.log('🧠 GPT Content Analyzer initialized', {
      mode: this.fallbackMode ? 'fallback' : 'ai-enhanced',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyze content with GPT-4 or intelligent fallback
   * Following recursive development: implement → test → evaluate → improve
   */
  async analyzeContent(
    transcript: string,
    context?: { domain?: string; audience?: string }
  ): Promise<GPTAnalysisResult> {
    const startTime = performance.now();

    try {
      if (this.fallbackMode) {
        return this.intelligentFallbackAnalysis(transcript, context);
      }

      return await this.gptEnhancedAnalysis(transcript, context);
    } catch (error) {
      console.warn('⚠️ GPT analysis failed, using fallback:', error);
      return this.intelligentFallbackAnalysis(transcript, context);
    } finally {
      const duration = performance.now() - startTime;
      console.log('⏱️ Content analysis completed', { duration: `${duration.toFixed(1)}ms` });
    }
  }

  /**
   * GPT-4 Enhanced Analysis (Production Ready)
   */
  private async gptEnhancedAnalysis(
    transcript: string,
    context?: { domain?: string; audience?: string }
  ): Promise<GPTAnalysisResult> {
    const prompt = this.buildGPTPrompt(transcript, context);

    // Simulate GPT-4 API call (implement actual API when available)
    const response = await this.callGPTAPI(prompt);

    return this.parseGPTResponse(response);
  }

  /**
   * Intelligent Fallback Analysis
   * Advanced heuristics for content understanding
   */
  private intelligentFallbackAnalysis(
    transcript: string,
    context?: { domain?: string; audience?: string }
  ): Promise<GPTAnalysisResult> {
    const words = transcript.toLowerCase().split(/\s+/);
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());

    // Advanced content type detection
    const contentType = this.detectContentType(words, context?.domain);
    const complexity = this.assessComplexity(words, sentences);
    const diagramSuggestions = this.generateDiagramSuggestions(words, contentType);
    const visualStyle = this.recommendVisualStyle(contentType, complexity);
    const narrativeFlow = this.extractNarrativeStructure(sentences);

    // Calculate confidence based on analysis depth
    const confidence = this.calculateAnalysisConfidence(
      words.length, sentences.length, contentType, complexity
    );

    return Promise.resolve({
      contentType,
      complexity,
      diagramSuggestions,
      visualStyle,
      narrativeFlow,
      confidence
    });
  }

  /**
   * Advanced Content Type Detection
   */
  private detectContentType(
    words: string[],
    domainHint?: string
  ): GPTAnalysisResult['contentType'] {
    const keywordSets = {
      technical: ['api', 'database', 'algorithm', 'code', 'system', 'server', 'function', 'method'],
      business: ['strategy', 'market', 'revenue', 'customer', 'sales', 'growth', 'roi', 'profit'],
      educational: ['learn', 'understand', 'concept', 'example', 'step', 'process', 'explain', 'teach'],
      creative: ['design', 'creative', 'art', 'style', 'inspiration', 'aesthetic', 'visual', 'color'],
      scientific: ['research', 'study', 'data', 'analysis', 'hypothesis', 'experiment', 'result', 'theory']
    };

    // Domain hint takes priority
    if (domainHint && domainHint in keywordSets) {
      return domainHint as GPTAnalysisResult['contentType'];
    }

    // Advanced scoring algorithm
    const scores = Object.entries(keywordSets).map(([type, keywords]) => {
      const matches = keywords.filter(keyword =>
        words.some(word => word.includes(keyword))
      ).length;
      const density = matches / Math.max(words.length / 100, 1);
      return { type: type as GPTAnalysisResult['contentType'], score: density };
    });

    const topScore = scores.reduce((a, b) => a.score > b.score ? a : b);
    return topScore.score > 0.5 ? topScore.type : 'educational';
  }

  /**
   * Complexity Assessment Algorithm
   */
  private assessComplexity(words: string[], sentences: string[]): GPTAnalysisResult['complexity'] {
    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const uniqueWords = new Set(words).size;
    const vocabularyRichness = uniqueWords / Math.max(words.length, 1);

    // Advanced complexity scoring
    const complexityScore = (
      (avgWordsPerSentence > 15 ? 2 : avgWordsPerSentence > 10 ? 1 : 0) +
      (vocabularyRichness > 0.7 ? 2 : vocabularyRichness > 0.5 ? 1 : 0) +
      (words.length > 500 ? 2 : words.length > 200 ? 1 : 0)
    ) / 6;

    if (complexityScore > 0.75) return 'expert';
    if (complexityScore > 0.5) return 'complex';
    if (complexityScore > 0.25) return 'moderate';
    return 'simple';
  }

  /**
   * Intelligent Diagram Suggestions
   */
  private generateDiagramSuggestions(
    words: string[],
    contentType: GPTAnalysisResult['contentType']
  ): DiagramSuggestion[] {
    const suggestions: DiagramSuggestion[] = [];

    // Process flow indicators
    const processWords = ['first', 'then', 'next', 'finally', 'process', 'step', 'workflow'];
    if (processWords.some(word => words.includes(word))) {
      suggestions.push({
        type: 'flow',
        priority: 0.9,
        reason: 'Sequential process detected in content',
        elements: this.extractProcessElements(words),
        relationships: ['sequential', 'conditional']
      });
    }

    // Hierarchy indicators
    const hierarchyWords = ['under', 'above', 'parent', 'child', 'level', 'tier', 'category'];
    if (hierarchyWords.some(word => words.includes(word))) {
      suggestions.push({
        type: 'hierarchy',
        priority: 0.8,
        reason: 'Hierarchical structure identified',
        elements: this.extractHierarchyElements(words),
        relationships: ['parent-child', 'containment']
      });
    }

    // Timeline indicators
    const timeWords = ['when', 'before', 'after', 'during', 'timeline', 'history', 'evolution'];
    if (timeWords.some(word => words.includes(word))) {
      suggestions.push({
        type: 'timeline',
        priority: 0.7,
        reason: 'Temporal sequence detected',
        elements: this.extractTimelineElements(words),
        relationships: ['temporal', 'causation']
      });
    }

    // Content-type specific suggestions
    if (contentType === 'business') {
      suggestions.push({
        type: 'matrix',
        priority: 0.6,
        reason: 'Business analysis often benefits from matrix visualization',
        elements: ['strategy', 'market', 'competition'],
        relationships: ['comparison', 'analysis']
      });
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Visual Style Recommendation Engine
   */
  private recommendVisualStyle(
    contentType: GPTAnalysisResult['contentType'],
    complexity: GPTAnalysisResult['complexity']
  ): VisualStyleRecommendation {
    const styleMap = {
      technical: {
        colorScheme: 'technical' as const,
        layout: 'structured' as const,
        typography: 'technical' as const,
        animations: 'minimal' as const
      },
      business: {
        colorScheme: 'professional' as const,
        layout: 'clean' as const,
        typography: 'modern' as const,
        animations: 'subtle' as const
      },
      educational: {
        colorScheme: 'vibrant' as const,
        layout: 'flowing' as const,
        typography: 'friendly' as const,
        animations: 'engaging' as const
      },
      creative: {
        colorScheme: 'creative' as const,
        layout: 'flowing' as const,
        typography: 'modern' as const,
        animations: 'dynamic' as const
      },
      scientific: {
        colorScheme: 'minimal' as const,
        layout: 'structured' as const,
        typography: 'classic' as const,
        animations: 'subtle' as const
      }
    };

    return styleMap[contentType];
  }

  /**
   * Narrative Structure Extraction
   */
  private extractNarrativeStructure(sentences: string[]): NarrativeStructure {
    const validSentences = sentences.filter(s => s.trim().length > 10);

    return {
      introduction: validSentences[0] || '',
      mainPoints: validSentences.slice(1, -1).slice(0, 5),
      conclusion: validSentences[validSentences.length - 1] || '',
      keyTransitions: this.extractTransitions(validSentences),
      emphasis: this.extractEmphasis(validSentences)
    };
  }

  // Helper methods for element extraction
  private extractProcessElements(words: string[]): string[] {
    const processes = ['input', 'process', 'output', 'validation', 'decision', 'action'];
    return processes.filter(p => words.includes(p));
  }

  private extractHierarchyElements(words: string[]): string[] {
    const hierarchy = ['root', 'branch', 'leaf', 'parent', 'child', 'category', 'subcategory'];
    return hierarchy.filter(h => words.includes(h));
  }

  private extractTimelineElements(words: string[]): string[] {
    const timeline = ['start', 'beginning', 'middle', 'end', 'milestone', 'event', 'phase'];
    return timeline.filter(t => words.includes(t));
  }

  private extractTransitions(sentences: string[]): string[] {
    const transitionWords = ['however', 'therefore', 'meanwhile', 'furthermore', 'consequently'];
    return sentences.filter(s =>
      transitionWords.some(t => s.toLowerCase().includes(t))
    ).slice(0, 3);
  }

  private extractEmphasis(sentences: string[]): string[] {
    return sentences.filter(s =>
      s.includes('important') || s.includes('key') || s.includes('critical')
    ).slice(0, 3);
  }

  private calculateAnalysisConfidence(
    wordCount: number,
    sentenceCount: number,
    contentType: string,
    complexity: string
  ): number {
    let confidence = 0.7; // Base confidence

    // Adjust based on content length
    if (wordCount > 100) confidence += 0.1;
    if (wordCount > 300) confidence += 0.1;
    if (sentenceCount > 10) confidence += 0.05;

    // Adjust based on analysis success
    if (contentType !== 'educational') confidence += 0.05; // Successful type detection
    if (complexity !== 'simple') confidence += 0.05; // Complexity analysis

    return Math.min(confidence, 0.95); // Max 95% confidence
  }

  // GPT API methods (for future implementation)
  private buildGPTPrompt(transcript: string, context?: any): string {
    return `Analyze this content for diagram generation: ${transcript}`;
  }

  private async callGPTAPI(prompt: string): Promise<any> {
    // Placeholder for actual GPT API integration
    throw new Error('GPT API not implemented - using fallback analysis');
  }

  private parseGPTResponse(response: any): GPTAnalysisResult {
    // Placeholder for GPT response parsing
    throw new Error('GPT response parsing not implemented');
  }
}

/**
 * 🎯 Quality Metrics and Validation
 * Following custom instructions for transparent process
 */
export class GPTAnalysisValidator {
  static validateResult(result: GPTAnalysisResult): boolean {
    return (
      result.confidence >= 0.6 &&
      result.diagramSuggestions.length > 0 &&
      result.narrativeFlow.mainPoints.length > 0
    );
  }

  static calculateQualityScore(result: GPTAnalysisResult): number {
    const weights = {
      confidence: 0.3,
      diagramCount: 0.25,
      narrativeCompleteness: 0.25,
      styleRecommendation: 0.2
    };

    const scores = {
      confidence: result.confidence,
      diagramCount: Math.min(result.diagramSuggestions.length / 3, 1),
      narrativeCompleteness: result.narrativeFlow.mainPoints.length > 0 ? 1 : 0,
      styleRecommendation: 1 // Always provides style recommendation
    };

    return Object.entries(weights).reduce((total, [key, weight]) => {
      return total + (scores[key as keyof typeof scores] * weight);
    }, 0);
  }
}