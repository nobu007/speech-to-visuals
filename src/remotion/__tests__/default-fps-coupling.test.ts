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
 * duration/FPS-normalization math.
 *
 * This file pins VALUES and RENDER-DEFAULT CONSUMER wiring. The full src/
 * discovery sweep — redeclaration, `fps || 30`, `const fps = 30`, `fps ?? 30`
 * sibling shapes, comment-line skip, canonical exclusion — lives in the shared
 * registry since round 8: tests/guards/frozen-literal-registry.test.ts, rule
 * 'default-fps (30) single-sourced in scene-synchronizer'.
 */

import { DEFAULT_FPS as CANONICAL_FPS } from '../scene-synchronizer';
import { DEFAULT_FPS as VIDEO_FPS } from '../Video';
import { readSource } from '@tests/guards/freeze-guard';

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

describe('REQ-296: default FPS (30) is single-sourced', () => {
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

  test.each(RENDER_DEFAULT_CONSUMERS)(
    '%s renders its default frame rate from DEFAULT_FPS, not a frozen 30',
    (rel) => {
      const src = readSource(rel);
      expect(src).toMatch(/DEFAULT_FPS/);
      expect(src).toMatch(/fps:\s*DEFAULT_FPS\b/);
      expect(src).not.toMatch(/fps:\s*30\s*[,}]/);
    },
  );
});
