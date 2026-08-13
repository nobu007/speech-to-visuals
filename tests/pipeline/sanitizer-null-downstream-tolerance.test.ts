/**
 * @jest-environment node
 */
/**
 * sanitizer-null-downstream-tolerance.test.ts
 *
 * End-to-end witness that a sanitizer-neutralized payload renders gracefully.
 *
 * THE CONCERN (steering, iteration 13). The untrusted-JSON sanitizer
 * (`sanitizeUntrustedJsonValue`, consumed by `parseJsonFromLLMText` and
 * `parseUntrustedJson`) collapses a non-finite numeric such as `1e400` to
 * `null` at the trust boundary. That `null` then surfaces on a typed-`number`
 * field (`durationMs: number`) — a runtime lie the type system does not catch.
 * The behavioral sanitizer tests prove the neutralization WORKS; they do NOT
 * prove a downstream "mapper"-style consumer renders the resulting `null`
 * without producing `NaN` / `undefined` / a crash in the rendering or scoring
 * path. (The steering named fromXRow mappers; those are PHANTOM in this repo —
 * 0 hits — so this witnesses the REAL downstream consumer of sanitized scene
 * data: `generateRenderPlan`, the render-plan mapper that turns scenes into
 * frame budgets.)
 *
 * THE GUARD under witness. `scene-render-spec-generator.ts:117`:
 *   const rawDuration = scene.durationMs || minDurationMs;
 * followed by a `[minDurationMs, maxDurationMs]` clamp and
 * `Math.round((durationMs / 1000) * fps)`. A `null` durationMs falls back to
 * `minDurationMs` (never `null/1000` → 0, never a NaN frame count). Sibling
 * fields use optional-chaining + nullish coalescing (`scene.nodes?.length ?? 0`,
 * `scene.summary || ...`), so a sanitized-null payload is tolerated across the
 * board.
 *
 * This test pins that contract: if a future edit replaces the `||` fallback
 * with direct arithmetic (`scene.durationMs / 1000`) the neutralized `null`
 * reaches frame math and the assertions below turn RED.
 */
import { describe, it, expect } from '@jest/globals';
import { generateRenderPlan } from '@/pipeline/scene-render-spec-generator';
import { sanitizeUntrustedJsonValue } from '@/analysis/llm-utils';
import type { SceneGraph } from '@/types/diagram';

// A scene payload AS IT WOULD ARRIVE from an LLM / API boundary, before the
// sanitizer runs — every numeric that an attacker or a buggy model could push
// to overflow is present (1e400 → Infinity under JSON.parse).
const tamperedRaw = {
  type: 'flow',
  nodes: [{ id: 'n1', label: 'Start' }, { id: 'n2', label: 'End' }],
  edges: [{ from: 'n1', to: 'n2' }],
  startMs: 0,
  durationMs: 1e400, // overflow → Infinity under JSON.parse → null after sanitize
  summary: 'tampered',
  keyphrases: [],
};

// The post-sanitization shape: exactly what every guarded parse site hands to
// its consumers. `durationMs` is now `null` (typeof object), despite the
// `SceneGraph['durationMs']: number` declaration.
const sanitized = sanitizeUntrustedJsonValue(tamperedRaw) as SceneGraph;

describe('Sanitizer-neutralized scene payload — downstream null tolerance', () => {
  it('sanitizer collapses the overflow durationMs to null (precondition)', () => {
    // If this precondition flips (durationMs is no longer null), the sanitizer
    // changed and the downstream witness below no longer exercises the null path.
    expect(sanitized.durationMs).toBeNull();
  });

  it('generateRenderPlan does NOT throw on a sanitizer-neutralized scene', () => {
    expect(() => generateRenderPlan([sanitized])).not.toThrow();
  });

  it('a neutralized durationMs falls back to the min-scene-duration, not NaN', () => {
    const plan = generateRenderPlan([sanitized]);
    const spec = plan.scenes[0];
    // minSceneDurationMs default = 2000 (src/pipeline/scene-render-spec-generator.ts:79).
    expect(spec.durationMs).toBe(2000);
    expect(Number.isFinite(spec.durationMs)).toBe(true);
    // Frame math must stay finite — `null / 1000 * fps` would be 0 or NaN
    // without the `|| minDurationMs` fallback; with it, 2000ms @ 30fps = 60 frames.
    expect(spec.totalFrames).toBe(60);
    expect(Number.isFinite(spec.totalFrames)).toBe(true);
    expect(plan.totalFrames).toBe(60);
    expect(Number.isFinite(plan.totalDurationMs)).toBe(true);
  });

  it('neutralized sibling fields (nodes/edges null) do not produce NaN counts', () => {
    // A payload where the sanitizer has nullified EVERY field it touches — the
    // harshest post-sanitization shape a consumer could see.
    const allNull = sanitizeUntrustedJsonValue({
      type: 'flow',
      nodes: 1e999, // → Infinity → null
      edges: 1e999, // → null
      startMs: 0,
      durationMs: 1e400, // → null
      summary: 1e400, // → null (numeric overflow on a string-typed field)
      keyphrases: [],
    }) as SceneGraph;
    const plan = generateRenderPlan([allNull]);
    const spec = plan.scenes[0];
    // Optional-chaining + nullish coalescing keep counts finite even when the
    // sanitizer nulled the arrays.
    expect(Number.isFinite(spec.nodeCount)).toBe(true);
    expect(Number.isFinite(spec.edgeCount)).toBe(true);
    expect(Number.isFinite(spec.contentReadyFrame)).toBe(true);
    expect(Number.isFinite(spec.endFrame)).toBe(true);
    // A null summary falls back to the generated label, never `null`/`undefined`.
    expect(typeof spec.summary).toBe('string');
    expect(spec.summary.length).toBeGreaterThan(0);
  });

  it('full end-to-end: raw LLM text → parseJsonFromLLMText → generateRenderPlan (no NaN anywhere)', async () => {
    // Pull in the text-mode chokepoint the same way the real pipeline does.
    const { parseJsonFromLLMText } = await import('@/analysis/llm-utils');
    // Hand-craft the text with LITERAL overflow magnitudes. Building it via
    // `JSON.stringify({ durationMs: 1e400 })` collapses 1e400 to `null` on disk
    // (`JSON.stringify(Infinity) === 'null'`), so parseJsonFromLLMText would see
    // a plain null — never exercising the sanitizer's Infinity→null
    // neutralization that a REAL overflowing LLM payload triggers. Inject the
    // literal so JSON.parse yields real Infinity, the vector under test.
    const rawText = JSON.stringify({
      scenes: [
        { ...tamperedRaw, durationMs: 9999 },
        { ...tamperedRaw, durationMs: 8888, summary: 'second' },
      ],
    })
      .replace(/"durationMs":9999/, '"durationMs":1e400')
      .replace(/"durationMs":8888/, '"durationMs":5e400');
    const parsed = parseJsonFromLLMText<{ scenes: SceneGraph[] }>(rawText);
    // Both scenes' overflow durations are neutralized Infinity→null by the sanitizer.
    expect(parsed.scenes[0].durationMs).toBeNull();
    expect(parsed.scenes[1].durationMs).toBeNull();

    const plan = generateRenderPlan(parsed.scenes);
    expect(plan.sceneCount).toBe(2);
    // No NaN/Infinity anywhere in the assembled frame budget.
    const allFrames = plan.scenes.flatMap((s) => [s.startFrame, s.endFrame, s.totalFrames]);
    expect(allFrames.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(plan.totalFrames)).toBe(true);
    expect(plan.totalFrames).toBeGreaterThan(0);
  });
});
