---
title: Module support-scripts
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
status: generated
---
# Module support-scripts

## Role

- Rationale: Support scripts provide validation or maintenance helpers around the main code.
- Roots: scripts
- Languages: typescript
- Files: 27
- Bytes: 293256

## Key Files

- `scripts/batch-audio-pipeline.ts`
- `scripts/benchmark-llm-performance.ts`
- `scripts/benchmark-performance.ts`
- `scripts/cache-warmup.ts`
- `scripts/code-size-audit.ts`
- `scripts/demo-custom-instructions.ts`
- `scripts/demo-phase27-quality-framework.ts`
- `scripts/diagram-to-scenes.ts`

## Risk Signals

- RISK-0240 (medium, Concurrency Or Timing) in `scripts/batch-audio-pipeline.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L126: private async processSequential(audioFiles: string[]): Promise<void> {
- RISK-0241 (low, High Attention File) in `scripts/batch-audio-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L46: private config: BatchConfig;
- RISK-0242 (medium, Concurrency Or Timing) in `scripts/benchmark-llm-performance.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L6: * - Adaptive timeout effectiveness
- RISK-0243 (medium, Parser Or Heuristic) in `scripts/benchmark-llm-performance.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L7: * - Error rates and fallback frequency
- RISK-0244 (medium, Persistence Or State) in `scripts/benchmark-llm-performance.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L5: * - Cache hit rates
- RISK-0245 (low, High Attention File) in `scripts/benchmark-llm-performance.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * - Cache hit rates
- RISK-0246 (low, High Attention File) in `scripts/benchmark-performance.ts`: The digest found several implementation signals worth manual review. Evidence: L11: import { performance } from 'perf_hooks';
- RISK-0247 (medium, Concurrency Or Timing) in `scripts/cache-warmup.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L198: async function warmupCache(): Promise<void> {
- RISK-0248 (medium, Parser Or Heuristic) in `scripts/cache-warmup.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L233: console.log(`  ⚠️  Result incomplete (may be using fallback)`);
- RISK-0249 (medium, Persistence Or State) in `scripts/cache-warmup.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0250 (low, High Attention File) in `scripts/cache-warmup.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Phase 43: Cache Warm-up Strategy
- RISK-0251 (medium, Concurrency Or Timing) in `scripts/demo-custom-instructions.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L84: console.log('   ⚙️  Note: Using shorter timeout to avoid delays in demo...');
- RISK-0252 (medium, Parser Or Heuristic) in `scripts/demo-custom-instructions.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L147: console.log(`      Target: >0.5 (50% connectivity) - ${edgeRatio >= 0.5 ? '✅ PASS' : '⚠️ SPARSE'}`);
- RISK-0253 (medium, Persistence Or State) in `scripts/demo-custom-instructions.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L111: console.log(`      Cache Hit Rate: ${stats.cacheHitRate}%`);
- RISK-0254 (low, High Attention File) in `scripts/demo-custom-instructions.ts`: The digest found several implementation signals worth manual review. Evidence: L52: console.log(`   Status: ${llmService.isEnabled() ? 'ENABLED' : 'DISABLED (will use fallback)'}`);
- RISK-0255 (medium, Parser Or Heuristic) in `scripts/demo-phase27-quality-framework.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L43: fallbackTriggered: false,
- RISK-0256 (low, High Attention File) in `scripts/demo-phase27-quality-framework.ts`: The digest found several implementation signals worth manual review. Evidence: L33: memoryUsage: 320,
- RISK-0257 (medium, Parser Or Heuristic) in `scripts/diagram-to-scenes.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L20: return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
- RISK-0258 (medium, Parser Or Heuristic) in `scripts/generate-diagram-from-text.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L21: function parseArgs(): { text?: string; file?: string; out?: string } {
- RISK-0259 (medium, Parser Or Heuristic) in `scripts/phase28-custom-instructions-demo.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L133: console.log('   Skipping LLM analysis test (fallback to rule-based)');
- RISK-0260 (low, High Attention File) in `scripts/phase28-custom-instructions-demo.ts`: The digest found several implementation signals worth manual review. Evidence: L39: memoryUsage: number;
- RISK-0261 (medium, Parser Or Heuristic) in `scripts/phase29-system-validation.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L142: fallbackTriggered: false,
- RISK-0262 (medium, Persistence Or State) in `scripts/phase29-system-validation.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L143: cacheHitRate: 0.0, // Fresh run
- RISK-0263 (low, High Attention File) in `scripts/phase29-system-validation.ts`: The digest found several implementation signals worth manual review. Evidence: L16: import { getHeapUsed } from '../src/utils/memory-usage';
- RISK-0264 (medium, Concurrency Or Timing) in `scripts/phase38-custom-instructions-validation.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L659: private async runTest(
- RISK-0265 (medium, Parser Or Heuristic) in `scripts/phase38-custom-instructions-validation.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L498: fallbackTriggered: false,
- RISK-0266 (medium, Persistence Or State) in `scripts/phase38-custom-instructions-validation.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L303: cacheHits: stats.cacheHits,
- RISK-0267 (low, High Attention File) in `scripts/phase38-custom-instructions-validation.ts`: The digest found several implementation signals worth manual review. Evidence: L26: import { getMemoryUsage } from '@/utils/memory-usage';
- RISK-0268 (medium, Concurrency Or Timing) in `scripts/phase40-custom-instructions-validation.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L80: private async validateSystemOverview(): Promise<void> {
- RISK-0269 (medium, Parser Or Heuristic) in `scripts/phase40-custom-instructions-validation.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L192: const packageJson = JSON.parse(
- RISK-0270 (low, High Attention File) in `scripts/phase40-custom-instructions-validation.ts`: The digest found several implementation signals worth manual review. Evidence: L22: private results: ValidationResult[] = [];
- RISK-0271 (medium, Parser Or Heuristic) in `scripts/render-video.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L33: const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
- RISK-0272 (high, Security Boundary) in `scripts/run-pipeline.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L59: const token = rest.shift()!;
- RISK-0273 (medium, Parser Or Heuristic) in `scripts/run-pipeline.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L47: function parseArgs(argv: string[]) {
- RISK-0274 (low, High Attention File) in `scripts/run-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L47: function parseArgs(argv: string[]) {
- RISK-0275 (medium, Parser Or Heuristic) in `scripts/test-complete-audio-pipeline.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L278: result.metrics.videoSizeMB = parseFloat((videoStats.size / 1024 / 1024).toFixed(2));
- RISK-0276 (low, High Attention File) in `scripts/test-complete-audio-pipeline.ts`: The digest found several implementation signals worth manual review. Evidence: L15: import { performance } from 'perf_hooks';
- RISK-0277 (medium, Concurrency Or Timing) in `scripts/test-llm-integration.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L102: private async testApiConnectivity(): Promise<void> {
- RISK-0278 (medium, Parser Or Heuristic) in `scripts/test-llm-integration.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L9: * - Verify fallback mechanisms
- RISK-0279 (medium, Persistence Or State) in `scripts/test-llm-integration.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L95: // Test 4: Cache functionality
- RISK-0280 (low, High Attention File) in `scripts/test-llm-integration.ts`: The digest found several implementation signals worth manual review. Evidence: L9: * - Verify fallback mechanisms
- RISK-0281 (medium, Concurrency Or Timing) in `scripts/test-phase37.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L271: new Error('Network timeout'),
- RISK-0282 (medium, Parser Or Heuristic) in `scripts/test-phase44-e2e.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L49: console.log('[Test 2/6] LLM Content Analysis with Fallback...');
- RISK-0283 (medium, Persistence Or State) in `scripts/test-phase44-e2e.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L7: import { existsSync, readFileSync, writeFileSync } from 'fs';
- RISK-0284 (low, High Attention File) in `scripts/test-phase44-e2e.ts`: The digest found several implementation signals worth manual review. Evidence: L11: import { getMemoryUsage } from '@/utils/memory-usage';
- RISK-0285 (high, Process Execution) in `scripts/validate-deployment-readiness.ts`: Process or shell execution can cross sandbox, quoting, timeout, or injection boundaries. Evidence: L23: import { execSync } from 'child_process';
- RISK-0286 (medium, Concurrency Or Timing) in `scripts/validate-deployment-readiness.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L79: private async validateDependencies(): Promise<void> {
- RISK-0287 (medium, Parser Or Heuristic) in `scripts/validate-deployment-readiness.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L96: const packageJson = JSON.parse(
- RISK-0288 (low, High Attention File) in `scripts/validate-deployment-readiness.ts`: The digest found several implementation signals worth manual review. Evidence: L23: import { execSync } from 'child_process';
- RISK-0289 (medium, Parser Or Heuristic) in `scripts/validate-llm-integration-phase42.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L6: * - ContentAnalyzer with fallback mechanisms
- RISK-0290 (medium, Persistence Or State) in `scripts/validate-llm-integration-phase42.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L49: console.log(`   Cache: ${stats.cacheHits} hits, ${stats.cacheMisses} misses`);
- RISK-0291 (low, High Attention File) in `scripts/validate-llm-integration-phase42.ts`: The digest found several implementation signals worth manual review. Evidence: L6: * - ContentAnalyzer with fallback mechanisms
- RISK-0292 (high, Security Boundary) in `scripts/validate-llm-integration.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L69: log('warning', 'GOOGLE_API_KEY not set - LLM features will use fallback');
- RISK-0293 (medium, Parser Or Heuristic) in `scripts/validate-llm-integration.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L13: * 5. Fallback mechanisms ✅
- RISK-0294 (medium, Persistence Or State) in `scripts/validate-llm-integration.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L14: * 6. Cache performance ✅
- RISK-0295 (low, High Attention File) in `scripts/validate-llm-integration.ts`: The digest found several implementation signals worth manual review. Evidence: L13: * 5. Fallback mechanisms ✅
- RISK-0296 (medium, Parser Or Heuristic) in `scripts/verify-phase1.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L32: const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

## Files

- `scripts/batch-audio-pipeline.ts` — typescript, 426 lines, attention 100
- `scripts/benchmark-llm-performance.ts` — typescript, 285 lines, attention 100
- `scripts/benchmark-performance.ts` — typescript, 257 lines, attention 100
- `scripts/cache-warmup.ts` — typescript, 283 lines, attention 100
- `scripts/code-size-audit.ts` — typescript, 64 lines, attention 0
- `scripts/demo-custom-instructions.ts` — typescript, 329 lines, attention 100
- `scripts/demo-phase27-quality-framework.ts` — typescript, 251 lines, attention 100
- `scripts/diagram-to-scenes.ts` — typescript, 73 lines, attention 14
- `scripts/generate-diagram-from-text.ts` — typescript, 116 lines, attention 42
- `scripts/list-models.ts` — typescript, 27 lines, attention 0
- `scripts/phase28-custom-instructions-demo.ts` — typescript, 336 lines, attention 98
- `scripts/phase29-system-validation.ts` — typescript, 464 lines, attention 100
- `scripts/phase38-custom-instructions-validation.ts` — typescript, 873 lines, attention 100
- `scripts/phase40-custom-instructions-validation.ts` — typescript, 548 lines, attention 100
- `scripts/render-video.ts` — typescript, 91 lines, attention 14
- `scripts/run-pipeline.ts` — typescript, 129 lines, attention 84
- `scripts/test-complete-audio-pipeline.ts` — typescript, 467 lines, attention 100
- `scripts/test-llm-integration.ts` — typescript, 402 lines, attention 100
- `scripts/test-multilingual-prompts.ts` — typescript, 91 lines, attention 0
- `scripts/test-phase34.ts` — typescript, 311 lines, attention 14
- `scripts/test-phase37.ts` — typescript, 386 lines, attention 28
- `scripts/test-phase44-e2e.ts` — typescript, 551 lines, attention 100
- `scripts/transcribe.ts` — typescript, 63 lines, attention 0
- `scripts/validate-deployment-readiness.ts` — typescript, 660 lines, attention 100
- `scripts/validate-llm-integration-phase42.ts` — typescript, 485 lines, attention 84
- `scripts/validate-llm-integration.ts` — typescript, 359 lines, attention 100
- `scripts/verify-phase1.ts` — typescript, 83 lines, attention 14
