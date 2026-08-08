/**
 * @jest-environment node
 */
/**
 * Cache-key canonicalization — structural guard against prefix truncation.
 *
 * The prefix-truncation defect class (fixed-length prefix/sample vs full text)
 * recurred at THREE layers because each was fixed in isolation while a sibling
 * site kept truncating before forwarding:
 *   - GeminiAnalyzer.buildAnalyzerCacheKey  (f6d5dc43: `text.slice(0,100)` → full)
 *   - LLMCache.generateKey storage layer      (f172f017: `slice(0,2000)` → full hash)
 *   - ContentAnalyzer hand-rolled key         (substring(0,100) → full via buildContentCacheKey)
 * A unit test on any one key BUILDER proved nothing about the others — the bug
 * always survived one layer downstream ("hash is a bucket selector NOT
 * equality"; "test-the-right-layer"). This is the 089e92ad `distance` technique
 * applied to keying: concentrate cache-key generation into ONE canonical
 * function (`buildContentCacheKey`) and STRUCTURALLY forbid re-inlining a
 * truncating prefix at any call site. Every anchor is RED on the pre-fix source
 * and GREEN after; together they fail loudly if anyone re-inlines a truncation
 * on the cache keying path — the 4th recurrence.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globSync } from 'node:fs';

import { buildContentCacheKey } from '../cache-key';

const cacheKeySrc = readFileSync(
  resolve(process.cwd(), 'src/analysis/cache-key.ts'),
  'utf8',
);
const contentAnalyzerSrc = readFileSync(
  resolve(process.cwd(), 'src/analysis/content-analyzer.ts'),
  'utf8',
);
const geminiAnalyzerSrc = readFileSync(
  resolve(process.cwd(), 'src/analysis/gemini-analyzer.ts'),
  'utf8',
);
const intelligentCacheSrc = readFileSync(
  resolve(process.cwd(), 'src/performance/intelligent-cache.ts'),
  'utf8',
);

/** Matches a truncating slice of the keying text: `.slice(0,N)` / `.substring(0,N)` / `.substr(0,N)`. */
const TRUNCATING_SLICE = /\.(slice|substring|substr)\s*\(\s*0\s*,/;

describe('buildContentCacheKey — canonical cache-key builder', () => {
  it('exports a function that returns `${scope}:${text}` verbatim (full text)', () => {
    // Runtime anchor: full text round-trips through the key unchanged.
    expect(buildContentCacheKey('scope-v1', 'the full content')).toBe('scope-v1:the full content');
    // Never truncates: a long text is preserved end-to-end.
    const long = 'x'.repeat(5000) + 'TAIL';
    expect(buildContentCacheKey('s', long)).toBe(`s:${long}`);
    expect(buildContentCacheKey('s', long)).toContain('TAIL');
  });

  it('cache-key.ts is the single source and forbids truncating the input', () => {
    expect(cacheKeySrc).toMatch(/export\s+function\s+buildContentCacheKey\s*\(/);
    // The canonical builder must not itself truncate its input.
    expect(cacheKeySrc).not.toMatch(
      /function\s+buildContentCacheKey[\s\S]*?return[\s\S]*?\.text\.(slice|substring|substr)\(0,/,
    );
  });
});

describe('ContentAnalyzer cache key — no truncating prefix (canonical call)', () => {
  it('imports and builds its cacheKey via buildContentCacheKey', () => {
    expect(contentAnalyzerSrc).toMatch(/import\s*\{[^}]*\bbuildContentCacheKey\b[^}]*\}\s*from\s*['"]\.\/cache-key['"]/);
    expect(contentAnalyzerSrc).toMatch(/cacheKey:\s*buildContentCacheKey\s*\(/);
  });

  it('does NOT hand-roll a truncating cache key', () => {
    // The old form was `cacheKey: `content-analyzer:${text.substring(0, 100)}``.
    // After the fix the cacheKey is delegated to buildContentCacheKey; a
    // reintroduction of any prefix truncation on the keying text must fail here.
    expect(contentAnalyzerSrc).not.toMatch(/cacheKey:\s*[`'"][^`'"]*\$\{[^}]*\.(slice|substring|substr)\(0,/);
  });

  it('uses a versioned scope so stale entries under the old truncated key are invalidated', () => {
    expect(contentAnalyzerSrc).toMatch(/CONTENT_ANALYZER_CACHE_VERSION\s*=\s*['"]v\d+['"]/);
    expect(contentAnalyzerSrc).toMatch(/content-analyzer-\$\{CONTENT_ANALYZER_CACHE_VERSION\}/);
  });
});

describe('GeminiAnalyzer buildAnalyzerCacheKey — delegates to the canonical builder', () => {
  it('forwards to buildContentCacheKey instead of re-inlining the key shape', () => {
    // The pre-canonical form hand-rolled `gemini-analyzer-${VERSION}:${text}`.
    // It must now delegate so the keying logic lives in exactly one place.
    expect(geminiAnalyzerSrc).toMatch(/import\s*\{[^}]*\bbuildContentCacheKey\b[^}]*\}\s*from\s*['"]\.\/cache-key['"]/);
    expect(geminiAnalyzerSrc).toMatch(/buildAnalyzerCacheKey[\s\S]*?return\s+buildContentCacheKey\s*\(/);
  });
});

describe('cached() decorator — no truncating prefix on serialized args', () => {
  it('does NOT slice JSON.stringify(args) for the default key', () => {
    // The old default key was `${propertyName}_${JSON.stringify(args).slice(0, 100)}`,
    // which collapsed two arg-sets sharing a 100-char JSON prefix and defeated
    // IntelligentCache.get's sourceContent guard (it compared truncated strings).
    expect(intelligentCacheSrc).not.toMatch(/JSON\.stringify\(args\)\.(slice|substring|substr)\s*\(\s*0\s*,/);
    expect(intelligentCacheSrc).toMatch(/\$\{propertyName\}_\$\{JSON\.stringify\(args\)\}/);
  });
});

describe('cache-key truncation — broad cross-layer sweep', () => {
  // Belt-and-suspenders: no production file in the analysis or performance cache
  // layers may construct a cache key by truncating its input. Catches a future
  // 4th site even if it isn't one of the three known call sites above.
  it('no analysis/performance source file truncates a cacheKey value', () => {
    const files: string[] = [
      ...globSync('src/analysis/*.ts'),
      ...globSync('src/performance/*.ts'),
    ].filter(f => !f.includes('__tests__') && !f.endsWith('cache-key.ts'));

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      // Strip comments so doc references to the old `.slice(0,100)` patterns
      // (which deliberately document the bug) don't false-positive.
      const codeOnly = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      if (new RegExp(`cacheKey\\s*:[\\s\\S]{0,80}${TRUNCATING_SLICE.source}`).test(codeOnly)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
