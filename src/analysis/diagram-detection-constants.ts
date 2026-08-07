/**
 * Shared diagram-detection constants.
 *
 * Single source of truth for constants consumed by BOTH the full
 * {@link DiagramDetector} and the MVP {@link SimpleDiagramDetector}, so the two
 * detectors (plus every internal confidence-capping site) cannot drift apart.
 */

/**
 * Maximum confidence a diagram-TYPE detection may report.
 *
 * Detection is inherently probabilistic, so 1.0 (absolute certainty) is never
 * emitted — 0.95 reserves headroom for misclassification. Every site that caps a
 * detection confidence MUST use this constant, not a bare `0.95` literal.
 *
 * Distinct from:
 *  - the scale ceiling `MAX_CONFIDENCE = 1` (the theoretical [0,1] maximum), and
 *  - `HYBRID_FALLBACK_CONFIDENCE_CAP = 0.85` (a lower ceiling for the
 *    low-evidence fallback path in DiagramDetector).
 */
export const MAX_DIAGRAM_CONFIDENCE = 0.95;
