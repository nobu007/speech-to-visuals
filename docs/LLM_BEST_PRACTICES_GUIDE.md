# LLM Integration Best Practices & Troubleshooting Guide

**System**: Speech-to-Visuals AutoDiagram Video Generator
**Date**: 2025-10-14
**Target Audience**: Developers, System Administrators, DevOps Engineers

---

## Table of Contents

1. [Best Practices](#1-best-practices)
2. [Configuration Guidelines](#2-configuration-guidelines)
3. [Common Issues & Solutions](#3-common-issues--solutions)
4. [Performance Optimization](#4-performance-optimization)
5. [Monitoring & Alerting](#5-monitoring--alerting)
6. [Development Workflow](#6-development-workflow)
7. [Production Deployment](#7-production-deployment)
8. [Debugging Techniques](#8-debugging-techniques)

---

## 1. Best Practices

### 1.1 API Key Management

**✅ DO**:
```bash
# Store API keys in environment variables
export GOOGLE_API_KEY="your-api-key-here"

# Use .env file for local development (never commit!)
echo "GOOGLE_API_KEY=your-key" >> .env

# Verify API key is loaded
npm run test:llm-parsing
```

**❌ DON'T**:
```typescript
// NEVER hardcode API keys in source code
const apiKey = "AIzaSy..."; // ❌ WRONG!

// NEVER commit .env file
// Add to .gitignore immediately
```

### 1.2 Error Handling Strategy

**✅ DO**:
```typescript
// Implement comprehensive error handling with fallbacks
try {
  const result = await geminiAnalyzer.analyzeText(text);
  if (!result) {
    // Fallback to rule-based analysis
    return contentAnalyzer.analyzeV1(text);
  }
  return result;
} catch (error) {
  console.error('Analysis failed:', error);
  // Always provide fallback
  return contentAnalyzer.analyzeV1(text);
}
```

**❌ DON'T**:
```typescript
// Don't let errors crash the application
const result = await geminiAnalyzer.analyzeText(text); // ❌ No error handling!

// Don't swallow errors silently
try {
  await someOperation();
} catch {} // ❌ Silent failure!
```

### 1.3 Caching Best Practices

**✅ DO**:
```typescript
// Enable persistent caching for production
const analyzer = new GeminiAnalyzer(apiKey);
// Cache is automatically persisted to .cache/llm/gemini-cache.json

// Check cache stats regularly
const stats = analyzer.getCacheStats();
console.log(`Cache hit rate: ${(stats.totalHits / stats.totalRequests * 100).toFixed(1)}%`);

// Clear expired entries periodically (optional, happens automatically)
cache.clearExpired();
```

**❌ DON'T**:
```typescript
// Don't disable caching in production
process.env.ANALYSIS_DISABLE_GEMINI = "1"; // ❌ Wastes API quota!

// Don't cache sensitive data
cache.set(userPassword, result); // ❌ Security risk!
```

### 1.4 Rate Limiting

**✅ DO**:
```typescript
// System automatically handles rate limiting
// Exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s
// Automatic fallback to flash model after 3 retries

// For batch processing, use controlled concurrency
const results = await Promise.all(
  inputs.map((input, i) =>
    new Promise(resolve =>
      setTimeout(() => analyzer.analyzeText(input).then(resolve), i * 500)
    )
  )
);
```

**❌ DON'T**:
```typescript
// Don't send all requests at once
const results = await Promise.all(
  inputs.map(input => analyzer.analyzeText(input)) // ❌ Rate limit guaranteed!
);

// Don't retry indefinitely
while (!success) {
  await analyzer.analyzeText(text); // ❌ Infinite loop risk!
}
```

---

## 2. Configuration Guidelines

### 2.1 Environment Variables

**Required**:
```bash
# Google Gemini API Key (required for LLM features)
GOOGLE_API_KEY="your-gemini-api-key"
```

**Optional**:
```bash
# Disable Gemini (fallback to rule-based only)
ANALYSIS_DISABLE_GEMINI="1"

# Custom cache configuration (optional, has defaults)
# These are embedded in code but can be exposed if needed
```

### 2.2 Model Selection

**Primary Model**: `gemini-2.5-pro`
- Best accuracy
- Slower response time (~15s average)
- Higher cost per request

**Fallback Model**: `gemini-2.5-flash`
- Good accuracy
- Faster response time (~8s average)
- Lower cost per request

**Rule-based Fallback**: `ContentAnalyzer.analyzeV1()`
- Basic accuracy
- Instant response (<1ms)
- No API cost

**Recommendation**:
- Production: Use default (pro + flash fallback)
- Development: Use default with caching
- Testing: Consider `ANALYSIS_DISABLE_GEMINI=1` for faster tests

### 2.3 Timeout Configuration

**Current Settings**:
```typescript
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MIN_TIMEOUT = 15000;     // 15 seconds minimum
const MAX_TIMEOUT = 60000;     // 60 seconds maximum
```

**Adaptive Timeout**:
- System automatically adjusts based on P95 response time
- Typical range: 15-25 seconds after warm-up
- Can be overridden per request: `analyzer.analyzeText(text, 45000)`

**When to Adjust**:
- ✅ Increase for complex inputs (long text, detailed diagrams)
- ✅ Decrease for simple inputs (short text, basic flows)
- ❌ Don't set below 10s (too aggressive, many false timeouts)
- ❌ Don't set above 60s (poor user experience)

---

## 3. Common Issues & Solutions

### 3.1 Rate Limit Errors

**Symptoms**:
```
Rate limit with gemini-2.5-pro (attempt 1/3)
Rate limit with gemini-2.5-pro (attempt 2/3)
Rate limit with gemini-2.5-pro (attempt 3/3)
Switching to gemini-2.5-flash...
```

**Solutions**:

1. **Automatic (System handles it)**:
   - Exponential backoff retry
   - Automatic fallback to flash model
   - System continues functioning

2. **Manual optimization**:
   ```typescript
   // Add delays between batch requests
   for (const item of items) {
     await analyzer.analyzeText(item);
     await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
   }
   ```

3. **Increase API quota**:
   - Contact Google Cloud support
   - Upgrade to higher tier
   - Typical quotas: 60/min (free), 300/min (standard), 1000/min (premium)

### 3.2 Timeout Errors

**Symptoms**:
```
Request timeout
Timeout with gemini-2.5-pro (attempt 1/3)
```

**Solutions**:

1. **Check input length**:
   ```typescript
   // System automatically truncates to 1000 chars
   // But verify your input isn't excessively long
   console.log(`Input length: ${text.length} chars`);
   ```

2. **Increase timeout for complex inputs**:
   ```typescript
   // Use custom timeout for known complex cases
   const result = await analyzer.analyzeText(longText, 45000); // 45s
   ```

3. **Check network connectivity**:
   ```bash
   # Test API connectivity
   curl -v https://generativelanguage.googleapis.com

   # Check DNS resolution
   nslookup generativelanguage.googleapis.com
   ```

4. **Monitor adaptive timeout**:
   ```typescript
   const stats = analyzer.getCacheStats();
   console.log(`Current adaptive timeout: ${stats.adaptiveTimeout.currentTimeoutMs}ms`);
   console.log(`P95 response time: ${stats.adaptiveTimeout.p95ResponseTimeMs}ms`);
   ```

### 3.3 Empty or Invalid Responses

**Symptoms**:
```
Empty response from LLM
Invalid diagram data structure from LLM
Failed to extract text from gemini response
```

**Solutions**:

1. **Check API key validity**:
   ```bash
   # Test API key
   curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=$GOOGLE_API_KEY"
   ```

2. **Verify model availability**:
   ```bash
   # List available models
   npm run list-models
   ```

3. **Review prompt engineering**:
   ```typescript
   // Current prompt is optimized for Japanese/English
   // If using other languages, may need adjustment
   // Check: src/analysis/gemini-analyzer.ts:148
   ```

4. **System automatically handles**:
   - Retries with different models
   - Falls back to rule-based analysis
   - No manual intervention needed in most cases

### 3.4 JSON Parsing Errors

**Symptoms**:
```
Invalid JSON structure from LLM
Failed to parse JSON response
```

**Solutions**:

1. **System has robust parsing**:
   ```typescript
   // parseJsonFromLLMText handles:
   // - Code blocks (```json ... ```)
   // - Markdown formatting
   // - Trailing commas
   // - Single quotes
   // - Surrounding text
   ```

2. **Test parsing manually**:
   ```bash
   npm run test:llm-parsing
   ```

3. **Inspect raw response**:
   ```typescript
   // Enable debug logging (already enabled)
   // Check console for: "📥 gemini response preview: ..."
   ```

4. **If persistent issues**:
   ```typescript
   // Adjust prompt to be more explicit about JSON format
   // See: src/analysis/content-analyzer.ts:64
   ```

---

## 4. Performance Optimization

### 4.1 Cache Optimization

**Maximize Cache Hit Rate**:

1. **Use consistent input formatting**:
   ```typescript
   // ✅ DO: Normalize inputs before caching
   const normalized = text.trim().toLowerCase();
   const result = await analyzer.analyzeText(normalized);

   // ❌ DON'T: Use inconsistent formatting
   analyzer.analyzeText(" Text with spaces  "); // New cache entry
   analyzer.analyzeText("text with spaces");    // Another entry
   analyzer.analyzeText("Text with spaces");    // Yet another!
   ```

2. **Leverage persistent cache**:
   ```bash
   # Cache persists across sessions
   # First run: 15s per request
   # Second run: <1ms per request (if same inputs)

   # Check cache contents
   cat .cache/llm/gemini-cache.json | jq '.entries | length'
   ```

3. **Monitor cache stats**:
   ```typescript
   const stats = analyzer.getCacheStats();
   console.log(`Cache efficiency: ${stats.hitRate.toFixed(1)}%`);

   // Target: >50% hit rate in production
   // Typical: 30-40% for varied inputs, 80-90% for repeated workflows
   ```

### 4.2 Batch Processing

**Recommended Approach**:
```typescript
// Process in controlled batches
async function processBatch(items: string[], batchSize = 5) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(item => analyzer.analyzeText(item))
    );

    results.push(...batchResults);

    // Delay between batches to avoid rate limits
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
    }
  }

  return results;
}
```

### 4.3 Input Optimization

**Reduce API Costs**:
```typescript
// System automatically truncates to 1000 chars
// But you can pre-process for better results

// ✅ DO: Extract key content before sending
function extractKeyContent(text: string): string {
  // Remove boilerplate, headers, footers
  // Focus on core diagram-relevant content
  return text
    .replace(/^.*?本文開始/s, '') // Skip preamble
    .replace(/参考文献.*$/s, '')  // Skip references
    .slice(0, 1000);
}

const result = await analyzer.analyzeText(extractKeyContent(rawText));
```

---

## 5. Monitoring & Alerting

### 5.1 Key Metrics to Monitor

**Performance Metrics**:
```typescript
// Run regular benchmarks
npm run benchmark-llm-performance

// Monitor:
// - Success rate (target: >95%)
// - P95 response time (target: <20s)
// - Cache hit rate (target: >50%)
```

**Quality Metrics**:
```typescript
// Run validation tests
npm run validate-llm-accuracy

// Monitor:
// - Entity extraction F1 (target: >80%)
// - Relation accuracy (target: >85%)
// - Structural completeness (target: >75%)
```

**Operational Metrics**:
```typescript
const stats = analyzer.getCacheStats();

// Monitor:
// - Total API requests (cost tracking)
// - Cache size (memory usage)
// - Adaptive timeout trends (performance)
```

### 5.2 Alerting Thresholds

**Critical Alerts** (immediate action required):
- Success rate drops below 80%
- P95 response time exceeds 60s
- API errors exceed 10% of requests

**Warning Alerts** (investigate soon):
- Success rate drops below 95%
- P95 response time exceeds 30s
- Cache hit rate drops below 30%
- Entity extraction F1 drops below 75%

**Info Alerts** (track trends):
- Adaptive timeout increasing (API performance degrading)
- Cache size growing rapidly (review TTL settings)
- Flash model usage increasing (quota pressure on pro model)

### 5.3 Logging Best Practices

**Production Logging**:
```typescript
// Current logging is excellent for debugging
// For production, consider structured logging:

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'llm-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'llm-combined.log' })
  ]
});

// Replace console.log with structured logging
logger.info('LLM request completed', {
  duration: responseTime,
  model: 'gemini-2.5-pro',
  cached: false,
  nodeCount: result.nodes.length
});
```

---

## 6. Development Workflow

### 6.1 Local Development

**Setup**:
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
echo "GOOGLE_API_KEY=your-key" >> .env

# 3. Verify setup
npm run test:llm-parsing

# 4. Start development
npm run dev
```

**Testing Workflow**:
```bash
# Unit tests (fast, no API calls)
npm run test:llm-parsing

# Integration tests (uses API, may cost quota)
npm run validate-llm-accuracy

# Performance benchmarks (comprehensive, costs quota)
npm run benchmark-llm-performance

# End-to-end test (full pipeline)
npm run pipeline:run public/jfk.wav --no-video
```

### 6.2 Pre-Commit Checklist

Before committing changes:

- [ ] Run tests: `npm run test:llm-parsing`
- [ ] Verify no hardcoded API keys: `grep -r "AIzaSy" src/`
- [ ] Check .gitignore includes .env: `cat .gitignore | grep .env`
- [ ] Update documentation if API changes
- [ ] Review error handling in new code
- [ ] Ensure fallback mechanisms work
- [ ] Test with `ANALYSIS_DISABLE_GEMINI=1` (rule-based fallback)

### 6.3 Code Review Guidelines

**Focus Areas**:
1. ✅ Error handling (always provide fallbacks)
2. ✅ API key security (never hardcoded)
3. ✅ Rate limiting (respect quotas)
4. ✅ Caching logic (avoid cache poisoning)
5. ✅ Timeout handling (reasonable defaults)
6. ✅ Logging (structured, informative)
7. ✅ Documentation (update guides)

---

## 7. Production Deployment

### 7.1 Pre-Deployment Checklist

**Infrastructure**:
- [ ] Set `GOOGLE_API_KEY` in production environment
- [ ] Configure persistent cache directory (`.cache/llm/`)
- [ ] Set up log aggregation (ELK, Datadog, etc.)
- [ ] Configure monitoring dashboards
- [ ] Set up alerting (PagerDuty, Slack, etc.)

**Security**:
- [ ] Rotate API keys regularly (quarterly recommended)
- [ ] Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- [ ] Enable API key restrictions (IP whitelist, referer restrictions)
- [ ] Implement request authentication/authorization
- [ ] Set up HTTPS only (no HTTP)

**Performance**:
- [ ] Warm up cache with common queries
- [ ] Test with production-like load
- [ ] Verify auto-scaling triggers
- [ ] Configure CDN if serving static content
- [ ] Enable compression (gzip, brotli)

### 7.2 Deployment Strategy

**Blue-Green Deployment** (Recommended):
```bash
# 1. Deploy to staging (green)
git checkout main
npm run build
deploy-to-staging

# 2. Run smoke tests
npm run validate-llm-accuracy
npm run benchmark-llm-performance

# 3. Switch traffic gradually
# 10% → 25% → 50% → 100%

# 4. Monitor metrics closely
# 5. Rollback if issues detected
```

**Rollback Plan**:
```bash
# Immediate rollback triggers:
# - Success rate drops below 80%
# - P95 response time exceeds 60s
# - Error rate exceeds 10%

# Rollback command:
rollback-to-previous-version
```

### 7.3 Post-Deployment Monitoring

**First 24 Hours**:
- Monitor every 1 hour
- Check success rates, response times, error rates
- Review logs for unexpected errors
- Validate cache performance

**First Week**:
- Monitor daily
- Analyze trends (improving or degrading?)
- Collect user feedback
- Fine-tune timeouts and thresholds

**Ongoing**:
- Weekly performance reviews
- Monthly cost analysis
- Quarterly API key rotation
- Continuous optimization

---

## 8. Debugging Techniques

### 8.1 Enable Verbose Logging

**Current logging is already comprehensive**:
```
📥 gemini-2.5-pro response preview: ...
⏱️  Using adaptive timeout: 17.2s (based on 1 historical samples)
⏳ Waiting 1.1s before retry (attempt 1)...
✨ Using cached LLM analysis
```

**For deeper debugging**:
```typescript
// Add custom debug logging
const DEBUG = process.env.DEBUG_LLM === '1';

if (DEBUG) {
  console.log('Full request:', JSON.stringify(request, null, 2));
  console.log('Full response:', JSON.stringify(response, null, 2));
}
```

### 8.2 Inspect Cache State

**Check cache contents**:
```bash
# View cache file
cat .cache/llm/gemini-cache.json | jq '.'

# Check cache size
du -h .cache/llm/gemini-cache.json

# Count cached entries
cat .cache/llm/gemini-cache.json | jq '.entries | length'
```

**Clear cache manually**:
```bash
# Remove cache file (forces fresh requests)
rm .cache/llm/gemini-cache.json

# Or clear expired entries programmatically
```

### 8.3 Test with Mock Data

**For testing without API calls**:
```typescript
// Create mock analyzer for testing
class MockGeminiAnalyzer {
  async analyzeText(text: string) {
    // Return pre-defined mock data
    return {
      type: 'flow',
      confidence: 0.9,
      nodes: [{ id: 'n1', label: 'Mock Node' }],
      edges: [],
      reasoning: 'Mock analysis'
    };
  }
}

// Use in tests
const analyzer = process.env.NODE_ENV === 'test'
  ? new MockGeminiAnalyzer()
  : new GeminiAnalyzer();
```

### 8.4 Reproduce Issues

**Capture reproduction case**:
```typescript
// When an error occurs, log the input
try {
  const result = await analyzer.analyzeText(text);
} catch (error) {
  // Save problematic input for later debugging
  fs.writeFileSync(
    `debug/failed-input-${Date.now()}.txt`,
    text
  );
  throw error;
}
```

**Replay with debugging**:
```bash
# Re-run with saved input
DEBUG_LLM=1 npm run test -- --input=debug/failed-input-*.txt
```

---

## 9. FAQ

### Q: Why is my first request slow but subsequent requests fast?

**A**: This is expected behavior due to caching. The first request goes to the LLM API (~15s), but subsequent identical requests are served from cache (<1ms). This is a ~94,000x speedup!

### Q: Can I use this offline?

**A**: Partially. The system will automatically fall back to rule-based analysis if Gemini API is unavailable. Quality will be lower, but basic functionality remains. For true offline use, set `ANALYSIS_DISABLE_GEMINI=1`.

### Q: How much does this cost?

**A**: Typical costs (based on Google's pricing):
- Gemini 2.5 Pro: ~$0.002/request
- Gemini 2.5 Flash: ~$0.0005/request
- With 50% cache hit rate: ~$0.001/request average
- Monthly cost for 10,000 requests: ~$10-20

### Q: What if I hit rate limits?

**A**: The system automatically handles rate limits with:
1. Exponential backoff retries
2. Automatic fallback to flash model
3. Final fallback to rule-based analysis
No manual intervention needed!

### Q: How do I improve accuracy?

**A**: Several approaches:
1. Fine-tune prompts (see `src/analysis/gemini-analyzer.ts:148`)
2. Provide more context in input text
3. Use custom training data (future enhancement)
4. Adjust temperature (currently 0.1 for consistency)

### Q: Can I use other LLM providers (OpenAI, Claude)?

**A**: Not currently, but the architecture supports it. The system uses an abstract interface that can be extended. See `src/analysis/types.ts:DiagramAnalysis` for the contract.

---

## 10. Additional Resources

**Documentation**:
- [LLM Integration Report](./architecture/LLM_INTEGRATION_REPORT.md)
- [Custom Instructions Compliance](./CUSTOM_INSTRUCTIONS_COMPLIANCE_2025.md)
- [Phase Completion Reports](../PHASE_*_COMPLETION_REPORT.md)

**Scripts**:
- `tests/validate-llm-accuracy.ts` - Accuracy validation
- `scripts/benchmark-llm-performance.ts` - Performance benchmarking
- `tests/test-llm-improvements.ts` - Feature testing

**External Links**:
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Gemini Pricing](https://ai.google.dev/pricing)
- [API Quotas](https://ai.google.dev/docs/quota)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-14
**Maintained By**: Development Team
**Contact**: See project README for support channels
