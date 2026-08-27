/**
 * @jest-environment jsdom
 *
 * NON-MOCK corruption-recovery integration test (app tree wiring).
 *
 * The 19 unit tests in src/components/__tests__/CorruptionOverlay.test.tsx
 * pin the component's behavior at the reportCorruption() call boundary, and
 * src/__tests__/tutorial-corruption-recovery.test.tsx pins the reader's
 * recovery — but each stubs one half of the wiring (the unit tests invoke
 * reportCorruption by hand; the recovery test replaces localStorage with a
 * jest.fn mock object). Neither renders the REAL app tree, so neither can
 * answer the question that matters to a user:
 *
 *   "I land on the app with a corrupt localStorage key — do I see anything?"
 *
 * Before the mount this test pins, the answer was NO: CorruptionOverlay was
 * rendered by exactly zero production components, so setCorruptionHandler
 * stayed null at runtime and every corruption event from every
 * safeLoadFromStorage caller vanished into logger.warn only. A component
 * that is fully unit-tested but unreachable is indistinguishable from a
 * deleted component at runtime.
 *
 * This test renders the real <App /> against the real jsdom localStorage:
 *
 *   corrupt 'tutorial-progress' (raw setItem, NO storage mock)
 *     → App mount → TutorialSystem useEffect → safeLoadFromStorage (real
 *       @stv/core) → JSON.parse throws → reportCorruption (real
 *       @stv/core) → setCorruptionHandler (installed by the mounted
 *       CorruptionOverlay) → overlay alert visible
 *
 * MOUNT-ORDER CONTRACT. React flushes sibling effects in tree order, and
 * TutorialSystem reads localStorage in its mount effect. The overlay must
 * therefore be mounted BEFORE TutorialSystem in App.tsx — one node later
 * and every mount-time corruption event (the common case: user arrives
 * with an already-corrupt key) fires into a null handler and is lost.
 * Leg 1 below is the RED witness for both the mount and its position.
 *
 * SIGNATURE-DIVERGENCE PIN. Leg 3 pins the REAL upstream detail wording
 * (`localStorage "<key>" contained unparseable JSON: …`, produced by
 * @stv/core safe-storage v1.0.7). extractStorageKey() regex-matches that
 * string to offer "Clear Key"; if a future @stv/core release rewords the
 * detail, the button silently disappears while the alert still renders.
 * Mocked-boundary tests cannot see this; pinning the real string can.
 *
 * Only @stv/core/utils/logger is mocked (console noise). safe-storage,
 * report-corruption, localStorage, and the whole App tree are real.
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockLogger } from '@tests/helpers/logger-mock';

// Mock ONLY the observability side-channel. The corruption chain under test
// (safe-storage → report-corruption → handler → overlay) stays fully real.
jest.unstable_mockModule('@stv/core/utils/logger', () => mockLogger());

let App: React.ComponentType;

beforeAll(async () => {
  App = (await import('../App')).default;
});

// jsdom environment augmentation for Radix UI (the same class of stub as the
// jsdom env itself — these unlock browser APIs, they do not mock contracts).
Object.defineProperty(globalThis, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: StubResizeObserver,
});

let setCorruptionHandler: typeof import('@stv/core/utils/report-corruption').setCorruptionHandler;

beforeAll(async () => {
  const corruptionMod = await import('@stv/core/utils/report-corruption');
  setCorruptionHandler = corruptionMod.setCorruptionHandler;
});

describe('CorruptionOverlay app-tree integration (real storage, real @stv/core)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Valid boolean → no corruption event, no first-visit dialog; the ONLY
    // corruption signal in this test is the corrupted 'tutorial-progress'.
    localStorage.setItem('first-visit', 'false');
  });

  afterEach(() => {
    cleanup();
    setCorruptionHandler(null);
    localStorage.clear();
  });

  it('renders the overlay when the app mounts over a corrupted localStorage key', async () => {
    // Raw corruption — exactly what a truncated/quota-corrupted write leaves
    // behind. NOT a mock: jsdom's real localStorage.
    localStorage.setItem('tutorial-progress', '{ this is not valid json');

    render(<App />);
    await act(async () => { /* flush mount effects */ });

    // Leg 1 — the mount witness. Before <CorruptionOverlay /> was added to
    // App.tsx (before TutorialSystem), the handler was null at flush time
    // and this query returned null.
    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();

    // Leg 2 — source attribution survived the real chain: the report the
    // overlay displays originates from TutorialSystem's safeLoadFromStorage.
    expect(screen.getByText('TutorialSystem')).toBeInTheDocument();
  });

  it('pins the real upstream detail format that extractStorageKey depends on', async () => {
    localStorage.setItem('tutorial-progress', '{ this is not valid json');

    render(<App />);
    await act(async () => {});

    // Leg 3 — REAL @stv/core safe-storage wording. The overlay's
    // extractStorageKey() regex (/localStorage ["']([^"']+)["']/) matches
    // THIS string; rewording upstream silently breaks "Clear Key".
    expect(
      screen.getByText(/localStorage "tutorial-progress" contained unparseable JSON/),
    ).toBeInTheDocument();

    // Leg 4 — the regex actually extracts the key from the real string, so
    // the recovery action is offered (this is the mock-boundary blind spot
    // the unit tests cannot cover).
    expect(screen.getByText('Clear Key')).toBeInTheDocument();
  });

  it('clears the report from the screen when the user clears the key', async () => {
    localStorage.setItem('tutorial-progress', '{ this is not valid json');

    render(<App />);
    await act(async () => {});
    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Clear Key'));
    });

    // "クリアで events 消失" — the visible alert is dismissed.
    expect(screen.queryByTestId('corruption-overlay')).toBeNull();
  });

  it('safeLoadFromStorage itself removed the corrupt key (recovery contract)', async () => {
    localStorage.setItem('tutorial-progress', '{ this is not valid json');

    render(<App />);
    await act(async () => {});

    // The reader's own recovery (report + removeItem + default) ran against
    // the REAL storage — the overlay is reporting an already-healed state,
    // which is exactly what the "Recovered" badge promises the user.
    expect(localStorage.getItem('tutorial-progress')).toBeNull();
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
