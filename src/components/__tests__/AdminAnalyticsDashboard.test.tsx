/**
 * @jest-environment jsdom
 */

/**
 * AdminAnalyticsDashboard component tests
 *
 * Verifies the dashboard renders monitoring data correctly and
 * responds to start/stop/refresh controls.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// -- mock data --

const mockSnapshot = {
  healthCheck: {
    status: 'healthy' as const,
    timestamp: 1700000000000,
    uptime: 3600000,
    checks: {
      memory: { status: 'healthy' as const, message: 'Memory OK', latency: 5, lastChecked: 1700000000000 },
      cache: { status: 'healthy' as const, message: 'Cache OK', latency: 2, lastChecked: 1700000000000 },
    },
    metrics: {
      timestamp: Date.now(),
      pipeline: { totalRequests: 10, successRate: 0.8, avgProcessingTime: 15000, p95ProcessingTime: 30000, p99ProcessingTime: 45000, activeRequests: 1 },
      llm: { totalRequests: 5, flashUsagePercent: 80, proUsagePercent: 20, avgFlashResponseTime: 2000, avgProResponseTime: 5000, cacheHitRate: 0.6, estimatedCostSavings: 50 },
      system: { cpuUsagePercent: 25, memoryUsageMB: 200, memoryUsagePercent: 40, heapUsedMB: 100, heapTotalMB: 200 },
      errors: { totalErrors: 2, errorRate: 0.2, recentErrors: [], recoverySuccessRate: 0.5 },
      quality: { transcriptionAccuracy: 0.92, layoutOverlapRate: 0, avgSceneQuality: 0.88 },
    },
    recommendations: ['System is operating optimally'],
  },
  nextDueAt: 1700000010000,
  lastCheckedAt: 1700000000000,
  productionMetrics: {
    totalRequests: 100,
    successfulRequests: 92,
    failedRequests: 8,
    averageProcessingTime: 15000,
    p95ProcessingTime: 30000,
    p99ProcessingTime: 45000,
    errorsByType: new Map([['timeout', 5], ['api_error', 3]]),
    componentMetrics: {
      transcription: { requests: 100, successes: 95, failures: 5, averageLatency: 5000, p95Latency: 8000, errors: [] },
      analysis: { requests: 100, successes: 90, failures: 10, averageLatency: 8000, p95Latency: 15000, errors: [] },
      visualization: { requests: 100, successes: 100, failures: 0, averageLatency: 2000, p95Latency: 4000, errors: [] },
      rendering: { requests: 100, successes: 92, failures: 8, averageLatency: 10000, p95Latency: 20000, errors: [] },
    },
  },
  productionHealth: {
    timestamp: new Date(),
    status: 'healthy' as const,
    components: {
      transcription: { name: 'transcription', status: 'healthy' as const, metrics: { successRate: 0.95, averageLatency: 5000, errorRate: 0.05 } },
      analysis: { name: 'analysis', status: 'degraded' as const, metrics: { successRate: 0.90, averageLatency: 8000, errorRate: 0.10 } },
      visualization: { name: 'visualization', status: 'healthy' as const, metrics: { successRate: 1.0, averageLatency: 2000, errorRate: 0 } },
      rendering: { name: 'rendering', status: 'healthy' as const, metrics: { successRate: 0.92, averageLatency: 10000, errorRate: 0.08 } },
    },
    alerts: [
      { severity: 'warning', component: 'analysis', message: 'analysis performance degraded', metric: 'errorRate', threshold: 0.05, actual: 0.10, timestamp: new Date(), actionRequired: 'Monitor closely.' },
    ],
    recommendations: ['System healthy. Continue monitoring for trends.'],
  },
  performanceSnapshot: {
    timestamp: Date.now(),
    pipeline: { totalRequests: 10, successRate: 0.8, avgProcessingTime: 15000, p95ProcessingTime: 30000, p99ProcessingTime: 45000, activeRequests: 1 },
    llm: { totalRequests: 5, flashUsagePercent: 80, proUsagePercent: 20, avgFlashResponseTime: 2000, avgProResponseTime: 5000, cacheHitRate: 0.6, estimatedCostSavings: 50 },
    system: { cpuUsagePercent: 25, memoryUsageMB: 200, memoryUsagePercent: 40, heapUsedMB: 100, heapTotalMB: 200 },
    errors: { totalErrors: 2, errorRate: 0.2, recentErrors: [], recoverySuccessRate: 0.5 },
    quality: { transcriptionAccuracy: 0.92, layoutOverlapRate: 0, avgSceneQuality: 0.88 },
  },
  trends: [
    { metric: 'processingTime', trend: 'improving', changePercent: -5.2 },
    { metric: 'errorRate', trend: 'stable', changePercent: 0.1 },
    { metric: 'memoryUsage', trend: 'degrading', changePercent: 12.3 },
  ],
  uptime: 3600000,
  learningStatus: {
    isRunning: true,
    iteration: 5,
    intervalMs: 60_000,
    nextAnalysisAt: Date.now() + 60_000,
    lastAnalysisAt: Date.now(),
    lastAnalysisSuccess: true,
  },
  learningReport: {
    totalDataPoints: 150,
    detectedPatterns: 3,
    optimizationStrategies: 2,
    systemInsights: 1,
    recentOptimizations: ['transcription_optimization', 'quality_enhancement'],
    learningVelocity: 2,
    commitHistory: [
      { component: 'transcription', reason: 'improvement_achieved', iteration: 3, message: 'feat(transcription): improvement_achieved', timestamp: '2026-06-24T12:00:00.000Z' },
    ],
  },
  detectedPatterns: [
    { pattern: 'slow_processing', confidence: 0.85, improvementSuggestion: 'Add caching', expectedGain: 0.3, validationCount: 5 },
  ],
  systemInsights: [
    { type: 'performance', description: 'Processing time above threshold', confidence: 0.9, actionable: true, recommendation: 'Consider caching' },
  ],
  reportHistory: [
    { timestamp: 1700000000000, iteration: 4, dataPoints: 140, detectedPatterns: 2, systemInsights: 0, learningVelocity: 1, success: true },
    { timestamp: 1700000060000, iteration: 5, dataPoints: 150, detectedPatterns: 3, systemInsights: 1, learningVelocity: 2, success: true },
  ],
};

// -- mock setup --

let mockReturn: {
  snapshot: typeof mockSnapshot;
  isPolling: boolean;
  refresh: ReturnType<typeof jest.fn>;
  start: ReturnType<typeof jest.fn>;
  stop: ReturnType<typeof jest.fn>;
};

jest.unstable_mockModule('@/hooks/useAdminAnalytics', () => ({
  __esModule: true,
  useAdminAnalytics: jest.fn(() => mockReturn),
}));

const { AdminAnalyticsDashboard } = await import('../AdminAnalyticsDashboard');

describe('AdminAnalyticsDashboard', () => {
  beforeEach(() => {
    mockReturn = {
      snapshot: mockSnapshot,
      isPolling: true,
      refresh: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -- structure tests --

  it('renders header with title', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Admin Analytics')).toBeInTheDocument();
  });

  it('renders overall HEALTHY status badge', () => {
    render(<AdminAnalyticsDashboard />);
    // Multiple badges show HEALTHY (overall + components); check at least one exists
    const healthyBadges = screen.getAllByText('HEALTHY');
    expect(healthyBadges.length).toBeGreaterThan(0);
  });

  it('renders CRITICAL status badge when status is critical', () => {
    mockReturn = {
      ...mockReturn,
      snapshot: {
        ...mockSnapshot,
        healthCheck: { ...mockSnapshot.healthCheck, status: 'critical' },
        productionHealth: { ...mockSnapshot.productionHealth, status: 'critical' },
      },
    };
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders uptime stat card', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    // 3600000ms = 1h 0m 0s
    expect(screen.getByText('1h 0m 0s')).toBeInTheDocument();
  });

  it('renders next health check time', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Next Health Check')).toBeInTheDocument();
  });

  it('renders total requests stat', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders avg processing time stat', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Avg Processing')).toBeInTheDocument();
    expect(screen.getByText('15.00s')).toBeInTheDocument();
  });

  it('renders P95 in stat subtitle', () => {
    render(<AdminAnalyticsDashboard />);
    // P95 from performanceSnapshot is 30000ms = 30.00s
    expect(screen.getByText('P95: 30.00s')).toBeInTheDocument();
  });

  // -- health tab tests --

  it('renders component health table', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Component Health')).toBeInTheDocument();
    expect(screen.getByText('transcription')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
    expect(screen.getByText('visualization')).toBeInTheDocument();
    expect(screen.getByText('rendering')).toBeInTheDocument();
  });

  it('renders system health checks', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('System Health Checks')).toBeInTheDocument();
    expect(screen.getByText('memory')).toBeInTheDocument();
    expect(screen.getByText('cache')).toBeInTheDocument();
    expect(screen.getByText('Memory OK')).toBeInTheDocument();
  });

  it('renders degraded status for analysis component', () => {
    render(<AdminAnalyticsDashboard />);
    const degradedBadges = screen.getAllByText('DEGRADED');
    expect(degradedBadges.length).toBeGreaterThan(0);
  });

  // -- tab tests --

  it('renders all five tab triggers', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByRole('tab', { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /trends/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /learning/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recommendations/i })).toBeInTheDocument();
  });

  it('shows alert count badge on Alerts tab', () => {
    render(<AdminAnalyticsDashboard />);
    const tabs = screen.getAllByRole('tab');
    const alertsTab = tabs.find(t => t.textContent?.includes('Alerts'));
    expect(alertsTab).toBeDefined();
    expect(alertsTab!.textContent).toContain('1');
  });

  // -- control button tests --

  it('calls refresh when Refresh button clicked', () => {
    render(<AdminAnalyticsDashboard />);
    const refreshBtn = screen.getByText('Refresh').closest('button')!;
    fireEvent.click(refreshBtn);
    expect(mockReturn.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows Pause button when polling is active', () => {
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('shows Start button when polling is inactive', () => {
    mockReturn = { ...mockReturn, isPolling: false };
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('Start')).toBeInTheDocument();
  });

  it('calls stop when Pause button clicked', () => {
    render(<AdminAnalyticsDashboard />);
    const pauseBtn = screen.getByText('Pause').closest('button')!;
    fireEvent.click(pauseBtn);
    expect(mockReturn.stop).toHaveBeenCalledTimes(1);
  });

  it('calls start when Start button clicked', () => {
    mockReturn = { ...mockReturn, isPolling: false };
    render(<AdminAnalyticsDashboard />);
    const startBtn = screen.getByText('Start').closest('button')!;
    fireEvent.click(startBtn);
    expect(mockReturn.start).toHaveBeenCalledTimes(1);
  });

  // -- empty state tests --

  it('renders alert count 0 badge when no alerts', () => {
    mockReturn = {
      ...mockReturn,
      snapshot: {
        ...mockSnapshot,
        productionHealth: { ...mockSnapshot.productionHealth, alerts: [] },
      },
    };
    render(<AdminAnalyticsDashboard />);
    // When no alerts, the badge shouldn't render (0 alerts = no badge)
    const tabs = screen.getAllByRole('tab');
    const alertsTab = tabs.find(t => t.textContent?.includes('Alerts'));
    expect(alertsTab).toBeDefined();
    // Should not contain alert count badge
    expect(alertsTab!.textContent).not.toMatch(/\d+/);
  });

  it('renders empty state message when no health data', () => {
    mockReturn = {
      ...mockReturn,
      snapshot: {
        healthCheck: null,
        nextDueAt: null,
        lastCheckedAt: null,
        productionMetrics: null,
        productionHealth: null,
        performanceSnapshot: null,
        trends: [],
        uptime: 0,
        learningStatus: {
          isRunning: false,
          iteration: 0,
          intervalMs: 60_000,
          nextAnalysisAt: null,
          lastAnalysisAt: null,
          lastAnalysisSuccess: false,
        },
        learningReport: {
          totalDataPoints: 0,
          detectedPatterns: 0,
          optimizationStrategies: 0,
          systemInsights: 0,
          recentOptimizations: [],
          learningVelocity: 0,
          commitHistory: [],
        },
        detectedPatterns: [],
        systemInsights: [],
        reportHistory: [],
      },
    };
    render(<AdminAnalyticsDashboard />);
    // Should show the empty state message
    expect(screen.getByText(/No health data available/)).toBeInTheDocument();
  });

  it('renders uptime as 0s when uptime is 0', () => {
    mockReturn = {
      ...mockReturn,
      snapshot: { ...mockSnapshot, uptime: 0 },
    };
    render(<AdminAnalyticsDashboard />);
    expect(screen.getByText('0s')).toBeInTheDocument();
  });
});
