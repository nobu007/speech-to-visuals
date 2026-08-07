/**
 * Single source of truth for the default diagram-canvas dimensions.
 *
 * `DEFAULT_CANVAS_WIDTH` (1920) / `DEFAULT_CANVAS_HEIGHT` (1080) were previously
 * redeclared as local `const` in 13 visualization modules (canvas-calculator,
 * layout-engine-v2, and every layout strategy). Every redeclaration coincided
 * with the same value, so a behavioral RED→GREEN was impossible — but the values
 * were coupled only by coincidence: changing one site would silently desync the
 * others. This module is the one place the literals may live; every consumer
 * imports from here (see __tests__/canvas-dimension-default-coupling.test.ts).
 *
 * Note: these are the DIAGRAM CANVAS dimensions (visualization layer) and are
 * intentionally distinct from the video-output resolution exported as
 * `DEFAULT_WIDTH`/`DEFAULT_HEIGHT` in src/remotion/Video.tsx, which happens to
 * share the same 1920×1080 value but belongs to a separate module boundary.
 */

export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;
