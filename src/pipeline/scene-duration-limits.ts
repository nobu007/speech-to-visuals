/**
 * Single source for scene-duration clamp boundaries (defect 08ae).
 *
 * Before this module, the min/max clamp values were hardcoded independently
 * at every clamp site and had already drifted:
 *   - main-pipeline `optimizeSceneTiming` used bare literals 2000/15000.
 *   - scene-render-spec-generator used its own 2000/30000 defaults.
 *   - video-generator's `convertSceneToRemotionFormat` carried a legacy
 *     [3000, 10000] normalization of its own, and several comments attributed
 *     that clamp to "simple-pipeline" — which never clamped durationMs.
 *     (Closed: video-generator now uses this module's floor + editorial cap.)
 *
 * There are exactly THREE legitimate concepts — do not collapse them:
 *
 * 1. MIN_SCENE_DURATION_MS — the shared floor. The timing optimizer, the
 *    render-spec generator, AND video-generator's scene conversion must agree
 *    on this: if one path's floor diverged from the others the reported video
 *    length would silently diverge from the clamped scene data again.
 *
 * 2. MAX_EDITORIAL_SCENE_DURATION_MS — the pacing cap shared by main-pipeline
 *    and video-generator's scene conversion. Scenes longer than this are
 *    shortened for video flow, even though the renderer could display them.
 *
 * 3. MAX_RENDERABLE_SCENE_DURATION_MS — the renderer's hard ceiling. The
 *    render plan refuses to schedule a single scene longer than this unless
 *    the caller overrides it via `RenderSpecConfig.maxSceneDurationMs`.
 *
 * The audio SEGMENTER's [3000, 15000] bounds
 * (`DEFAULT_MIN/MAX_SEGMENT_LENGTH_MS` in src/analysis/scene-segmenter.ts)
 * are a DIFFERENT concept (how transcription text is grouped into segments)
 * and are intentionally NOT defined here.
 */

/** Shared floor for a single scene's durationMs (ms). */
export const MIN_SCENE_DURATION_MS = 2000;

/** main-pipeline pacing cap: scenes longer than this are shortened for flow. */
export const MAX_EDITORIAL_SCENE_DURATION_MS = 15000;

/** Renderer hard ceiling: the render plan never schedules a longer scene. */
export const MAX_RENDERABLE_SCENE_DURATION_MS = 30000;
