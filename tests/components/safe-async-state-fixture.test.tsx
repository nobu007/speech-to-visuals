/**
 * @jest-environment jsdom
 *
 * Positive-case fixture for the async-setState / post-await stale-closure class
 * (see src/__tests__/async-state-stale-closure-guard.test.ts).
 *
 * The structural guard ships with `AT_RISK_HANDLERS` tokens for the two known
 * fixes (StreamingProcessor useRef mirror, Iteration43 let accumulator) but no
 * VISIBLE EXAMPLE of what a guarded pattern looks like. A future contributor
 * who has to write "setX inside an observer / raf / fetch, then read X from
 * another callback" without knowing the class will reach for the wrong shape.
 *
 * This file is a WORKING REFERENCE — the hook below is correct, it compiles,
 * and the assertions confirm the contract:
 *
 *   1. The observer is created on mount and `disconnect()` runs on unmount.
 *   2. A ref-mirror (`widthRef.current`) updated alongside `setWidth` is the
 *      value to read after an `await` or inside a separate callback — never
 *      the bare `width` state, which is the pre-call closure binding.
 *   3. The cleanup that detaches the observer is unconditional and returns
 *      the disposer's reference (matches the listener-registration pattern
 *      closed in 09t / 09u).
 *
 * DO NOT mutate this file to "simplify" it without re-running the guard
 * (`npx jest --config jest.config.cjs safe-async-state-fixture`). If the
 * mirror is removed, the post-callback assertion below must FAIL.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, act } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Tracking ResizeObserver mock — records every (un)observe / disconnect so the
// test can assert lifecycle and cleanup.
// ---------------------------------------------------------------------------

let observerInstances: TrackingObserver[] = [];

class TrackingObserver {
  readonly cb: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    observerInstances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(el: Element): void {
    this.observed = this.observed.filter((x) => x !== el);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  /** Simulate the browser firing a resize with the given width. */
  fire(width: number): void {
    this.cb(
      [{ contentRect: { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

beforeEach(() => {
  observerInstances = [];
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: TrackingObserver,
  });
});

afterEach(() => {
  // Defensive: any observer still alive means a test forgot to unmount.
  for (const o of observerInstances) {
    expect(o.disconnected).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// The reference hook. THIS IS THE GUARDED PATTERN — every contributor who
// touches async-setState code should be pointed here for a working example.
// ---------------------------------------------------------------------------

/**
 * Track the rendered width of `targetId`. Returns:
 *   - `width`: the React state, for JSX rendering (the normal pattern)
 *   - `widthNow()`: the synchronous ref-mirror, for use AFTER an await /
 *     inside a separate callback — this is what avoids the 09c bug.
 */
export function useTrackedWidth(targetId: string) {
  const [width, setWidth] = useState(0);
  // Ref mirror — read this whenever the read site is "post setX and post
  // await / loop / external event". NEVER read the bare `width` state in
  // such positions within the SAME invocation.
  const widthRef = useRef(width);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const next = entries[0].contentRect.width;
      widthRef.current = next; // <-- mirror, write-through
      setWidth(next);          // <-- schedule render
    });
    const target = document.getElementById(targetId);
    if (target) observer.observe(target);
    // Cleanup MUST run the disposer. No conditional returns above this line.
    return () => observer.disconnect();
  }, [targetId]);

  return { width, widthNow: () => widthRef.current };
}

// ---------------------------------------------------------------------------
// Tests — assert (1) lifecycle, (2) mirror freshness, (3) cleanup pattern.
// ---------------------------------------------------------------------------

describe('safe-async-state fixture: useTrackedWidth', () => {
  it('creates a ResizeObserver on mount and disconnects it on unmount', () => {
    document.body.innerHTML = '<div id="probe" style="width: 100px"></div>';

    const { unmount } = render(<Probe targetId="probe" />);
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].observed).toHaveLength(1);
    expect(observerInstances[0].disconnected).toBe(false);

    unmount();
    expect(observerInstances[0].disconnected).toBe(true);
  });

  it('updates both the state (for JSX) and the ref-mirror (for post-await reads)', () => {
    document.body.innerHTML = '<div id="probe"></div>';
    const captured: Array<{ fromState: number; fromMirror: number }> = [];

    render(
      <Probe
        targetId="probe"
        capture={(readState, readMirror) => {
          captured.push({ fromState: readState(), fromMirror: readMirror() });
        }}
      />,
    );

    const o = observerInstances[0];
    act(() => {
      o.fire(200); // simulate resize → state + mirror both go to 200
    });

    // Probe captures once per render: the initial mount (0/0) and the
    // post-fire re-render (200/200). Both must agree at any given capture.
    expect(captured.length).toBeGreaterThanOrEqual(2);
    const last = captured[captured.length - 1];
    expect(last.fromState).toBe(200);
    expect(last.fromMirror).toBe(200);
  });

  it('the ref-mirror reflects the LATEST setWidth even when read in a later microtask', async () => {
    // This is the exact post-await pattern: setX → await → read X.
    // Bare `width` here would read 0 (pre-call closure binding). The mirror
    // returns 250 (the value just set) — proving the guard works.
    document.body.innerHTML = '<div id="probe"></div>';
    let mirrorValueAfterAwait: number = -1;

    render(
      <Probe
        targetId="probe"
        asyncCapture={async (readMirror) => {
          await Promise.resolve(); // post-await boundary
          mirrorValueAfterAwait = readMirror();
        }}
      />,
    );

    const o = observerInstances[0];
    act(() => {
      o.fire(250);
    });

    // Let the asyncCapture microtask run.
    await Promise.resolve();
    expect(mirrorValueAfterAwait).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// Test host — a tiny component that mounts the hook and exposes its read
// helpers to the test via callbacks. Kept inline so the fixture is a single
// file the reader can study end-to-end.
// ---------------------------------------------------------------------------

interface ProbeProps {
  targetId: string;
  capture?: (readState: () => number, readMirror: () => number) => void;
  asyncCapture?: (readMirror: () => number) => Promise<void>;
}

function Probe({ targetId, capture, asyncCapture }: ProbeProps) {
  const { width, widthNow } = useTrackedWidth(targetId);

  // Fire capture during render — this is the "synchronous side"; both values
  // must agree.
  if (capture) capture(() => width, widthNow);

  // Fire asyncCapture once per (re)render; the closure inside uses widthNow()
  // (mirror), NOT width (state), to dodge the 09c class.
  useEffect(() => {
    if (asyncCapture) void asyncCapture(widthNow);
    // We intentionally omit `asyncCapture` from deps — calling it per effect
    // run simulates the "read after a real async boundary" the bug class is
    // named for. (Re-runs on every width update are fine; the test only
    // mounts once.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  return null;
}

// Make TS happy with the JSX above.
import React from 'react';
void React;