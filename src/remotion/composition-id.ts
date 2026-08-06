/**
 * Canonical Remotion composition id — the single source of truth shared by the
 * composition registration (Root.tsx) and the server-side render path
 * (ActualVideoRenderer / VideoGenerator).
 *
 * Why a side-effect-free module: ActualVideoRenderer and VideoGenerator run in
 * Node, so they must NOT import Root.tsx (which pulls in React + the Remotion
 * `Composition` component). Keeping the id here lets the render path import the
 * contract without that coupling, while preventing the literal from drifting
 * between the registration site and the query site.
 *
 * Drift here is a silent production failure: if the render path queries an id
 * that Root never registers, `selectComposition` throws and VideoGenerator
 * falls back to mock rendering — no real video is produced. See
 * render-composition-id-contract.test.ts for the regression guard.
 */
export const COMPOSITION_ID = 'SpeechToVisualsVideo';
