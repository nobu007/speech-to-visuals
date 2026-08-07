/**
 * @jest-environment jsdom
 *
 * CorruptionOverlay component tests.
 *
 * Verifies that the overlay:
 * - Renders nothing when no corruption has occurred
 * - Displays an alert when reportCorruption fires
 * - Supports dismiss, clear-key, and reset-to-defaults actions
 * - Properly subscribes and unsubscribes via setCorruptionHandler
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { mockLogger } from '@tests/helpers/logger-mock';

// Mock logger via the shared factory (unstable_mockModule is not hoisted, so
// the imported binding is safe to reference here).
jest.unstable_mockModule('@/utils/logger', () => mockLogger());

let CorruptionOverlay: typeof import('../CorruptionOverlay').CorruptionOverlay;
let reportCorruption: typeof import('@/utils/report-corruption').reportCorruption;
let setCorruptionHandler: typeof import('@/utils/report-corruption').setCorruptionHandler;

beforeAll(async () => {
  const overlayMod = await import('../CorruptionOverlay');
  const corruptionMod = await import('@/utils/report-corruption');
  CorruptionOverlay = overlayMod.CorruptionOverlay;
  reportCorruption = corruptionMod.reportCorruption;
  setCorruptionHandler = corruptionMod.setCorruptionHandler;
});

describe('CorruptionOverlay', () => {
  beforeEach(() => {
    setCorruptionHandler(null);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    setCorruptionHandler(null);
    localStorage.clear();
  });

  /**
   * Helper: render overlay and wait for useEffect to install the handler,
   * then trigger a corruption report inside act() so React processes the
   * state update synchronously.
   */
  async function renderOverlayAndReport(
    source: string,
    detail: string,
    recovered = true,
  ) {
    render(<CorruptionOverlay />);
    // Flush useEffect (setCorruptionHandler is called in effect)
    await act(async () => { /* flush effects */ });
    // Trigger corruption inside act so setState is batched
    act(() => {
      reportCorruption(source, detail, recovered);
    });
  }

  it('should render nothing when no corruption has occurred', () => {
    const { container } = render(<CorruptionOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('should display alert when reportCorruption is called', async () => {
    await renderOverlayAndReport('TestSource', 'localStorage "test-key" contained invalid data');

    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();
    expect(screen.getByText(/invalid data/)).toBeInTheDocument();
    expect(screen.getByText('TestSource')).toBeInTheDocument();
  });

  it('should show "Recovered" badge when recovered=true', async () => {
    await renderOverlayAndReport('Config', 'Some corruption', true);

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('should show "Needs Attention" when recovered=false', async () => {
    await renderOverlayAndReport('Cache', 'Unrecoverable corruption', false);

    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
  });

  it('should dismiss individual report when dismiss button is clicked', async () => {
    await renderOverlayAndReport('Source1', 'localStorage "key1" was corrupt');

    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
    });

    expect(screen.queryByTestId('corruption-overlay')).toBeNull();
  });

  it('should show Clear Key button when storage key is extractable from detail', async () => {
    await renderOverlayAndReport('LLMCache', 'localStorage "llm-cache" contained unparseable JSON');

    expect(screen.getByText('Clear Key')).toBeInTheDocument();
  });

  it('should NOT show Clear Key button when no storage key in detail', async () => {
    await renderOverlayAndReport('Unknown', 'Generic corruption without key name');

    expect(screen.queryByText('Clear Key')).toBeNull();
  });

  it('should remove localStorage key when Clear Key is clicked', async () => {
    localStorage.setItem('corrupt-key', '{ invalid json');

    await renderOverlayAndReport('Test', 'localStorage "corrupt-key" contained bad data');

    await act(async () => {
      fireEvent.click(screen.getByText('Clear Key'));
    });

    expect(localStorage.getItem('corrupt-key')).toBeNull();
  });

  it('should show Reset All to Defaults when multiple reports exist', async () => {
    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "key1" corrupt');
      reportCorruption('Source2', 'localStorage "key2" corrupt');
    });

    expect(screen.getByText('Reset All to Defaults')).toBeInTheDocument();
  });

  it('should NOT show Reset All to Defaults for single report', async () => {
    await renderOverlayAndReport('Source1', 'localStorage "key1" corrupt');

    expect(screen.queryByText('Reset All to Defaults')).toBeNull();
  });

  it('should clear known storage keys when Reset All to Defaults is clicked', async () => {
    localStorage.setItem('tutorial-progress', 'bad');
    localStorage.setItem('production-config', 'bad');
    localStorage.setItem('llm-cache', 'bad');

    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "key1" corrupt');
      reportCorruption('Source2', 'localStorage "key2" corrupt');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Reset All to Defaults'));
    });

    expect(localStorage.getItem('tutorial-progress')).toBeNull();
    expect(localStorage.getItem('production-config')).toBeNull();
    expect(localStorage.getItem('llm-cache')).toBeNull();
  });

  it('should dismiss all reports after Reset All to Defaults', async () => {
    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "key1" corrupt');
      reportCorruption('Source2', 'localStorage "key2" corrupt');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Reset All to Defaults'));
    });

    expect(screen.queryByTestId('corruption-overlay')).toBeNull();
  });

  it('should respect maxVisible limit', async () => {
    render(<CorruptionOverlay maxVisible={2} />);
    await act(async () => {});

    act(() => {
      reportCorruption('S1', 'corruption 1');
      reportCorruption('S2', 'corruption 2');
      reportCorruption('S3', 'corruption 3');
    });

    // Only the last 2 should be visible (S2, S3)
    const badges = screen.getAllByText(/S\d/);
    expect(badges).toHaveLength(2);
  });

  it('should show Clear All Corrupt Keys when multiple reports have extractable keys', async () => {
    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "key1" corrupt');
      reportCorruption('Source2', 'localStorage "key2" corrupt');
    });

    expect(screen.getByText('Clear All Corrupt Keys')).toBeInTheDocument();
  });

  it('should NOT show Clear All Corrupt Keys when reports lack storage keys', async () => {
    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'Generic corruption without key');
      reportCorruption('Source2', 'Another generic corruption');
    });

    expect(screen.queryByText('Clear All Corrupt Keys')).toBeNull();
    // Reset All to Defaults should still be available
    expect(screen.getByText('Reset All to Defaults')).toBeInTheDocument();
  });

  it('should clear only corrupt keys when Clear All Corrupt Keys is clicked', async () => {
    localStorage.setItem('corrupt-key-1', 'bad');
    localStorage.setItem('corrupt-key-2', 'bad');
    // This key is NOT in any corruption report, so it should survive
    localStorage.setItem('untouched-key', 'good');

    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "corrupt-key-1" corrupt');
      reportCorruption('Source2', 'localStorage "corrupt-key-2" corrupt');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Clear All Corrupt Keys'));
    });

    expect(localStorage.getItem('corrupt-key-1')).toBeNull();
    expect(localStorage.getItem('corrupt-key-2')).toBeNull();
    // Untouched key should still exist — Clear All only removes keys from reports
    expect(localStorage.getItem('untouched-key')).toBe('good');
  });

  it('should dismiss all reports after Clear All Corrupt Keys', async () => {
    render(<CorruptionOverlay />);
    await act(async () => {});

    act(() => {
      reportCorruption('Source1', 'localStorage "key1" corrupt');
      reportCorruption('Source2', 'localStorage "key2" corrupt');
    });

    expect(screen.getByTestId('corruption-overlay')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Clear All Corrupt Keys'));
    });

    expect(screen.queryByTestId('corruption-overlay')).toBeNull();
  });

  it('should unsubscribe from corruption handler on unmount', async () => {
    const { unmount } = render(<CorruptionOverlay />);
    await act(async () => {});
    unmount();

    expect(() => {
      reportCorruption('PostUnmount', 'should not throw');
    }).not.toThrow();
  });
});
