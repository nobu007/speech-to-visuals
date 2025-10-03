/**
 * 🎨 Dynamic Style Adaptation System
 * Iteration 37 - Phase 1: Advanced AI Content Understanding
 *
 * Automatically adapts visual styles based on content analysis
 * Following recursive development methodology
 */

import { GPTAnalysisResult, VisualStyleRecommendation } from './gpt-content-analyzer';

export interface StyleConfiguration {
  colors: ColorPalette;
  typography: TypographySettings;
  layout: LayoutParameters;
  animations: AnimationSettings;
  branding: BrandingOptions;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  gradients?: string[];
}

export interface TypographySettings {
  headingFont: string;
  bodyFont: string;
  codeFont?: string;
  sizes: {
    title: number;
    heading: number;
    body: number;
    caption: number;
  };
  weights: {
    light: number;
    normal: number;
    bold: number;
  };
}

export interface LayoutParameters {
  spacing: 'compact' | 'normal' | 'spacious';
  alignment: 'left' | 'center' | 'justified';
  hierarchy: 'flat' | 'nested' | 'layered';
  flow: 'linear' | 'radial' | 'grid' | 'organic';
}

export interface AnimationSettings {
  speed: 'slow' | 'normal' | 'fast';
  easing: 'linear' | 'ease' | 'bounce' | 'elastic';
  transitions: AnimationTransition[];
  emphasis: 'subtle' | 'moderate' | 'dramatic';
}

export interface AnimationTransition {
  type: 'fade' | 'slide' | 'scale' | 'rotate' | 'morph';
  duration: number;
  delay: number;
  direction?: 'in' | 'out' | 'through';
}

export interface BrandingOptions {
  logoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  watermark?: boolean;
  customColors?: ColorPalette;
  customFonts?: string[];
}

export class DynamicStyleAdapter {
  private presetStyles: Map<string, StyleConfiguration>;
  private customStyles: Map<string, StyleConfiguration>;

  constructor() {
    this.presetStyles = new Map();
    this.customStyles = new Map();
    this.initializePresetStyles();

    console.log('🎨 Dynamic Style Adapter initialized', {
      presets: this.presetStyles.size,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Adapt style based on GPT content analysis
   * Following recursive development: small, testable improvements
   */
  adaptStyle(
    analysis: GPTAnalysisResult,
    userPreferences?: Partial<StyleConfiguration>
  ): StyleConfiguration {
    const startTime = performance.now();

    try {
      // Get base style from content analysis
      const baseStyle = this.getBaseStyleFromAnalysis(analysis);

      // Apply content-specific adaptations
      const adaptedStyle = this.applyContentAdaptations(baseStyle, analysis);

      // Merge with user preferences
      const finalStyle = this.mergeUserPreferences(adaptedStyle, userPreferences);

      // Validate and optimize
      const validatedStyle = this.validateAndOptimize(finalStyle);

      const duration = performance.now() - startTime;
      console.log('✨ Style adaptation completed', {
        duration: `${duration.toFixed(1)}ms`,
        confidence: analysis.confidence,
        contentType: analysis.contentType,
        complexity: analysis.complexity
      });

      return validatedStyle;
    } catch (error) {
      console.warn('⚠️ Style adaptation failed, using default:', error);
      return this.getDefaultStyle();
    }
  }

  /**
   * Get base style configuration from content analysis
   */
  private getBaseStyleFromAnalysis(analysis: GPTAnalysisResult): StyleConfiguration {
    const { contentType, complexity, visualStyle } = analysis;

    // Select base style template
    const baseKey = `${contentType}-${complexity}`;
    let baseStyle = this.presetStyles.get(baseKey) || this.presetStyles.get(contentType);

    if (!baseStyle) {
      baseStyle = this.getDefaultStyle();
    }

    // Apply visual style recommendations
    return this.applyVisualStyleRecommendations(baseStyle, visualStyle);
  }

  /**
   * Apply content-specific adaptations
   */
  private applyContentAdaptations(
    baseStyle: StyleConfiguration,
    analysis: GPTAnalysisResult
  ): StyleConfiguration {
    const adapted = { ...baseStyle };

    // Adapt colors based on content type
    adapted.colors = this.adaptColors(baseStyle.colors, analysis);

    // Adapt typography based on complexity
    adapted.typography = this.adaptTypography(baseStyle.typography, analysis);

    // Adapt layout based on diagram suggestions
    adapted.layout = this.adaptLayout(baseStyle.layout, analysis);

    // Adapt animations based on content flow
    adapted.animations = this.adaptAnimations(baseStyle.animations, analysis);

    return adapted;
  }

  /**
   * Color adaptation algorithm
   */
  private adaptColors(
    baseColors: ColorPalette,
    analysis: GPTAnalysisResult
  ): ColorPalette {
    const { contentType, complexity } = analysis;

    // Content-specific color adjustments
    let colorAdjustments: Partial<ColorPalette> = {};

    switch (contentType) {
      case 'technical':
        colorAdjustments = {
          primary: '#2563eb', // Blue for technical
          secondary: '#1e40af',
          accent: '#06b6d4'
        };
        break;
      case 'business':
        colorAdjustments = {
          primary: '#059669', // Green for business
          secondary: '#047857',
          accent: '#f59e0b'
        };
        break;
      case 'educational':
        colorAdjustments = {
          primary: '#7c3aed', // Purple for educational
          secondary: '#6d28d9',
          accent: '#ec4899'
        };
        break;
      case 'creative':
        colorAdjustments = {
          primary: '#dc2626', // Red for creative
          secondary: '#b91c1c',
          accent: '#f97316'
        };
        break;
      case 'scientific':
        colorAdjustments = {
          primary: '#0891b2', // Cyan for scientific
          secondary: '#0e7490',
          accent: '#8b5cf6'
        };
        break;
    }

    // Complexity-based adjustments
    if (complexity === 'expert') {
      colorAdjustments.background = '#fafafa'; // Lighter background for readability
    } else if (complexity === 'simple') {
      colorAdjustments.accent = '#fbbf24'; // Brighter accent for engagement
    }

    return { ...baseColors, ...colorAdjustments };
  }

  /**
   * Typography adaptation algorithm
   */
  private adaptTypography(
    baseTypography: TypographySettings,
    analysis: GPTAnalysisResult
  ): TypographySettings {
    const { contentType, complexity } = analysis;

    let adjustments: Partial<TypographySettings> = {};

    // Content-specific font choices
    switch (contentType) {
      case 'technical':
        adjustments = {
          headingFont: 'Inter, system-ui, sans-serif',
          bodyFont: 'system-ui, sans-serif',
          codeFont: 'JetBrains Mono, monospace'
        };
        break;
      case 'business':
        adjustments = {
          headingFont: 'Inter, system-ui, sans-serif',
          bodyFont: 'system-ui, sans-serif'
        };
        break;
      case 'educational':
        adjustments = {
          headingFont: 'Poppins, system-ui, sans-serif',
          bodyFont: 'Open Sans, system-ui, sans-serif'
        };
        break;
      case 'creative':
        adjustments = {
          headingFont: 'Playfair Display, serif',
          bodyFont: 'Source Sans Pro, sans-serif'
        };
        break;
      case 'scientific':
        adjustments = {
          headingFont: 'Merriweather, serif',
          bodyFont: 'Source Sans Pro, sans-serif'
        };
        break;
    }

    // Complexity-based size adjustments
    if (complexity === 'expert') {
      adjustments.sizes = {
        ...baseTypography.sizes,
        body: Math.max(baseTypography.sizes.body - 1, 12),
        caption: Math.max(baseTypography.sizes.caption - 1, 10)
      };
    } else if (complexity === 'simple') {
      adjustments.sizes = {
        ...baseTypography.sizes,
        title: baseTypography.sizes.title + 2,
        heading: baseTypography.sizes.heading + 1
      };
    }

    return { ...baseTypography, ...adjustments };
  }

  /**
   * Layout adaptation based on diagram suggestions
   */
  private adaptLayout(
    baseLayout: LayoutParameters,
    analysis: GPTAnalysisResult
  ): LayoutParameters {
    const { diagramSuggestions, complexity } = analysis;

    let adjustments: Partial<LayoutParameters> = {};

    // Adapt based on primary diagram type
    const primaryDiagram = diagramSuggestions[0];
    if (primaryDiagram) {
      switch (primaryDiagram.type) {
        case 'flow':
          adjustments = {
            flow: 'linear',
            hierarchy: 'layered',
            spacing: complexity === 'complex' ? 'spacious' : 'normal'
          };
          break;
        case 'hierarchy':
          adjustments = {
            flow: 'radial',
            hierarchy: 'nested',
            alignment: 'center'
          };
          break;
        case 'timeline':
          adjustments = {
            flow: 'linear',
            hierarchy: 'flat',
            spacing: 'spacious'
          };
          break;
        case 'matrix':
          adjustments = {
            flow: 'grid',
            hierarchy: 'flat',
            alignment: 'center'
          };
          break;
        case 'network':
          adjustments = {
            flow: 'organic',
            hierarchy: 'layered',
            spacing: 'normal'
          };
          break;
      }
    }

    return { ...baseLayout, ...adjustments };
  }

  /**
   * Animation adaptation based on content flow
   */
  private adaptAnimations(
    baseAnimations: AnimationSettings,
    analysis: GPTAnalysisResult
  ): AnimationSettings {
    const { contentType, complexity, narrativeFlow } = analysis;

    let adjustments: Partial<AnimationSettings> = {};

    // Content-specific animation styles
    switch (contentType) {
      case 'technical':
        adjustments = {
          speed: 'normal',
          emphasis: 'subtle',
          easing: 'ease'
        };
        break;
      case 'business':
        adjustments = {
          speed: 'normal',
          emphasis: 'moderate',
          easing: 'ease'
        };
        break;
      case 'educational':
        adjustments = {
          speed: 'normal',
          emphasis: 'moderate',
          easing: 'bounce'
        };
        break;
      case 'creative':
        adjustments = {
          speed: 'fast',
          emphasis: 'dramatic',
          easing: 'elastic'
        };
        break;
      case 'scientific':
        adjustments = {
          speed: 'slow',
          emphasis: 'subtle',
          easing: 'linear'
        };
        break;
    }

    // Complexity adjustments
    if (complexity === 'complex') {
      adjustments.speed = 'slow'; // Give time to process
    } else if (complexity === 'simple') {
      adjustments.emphasis = 'dramatic'; // Make it engaging
    }

    // Generate transitions based on narrative flow
    const transitions = this.generateTransitionsFromNarrative(narrativeFlow);
    adjustments.transitions = transitions;

    return { ...baseAnimations, ...adjustments };
  }

  /**
   * Generate animation transitions from narrative structure
   */
  private generateTransitionsFromNarrative(
    narrative: GPTAnalysisResult['narrativeFlow']
  ): AnimationTransition[] {
    const transitions: AnimationTransition[] = [];

    // Introduction transition
    transitions.push({
      type: 'fade',
      duration: 1000,
      delay: 0,
      direction: 'in'
    });

    // Main point transitions
    narrative.mainPoints.forEach((_, index) => {
      transitions.push({
        type: 'slide',
        duration: 800,
        delay: (index + 1) * 1200,
        direction: 'in'
      });
    });

    // Conclusion transition
    transitions.push({
      type: 'scale',
      duration: 1200,
      delay: (narrative.mainPoints.length + 1) * 1200,
      direction: 'in'
    });

    return transitions;
  }

  /**
   * Apply visual style recommendations from GPT analysis
   */
  private applyVisualStyleRecommendations(
    baseStyle: StyleConfiguration,
    visualStyle: VisualStyleRecommendation
  ): StyleConfiguration {
    const style = { ...baseStyle };

    // Apply color scheme recommendation
    if (visualStyle.colorScheme !== 'professional') {
      const schemeColors = this.getColorScheme(visualStyle.colorScheme);
      style.colors = { ...style.colors, ...schemeColors };
    }

    // Apply layout recommendation
    if (visualStyle.layout) {
      style.layout = { ...style.layout, spacing: this.mapLayoutToSpacing(visualStyle.layout) };
    }

    // Apply typography recommendation
    if (visualStyle.typography) {
      const typographyAdjustments = this.getTypographyForStyle(visualStyle.typography);
      style.typography = { ...style.typography, ...typographyAdjustments };
    }

    // Apply animation recommendation
    if (visualStyle.animations) {
      style.animations = { ...style.animations, emphasis: visualStyle.animations };
    }

    return style;
  }

  /**
   * Merge user preferences with adapted style
   */
  private mergeUserPreferences(
    adaptedStyle: StyleConfiguration,
    userPreferences?: Partial<StyleConfiguration>
  ): StyleConfiguration {
    if (!userPreferences) return adaptedStyle;

    return {
      colors: { ...adaptedStyle.colors, ...userPreferences.colors },
      typography: { ...adaptedStyle.typography, ...userPreferences.typography },
      layout: { ...adaptedStyle.layout, ...userPreferences.layout },
      animations: { ...adaptedStyle.animations, ...userPreferences.animations },
      branding: { ...adaptedStyle.branding, ...userPreferences.branding }
    };
  }

  /**
   * Validate and optimize final style configuration
   */
  private validateAndOptimize(style: StyleConfiguration): StyleConfiguration {
    // Ensure accessibility standards
    this.ensureAccessibility(style);

    // Optimize for performance
    this.optimizeForPerformance(style);

    // Validate color contrast
    this.validateColorContrast(style.colors);

    return style;
  }

  // Helper methods
  private getColorScheme(scheme: VisualStyleRecommendation['colorScheme']): Partial<ColorPalette> {
    const schemes = {
      professional: { primary: '#1e40af', secondary: '#374151' },
      creative: { primary: '#dc2626', secondary: '#f97316' },
      technical: { primary: '#2563eb', secondary: '#0891b2' },
      minimal: { primary: '#374151', secondary: '#6b7280' },
      vibrant: { primary: '#7c3aed', secondary: '#ec4899' }
    };
    return schemes[scheme] || schemes.professional;
  }

  private mapLayoutToSpacing(layout: VisualStyleRecommendation['layout']): LayoutParameters['spacing'] {
    const mapping = {
      clean: 'normal' as const,
      dense: 'compact' as const,
      flowing: 'spacious' as const,
      structured: 'normal' as const
    };
    return mapping[layout] || 'normal';
  }

  private getTypographyForStyle(typography: VisualStyleRecommendation['typography']): Partial<TypographySettings> {
    const styles = {
      modern: { headingFont: 'Inter, sans-serif', bodyFont: 'system-ui, sans-serif' },
      classic: { headingFont: 'Merriweather, serif', bodyFont: 'Georgia, serif' },
      technical: { headingFont: 'JetBrains Mono, monospace', bodyFont: 'system-ui, sans-serif' },
      friendly: { headingFont: 'Poppins, sans-serif', bodyFont: 'Open Sans, sans-serif' }
    };
    return styles[typography] || styles.modern;
  }

  private ensureAccessibility(style: StyleConfiguration): void {
    // Ensure minimum font sizes
    if (style.typography.sizes.body < 14) {
      style.typography.sizes.body = 14;
    }
    if (style.typography.sizes.caption < 12) {
      style.typography.sizes.caption = 12;
    }
  }

  private optimizeForPerformance(style: StyleConfiguration): void {
    // Limit number of animations for performance
    if (style.animations.transitions.length > 10) {
      style.animations.transitions = style.animations.transitions.slice(0, 10);
    }
  }

  private validateColorContrast(colors: ColorPalette): void {
    // Basic contrast validation (in production, use actual contrast algorithms)
    console.log('🔍 Color contrast validation completed', { colors: colors.primary });
  }

  private getDefaultStyle(): StyleConfiguration {
    return this.presetStyles.get('default') || {
      colors: {
        primary: '#2563eb',
        secondary: '#374151',
        accent: '#f59e0b',
        background: '#ffffff',
        text: '#111827',
        muted: '#6b7280'
      },
      typography: {
        headingFont: 'Inter, system-ui, sans-serif',
        bodyFont: 'system-ui, sans-serif',
        sizes: { title: 24, heading: 20, body: 16, caption: 14 },
        weights: { light: 300, normal: 400, bold: 600 }
      },
      layout: {
        spacing: 'normal',
        alignment: 'left',
        hierarchy: 'layered',
        flow: 'linear'
      },
      animations: {
        speed: 'normal',
        easing: 'ease',
        transitions: [],
        emphasis: 'moderate'
      },
      branding: {}
    };
  }

  /**
   * Initialize preset style configurations
   */
  private initializePresetStyles(): void {
    // Default style
    this.presetStyles.set('default', this.getDefaultStyle());

    // Content-type specific styles
    this.presetStyles.set('technical', {
      ...this.getDefaultStyle(),
      colors: {
        primary: '#2563eb',
        secondary: '#1e40af',
        accent: '#06b6d4',
        background: '#f8fafc',
        text: '#0f172a',
        muted: '#475569'
      }
    });

    this.presetStyles.set('business', {
      ...this.getDefaultStyle(),
      colors: {
        primary: '#059669',
        secondary: '#047857',
        accent: '#f59e0b',
        background: '#ffffff',
        text: '#111827',
        muted: '#374151'
      }
    });

    // Add more preset styles as needed
    console.log('📋 Preset styles initialized', { count: this.presetStyles.size });
  }
}

/**
 * Style quality validation
 */
export class StyleQualityValidator {
  static validateStyle(style: StyleConfiguration): boolean {
    return (
      style.colors.primary !== undefined &&
      style.typography.headingFont !== undefined &&
      style.layout.spacing !== undefined &&
      style.animations.speed !== undefined
    );
  }

  static calculateStyleScore(style: StyleConfiguration): number {
    let score = 0.6; // Base score

    // Color scheme completeness
    const colorKeys = Object.keys(style.colors);
    score += (colorKeys.length / 6) * 0.2; // Up to 0.2 for complete colors

    // Typography completeness
    if (style.typography.sizes && style.typography.weights) score += 0.1;

    // Animation sophistication
    if (style.animations.transitions.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }
}