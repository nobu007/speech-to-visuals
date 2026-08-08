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

/**
 * Minimum diagram-detection confidence considered "good".
 *
 * Boundary-INCLUSIVE (`>=`): a detection whose confidence EQUALS this value has
 * met the threshold. Every site that asks "is this detection confidence good
 * enough?" MUST delegate to {@link meetsGoodDetectionConfidence} (defined in
 * `diagram-detector.ts`) rather than re-comparing against a bare `0.6` literal,
 * so the gate and its consumers cannot disagree about the boundary value.
 *
 * The divergent-operator bug this closes: `DiagramDetector.testConfidenceThreshold`
 * used `confidence >= 0.6` (0.6 PASSES the gate) while `SimplePipeline` flagged
 * the SAME 0.6 as low-confidence via `confidence > 0.6` / `<= 0.6` (0.6 FAILS).
 * At exactly 0.6 the detector accepted a result the pipeline simultaneously
 * reported as low-confidence. Centralizing the value AND the operator resolves it.
 *
 * Distinct from `SceneSegmenter.GOOD_CONFIDENCE_THRESHOLD` (also 0.6), which
 * gates SEGMENT-coherence avgConfidence — a separate domain that may legitimately
 * use its own boundary convention.
 */
export const GOOD_DETECTION_CONFIDENCE_THRESHOLD = 0.6;
