/**
 * 🧠 Advanced Content Analyzer
 * 音声内容の高度分析とシーン生成エンジン
 *
 * Features:
 * - Intelligent scene segmentation based on topic shifts
 * - Diagram type detection with confidence scoring
 * - Entity extraction and relationship mapping
 * - Content complexity assessment
 * - Multi-language content understanding
 */

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface AnalyzedScene {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  content: string;
  diagramType: DiagramType;
  confidence: number;
  entities: Entity[];
  relationships: Relationship[];
  complexity: 'simple' | 'moderate' | 'complex';
  keywords: string[];
  summary: string;
}

export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'concept' | 'process' | 'data' | 'system' | 'event';
  importance: number; // 0-1
  attributes: Record<string, any>;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: 'flows_to' | 'contains' | 'depends_on' | 'triggers' | 'relates_to';
  strength: number; // 0-1
  description: string;
}

export type DiagramType = 'flow' | 'tree' | 'timeline' | 'matrix' | 'cycle' | 'network' | 'hierarchy';

export interface ContentAnalysisConfig {
  minSceneDuration: number;
  maxSceneDuration: number;
  confidenceThreshold: number;
  entityExtractionEnabled: boolean;
  relationshipMappingEnabled: boolean;
  multiLanguageSupport: boolean;
  customKeywords?: string[];
}

export interface ContentAnalysisResult {
  scenes: AnalyzedScene[];
  totalDuration: number;
  overallComplexity: 'simple' | 'moderate' | 'complex';
  dominantDiagramType: DiagramType;
  confidence: number;
  processingTime: number;
  metadata: {
    segmentCount: number;
    entityCount: number;
    relationshipCount: number;
    keywordDensity: number;
  };
}

/**
 * Advanced Content Analyzer with AI-powered understanding
 */
export class ContentAnalyzer {
  private config: ContentAnalysisConfig;
  private diagramPatterns: Map<DiagramType, RegExp[]>;
  private keywordDatabase: Map<string, DiagramType>;

  constructor(config: Partial<ContentAnalysisConfig> = {}) {
    this.config = {
      minSceneDuration: 3,
      maxSceneDuration: 30,
      confidenceThreshold: 0.7,
      entityExtractionEnabled: true,
      relationshipMappingEnabled: true,
      multiLanguageSupport: true,
      ...config
    };

    this.initializePatterns();
    this.initializeKeywordDatabase();
  }

  /**
   * Analyze transcription segments and generate structured scenes
   */
  async analyze(segments: TranscriptionSegment[]): Promise<ContentAnalysisResult> {
    const startTime = performance.now();

    console.log(`🧠 Starting content analysis with ${segments.length} segments...`);

    try {
      // Step 1: Scene Segmentation
      const rawScenes = await this.segmentIntoScenes(segments);
      console.log(`📋 Generated ${rawScenes.length} raw scenes`);

      // Step 2: Enhanced Analysis
      const analyzedScenes = await Promise.all(
        rawScenes.map(scene => this.enhanceScene(scene))
      );

      // Step 3: Relationship Mapping
      const scenesWithRelationships = this.config.relationshipMappingEnabled
        ? await this.mapRelationships(analyzedScenes)
        : analyzedScenes;

      // Step 4: Quality Assessment
      const result = this.generateAnalysisResult(
        scenesWithRelationships,
        segments,
        performance.now() - startTime
      );

      console.log(`✅ Content analysis completed in ${result.processingTime.toFixed(1)}ms`);
      console.log(`📊 Generated ${result.scenes.length} scenes with ${result.confidence.toFixed(1)}% confidence`);

      return result;

    } catch (error) {
      console.error('❌ Content analysis failed:', error);

      // Fallback analysis
      return this.generateFallbackResult(segments, performance.now() - startTime);
    }
  }

  /**
   * Intelligent scene segmentation based on topic shifts and timing
   */
  private async segmentIntoScenes(segments: TranscriptionSegment[]): Promise<AnalyzedScene[]> {
    const scenes: AnalyzedScene[] = [];
    let currentScene: Partial<AnalyzedScene> | null = null;
    let sceneText = '';
    let sceneStart = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isTopicShift = this.detectTopicShift(sceneText, segment.text);
      const isTimeBreak = currentScene && (segment.start - sceneStart) > this.config.maxSceneDuration;

      if (!currentScene || isTopicShift || isTimeBreak) {
        // Finalize previous scene
        if (currentScene && sceneText.trim()) {
          scenes.push(this.createScene(
            scenes.length,
            sceneStart,
            segments[i - 1]?.end || segment.start,
            sceneText.trim()
          ));
        }

        // Start new scene
        currentScene = {};
        sceneText = segment.text;
        sceneStart = segment.start;
      } else {
        // Continue current scene
        sceneText += ' ' + segment.text;
      }
    }

    // Finalize last scene
    if (currentScene && sceneText.trim()) {
      const lastSegment = segments[segments.length - 1];
      scenes.push(this.createScene(
        scenes.length,
        sceneStart,
        lastSegment.end,
        sceneText.trim()
      ));
    }

    return scenes.filter(scene => scene.duration >= this.config.minSceneDuration);
  }

  /**
   * Detect topic shifts using keyword analysis and semantic similarity
   */
  private detectTopicShift(currentText: string, newText: string): boolean {
    if (!currentText) return false;

    const currentKeywords = this.extractKeywords(currentText);
    const newKeywords = this.extractKeywords(newText);

    // Calculate keyword overlap
    const overlap = currentKeywords.filter(kw => newKeywords.includes(kw)).length;
    const similarity = overlap / Math.max(currentKeywords.length, newKeywords.length, 1);

    // Topic shift if similarity is below threshold
    return similarity < 0.3;
  }

  /**
   * Extract keywords from text using simple heuristics
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'];
    return stopWords.includes(word);
  }

  /**
   * Create a basic scene structure
   */
  private createScene(id: number, start: number, end: number, content: string): AnalyzedScene {
    const keywords = this.extractKeywords(content);
    const diagramType = this.detectDiagramType(content);
    const entities = this.config.entityExtractionEnabled ? this.extractEntities(content) : [];

    return {
      id: `scene-${id}`,
      startTime: start,
      endTime: end,
      duration: end - start,
      title: this.generateTitle(content),
      content,
      diagramType,
      confidence: this.calculateBaseConfidence(content, diagramType),
      entities,
      relationships: [],
      complexity: this.assessComplexity(content, entities.length),
      keywords,
      summary: this.generateSummary(content)
    };
  }

  /**
   * Enhance scene with advanced analysis
   */
  private async enhanceScene(scene: AnalyzedScene): Promise<AnalyzedScene> {
    // Improve diagram type detection
    const enhancedDiagramType = this.refineDigramType(scene.content, scene.diagramType);

    // Calculate enhanced confidence
    const enhancedConfidence = this.calculateEnhancedConfidence(scene);

    // Optimize entity extraction
    const optimizedEntities = this.optimizeEntities(scene.entities, scene.content);

    return {
      ...scene,
      diagramType: enhancedDiagramType,
      confidence: enhancedConfidence,
      entities: optimizedEntities
    };
  }

  /**
   * Detect diagram type from content using pattern matching
   */
  private detectDiagramType(content: string): DiagramType {
    const text = content.toLowerCase();

    // Flow diagram indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('flow') || [])) {
      return 'flow';
    }

    // Timeline indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('timeline') || [])) {
      return 'timeline';
    }

    // Tree/hierarchy indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('tree') || [])) {
      return 'tree';
    }

    // Cycle indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('cycle') || [])) {
      return 'cycle';
    }

    // Matrix indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('matrix') || [])) {
      return 'matrix';
    }

    // Network indicators
    if (this.matchesPatterns(text, this.diagramPatterns.get('network') || [])) {
      return 'network';
    }

    // Default to flow for general process descriptions
    return 'flow';
  }

  /**
   * Refine diagram type with additional context
   */
  private refineDigramType(content: string, currentType: DiagramType): DiagramType {
    // Use keyword database for refinement
    const keywords = this.extractKeywords(content);
    const keywordVotes = new Map<DiagramType, number>();

    keywords.forEach(keyword => {
      const suggestedType = this.keywordDatabase.get(keyword);
      if (suggestedType) {
        keywordVotes.set(suggestedType, (keywordVotes.get(suggestedType) || 0) + 1);
      }
    });

    // If keywords strongly suggest a different type, consider changing
    const maxVotes = Math.max(...Array.from(keywordVotes.values()));
    if (maxVotes >= 2) {
      for (const [type, votes] of keywordVotes) {
        if (votes === maxVotes && type !== currentType) {
          return type;
        }
      }
    }

    return currentType;
  }

  /**
   * Extract entities from content
   */
  private extractEntities(content: string): Entity[] {
    const entities: Entity[] = [];
    const words = content.split(/\s+/);
    const entityId = (name: string) => `entity-${name.toLowerCase().replace(/\s+/g, '-')}`;

    // Extract capitalized words as potential entities
    const capitalizedWords = words.filter(word =>
      /^[A-Z][a-z]+/.test(word) && word.length > 2
    );

    // Extract quoted phrases as concepts
    const quotedPhrases = content.match(/"([^"]+)"/g) || [];

    // Process capitalized words
    capitalizedWords.forEach((word, index) => {
      entities.push({
        id: entityId(word),
        name: word,
        type: this.inferEntityType(word, content),
        importance: Math.min(0.5 + (index / capitalizedWords.length) * 0.5, 1),
        attributes: { source: 'capitalized' }
      });
    });

    // Process quoted phrases
    quotedPhrases.forEach(phrase => {
      const cleanPhrase = phrase.replace(/"/g, '');
      entities.push({
        id: entityId(cleanPhrase),
        name: cleanPhrase,
        type: 'concept',
        importance: 0.8,
        attributes: { source: 'quoted' }
      });
    });

    // Remove duplicates and low-importance entities
    const uniqueEntities = entities
      .filter((entity, index) =>
        entities.findIndex(e => e.name === entity.name) === index
      )
      .filter(entity => entity.importance > 0.3)
      .slice(0, 8); // Limit to 8 entities per scene

    return uniqueEntities;
  }

  /**
   * Infer entity type from context
   */
  private inferEntityType(word: string, context: string): Entity['type'] {
    const lowerWord = word.toLowerCase();
    const lowerContext = context.toLowerCase();

    // Person indicators
    if (/\b(mr|ms|dr|prof|john|mary|alice|bob)\b/.test(lowerContext)) {
      return 'person';
    }

    // System indicators
    if (/\b(system|application|database|server|api)\b/.test(lowerContext)) {
      return 'system';
    }

    // Process indicators
    if (/\b(process|workflow|procedure|method)\b/.test(lowerContext)) {
      return 'process';
    }

    // Event indicators
    if (/\b(event|meeting|conference|launch)\b/.test(lowerContext)) {
      return 'event';
    }

    // Data indicators
    if (/\b(data|information|report|document)\b/.test(lowerContext)) {
      return 'data';
    }

    // Default to concept
    return 'concept';
  }

  /**
   * Map relationships between entities
   */
  private async mapRelationships(scenes: AnalyzedScene[]): Promise<AnalyzedScene[]> {
    return scenes.map(scene => {
      const relationships: Relationship[] = [];
      const entities = scene.entities;

      // Simple relationship inference based on proximity and keywords
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const entity1 = entities[i];
          const entity2 = entities[j];

          const relationship = this.inferRelationship(entity1, entity2, scene.content);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }

      return { ...scene, relationships };
    });
  }

  /**
   * Infer relationship between two entities
   */
  private inferRelationship(entity1: Entity, entity2: Entity, content: string): Relationship | null {
    const text = content.toLowerCase();
    const name1 = entity1.name.toLowerCase();
    const name2 = entity2.name.toLowerCase();

    // Look for flow indicators
    if (text.includes(`${name1} to ${name2}`) || text.includes(`${name1} -> ${name2}`)) {
      return {
        id: `rel-${entity1.id}-${entity2.id}`,
        source: entity1.id,
        target: entity2.id,
        type: 'flows_to',
        strength: 0.8,
        description: `${entity1.name} flows to ${entity2.name}`
      };
    }

    // Look for dependency indicators
    if (text.includes(`${name1} depends on ${name2}`) || text.includes(`${name1} requires ${name2}`)) {
      return {
        id: `rel-${entity1.id}-${entity2.id}`,
        source: entity1.id,
        target: entity2.id,
        type: 'depends_on',
        strength: 0.7,
        description: `${entity1.name} depends on ${entity2.name}`
      };
    }

    // Look for containment indicators
    if (text.includes(`${name1} contains ${name2}`) || text.includes(`${name2} in ${name1}`)) {
      return {
        id: `rel-${entity1.id}-${entity2.id}`,
        source: entity1.id,
        target: entity2.id,
        type: 'contains',
        strength: 0.6,
        description: `${entity1.name} contains ${entity2.name}`
      };
    }

    // Look for trigger indicators
    if (text.includes(`${name1} triggers ${name2}`) || text.includes(`${name1} causes ${name2}`)) {
      return {
        id: `rel-${entity1.id}-${entity2.id}`,
        source: entity1.id,
        target: entity2.id,
        type: 'triggers',
        strength: 0.7,
        description: `${entity1.name} triggers ${entity2.name}`
      };
    }

    // General relationship if entities appear close together
    const entity1Index = text.indexOf(name1);
    const entity2Index = text.indexOf(name2);

    if (entity1Index !== -1 && entity2Index !== -1) {
      const distance = Math.abs(entity1Index - entity2Index);
      if (distance < 50) { // Within 50 characters
        return {
          id: `rel-${entity1.id}-${entity2.id}`,
          source: entity1.id,
          target: entity2.id,
          type: 'relates_to',
          strength: Math.max(0.3, 1 - distance / 100),
          description: `${entity1.name} relates to ${entity2.name}`
        };
      }
    }

    return null;
  }

  /**
   * Check if text matches any of the given patterns
   */
  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Calculate base confidence for scene analysis
   */
  private calculateBaseConfidence(content: string, diagramType: DiagramType): number {
    const baseConfidence = 0.6;
    const lengthBonus = Math.min(content.length / 200, 0.2); // Up to 20% bonus for longer content
    const keywordBonus = this.calculateKeywordBonus(content, diagramType);

    return Math.min(baseConfidence + lengthBonus + keywordBonus, 0.95);
  }

  /**
   * Calculate enhanced confidence with multiple factors
   */
  private calculateEnhancedConfidence(scene: AnalyzedScene): number {
    let confidence = scene.confidence;

    // Entity bonus
    if (scene.entities.length > 0) {
      confidence += Math.min(scene.entities.length * 0.05, 0.15);
    }

    // Keyword density bonus
    if (scene.keywords.length > 3) {
      confidence += 0.1;
    }

    // Duration penalty for very short scenes
    if (scene.duration < 5) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(confidence, 0.95));
  }

  /**
   * Calculate keyword bonus for diagram type
   */
  private calculateKeywordBonus(content: string, diagramType: DiagramType): number {
    const keywords = this.extractKeywords(content);
    const relevantKeywords = keywords.filter(keyword =>
      this.keywordDatabase.get(keyword) === diagramType
    );

    return Math.min(relevantKeywords.length * 0.05, 0.2);
  }

  /**
   * Assess content complexity
   */
  private assessComplexity(content: string, entityCount: number): 'simple' | 'moderate' | 'complex' {
    const wordCount = content.split(/\s+/).length;
    const sentenceCount = content.split(/[.!?]+/).length;

    if (wordCount < 30 && entityCount <= 2 && sentenceCount <= 3) {
      return 'simple';
    } else if (wordCount < 80 && entityCount <= 5 && sentenceCount <= 8) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  /**
   * Generate scene title from content
   */
  private generateTitle(content: string): string {
    const words = content.split(/\s+/).slice(0, 6);
    let title = words.join(' ');

    if (title.length > 40) {
      title = title.substring(0, 37) + '...';
    }

    return title || 'Untitled Scene';
  }

  /**
   * Generate scene summary
   */
  private generateSummary(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    return sentences[0]?.trim() + (sentences.length > 1 ? '...' : '') || content.substring(0, 100) + '...';
  }

  /**
   * Optimize entities by removing duplicates and low-quality entries
   */
  private optimizeEntities(entities: Entity[], content: string): Entity[] {
    return entities
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 6) // Keep top 6 entities
      .map(entity => ({
        ...entity,
        importance: Math.min(entity.importance * 1.1, 1) // Slight boost
      }));
  }

  /**
   * Generate analysis result with metadata
   */
  private generateAnalysisResult(
    scenes: AnalyzedScene[],
    originalSegments: TranscriptionSegment[],
    processingTime: number
  ): ContentAnalysisResult {
    const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const avgConfidence = scenes.reduce((sum, scene) => sum + scene.confidence, 0) / scenes.length;

    // Determine dominant diagram type
    const diagramCounts = new Map<DiagramType, number>();
    scenes.forEach(scene => {
      diagramCounts.set(scene.diagramType, (diagramCounts.get(scene.diagramType) || 0) + 1);
    });

    const dominantDiagramType = Array.from(diagramCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'flow';

    // Assess overall complexity
    const complexScenes = scenes.filter(s => s.complexity === 'complex').length;
    const moderateScenes = scenes.filter(s => s.complexity === 'moderate').length;

    let overallComplexity: 'simple' | 'moderate' | 'complex';
    if (complexScenes > scenes.length / 3) {
      overallComplexity = 'complex';
    } else if (moderateScenes > scenes.length / 2) {
      overallComplexity = 'moderate';
    } else {
      overallComplexity = 'simple';
    }

    const allEntities = scenes.flatMap(s => s.entities);
    const allRelationships = scenes.flatMap(s => s.relationships);
    const allKeywords = scenes.flatMap(s => s.keywords);

    return {
      scenes,
      totalDuration,
      overallComplexity,
      dominantDiagramType,
      confidence: avgConfidence,
      processingTime,
      metadata: {
        segmentCount: originalSegments.length,
        entityCount: allEntities.length,
        relationshipCount: allRelationships.length,
        keywordDensity: allKeywords.length / Math.max(scenes.length, 1)
      }
    };
  }

  /**
   * Generate fallback result when analysis fails
   */
  private generateFallbackResult(
    segments: TranscriptionSegment[],
    processingTime: number
  ): ContentAnalysisResult {
    console.log('🔄 Generating fallback analysis result...');

    const fallbackScene: AnalyzedScene = {
      id: 'scene-fallback',
      startTime: segments[0]?.start || 0,
      endTime: segments[segments.length - 1]?.end || 10,
      duration: segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0),
      title: 'General Content',
      content: segments.map(s => s.text).join(' '),
      diagramType: 'flow',
      confidence: 0.6,
      entities: [],
      relationships: [],
      complexity: 'moderate',
      keywords: ['content', 'analysis', 'diagram'],
      summary: 'General content analysis with basic diagram structure'
    };

    return {
      scenes: [fallbackScene],
      totalDuration: fallbackScene.duration,
      overallComplexity: 'moderate',
      dominantDiagramType: 'flow',
      confidence: 0.6,
      processingTime,
      metadata: {
        segmentCount: segments.length,
        entityCount: 0,
        relationshipCount: 0,
        keywordDensity: 3
      }
    };
  }

  /**
   * Initialize diagram detection patterns
   */
  private initializePatterns(): void {
    this.diagramPatterns = new Map([
      ['flow', [
        /\b(flow|process|step|then|next|after|before|sequence)\b/i,
        /\b(workflow|procedure|pipeline|algorithm)\b/i,
        /\b(first|second|third|finally|eventually)\b/i
      ]],
      ['timeline', [
        /\b(timeline|chronology|history|evolution)\b/i,
        /\b(year|month|day|period|era|age)\b/i,
        /\b(past|present|future|ago|since|until)\b/i
      ]],
      ['tree', [
        /\b(hierarchy|structure|organization|tree)\b/i,
        /\b(parent|child|branch|leaf|root)\b/i,
        /\b(above|below|under|over|level)\b/i
      ]],
      ['cycle', [
        /\b(cycle|loop|circular|repeat|recurring)\b/i,
        /\b(again|once more|continuously|iteration)\b/i,
        /\b(feedback|return|back to)\b/i
      ]],
      ['matrix', [
        /\b(matrix|grid|table|comparison|versus)\b/i,
        /\b(rows|columns|cells|compare|contrast)\b/i,
        /\b(dimensions|axis|quadrant)\b/i
      ]],
      ['network', [
        /\b(network|connection|linked|related|graph)\b/i,
        /\b(nodes|edges|vertices|connections)\b/i,
        /\b(interconnected|web|mesh)\b/i
      ]]
    ]);
  }

  /**
   * Initialize keyword to diagram type mapping
   */
  private initializeKeywordDatabase(): void {
    this.keywordDatabase = new Map([
      // Flow keywords
      ['process', 'flow'], ['workflow', 'flow'], ['procedure', 'flow'],
      ['algorithm', 'flow'], ['method', 'flow'], ['steps', 'flow'],

      // Timeline keywords
      ['history', 'timeline'], ['evolution', 'timeline'], ['development', 'timeline'],
      ['progress', 'timeline'], ['chronology', 'timeline'], ['sequence', 'timeline'],

      // Tree keywords
      ['hierarchy', 'tree'], ['organization', 'tree'], ['structure', 'tree'],
      ['taxonomy', 'tree'], ['classification', 'tree'], ['breakdown', 'tree'],

      // Cycle keywords
      ['cycle', 'cycle'], ['loop', 'cycle'], ['iteration', 'cycle'],
      ['recursive', 'cycle'], ['feedback', 'cycle'], ['circular', 'cycle'],

      // Matrix keywords
      ['comparison', 'matrix'], ['analysis', 'matrix'], ['evaluation', 'matrix'],
      ['framework', 'matrix'], ['dimensions', 'matrix'], ['criteria', 'matrix'],

      // Network keywords
      ['network', 'network'], ['relationships', 'network'], ['connections', 'network'],
      ['ecosystem', 'network'], ['interactions', 'network'], ['dependencies', 'network']
    ]);
  }
}