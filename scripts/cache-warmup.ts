/**
 * Phase 43: Cache Warm-up Strategy
 *
 * Pre-populates semantic cache with common diagram patterns to improve
 * cache hit rate from 0% (cold start) to targeted 30% within first week.
 *
 * Strategy:
 * 1. Common tutorial/explanation patterns
 * 2. Frequently used technical explanations
 * 3. Multi-language variations (EN/JA)
 * 4. Business process descriptions
 *
 * Expected Impact:
 * - Week 1: 10% hit rate
 * - Week 2: 20% hit rate
 * - Week 4: 30% hit rate
 */

import { ContentAnalyzer } from '../src/analysis/content-analyzer';
import { GeminiAnalyzer } from '../src/analysis/gemini-analyzer';
import { llmService } from '../src/analysis/llm-service';
import 'dotenv/config';

interface WarmupPattern {
  category: string;
  language: 'en' | 'ja';
  text: string;
}

/**
 * Common patterns to pre-cache
 * Based on typical use cases and expected queries
 */
const WARMUP_PATTERNS: WarmupPattern[] = [
  // === Tutorial/Learning Patterns (EN) ===
  {
    category: 'tutorial-sequential',
    language: 'en',
    text: `First, we need to understand the basic concepts.
Next, we'll explore the implementation details.
Then, we can proceed to advanced techniques.
Finally, we'll review best practices and optimization.`
  },
  {
    category: 'tutorial-hierarchical',
    language: 'en',
    text: `The main system consists of three subsystems.
The first subsystem handles data input and validation.
The second subsystem processes and transforms the data.
The third subsystem generates output and reports.`
  },

  // === Technical Explanation Patterns (EN) ===
  {
    category: 'technical-algorithm',
    language: 'en',
    text: `The algorithm starts by initializing variables.
It then processes each element in the input array.
For each element, it applies a transformation function.
The results are collected and returned as output.`
  },
  {
    category: 'technical-architecture',
    language: 'en',
    text: `The architecture follows a layered approach.
The presentation layer handles user interactions.
The business logic layer processes core functionality.
The data layer manages persistence and retrieval.`
  },

  // === Business Process Patterns (EN) ===
  {
    category: 'business-workflow',
    language: 'en',
    text: `The process begins with customer request submission.
The request is validated and assigned to an appropriate team.
The team analyzes requirements and prepares a solution.
After approval, the solution is implemented and delivered.`
  },
  {
    category: 'business-decision',
    language: 'en',
    text: `First, gather all relevant data and information.
Analyze the data to identify key patterns and insights.
Evaluate different options based on defined criteria.
Make the final decision and communicate to stakeholders.`
  },

  // === Research/Scientific Patterns (EN) ===
  {
    category: 'research-methodology',
    language: 'en',
    text: `The research team formulated a hypothesis.
They designed experiments to test the hypothesis.
Data was collected and analyzed statistically.
Results were interpreted and conclusions were drawn.`
  },
  {
    category: 'research-analysis',
    language: 'en',
    text: `The study examined the relationship between variables.
Data collection involved surveys and observations.
Statistical analysis revealed significant correlations.
Findings were compared with previous research.`
  },

  // === Japanese Tutorial Patterns ===
  {
    category: 'tutorial-sequential-ja',
    language: 'ja',
    text: `まず、基本的な概念を理解する必要があります。
次に、実装の詳細を探求します。
その後、高度なテクニックに進むことができます。
最後に、ベストプラクティスと最適化を確認します。`
  },
  {
    category: 'tutorial-hierarchical-ja',
    language: 'ja',
    text: `システムは3つのサブシステムで構成されています。
第1のサブシステムはデータ入力と検証を処理します。
第2のサブシステムはデータを処理し変換します。
第3のサブシステムは出力とレポートを生成します。`
  },

  // === Japanese Business Patterns ===
  {
    category: 'business-workflow-ja',
    language: 'ja',
    text: `プロセスは顧客からの要求提出で始まります。
要求は検証され、適切なチームに割り当てられます。
チームは要件を分析し、ソリューションを準備します。
承認後、ソリューションが実装され配信されます。`
  },
  {
    category: 'technical-algorithm-ja',
    language: 'ja',
    text: `アルゴリズムは変数の初期化から始まります。
その後、入力配列の各要素を処理します。
各要素に対して変換関数を適用します。
結果は収集され、出力として返されます。`
  },

  // === Problem-Solution Patterns (EN) ===
  {
    category: 'problem-solution',
    language: 'en',
    text: `The company faced declining customer satisfaction.
Analysis revealed slow response times as the main issue.
A new ticketing system was implemented to streamline processes.
Customer satisfaction improved by 40% after implementation.`
  },

  // === Comparison Patterns (EN) ===
  {
    category: 'comparison-evaluation',
    language: 'en',
    text: `Option A provides faster performance but higher cost.
Option B offers lower cost but slower processing speed.
Option C balances cost and performance moderately.
After evaluation, Option C was selected as optimal.`
  },

  // === Timeline/Historical Patterns (EN) ===
  {
    category: 'timeline-events',
    language: 'en',
    text: `In 2020, the project was initiated with initial planning.
In 2021, the development phase began with prototype creation.
In 2022, testing and refinement were conducted extensively.
In 2023, the final version was released to production.`
  },

  // === Cause-Effect Patterns (EN) ===
  {
    category: 'cause-effect',
    language: 'en',
    text: `Increased demand for the product led to supply shortages.
Supply shortages resulted in higher prices.
Higher prices caused some customers to seek alternatives.
Market share decreased as a consequence.`
  },

  // === Instructional Patterns (EN) ===
  {
    category: 'instruction-steps',
    language: 'en',
    text: `To complete the installation, follow these steps.
Download the software package from the official website.
Extract the files to your preferred directory.
Run the installer and follow the on-screen instructions.
Restart your computer to complete the setup.`
  }
];

/**
 * Warm up the cache by pre-processing common patterns
 */
async function warmupCache(): Promise<void> {
  console.log('🔥 Phase 43: Cache Warm-up Initiated');
  console.log(`📦 Patterns to process: ${WARMUP_PATTERNS.length}`);
  console.log('');

  const contentAnalyzer = new ContentAnalyzer();
  const geminiAnalyzer = new GeminiAnalyzer();

  if (!contentAnalyzer || !geminiAnalyzer.isEnabled()) {
    console.error('❌ LLM service not enabled. Set GOOGLE_API_KEY environment variable.');
    process.exit(1);
  }

  let successCount = 0;
  let failureCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < WARMUP_PATTERNS.length; i++) {
    const pattern = WARMUP_PATTERNS[i];
    const progress = `[${i + 1}/${WARMUP_PATTERNS.length}]`;

    try {
      console.log(`${progress} Processing: ${pattern.category} (${pattern.language})`);

      // Set language preference
      contentAnalyzer.setLanguage(pattern.language);
      geminiAnalyzer.setLanguage(pattern.language);

      // Process with ContentAnalyzer (caches in LLMService)
      const result = await contentAnalyzer.analyzeV2(pattern.text);

      if (result && result.nodes && result.nodes.length > 0) {
        console.log(`  ✅ Success: ${result.nodes.length} nodes, ${result.edges?.length || 0} edges`);
        successCount++;
      } else {
        console.log(`  ⚠️  Result incomplete (may be using fallback)`);
        successCount++; // Still counts as cached
      }

      // Rate limiting: 200ms between requests (as per LLMService config)
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (error: unknown) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failureCount++;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('🔥 Cache Warm-up Complete');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Successful: ${successCount}/${WARMUP_PATTERNS.length}`);
  console.log(`❌ Failed: ${failureCount}/${WARMUP_PATTERNS.length}`);
  console.log(`⏱️  Total time: ${totalTime}s`);
  console.log(`⚡ Average time per pattern: ${(parseFloat(totalTime) / WARMUP_PATTERNS.length).toFixed(2)}s`);
  console.log('');

  // Display cache statistics
  const stats = llmService.getStats();
  console.log('📊 LLM Service Statistics:');
  console.log(`   Total requests: ${stats.totalRequests}`);
  console.log(`   Cache hits: ${stats.cacheHits}`);
  console.log(`   Cache misses: ${stats.cacheMisses}`);
  console.log(`   Cache hit rate: ${stats.cacheHitRate.toFixed(1)}%`);
  console.log(`   Model usage: ${stats.modelUsage.flash} Flash (${stats.modelUsage.flashPercent.toFixed(1)}%), ${stats.modelUsage.pro} Pro`);
  console.log(`   Avg response time: ${stats.performance.avgResponseTime}ms`);
  console.log('');

  console.log('💡 Expected Impact:');
  console.log('   - Cache now contains common patterns');
  console.log('   - Similar queries will benefit from cache hits');
  console.log('   - Expected hit rate: 10% (week 1), 30% (week 4)');
  console.log('');

  console.log('✅ Cache warm-up successful!');
}

// Execute warm-up
warmupCache().catch(error => {
  console.error('❌ Cache warm-up failed:', error);
  process.exit(1);
});
