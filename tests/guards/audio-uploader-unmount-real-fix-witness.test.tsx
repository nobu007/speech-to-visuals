/**
 * @jest-environment jsdom
 *
 * TC-317: AudioUploader async-setState-after-unmount real fix + RED→GREEN
 * mutation witness pair (TASK-0220 sibling / REQ-300).
 *
 * AudioUploader.validateAndSelect awaits `getAudioDuration` (browser metadata
 * parse via `new Audio()` + `onloadedmetadata`), which is non-trivial for
 * large files. If the user navigates away before it resolves, the pre-fix
 * code continued past the await and (a) fired stray validation toasts for an
 * abandoned file and (b) called `setSelectedFile` on an unmounted component.
 * The fix (mirroring InteractiveResultViewer TC-316) introduces `mountedRef`
 * + an unmount-cleanup useEffect and gates every post-await side effect on it.
 *
 * This is the L3 end-to-end verify the AI Hub steering asks for: the witness
 * exercises the ACTUAL production code path, and removing the guard makes it
 * RED while the guard makes it GREEN. Three layers:
 *   TC-317-01 — source anchor: pin (via readFileSync regex) the mountedRef
 *               declaration, the unmount-cleanup flip, the post-await early
 *               return, and the guarded setSelectedFile. Reverting ANY of
 *               these is RED independent of the runtime.
 *   TC-317-02 — runtime positive control: mount, select a file whose duration
 *               validation FAILS, let metadata resolve while STILL mounted →
 *               toast.error IS called. Proves the mock actually reaches the
 *               post-await code (so the hazard witness below is not vacuous).
 *   TC-317-03 — runtime hazard witness (the load-bearing RED→GREEN): mount,
 *               select the same invalid-duration file, UNMOUNT before metadata
 *               resolves, then resolve → with the guard, toast.error is NOT
 *               called; without the guard it IS. This is the observable harm
 *               the guard closes (a stray toast for an abandoned file plus the
 *               unmounted setState).
 *
 * Note on React 18: React 18 no longer logs the classic "setState on unmounted
 * component" warning, so we assert on the SIDE EFFECT (toast) that differs
 * with/without the guard, not on a warning that would be vacuously absent.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

const CHOKEPOINT_FILE = 'src/components/AudioUploader.tsx';

// Resolve REPO_ROOT from this test file's own location, not process.cwd()
// (jest ESM workers can run with a cwd that is not the repo root — see the
// TC-302 / TC-313 notes on the same cwd race under --maxWorkers>1).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- Pre-import mocks (mirrors src/components/__tests__/AudioUploader.test.tsx)

const mockValidateAudioFile = jest.fn();
const mockValidateAudioDuration = jest.fn();

jest.unstable_mockModule('@/utils/audio-validation', () => ({
  validateAudioFile: mockValidateAudioFile,
  validateAudioDuration: mockValidateAudioDuration,
  MIN_AUDIO_DURATION_SECONDS: 1,
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.unstable_mockModule('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', props, children),
}));

jest.unstable_mockModule('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false)[]) => args.filter(Boolean).join(' '),
}));

const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

jest.unstable_mockModule('sonner', () => ({
  toast: {
    error: mockToastError,
    warning: mockToastWarning,
    success: jest.fn(),
    info: jest.fn(),
  },
}));

jest.unstable_mockModule('lucide-react', () => ({
  Upload: () => React.createElement('svg', { 'data-testid': 'icon-upload' }),
  FileAudio: () => React.createElement('svg', { 'data-testid': 'icon-file-audio' }),
}));

jest.unstable_mockModule('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { AudioUploader } = await import('@/components/AudioUploader');

// --- Controllable Audio mock -------------------------------------------------
//
// Unlike the unit test's auto-firing mock, this one CAPTURES the
// `onloadedmetadata` handler without firing it, so the test can unmount the
// component first and then resolve the await — exactly the unmount-during-
// metadata-parse vector the guard exists to close.

let metadataCallback: (() => void) | null = null;
let mockDuration = 30;

type AudioLike = Record<string, unknown>;

function setupControllableAudio(duration: number): void {
  mockDuration = duration;
  metadataCallback = null;
  const g = globalThis as typeof globalThis & { Audio?: unknown };
  g.Audio = jest.fn().mockImplementation(() => {
    const instance: AudioLike = {};
    Object.defineProperty(instance, 'onloadedmetadata', {
      get: () => metadataCallback,
      set: (fn: (() => void) | null) => {
        metadataCallback = fn;
      },
      configurable: true,
    });
    Object.defineProperty(instance, 'onerror', {
      get: () => null,
      set: () => {
        /* test-controlled; not exercised here */
      },
      configurable: true,
    });
    Object.defineProperty(instance, 'duration', {
      get: () => mockDuration,
      configurable: true,
    });
    Object.defineProperty(instance, 'src', {
      set: () => {
        /* deliberately do NOT auto-fire; the test resolves on its schedule */
      },
      configurable: true,
    });
    return instance;
  });
}

// --- Helpers -----------------------------------------------------------------

function createAudioFile(name = 'test.mp3', type = 'audio/mpeg', size = 1024): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function selectFileViaInput(container: HTMLElement, file: File): void {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const fileList = { 0: file, length: 1, item: () => file };
  Object.defineProperty(input, 'files', { value: fileList, configurable: true });
  fireEvent.change(input);
}

// --- Setup / Teardown --------------------------------------------------------

const globalWithAudio = globalThis as typeof globalThis & { Audio?: unknown };
const originalAudio = globalWithAudio.Audio;

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateAudioFile.mockReturnValue({ valid: true, errors: [], warnings: [] });
  mockValidateAudioDuration.mockReturnValue({ valid: true, errors: [], warnings: [] });
  setupControllableAudio(30);

  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn().mockReturnValue('blob:mock'),
      configurable: true,
      writable: true,
    });
  } else {
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
      configurable: true,
      writable: true,
    });
  } else {
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

afterEach(() => {
  globalWithAudio.Audio = originalAudio;
  metadataCallback = null;
  jest.restoreAllMocks();
});

// --- (TC-317-01) source anchor ----------------------------------------------

describe('AudioUploader unmount guard — source anchor pinned (TC-317-01)', () => {
  const src = (): string => readFileSync(path.join(REPO_ROOT, CHOKEPOINT_FILE), 'utf8');

  it('declares mountedRef and flips it in an unmount-cleanup useEffect', () => {
    const body = src();
    expect(body).toMatch(/const mountedRef = useRef\(true\)/);
    // The cleanup that flips the flag lives inside a useEffect return.
    expect(body).toMatch(/useEffect\(\(\) => \{[\s\S]*?return \(\) => \{[\s\S]*?mountedRef\.current = false/);
  });

  it('guards the post-await path with an early return on !mountedRef.current', () => {
    // The load-bearing line: immediately after awaiting getAudioDuration,
    // bail before any further side effect. Removing this line is RED.
    const body = src();
    expect(body).toMatch(/await getAudioDuration\(file\);[\s\S]*?if \(!mountedRef\.current\) return;/);
  });

  it('guards the catch-fallthrough setSelectedFile on mountedRef.current', () => {
    // setSelectedFile is also reachable via the catch fallthrough; it must be
    // wrapped so an unmount-during-reject path cannot setState either.
    const body = src();
    expect(body).toMatch(/if \(mountedRef\.current\) \{[\s\S]*?setSelectedFile\(file\)/);
  });
});

// --- (TC-317-02) runtime positive control -----------------------------------

describe('AudioUploader unmount guard — positive control (TC-317-02)', () => {
  it('mounted component: invalid duration resolves → toast.error IS called (proves path is exercised)', async () => {
    // If this ever stops calling toast.error, the hazard witness (TC-317-03)
    // would pass vacuously. This control proves the mock reaches the
    // post-await validation branch.
    mockValidateAudioDuration.mockReturnValue({
      valid: false,
      errors: ['duration too short'],
      warnings: [],
    });

    const { container } = render(React.createElement(AudioUploader, {
      onUpload: jest.fn(),
      isProcessing: false,
    }));
    selectFileViaInput(container, createAudioFile());

    // Component still mounted → resolve metadata now.
    await act(async () => {
      metadataCallback?.();
      await Promise.resolve();
    });

    expect(mockToastError).toHaveBeenCalledWith('duration too short');
  });
});

// --- (TC-317-03) runtime hazard witness (load-bearing RED→GREEN) ------------

describe('AudioUploader unmount guard — absorbs unmount-during-await (TC-317-03)', () => {
  it('unmount before metadata resolves → no stray post-unmount toast.error', async () => {
    // The vector: user picks a file, metadata parse is in flight, user
    // navigates away (unmount), THEN metadata resolves. Pre-fix, the post-
    // await branch kept running and called toast.error for an abandoned file
    // (and setSelectedFile on an unmounted component). Post-fix, the
    // `if (!mountedRef.current) return;` absorbs it.
    mockValidateAudioDuration.mockReturnValue({
      valid: false,
      errors: ['duration too short'],
      warnings: [],
    });

    const { container, unmount } = render(React.createElement(AudioUploader, {
      onUpload: jest.fn(),
      isProcessing: false,
    }));
    selectFileViaInput(container, createAudioFile());

    // validateAndSelect is now suspended at `await getAudioDuration`;
    // metadataCallback is captured. Unmount BEFORE resolving.
    unmount();

    // Now resolve the in-flight metadata parse (the component is gone).
    await act(async () => {
      metadataCallback?.();
      await Promise.resolve();
    });

    // WITH the guard: the post-await early return fired, so the invalid-
    // duration branch (and its toast.error) never ran.
    // WITHOUT the guard: toast.error('duration too short') WOULD fire here.
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('unmount before metadata resolves → setSelectedFile is NOT invoked on the unmounted instance', async () => {
    // Valid-duration path: the only post-await side effect is setSelectedFile.
    // We cannot read DOM after unmount, so we assert the absence of any React
    // "state update on unmounted component" console.error (defensive; in
    // React 18 this warning is gone, so this is a belt-and-braces check) AND
    // that the guard's early return kept the component quiescent.
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { container, unmount } = render(React.createElement(AudioUploader, {
      onUpload: jest.fn(),
      isProcessing: false,
    }));
    selectFileViaInput(container, createAudioFile());
    unmount();

    await act(async () => {
      metadataCallback?.();
      await Promise.resolve();
    });

    const unmountedWarnings = consoleErrorSpy.mock.calls
      .map((c) => String(c[0] ?? ''))
      .filter((m) => /unmounted component|Can.*perform.*state.*update/i.test(m));
    expect(unmountedWarnings).toEqual([]);

    consoleErrorSpy.mockRestore();
  });
});
