/**
 * async-state-guarded-pattern.example.tsx — POSITIVE-CASE FIXTURE
 *
 * THIS FILE IS A LEARNING-AID, NOT PRODUCTION CODE. It exists so that future
 * developers see what a CORRECT async-setState pattern looks like. The
 * `async-state-stale-closure-guard.test.ts` enforces the shape invariant; this
 * fixture is its human-readable counterpart.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE BUG (09c / 09v class)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   const [phase, setPhase] = useState('idle');
 *
 *   const handleStart = async () => {
 *     setPhase('running');                 // (1) schedule a state update
 *     await doWork();                      // (2) cross an await boundary
 *     console.log('phase is', phase);      // (3) BUG: reads STALE 'idle'!
 *   };
 *
 * `phase` is the closure binding from when `handleStart` was created. `setPhase`
 * only schedules a re-render — within this single invocation, the local
 * `phase` identifier still refers to the pre-call value. The post-await read
 * returns 'idle', not 'running'.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE GUARDED PATTERN — three canonical shapes
 * ────────────────────────────────────────────────────────────────────────────
 *
 * SHAPE 1 — call-time ref mirror (09c fix: StreamingProcessor).
 *
 *   const phaseRef = useRef('idle');
 *   const [phase, setPhase] = useState('idle');
 *
 *   const handleStart = async () => {
 *     setPhase('running');
 *     phaseRef.current = 'running';        // ← mirror, set synchronously
 *     await doWork();
 *     console.log('phase is', phaseRef.current);   // ← read the mirror
 *   };
 *
 * Why it works: the ref is mutated synchronously, so the post-await read sees
 * the value the setX just produced. The React state is updated for the next
 * render, but the imperative read inside this same call uses the ref.
 *
 * SHAPE 2 — local accumulator in a loop (09v fix: Iteration43).
 *
 *   let lastOverallScore = 0;
 *   for (const sample of samples) {
 *     setQualityMetrics({ overallScore: sample.score });
 *     lastOverallScore = sample.score;     // ← local accumulator
 *   }
 *   logger.info('final score', lastOverallScore);  // ← read the accumulator
 *
 * Why it works: the loop binding updates each iteration; the post-loop read
 * is from the local, not from the React state identifier.
 *
 * SHAPE 3 — observer / raf inside `useEffect` (the shape you are reading now).
 *
 *   useEffect(() => {
 *     const id = requestAnimationFrame(function tick() {
 *       rafRef.current = requestAnimationFrame(tick); // ← observer pattern
 *       setProgress(readLatest());                    // ← read latest from ref
 *     });
 *     return () => {
 *       cancelAnimationFrame(rafRef.current);         // ← real cleanup
 *     };
 *   }, []);
 *
 * Why it works: the observer runs in its OWN invocation each frame, so it
 * reads the current state via a ref (not a closure from N frames ago). The
 * cleanup cancels the raf so it does not leak on unmount.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS FIXTURE DEMONSTRATES
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The hook below uses SHAPE 3 (observer/raf) with a call-time ref mirror. It
 *   - reads the LATEST state from a ref, NOT from a closure,
 *   - has a real cleanup function (cancels the raf and clears the interval),
 *   - does not have the `setX → await → read X` anti-pattern (so the
 *     `async-state-stale-closure-guard` does NOT flag it),
 *   - is registered as a SAFE handler in the guard's AT_RISK_HANDLERS table
 *     (no, it is NOT — it is intentionally not at-risk so it demonstrates the
 *     safe shape end-to-end without registry maintenance).
 *
 * The companion test
 *   `src/hooks/__tests__/__fixtures__/async-state-guarded-pattern.example.test.tsx`
 * exercises the hook under react-testing-library and asserts the guarded
 * pattern works end-to-end (observer fires, cleanup fires, ref mirror stays
 * in sync). Copy-paste the hook into a real feature and it Just Works.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Tick-driven counter hook — uses a `requestAnimationFrame` observer inside
 * `useEffect` to bump a counter, with a call-time ref mirror so any
 * post-observer read sees the latest count.
 *
 * Pattern reference: SHAPE 3 above.
 */
export function useRafTickCounter(): {
  count: number;
  /** Synchronous read of the LATEST count, always equal to the state. */
  readLatest: () => number;
} {
  const [count, setCount] = useState(0);
  // Call-time ref mirror — Shape 1's primitive, used here to give callers
  // a synchronous readLatest() that is immune to the closure-staleness
  // bug. Inside the observer we mutate this in lockstep with setCount.
  const countRef = useRef(0);
  // raf handle for cleanup — we hold it in a ref so the cleanup closure
  // can cancel the IN-FLIGHT raf even if it was scheduled by a previous
  // observer tick.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;

    const tick = (): void => {
      if (stopped) return;                  // ← cooperative shutdown
      const next = countRef.current + 1;
      countRef.current = next;              // ← ref mirror
      setCount(next);                       // ← schedule React state update
      rafRef.current = requestAnimationFrame(tick);   // ← next tick
    };

    rafRef.current = requestAnimationFrame(tick);

    // Real cleanup — the listener-registration guard (09t/09u) demands an
    // unsubscribe-returning register, and an effect cleanup is the
    // equivalent for observers. A missing cleanup is the #1 leak source
    // for raf-driven hooks.
    return () => {
      stopped = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);                                   // ← empty deps: observer is mount-only

  return {
    count,
    readLatest: () => countRef.current,
  };
}

/**
 * Polling counter — `setInterval` observer with the same guarded shape.
 *
 * Demonstrates that the pattern generalizes across observer kinds (raf,
 * interval, event listener, websocket message handler): the cleanup is
 * always the inverse of the register, and reads inside the observer use
 * the ref mirror.
 */
export function useIntervalPollingCount(
  intervalMs: number,
): { count: number; readLatest: () => number } {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const next = countRef.current + 1;
      countRef.current = next;
      setCount(next);
    }, intervalMs);
    return () => clearInterval(id);          // ← 1:1 balanced register/cleanup
  }, [intervalMs]);

  return {
    count,
    readLatest: () => countRef.current,
  };
}
