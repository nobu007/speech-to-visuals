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

/**
 * Files that build a content-derived cache/dedup key — guarded end-to-end
 * (truncation + metadata fingerprint). Hoisted to module scope so the
 * truncation guard and the metadata-fingerprint guard share ONE list.
 */
const KEY_BUILDERS: Array<{ file: string; fn: string }> = [
  { file: 'src/pipeline/main-pipeline.ts', fn: 'generateCacheKey' },
  { file: 'src/performance/intelligent-cache.ts', fn: 'generateCacheKey' },
  { file: 'src/analysis/llm-cache.ts', fn: 'generateKey' },
  { file: 'src/api/batch-processing-api.ts', fn: 'computeFileHash' },
  { file: 'src/analysis/gemini-analyzer.ts', fn: 'buildAnalyzerCacheKey' },
];

/** Strip comments (block + line) so doc references to old bugs don't match. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Match a function/method DEFINITION (not a call) and return the index of its
 * opening `{`. Requires `{` to follow `)` — possibly with a return-type
 * annotation — so call sites (`this.fn(x);`) never match.
 */
function findDefBodyBrace(src: string, fn: string): number {
  const defRe = new RegExp(`\\b${fn}\\s*\\([^)]*\\)\\s*(:[\\s\\S]*?)?\\{`);
  const m = defRe.exec(src);
  return m ? m.index + m[0].length - 1 : -1;
}

/**
 * Balanced-brace extraction from `braceIdx` (pointing at `{`). Comment-stripped
 * source only; the five target builders contain no literal braces inside plain
 * string literals, and template `${…}` interpolations are brace-balanced, so a
 * naive depth counter terminates at the function's true close.
 */
function extractBody(src: string, braceIdx: number): string {
  let depth = 0;
  for (let i = braceIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(braceIdx, i + 1);
    }
  }
  return src.slice(braceIdx);
}

// --- Metadata-fingerprint detection (08y defect class) ----------------------
// A cache/dedup key built from file METADATA (name+size) instead of content.
// Two files can share a name+size yet differ in content → silently cross-return
// the wrong cached/dedup result. A content key reads arrayBuffer()/text and
// NEVER interpolates both a file-name and a file-size property into the same key.
/** A file-NAME property used as keying metadata (NOT content). */
const NAME_META = /\.(?:name|fileName|originalName|audioFileName|inputFileName)\b/;
/**
 * A file-SIZE property used as keying metadata. Excludes `.byteLength`
 * (content-derived) and capacity fields surface only via the keying-context
 * filter below, never as a name+size pair in a key expression.
 */
const SIZE_META = /\.(?:size|fileSize)\b/;
/** True if `keyExpr` interpolates BOTH a file-name and a file-size property. */
function hasMetadataFingerprint(keyExpr: string): boolean {
  return NAME_META.test(keyExpr) && SIZE_META.test(keyExpr);
}
/** All backtick template-literal bodies in `src` (content between backticks). */
function templateLiterals(src: string): string[] {
  const out: string[] = [];
  const re = /`([^`]*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

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
  // Belt-and-suspenders: no production file in any keying layer may construct a
  // cache key by truncating its input. Catches a future site even if it isn't
  // one of the known call sites below. The dir list spans EVERY layer that
  // builds a content-derived key (analysis/performance + pipeline + api): the
  // 08y lesson was that a guard scoped to analysis/performance let the SAME
  // defect class survive in `main-pipeline.generateCacheKey` because that key
  // builder lived in a different dir and built its key its own way.
  it('no keying-layer source file truncates a cacheKey value', () => {
    const files: string[] = [
      ...globSync('src/analysis/*.ts'),
      ...globSync('src/performance/*.ts'),
      ...globSync('src/pipeline/*.ts'),
      ...globSync('src/api/*.ts'),
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

describe('key-builder function bodies — no truncation of the keying INPUT', () => {
  // The 08y KEY LESSON: centralizing the canonical FN is insufficient if the
  // guard's scope excludes other dirs that build keys their own way. The audit
  // must grep key-BUILDERS (`generateCacheKey` / `computeFileHash` /
  // `generateKey` / `buildAnalyzerCacheKey`) across ALL keying dirs, not just
  // the `cacheKey:` consumers in two. This targets the builder FUNCTIONS
  // themselves: a truncating slice on the keying INPUT inside any of them is the
  // prefix-truncation class that bit f6d5dc43 / f172f017 (and would have caught
  // a regression in main-pipeline's 08y layer, which lived outside the old
  // 2-dir guard). OUTPUT shortening of a digest (`.digest('hex').slice(0,16)`)
  // is allowed — only the INPUT must not be truncated.
  // KEY_BUILDERS + stripComments/findDefBodyBrace/extractBody are hoisted to
  // module scope above (shared with the metadata-fingerprint guard below).

  it('every key builder is present (rename/removal surfaces here, not silently)', () => {
    // If a builder is renamed or deleted, the truncation guard below would skip
    // it via `findDefBodyBrace === -1`. This assertion makes that loud instead.
    for (const { file, fn } of KEY_BUILDERS) {
      const src = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));
      expect(findDefBodyBrace(src, fn)).toBeGreaterThanOrEqual(0);
    }
  });

  it('no key builder truncates its input before hashing (digest OUTPUT shortening allowed)', () => {
    const offenders: string[] = [];

    for (const { file, fn } of KEY_BUILDERS) {
      const src = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));
      const braceIdx = findDefBodyBrace(src, fn);
      if (braceIdx < 0) continue;
      const body = extractBody(src, braceIdx);

      // Neutralize OUTPUT shortening: `.digest('hex').slice(0, 16)` (optionally
      // across newlines/whitespace) shortens the OUTPUT digest, not the INPUT,
      // and is the sanctioned pattern. Any truncating slice that remains is an
      // INPUT truncation = the prefix-truncation defect class.
      const INPUT_TRUNCATION = /\.(?:slice|substring|substr)\s*\(\s*0\s*,/;
      const DIGEST_OUTPUT = /\.digest\s*\([^)]*\)\s*\.\s*(?:slice|substring|substr)\s*\(\s*0\s*,/;
      const residual = body.replace(new RegExp(DIGEST_OUTPUT, 'g'), '/*digest-output*/');

      const m = residual.match(INPUT_TRUNCATION);
      if (m) {
        offenders.push(`${file} :: ${fn}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('cache-key metadata fingerprint — no key built from file name+size', () => {
  // The 08y defect class (5071f017): main-pipeline keyed the transcription cache
  // on `${audioFile.name}-${audioFile.size}` METADATA, so two files that shared a
  // name+size but differed in content cross-returned the WRONG cached result. The
  // per-layer fixes (GeminiAnalyzer / LLMCache / ContentAnalyzer / MainPipeline)
  // each paired with a per-layer guard, but a 5th instance could still slip in.
  // This is the repo-wide structural close: a cache/dedup key built from file
  // METADATA (name+size) instead of CONTENT is forbidden ANYWHERE under src/.
  //
  // A content key reads arrayBuffer()/text and NEVER interpolates both a file-NAME
  // and a file-SIZE property into the same key expression. A validation ERROR
  // MESSAGE that happens to mention name+size (`File ${meta.name} size ${meta.size}MB
  // exceeds …`) is NOT a key and must not trip the guard — hence the keying-context
  // filter (`.update(…)` argument / `*Key` assignment) in the broad sweep.

  it('no key builder interpolates file name+size metadata into its key', () => {
    // Targets the enumerated builder BODIES — a bare `return \`...name...size...\``
    // reintroduction (the 08y shape) inside generateCacheKey/computeFileHash/…
    // is caught here even though it is neither a `.update()` arg nor a `*Key=`.
    const offenders: string[] = [];
    for (const { file, fn } of KEY_BUILDERS) {
      const src = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));
      const braceIdx = findDefBodyBrace(src, fn);
      if (braceIdx < 0) continue;
      const body = extractBody(src, braceIdx);
      for (const tmpl of templateLiterals(body)) {
        if (hasMetadataFingerprint(tmpl)) {
          offenders.push(`${file} :: ${fn}: \`${tmpl}\``);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no production file builds a cache/dedup key from file name+size metadata', () => {
    // Repo-wide sweep: catches a brand-new key builder added in ANY src/ dir, not
    // just the enumerated KEY_BUILDERS. Scans for the two keying contexts:
    //   (1) createHash(...).update(<key-expr>)  — the hash INPUT is the key
    //   (2) <…>Key = <key-expr> / cacheKey: <key-expr>  — key assignment/property
    // Only flag when BOTH a file-name and file-size property appear in the same
    // key expression. The dedup form `${hash}::${file.size}` (content hash + size)
    // is NOT flagged because it carries no name; an error message is NOT flagged
    // because it is neither context.
    const files = (globSync('src/**/*.ts') as string[]).filter(
      f => !f.includes('__tests__'),
    );
    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'));

      let m: RegExpExecArray | null;
      // (1) hash INPUT: `.update( <expr> )`
      const updateRe = /\.update\s*\(\s*([^)]{0,200}?)\s*\)/g;
      while ((m = updateRe.exec(src)) !== null) {
        if (hasMetadataFingerprint(m[1])) offenders.push(`${file}: .update(${m[1].trim()})`);
      }
      // (2) key assignment: `<…>[Kk]ey` = `:` <expr>  (e.g. cacheKey, dedupKey, contentKey)
      const keyAssignRe = /\b\w*[Kk]ey\b\s*[:=]\s*(.{0,150}?)(?:[,;)\n}])/g;
      while ((m = keyAssignRe.exec(src)) !== null) {
        if (hasMetadataFingerprint(m[1])) offenders.push(`${file}: Key<-${m[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('main-pipeline transcription cache key is derived from CONTENT (sha256), not metadata', () => {
    // Directly pins the 08y fix: generateCacheKey must hash the audio CONTENT
    // (arrayBuffer) for File inputs, and must NOT interpolate name/size. This is
    // the explicit contract assertion that the old code-comment-only contract
    // lacked — a future loop-bound / metadata regression fails loudly here.
    const src = readFileSync(resolve(process.cwd(), 'src/pipeline/main-pipeline.ts'), 'utf8');
    const braceIdx = findDefBodyBrace(stripComments(src), 'generateCacheKey');
    expect(braceIdx).toBeGreaterThanOrEqual(0);
    const body = extractBody(stripComments(src), braceIdx);

    // Content path is present: hashes the File's arrayBuffer bytes.
    expect(body).toMatch(/\.arrayBuffer\s*\(\s*\)/);
    expect(body).toMatch(/createHash\s*\(\s*['"]sha256['"]\s*\)/);
    // Metadata path is absent: no name/size interpolation anywhere in the key.
    for (const tmpl of templateLiterals(body)) {
      expect(hasMetadataFingerprint(tmpl)).toBe(false);
    }
  });
});
