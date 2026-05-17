/**
 * TASK-0017: Prompt Builder Module
 *
 * Constructs LLM analysis prompts for the Gemini API.
 * Supports language-aware prompting (Japanese/English) and
 * model-optimized prompts (Flash: concise, Pro: detailed).
 *
 * Wraps the existing prompt-templates.ts functions into a PromptBuilder
 * class with the API specified in TASK-0017.
 */

import { getGeminiAnalyzerPrompt } from './prompt-templates';
import type { Language } from './language-detector';

/** Diagram types that Gemini can detect */
const VALID_DIAGRAM_TYPES = ['flow', 'tree', 'timeline', 'matrix', 'cycle'] as const;

/** Model names for prompt optimization */
type ModelType = 'gemini-2.5-flash' | 'gemini-2.5-pro';

/**
 * PromptBuilder: Constructs analysis prompts for Gemini LLM
 *
 * Features:
 * - Language-aware prompts (Japanese/English)
 * - Model-optimized output instructions (Flash: concise, Pro: detailed)
 * - JSON output format specification
 * - Segmentation-aware prompt construction
 */
export class PromptBuilder {
  /**
   * Build an analysis prompt from text segments.
   *
   * @param text - The input text or concatenated segments to analyze
   * @param language - Language code ('ja', 'en', or 'auto')
   * @param complexity - Complexity score (0-1) used for model optimization
   * @returns Constructed prompt string
   */
  buildAnalysisPrompt(text: string, language: string = 'auto', complexity: number = 0.0): string {
    // Determine target model based on complexity
    const model: ModelType = complexity < 0.2 ? 'gemini-2.5-flash' : 'gemini-2.5-pro';

    // Get base prompt from prompt-templates
    const validLangs: Language[] = ['ja', 'en', 'zh', 'es', 'fr', 'de'];
    const lang: Language = validLangs.includes(language as Language) ? (language as Language) : 'auto';
    const basePrompt = getGeminiAnalyzerPrompt(text, lang);

    // Append model-specific optimization instructions
    const optimizationSuffix = this.getModelOptimizationSuffix(model);

    return basePrompt + '\n' + optimizationSuffix;
  }

  /**
   * Get the model-specific optimization suffix for the prompt.
   * Flash models get concise instructions; Pro models get detailed instructions.
   */
  private getModelOptimizationSuffix(model: ModelType): string {
    if (model === 'gemini-2.5-flash') {
      return '[Flash optimization: Be concise. Prioritize key entities and primary relationships. Minimize verbosity.]';
    }
    return '[Pro optimization: Be thorough. Include all entities, implicit relationships, and detailed reasoning. Extract maximum information from the text.]';
  }
}

/** Singleton instance for convenience */
export const promptBuilder = new PromptBuilder();
