---
title: Module src-analysis
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Module src-analysis

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 39
- Bytes: 473888

## Key Files

- `src/analysis/budget-alert.ts`
- `src/analysis/complexity-detector.ts`
- `src/analysis/content-analyzer.ts`
- `src/analysis/cost-estimator.ts`
- `src/analysis/diagram-detector.ts`
- `src/analysis/fallback-chain.ts`
- `src/analysis/gemini-analyzer.ts`
- `src/analysis/index.ts`

## Risk Signals

- RISK-0326 (medium, Concurrency Or Timing) in `src/analysis/__tests__/content-analyzer.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L49: retryCount: 0,
- RISK-0327 (medium, Parser Or Heuristic) in `src/analysis/__tests__/content-analyzer.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L50: fallbackUsed: false,
- RISK-0328 (medium, Persistence Or State) in `src/analysis/__tests__/content-analyzer.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L48: fromCache: false,
- RISK-0329 (low, High Attention File) in `src/analysis/__tests__/content-analyzer.test.ts`: The digest found several implementation signals worth manual review. Evidence: L48: fromCache: false,
- RISK-0330 (medium, Concurrency Or Timing) in `src/analysis/__tests__/diagram-detector.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L484: it('should handle error gracefully and return fallback analysis', async () => {
- RISK-0331 (medium, Parser Or Heuristic) in `src/analysis/__tests__/diagram-detector.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L277: const sparseFeatures: TextFeatures = {
- RISK-0332 (medium, Concurrency Or Timing) in `src/analysis/__tests__/fallback-chain.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L152: const primaryWithRetryableError = async () => {
- RISK-0333 (medium, Parser Or Heuristic) in `src/analysis/__tests__/fallback-chain.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `fallback`
- RISK-0334 (low, High Attention File) in `src/analysis/__tests__/fallback-chain.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Tests for TASK-0018: Three-Layer Fallback Chain
- RISK-0335 (medium, Concurrency Or Timing) in `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L72: execute: jest.fn().mockImplementation(async (req: { parser?: (text: string) => DiagramAnalysis }) => {
- RISK-0336 (medium, Parser Or Heuristic) in `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L9: * - createEnhancedParser() via execute:
- RISK-0337 (medium, Persistence Or State) in `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L18: * - getCacheStats() - stats mapping
- RISK-0338 (low, High Attention File) in `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts`: The digest found several implementation signals worth manual review. Evidence: L9: * - createEnhancedParser() via execute:
- RISK-0339 (medium, Concurrency Or Timing) in `src/analysis/__tests__/gemini-analyzer.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L35: retryCount: 0,
- RISK-0340 (medium, Parser Or Heuristic) in `src/analysis/__tests__/gemini-analyzer.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L21: * parsed result from the Gemini API. The mock simulates a successful
- RISK-0341 (medium, Persistence Or State) in `src/analysis/__tests__/gemini-analyzer.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L33: fromCache: false,
- RISK-0342 (low, High Attention File) in `src/analysis/__tests__/gemini-analyzer.test.ts`: The digest found several implementation signals worth manual review. Evidence: L21: * parsed result from the Gemini API. The mock simulates a successful
- RISK-0343 (high, Security Boundary) in `src/analysis/__tests__/language-detector.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L24: /** Mock tokenizer that tests can configure via mockTokenizer */
- RISK-0344 (medium, Concurrency Or Timing) in `src/analysis/__tests__/language-detector.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L340: it('should initialize Kuromoji tokenizer successfully', async () => {
- RISK-0345 (low, High Attention File) in `src/analysis/__tests__/language-detector.test.ts`: The digest found several implementation signals worth manual review. Evidence: L24: /** Mock tokenizer that tests can configure via mockTokenizer */
- RISK-0346 (medium, Concurrency Or Timing) in `src/analysis/__tests__/llm-service-comprehensive.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L115: const mockStream = (async function* () {
- RISK-0347 (medium, Parser Or Heuristic) in `src/analysis/__tests__/llm-service-comprehensive.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L7: * - execute() - model selection, retry, fallback, error handling
- RISK-0348 (medium, Persistence Or State) in `src/analysis/__tests__/llm-service-comprehensive.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L9: * - clearCache()
- RISK-0349 (low, High Attention File) in `src/analysis/__tests__/llm-service-comprehensive.test.ts`: The digest found several implementation signals worth manual review. Evidence: L7: * - execute() - model selection, retry, fallback, error handling
- RISK-0350 (medium, Parser Or Heuristic) in `src/analysis/__tests__/llm-service-warmup.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L35: cachePersistPath: path.join(tmpDir, 'test-cache.json'),
- RISK-0351 (medium, Persistence Or State) in `src/analysis/__tests__/llm-service-warmup.test.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L2: * REQ-202: LLMService Cache Warmup Integration Tests
- RISK-0352 (low, High Attention File) in `src/analysis/__tests__/llm-service-warmup.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * REQ-202: LLMService Cache Warmup Integration Tests
- RISK-0353 (medium, Concurrency Or Timing) in `src/analysis/__tests__/llm-service.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L51: it('should parse JSON wrapped in markdown code block (```json ... ```)', () => {
- RISK-0354 (medium, Parser Or Heuristic) in `src/analysis/__tests__/llm-service.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L6: * 6. Response parse error tolerance (malformed JSON, empty response)
- RISK-0355 (low, High Attention File) in `src/analysis/__tests__/llm-service.test.ts`: The digest found several implementation signals worth manual review. Evidence: L6: * 6. Response parse error tolerance (malformed JSON, empty response)
- RISK-0356 (high, Security Boundary) in `src/analysis/__tests__/retry-strategy.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L173: const authErrorFn = async () => {
- RISK-0357 (medium, Concurrency Or Timing) in `src/analysis/__tests__/retry-strategy.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L83: const errorFn = async () => {
- RISK-0358 (low, High Attention File) in `src/analysis/__tests__/retry-strategy.test.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Tests for TASK-0019: Retry Strategy with Exponential Backoff and Jitter
- RISK-0359 (medium, Parser Or Heuristic) in `src/analysis/__tests__/rule-based-analyzer.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: * Tests for TASK-0022: Rule-Based V1 Fallback Analyzer
- RISK-0360 (high, Security Boundary) in `src/analysis/__tests__/semantic-similarity.test.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L51: // Both 2 chars, ratio = 1, but no common tokens
- RISK-0361 (high, Security Boundary) in `src/analysis/budget-alert.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L4: * Monitors cumulative session/daily cost against configurable
- RISK-0362 (low, High Attention File) in `src/analysis/budget-alert.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * Monitors cumulative session/daily cost against configurable
- RISK-0363 (medium, Network Or IPC) in `src/analysis/complexity-detector.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L247: const density = (relationshipCount / words.length) * 100;
- RISK-0364 (low, High Attention File) in `src/analysis/complexity-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L47: private readonly SIMPLE_THRESHOLD = 0.15;  // Simple content (Flash model)
- RISK-0365 (high, Security Boundary) in `src/analysis/content-analyzer.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L76: maxOutputTokens: 2048,
- RISK-0366 (medium, Concurrency Or Timing) in `src/analysis/content-analyzer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L18: * - Consistent retry and error handling
- RISK-0367 (medium, Parser Or Heuristic) in `src/analysis/content-analyzer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L70: // Use LLMService for execution (handles caching, retry, fallback automatically)
- RISK-0368 (medium, Persistence Or State) in `src/analysis/content-analyzer.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L17: * - Shared cache with other analyzers
- RISK-0369 (low, High Attention File) in `src/analysis/content-analyzer.ts`: The digest found several implementation signals worth manual review. Evidence: L12: * - Maintains backward compatibility
- RISK-0370 (high, Security Boundary) in `src/analysis/cost-estimator.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L5: * published pricing per million tokens.
- RISK-0371 (low, High Attention File) in `src/analysis/cost-estimator.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * published pricing per million tokens.
- RISK-0372 (low, High Attention File) in `src/analysis/diagram-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L161: private iteration: number = 1;
- RISK-0373 (medium, Concurrency Or Timing) in `src/analysis/fallback-chain.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L24: timeout?: number;
- RISK-0374 (medium, Parser Or Heuristic) in `src/analysis/fallback-chain.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: path contains `fallback`
- RISK-0375 (low, High Attention File) in `src/analysis/fallback-chain.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * TASK-0018: Three-Layer Fallback Chain
- RISK-0376 (medium, Concurrency Or Timing) in `src/analysis/gemini-analyzer.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L25: * - Consistent retry and error handling
- RISK-0377 (medium, Parser Or Heuristic) in `src/analysis/gemini-analyzer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L33: import { parseJsonFromLLMText } from "./llm-utils";
- RISK-0378 (medium, Persistence Or State) in `src/analysis/gemini-analyzer.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L24: * - Shared cache with ContentAnalyzer and future analyzers
- RISK-0379 (low, High Attention File) in `src/analysis/gemini-analyzer.ts`: The digest found several implementation signals worth manual review. Evidence: L24: * - Shared cache with ContentAnalyzer and future analyzers
- RISK-0380 (high, Security Boundary) in `src/analysis/language-detector.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L54: tokens: Array<{ surface_form: string; pos: string }>;
- RISK-0381 (high, Destructive Mutation) in `src/analysis/language-detector.ts`: Deletion or forceful mutation needs clear guardrails and recovery behavior. Evidence: L616: export function forceLanguage(preferredLanguage: Language): Language {
- RISK-0382 (medium, Parser Or Heuristic) in `src/analysis/language-detector.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L15: * - Graceful fallback when Kuromoji is unavailable
- RISK-0383 (low, High Attention File) in `src/analysis/language-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L15: * - Graceful fallback when Kuromoji is unavailable
- RISK-0384 (high, Security Boundary) in `src/analysis/llm-cache.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L6: * - Persistent file-based storage for cross-session efficiency
- RISK-0385 (medium, Persistence Or State) in `src/analysis/llm-cache.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: path contains `cache`
- RISK-0386 (low, High Attention File) in `src/analysis/llm-cache.ts`: The digest found several implementation signals worth manual review. Evidence: L4: * - Memory-efficient with TTL and size limits
- RISK-0387 (high, Security Boundary) in `src/analysis/llm-service.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L25: import { TokenUsageTracker, type ModelType, type StageType, type TokenUsageSummary } from './token-usage-tracker';
- RISK-0388 (medium, Concurrency Or Timing) in `src/analysis/llm-service.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L186: const defaultResolver = async (text: string): Promise<unknown> => text;
- RISK-0389 (medium, Parser Or Heuristic) in `src/analysis/llm-service.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L23: import { parseJsonFromLLMText } from "./llm-utils";
- RISK-0390 (medium, Persistence Or State) in `src/analysis/llm-service.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L15: * - Shared cache across all LLM operations
- RISK-0391 (low, High Attention File) in `src/analysis/llm-service.ts`: The digest found several implementation signals worth manual review. Evidence: L8: * - Centralized rate limiting and retry logic
- RISK-0392 (medium, Parser Or Heuristic) in `src/analysis/llm-utils.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L6: * Extract and parse JSON from an LLM text response.
- RISK-0393 (low, High Attention File) in `src/analysis/llm-utils.ts`: The digest found several implementation signals worth manual review. Evidence: L6: * Extract and parse JSON from an LLM text response.
- RISK-0394 (medium, Parser Or Heuristic) in `src/analysis/prompt-templates.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L212: const CONTENT_ANALYZER_PROMPT_JA = (text: string) => `以下のテキストを分析し、内容を最もよく表す図解を生成するためのJSONデータを作成してください。
- RISK-0395 (medium, Network Or IPC) in `src/analysis/retry-strategy.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L34: * Retryable HTTP status codes
- RISK-0396 (medium, Concurrency Or Timing) in `src/analysis/retry-strategy.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L129: export async function executeWithRetry<T>(
- RISK-0397 (low, High Attention File) in `src/analysis/retry-strategy.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * TASK-0019: Retry Strategy with Exponential Backoff and Jitter
- RISK-0398 (medium, Parser Or Heuristic) in `src/analysis/rule-based-analyzer.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L2: * TASK-0022: Rule-Based V1 Fallback Analyzer
- RISK-0399 (low, High Attention File) in `src/analysis/scene-segmenter.ts`: The digest found several implementation signals worth manual review. Evidence: L11: private config: AnalysisConfig;
- RISK-0400 (high, Security Boundary) in `src/analysis/semantic-similarity.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L8: * 1. Token-based Jaccard similarity (fast, no dependencies)
- RISK-0401 (medium, Persistence Or State) in `src/analysis/semantic-similarity.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L2: * Semantic Similarity Calculator for LLM Cache
- RISK-0402 (low, High Attention File) in `src/analysis/semantic-similarity.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * Semantic Similarity Calculator for LLM Cache
- RISK-0403 (medium, Parser Or Heuristic) in `src/analysis/simple-diagram-detector.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L129: const keywordMatches = (text.match(regex) || []).length;
- RISK-0404 (low, High Attention File) in `src/analysis/simple-diagram-detector.ts`: The digest found several implementation signals worth manual review. Evidence: L43: private flowKeywords = [
- RISK-0405 (high, Security Boundary) in `src/analysis/token-usage-tracker.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: path contains `token`
- RISK-0406 (medium, Parser Or Heuristic) in `src/analysis/token-usage-tracker.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L5: * grouped by stage (analysis, fallback, cache-warmup).
- RISK-0407 (medium, Persistence Or State) in `src/analysis/token-usage-tracker.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L5: * grouped by stage (analysis, fallback, cache-warmup).
- RISK-0408 (low, High Attention File) in `src/analysis/token-usage-tracker.ts`: The digest found several implementation signals worth manual review. Evidence: L2: * TASK-0144: Token Usage Tracker (REQ-098)

## Files

- `src/analysis/__tests__/complexity-detector.test.ts` — typescript, 326 lines, attention 0
- `src/analysis/__tests__/content-analyzer.test.ts` — typescript, 493 lines, attention 100
- `src/analysis/__tests__/diagram-detector-security.test.ts` — typescript, 56 lines, attention 8
- `src/analysis/__tests__/diagram-detector.test.ts` — typescript, 582 lines, attention 56
- `src/analysis/__tests__/fallback-chain.test.ts` — typescript, 280 lines, attention 100
- `src/analysis/__tests__/gemini-analyzer-comprehensive.test.ts` — typescript, 710 lines, attention 100
- `src/analysis/__tests__/gemini-analyzer.test.ts` — typescript, 420 lines, attention 100
- `src/analysis/__tests__/language-detector.test.ts` — typescript, 497 lines, attention 100
- `src/analysis/__tests__/llm-service-comprehensive.test.ts` — typescript, 790 lines, attention 100
- `src/analysis/__tests__/llm-service-warmup.test.ts` — typescript, 134 lines, attention 100
- `src/analysis/__tests__/llm-service.test.ts` — typescript, 304 lines, attention 100
- `src/analysis/__tests__/prompt-builder.test.ts` — typescript, 217 lines, attention 0
- `src/analysis/__tests__/prompt-templates.test.ts` — typescript, 353 lines, attention 0
- `src/analysis/__tests__/retry-strategy.test.ts` — typescript, 212 lines, attention 100
- `src/analysis/__tests__/rule-based-analyzer.test.ts` — typescript, 183 lines, attention 14
- `src/analysis/__tests__/scene-segmenter.test.ts` — typescript, 314 lines, attention 14
- `src/analysis/__tests__/semantic-similarity.test.ts` — typescript, 173 lines, attention 14
- `src/analysis/__tests__/simple-diagram-detector-security.test.ts` — typescript, 49 lines, attention 8
- `src/analysis/budget-alert.ts` — typescript, 138 lines, attention 100
- `src/analysis/complexity-detector.ts` — typescript, 513 lines, attention 100
- `src/analysis/content-analyzer.ts` — typescript, 110 lines, attention 100
- `src/analysis/cost-estimator.ts` — typescript, 81 lines, attention 100
- `src/analysis/diagram-detector.ts` — typescript, 1407 lines, attention 100
- `src/analysis/fallback-chain.ts` — typescript, 204 lines, attention 100
- `src/analysis/gemini-analyzer.ts` — typescript, 286 lines, attention 100
- `src/analysis/index.ts` — typescript, 18 lines, attention 0
- `src/analysis/language-detector.ts` — typescript, 623 lines, attention 100
- `src/analysis/llm-cache.ts` — typescript, 368 lines, attention 100
- `src/analysis/llm-service.ts` — typescript, 1020 lines, attention 100
- `src/analysis/llm-utils.ts` — typescript, 89 lines, attention 100
- `src/analysis/prompt-builder.ts` — typescript, 68 lines, attention 14
- `src/analysis/prompt-templates.ts` — typescript, 333 lines, attention 14
- `src/analysis/retry-strategy.ts` — typescript, 201 lines, attention 100
- `src/analysis/rule-based-analyzer.ts` — typescript, 168 lines, attention 56
- `src/analysis/scene-segmenter.ts` — typescript, 971 lines, attention 100
- `src/analysis/semantic-similarity.ts` — typescript, 204 lines, attention 100
- `src/analysis/simple-diagram-detector.ts` — typescript, 380 lines, attention 100
- `src/analysis/token-usage-tracker.ts` — typescript, 142 lines, attention 100
- `src/analysis/types.ts` — typescript, 57 lines, attention 0
