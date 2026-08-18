/**
 * @jest-environment jsdom
 *
 * Regression test for the post-loop stale-closure bug in
 * Iteration43Interface.startProcessing (09c class — same shape as
 * StreamingProcessor.onComplete).
 *
 * The completion log read `qualityMetrics.overallScore` from the useCallback
 * closure, but every score was produced via an async `setQualityMetrics` call
 * inside the loop — those updates do NOT mutate the closure binding within a
 * single invocation. So the log reported the stale pre-run value (0.0%) instead
 * of the just-computed score. The fix mirrors the computed value into a local
 * `finalOverallScore` accumulator and logs that.
 *
 * RED on the pre-fix source (log shows 0.0%); GREEN after (96.0%).
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — passthrough UI primitives so the simulation logic runs in jsdom.
// TabsContent renders its children unconditionally so the iteration log (which
// lives in the "quality" tab) is queryable regardless of the active tab.
// ---------------------------------------------------------------------------

jest.unstable_mockModule('lucide-react', () => ({
  Upload: () => React.createElement('span'),
  Play: () => React.createElement('span'),
  Download: () => React.createElement('span'),
  Settings: () => React.createElement('span'),
  Activity: () => React.createElement('span'),
  CheckCircle: () => React.createElement('span'),
  AlertCircle: () => React.createElement('span'),
  Info: () => React.createElement('span'),
}));

jest.unstable_mockModule('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  CardContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { onClick, disabled }, children),
}));

jest.unstable_mockModule('@/components/ui/progress', () => ({
  Progress: () => React.createElement('div'),
}));

jest.unstable_mockModule('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}));

jest.unstable_mockModule('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TabsList: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  TabsTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  // Render children unconditionally so the log panel is always in the DOM.
  TabsContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

jest.unstable_mockModule('@stv/core/lib/metrics-utils', () => ({
  bytesToMb: (bytes: number) => bytes / (1024 * 1024),
}));

const { default: Iteration43Interface } = await import('@/components/Iteration43Interface');

describe('Iteration43Interface — post-loop quality-score log', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Deterministic: every Math.random() returns 0, so each phase runs all 3
    // iterations and the final overallScore is Math.min(5*20, 96) = 96.
    jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs the computed final score, not the stale pre-run value (0.0%)', async () => {
    const { container } = render(React.createElement(Iteration43Interface));

    // Upload an audio file so the "処理開始" button renders.
    const file = new File(['dummy'], 'test.wav', { type: 'audio/wav' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const playBtn = screen.getByRole('button', { name: '処理開始' });

    // Run the full simulated pipeline (5 phases × 3 iterations × 1000ms).
    await act(async () => {
      fireEvent.click(playBtn);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000);
    });

    // The final computed score (last phase i=4): Math.min(5*20, 96) = 96.0%.
    expect(screen.getByText(/Overall quality score: 96\.0%/)).toBeInTheDocument();
    // The stale pre-run value must NOT appear in the completion log.
    expect(screen.queryByText(/Overall quality score: 0\.0%/)).toBeNull();
  });
});
