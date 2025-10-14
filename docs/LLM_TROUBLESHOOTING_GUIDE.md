# LLM Integration Troubleshooting Guide

**Phase 32 Documentation**
**System**: Speech-to-Visuals Audio-to-Diagram Video Generator

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [API Configuration](#api-configuration)
4. [Performance Optimization](#performance-optimization)
5. [Language Support](#language-support)
6. [Cache Management](#cache-management)
7. [Fallback Mechanisms](#fallback-mechanisms)
8. [Advanced Debugging](#advanced-debugging)

---

## Quick Diagnostics

### Run Health Check

```bash
# Validate LLM integration status
npm run validate:llm

# Expected output:
# ✅ GOOGLE_API_KEY configured
# ✅ LLMService is enabled and ready
# ✅ ContentAnalyzer V1 (rule-based) working
# ✅ ContentAnalyzer V2 (LLM-powered) working
# ✅ GeminiAnalyzer working correctly
```

### Check API Key Configuration

```bash
# Verify environment variable
echo $GOOGLE_API_KEY

# Should show: AIzaSyA... (your API key)
# If empty, set it:
export GOOGLE_API_KEY="your-api-key-here"

# Or add to .env file:
echo 'GOOGLE_API_KEY="your-api-key-here"' >> .env
```

---

## Common Issues

### Issue 1: "GOOGLE_API_KEY not configured"

**Symptoms:**
- Error message: "⚠️ LLMService not enabled"
- System falls back to rule-based analysis only

**Solutions:**

1. **Set environment variable:**
   ```bash
   export GOOGLE_API_KEY="AIzaSyA..."
   ```

2. **Create .env file:**
   ```bash
   # Create .env in project root
   cat > .env << EOF
   GOOGLE_API_KEY="AIzaSyA..."
   EOF
   ```

3. **Verify configuration:**
   ```bash
   npm run validate:llm
   ```

**Root Cause:**
The LLMService requires a valid Google Gemini API key to function. Without it, the system automatically falls back to rule-based analysis (ContentAnalyzer V1).

---

### Issue 2: Slow LLM Response Times (>30s)

**Symptoms:**
- Processing takes longer than expected
- Timeout errors in console logs

**Solutions:**

1. **Check network connectivity:**
   ```bash
   curl -I https://generativelanguage.googleapis.com/
   # Should return 200 OK
   ```

2. **Verify model selection:**
   - Flash model (gemini-1.5-flash-8b): Faster, suitable for simple tasks
   - Pro model (gemini-1.5-pro): Slower, better for complex analysis

3. **Reduce input text length:**
   ```typescript
   // Prompts automatically truncate to 1000 chars
   // For longer texts, pre-process before analysis
   const truncatedText = text.slice(0, 1000);
   ```

4. **Check cache status:**
   ```bash
   # Cache files should exist
   ls -lh .cache/llm/
   # gemini-cache.json
   # unified-cache.json
   ```

**Performance Targets:**
- Simple text: <10s
- Complex text: <20s
- Cached requests: <2ms

---

### Issue 3: Low Relationship Extraction Quality

**Symptoms:**
- Few or no edges in diagram output
- Warning: "Sparse relationships detected"
- Edge ratio < 0.5

**Solutions:**

1. **Check input text quality:**
   ```typescript
   // Ensure text contains explicit connectors
   // Good: "A leads to B, which results in C"
   // Bad: "A. B. C."
   ```

2. **Use GeminiAnalyzer (Phase 26):**
   ```typescript
   import { GeminiAnalyzer } from './src/analysis/gemini-analyzer';

   const analyzer = new GeminiAnalyzer();
   const result = await analyzer.analyzeText(text);

   console.log(`Edge ratio: ${result.edges.length / (result.nodes.length - 1)}`);
   // Target: >0.7 for complex relationships
   ```

3. **Review prompt language:**
   ```bash
   # Test multilingual detection
   npx tsx scripts/test-multilingual-prompts.ts

   # Ensure prompts match input language
   # Japanese text → Japanese prompt
   # English text → English prompt
   ```

4. **Check Phase 26 enhancements:**
   - Multi-stage reasoning enabled ✅
   - Chain-of-thought prompting ✅
   - Relationship validation ✅

**Quality Metrics (Phase 26):**
- Relationship accuracy: >85%
- Edge completeness: >88%
- False positive rate: <5%

---

### Issue 4: "Invalid JSON from LLM Response"

**Symptoms:**
- Error: "Invalid diagram data structure from LLM"
- Automatic fallback to rule-based analysis

**Solutions:**

1. **Check API response format:**
   ```typescript
   // LLMService logs raw responses
   console.log(`📥 GeminiAnalyzer response preview: ...`);

   // Look for malformed JSON:
   // - Missing braces
   // - Markdown code blocks (```)
   // - Explanatory text before/after JSON
   ```

2. **Verify prompt correctness:**
   ```typescript
   import { getGeminiAnalyzerPrompt } from './src/analysis/prompt-templates';

   const prompt = getGeminiAnalyzerPrompt('Your test text');
   console.log(prompt);

   // Should include: "純粋なJSONのみ（Markdown不要）"
   // or: "Pure JSON only (no Markdown)"
   ```

3. **Increase maxOutputTokens:**
   ```typescript
   // In gemini-analyzer.ts or content-analyzer.ts
   options: {
     maxOutputTokens: 2048,  // Increase if truncation occurs
     temperature: 0.1        // Keep low for consistency
   }
   ```

4. **Test parsing manually:**
   ```typescript
   import { parseJsonFromLLMText } from './src/analysis/llm-utils';

   const rawResponse = `...`; // Your LLM response
   const parsed = parseJsonFromLLMText(rawResponse);
   console.log(parsed);
   ```

**Prevention:**
- Prompts explicitly request "JSON only, no code blocks"
- `parseJsonFromLLMText` strips Markdown automatically
- Validation catches malformed responses early

---

## API Configuration

### Supported Models

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| `gemini-1.5-flash-8b` | Fast | Good | Simple diagrams, quick analysis |
| `gemini-1.5-pro-latest` | Slow | Excellent | Complex relationships, high accuracy |

### Model Selection Logic

```typescript
// LLMService automatically selects model based on complexity

// Flash (default):
// - Text length < 500 chars
// - Low complexity score (<30%)
// - Cache hit available

// Pro (adaptive):
// - Text length > 500 chars
// - High complexity score (>30%)
// - Flash model fails/times out
```

### Rate Limiting

```yaml
Rate Limits:
  Minimum interval: 200ms between requests (Phase 30 optimized)
  Concurrent requests: 1 (sequential processing)
  Retry strategy: Exponential backoff (1s, 2s, 4s, 8s, 16s, 32s)
  Max retries: 3
```

### Cost Optimization

```typescript
// LLMService caching reduces API calls by 99%+

// Example savings (Phase 31 metrics):
// - First analysis: 7.5s, costs 1 API call
// - Subsequent identical texts: 0ms, costs 0 API calls
// - Time saved: 99.97%
```

---

## Language Support

### Supported Languages (Phase 32)

- **Japanese (ja)**: Native support, optimized prompts
- **English (en)**: Full support, specialized prompts
- **Auto-detection**: Automatic language detection

### Language Detection

```typescript
import { detectLanguage } from './src/analysis/language-detector';

const result = detectLanguage('あなたのテキスト');
console.log(result);
// {
//   language: 'ja',
//   confidence: 0.95,
//   japaneseCharRatio: 0.89,
//   englishCharRatio: 0.11
// }
```

### Force Language

```typescript
import { GeminiAnalyzer } from './src/analysis/gemini-analyzer';

const analyzer = new GeminiAnalyzer(undefined, undefined, 'en'); // Force English
analyzer.setLanguage('ja'); // Switch to Japanese
```

### Test Multilingual System

```bash
npx tsx scripts/test-multilingual-prompts.ts

# Expected output:
# ✅ All tests passed! Multilingual prompt system is working correctly.
```

---

## Cache Management

### Cache Location

```bash
.cache/llm/
├── gemini-cache.json      # GeminiAnalyzer cache
└── unified-cache.json     # Unified LLMService cache
```

### Cache Statistics

```typescript
import { llmService } from './src/analysis/llm-service';

const stats = llmService.getStats();
console.log(stats);
// {
//   cacheHits: 10,
//   cacheMisses: 3,
//   totalRequests: 13,
//   performance: { avgResponseTime: 5000, p95: 15000 },
//   timeSavings: 120000  // 120 seconds saved
// }
```

### Clear Cache

```bash
# Remove all cached LLM responses
rm -rf .cache/llm/*

# Restart application to rebuild cache
npm run dev
```

### Cache Hit Indicators (Phase 32)

```bash
# Console logs show cache status
✨ LLMService: Using cached result
🔍 Semantic cache hit (similarity: 80.1%)

# Or cache miss:
🔄 LLMService: Making API request to gemini-1.5-flash-8b
```

---

## Fallback Mechanisms

### Three-Layer Fallback Architecture

```
1. Primary: LLM (Gemini Flash/Pro)
   ├─ Success → Return LLM result
   └─ Failure ↓

2. Secondary: Alternative LLM Model
   ├─ Flash fails → Try Pro
   ├─ Pro fails → Try Flash
   └─ Both fail ↓

3. Tertiary: Rule-based Analysis (V1)
   ├─ Always succeeds (offline)
   └─ Return simple diagram
```

### Fallback Triggers

- **API Key Missing:** Immediate fallback to rule-based
- **Network Timeout:** Retry 3x, then fallback
- **Invalid JSON:** Parse error → fallback
- **Rate Limit:** Exponential backoff → retry → fallback

### Disable Fallback (Testing Only)

```typescript
// Not recommended for production
const analyzer = new ContentAnalyzer();
const result = await analyzer.analyzeV2(text);
// Will throw error instead of falling back

// Better: Check success explicitly
if (!result || result.type === 'flowchart' && result.nodes.length < 2) {
  console.warn('Low-quality result, may have fallen back');
}
```

---

## Advanced Debugging

### Enable Verbose Logging

```typescript
// Add to llm-service.ts or analyzer files
console.log('🐛 Debug: Request details', {
  prompt: prompt.slice(0, 100),
  model: selectedModel,
  options: options
});
```

### Inspect LLM Responses

```typescript
// In gemini-analyzer.ts:208 (createEnhancedParser)
console.log(`📥 GeminiAnalyzer response preview: ${responseText.slice(0, 500)}...`);

// Full response:
console.log(`📥 Full response:`, JSON.stringify(responseText, null, 2));
```

### Monitor Performance

```bash
# Get live performance metrics
npx tsx scripts/validate-llm-integration.ts

# Check Phase 27 quality framework
npm run quality:check
```

### Test Individual Components

```typescript
// Test ContentAnalyzer V1 (rule-based)
import { ContentAnalyzer } from './src/analysis/content-analyzer';
const analyzer = new ContentAnalyzer();
const result = analyzer.analyzeV1('Test text');
console.log(result);

// Test ContentAnalyzer V2 (LLM)
const resultV2 = await analyzer.analyzeV2('Test text');
console.log(resultV2);

// Test GeminiAnalyzer
import { GeminiAnalyzer } from './src/analysis/gemini-analyzer';
const gemini = new GeminiAnalyzer();
const geminiResult = await gemini.analyzeText('Test text');
console.log(geminiResult);
```

---

## Phase-by-Phase Features

### Phase 22-23: Unified LLMService
- Single source of truth for all LLM operations
- Shared cache across analyzers
- Consistent retry and error handling

### Phase 26: Enhanced Relationship Extraction
- Multi-stage reasoning (think → extract → validate)
- Chain-of-thought prompting
- Cycle detection and disconnected node analysis
- 90% relationship accuracy (target: 85%)

### Phase 30: Performance Optimization
- Rate limiting reduced to 200ms (from 500ms)
- Faster consecutive requests
- Maintained stability and reliability

### Phase 32: Multilingual Support
- Automatic language detection (Japanese/English)
- Adaptive prompt generation
- Language-specific optimization
- Zero configuration required

---

## Best Practices

### 1. Always Set API Key
```bash
# In .env file (recommended)
GOOGLE_API_KEY="AIzaSyA..."

# Never commit API keys to Git!
echo ".env" >> .gitignore
```

### 2. Monitor Cache Performance
```typescript
// Periodically check cache hit rate
const stats = llmService.getStats();
const hitRate = stats.cacheHits / stats.totalRequests;
console.log(`Cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
// Target: >50% for production workloads
```

### 3. Use Appropriate Language
```typescript
// Let auto-detection work:
const analyzer = new GeminiAnalyzer(); // Default: 'auto'

// Only force language if you know the input language:
analyzer.setLanguage('ja'); // For Japanese-only inputs
```

### 4. Test Before Deployment
```bash
# Run all validation tests
npm run validate:llm
npm run test:llm-parsing
npx tsx scripts/test-multilingual-prompts.ts

# All should pass before deploying
```

### 5. Monitor Quality Metrics
```yaml
Target Metrics (Phase 26+):
  Relationship Accuracy: >85%
  Edge Completeness: >88%
  Processing Time (P95): <20s
  Cache Hit Rate: >50%
  Fallback Rate: <5%
```

---

## Getting Help

### Report Issues

If you encounter persistent issues:

1. **Gather diagnostic information:**
   ```bash
   npm run validate:llm > diagnostics.log 2>&1
   ```

2. **Check logs for error patterns:**
   ```bash
   grep "ERROR\|❌\|⚠️" diagnostics.log
   ```

3. **Review Phase 31 compliance report:**
   ```bash
   cat PHASE_31_CUSTOM_INSTRUCTIONS_VALIDATION_REPORT.md
   ```

4. **Create GitHub issue** with:
   - Diagnostic logs
   - Input text (if not sensitive)
   - Expected vs actual behavior

### Additional Resources

- **Architecture Documentation:** `docs/architecture/SYSTEM_CORE.md`
- **Quality Metrics:** `docs/architecture/QUALITY_METRICS.md`
- **Iteration Log:** `docs/architecture/ITERATION_LOG.md`
- **Phase 31 Report:** `PHASE_31_CUSTOM_INSTRUCTIONS_VALIDATION_REPORT.md`

---

**Document Version:** 1.0 (Phase 32)
**Last Updated:** 2025-10-14
**System Status:** ✅ Production Ready
