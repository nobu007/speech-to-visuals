/**
 * Structural source-coupling guard for the default frame rate (REQ-296).
 *
 * `DEFAULT_FPS` (30) lives in exactly one place: `src/remotion/scene-synchronizer.ts`.
 * It was previously redeclared as an independent local `const` in `Video.tsx` and
 * `srt-parser.ts`, and inlined as a bare `|| 30` fallback across the pipeline and
 * export layers (`this.options.fps || 30`, `quality.fps || 30`, and the
 * `30 / (options.fps || 30)` FPS-normalization in production-exporter). Every copy
 * coincided, so a behavioral RED→GREEN was impossible, but the values were coupled
 * only by coincidence: changing the default frame rate in scene-synchronizer would
 * silently desync the registered composition, SRT parsing, and the export
 * duration/FPS-normalization math. This test guards the COUPLING at the source-text
 * level so a frozen copy can never reappear.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_FPS as CANONICAL_FPS } from '../scene-synchronizer';
import { DEFAULT_FPS as VIDEO_FPS } from '../Video';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** The canonical definition file — the one place the `30` literal may appear. */
const CANONICAL_FILE = path.join('src', 'remotion', 'scene-synchronizer.ts');

/** A local redeclaration that shadows the canonical export, e.g. `const DEFAULT_FPS = 30;`. */
const LOCAL_REDECLARATION = /\bconst\s+DEFAULT_FPS\s*=\s*30\s*;/;

/**
 * A bare-literal FPS fallback, e.g. `options.fps || 30`, `quality.fps || 30`,
 * `this.options.fps || 30`. Any such site must import and use `DEFAULT_FPS`
 * instead, otherwise it freezes a copy of the default frame rate.
 */
const BARE_LITERAL_FPS_FALLBACK = /\bfps\b\s*\|\|\s*30\b/;

/**
 * Sibling shapes the original guard missed (found by the 2026-08 single-source
 * sweep). All freeze the same "system default frame rate" under a different
 * syntactic shape:
 *   - `const fps = 30` — a local alias that feeds frame arithmetic directly
 *     (animated-scene-renderer's Lottie `fr`, videoRenderer's totalFrames).
 *   - `fps ?? 30` — nullish fallback (actualVideoRenderer's resolvedFps).
 * Both shapes bypass `DEFAULT_FPS` while computing frame counts, so changing
 * the canonical default silently desyncs Lottie/SRT/composition timing from
 * those paths.
 */
const LOCAL_FPS_ALIAS = /\bconst\s+fps\s*=\s*30\b/;
const NULLISH_FPS_FALLBACK = /\bfps\s*\?\?\s*30\b/;

/**
 * Files whose `fps: 30` is the RENDER-DEFAULT (the value used when the caller
 * did not choose a frame rate), not a per-preset spec. These flow into
 * VideoGenerator / render requests, so they must carry `DEFAULT_FPS`.
 *
 * INTENTIONAL EXCLUSIONS — `fps: 30` lines that are NOT the system default:
 *   - src/export/production-exporter.ts preset tables (`fps: 24`/`30` per
 *     preset are spec values, like width/height).
 *   - src/config/production-config.ts environment presets (same reason).
 *   - src/components/{VideoGenerationPanel,InteractiveResultViewer}.tsx and
 *     src/export/export-ui.tsx useState initializers — user-editable UI
 *     defaults, excluded for the same reason production-config was excluded
 *     from the error-rate guard (09a).
 */
const RENDER_DEFAULT_CONSUMERS = [
  'src/pipeline/video-generator.ts',
  'src/pipeline/simple-pipeline.ts',
  'src/pipeline/main-pipeline.ts',
  'src/pipeline/pipeline-orchestrator.ts',
];

function getAllProductionSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '__tests__'].includes(entry.name)) continue;
      results.push(...getAllProductionSourceFiles(fullPath));
    } else if (entry.name.match(/\.(ts|tsx)$/)) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      results.push(fullPath);
    }
  }
  return results;
}

describe('REQ-296: default FPS (30) is single-sourced', () => {
  const projectRoot = path.resolve(__dirname, '../../../');

  test('canonical constant holds its documented value', () => {
    // Locking the canonical value makes the "coincide today" desync detectable:
    // if this ever changes, every frozen local literal would diverge.
    expect(CANONICAL_FPS).toBe(30);
  });

  test('Video re-export is the identical canonical constant (not a frozen copy)', () => {
    // Video.tsx must re-export the canonical value, not redeclare it. A strict
    // equality check on the imported bindings proves single-sourcing.
    expect(VIDEO_FPS).toBe(CANONICAL_FPS);
  });

  test('no production source redeclares DEFAULT_FPS or inlines a `fps || 30` fallback', () => {
    const srcDir = path.join(projectRoot, 'src');
    expect(fs.existsSync(srcDir)).toBe(true);

    const files = getAllProductionSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(50); // sanity check

    const redeclarations: { file: string; line: number; content: string }[] = [];
    const bareLiterals: { file: string; line: number; content: string }[] = [];

    for (const file of files) {
      const rel = path.relative(projectRoot, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((line, idx) => {
        // Comment-only lines may QUOTE the historical literal (e.g. the
        // actualVideoRenderer note "Previously a fixed `const fps = 30`") —
        // only executable code freezes a copy.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (rel !== CANONICAL_FILE && LOCAL_REDECLARATION.test(line)) {
          redeclarations.push({ file: rel, line: idx + 1, content: line.trim() });
        }
        if (BARE_LITERAL_FPS_FALLBACK.test(line)) {
          bareLiterals.push({ file: rel, line: idx + 1, content: line.trim() });
        }
        if (rel !== CANONICAL_FILE && LOCAL_FPS_ALIAS.test(line)) {
          bareLiterals.push({ file: rel, line: idx + 1, content: line.trim() });
        }
        if (rel !== CANONICAL_FILE && NULLISH_FPS_FALLBACK.test(line)) {
          bareLiterals.push({ file: rel, line: idx + 1, content: line.trim() });
        }
      });
    }

    expect(redeclarations).toEqual([]);
    expect(bareLiterals).toEqual([]);
  });

  test.each(RENDER_DEFAULT_CONSUMERS)(
    '%s renders its default frame rate from DEFAULT_FPS, not a frozen 30',
    (rel) => {
      const src = fs.readFileSync(path.join(projectRoot, rel), 'utf-8');
      expect(src).toMatch(/DEFAULT_FPS/);
      expect(src).toMatch(/fps:\s*DEFAULT_FPS\b/);
      expect(src).not.toMatch(/fps:\s*30\s*[,}]/);
    },
  );
});
