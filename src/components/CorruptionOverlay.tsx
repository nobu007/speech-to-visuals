/**
 * CorruptionOverlay - User-facing UI for localStorage corruption events.
 *
 * Subscribes to reportCorruption via setCorruptionHandler and displays
 * a dismissible overlay when corruption is detected. Provides actionable
 * recovery buttons so users don't need DevTools to resolve corruption.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/utils/logger';
import {
  setCorruptionHandler,
  type CorruptionReport,
  type CorruptionHandler,
} from '@/utils/report-corruption';

interface CorruptionOverlayProps {
  className?: string;
  /** Max number of reports to keep visible (default: 5) */
  maxVisible?: number;
}

interface VisibleReport extends CorruptionReport {
  id: string;
}

/**
 * Extracts a localStorage key name from a corruption detail string.
 * Looks for patterns like: localStorage "key_name"
 */
function extractStorageKey(detail: string): string | null {
  const match = detail.match(/localStorage ["']([^"']+)["']/);
  return match ? match[1] : null;
}

export const CorruptionOverlay: React.FC<CorruptionOverlayProps> = ({
  className = '',
  maxVisible = 5,
}) => {
  const [reports, setReports] = useState<VisibleReport[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const reportsRef = useRef<VisibleReport[]>([]);
  reportsRef.current = reports;

  // Subscribe to corruption events
  useEffect(() => {
    const handler: CorruptionHandler = (report: CorruptionReport) => {
      const id = `${report.source}-${report.timestamp}`;
      setReports(prev => {
        const next = [...prev, { ...report, id }];
        return next.slice(-maxVisible);
      });
    };

    setCorruptionHandler(handler);
    return () => {
      setCorruptionHandler(null);
    };
  }, [maxVisible]);

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
  }, []);

  const clearCorruptKey = useCallback((detail: string) => {
    const key = extractStorageKey(detail);
    if (key) {
      try {
        localStorage.removeItem(key);
        logger.info(`[CorruptionOverlay] Cleared corrupt key: ${key}`);
      } catch {
        logger.warn(`[CorruptionOverlay] Failed to clear key: ${key}`);
      }
    }
  }, []);

  const clearAllCorruptKeys = useCallback(() => {
    // Clear only the keys extracted from visible corruption reports
    const keysToClear = new Set<string>();
    for (const report of reportsRef.current) {
      if (dismissedIds.has(report.id)) continue;
      const key = extractStorageKey(report.detail);
      if (key) keysToClear.add(key);
    }
    keysToClear.forEach(key => {
      try {
        localStorage.removeItem(key);
        logger.info(`[CorruptionOverlay] Cleared corrupt key: ${key}`);
      } catch {
        logger.warn(`[CorruptionOverlay] Failed to clear key: ${key}`);
      }
    });
    setDismissedIds(new Set(reportsRef.current.map(r => r.id)));
  }, [dismissedIds]);

  const resetToDefaults = useCallback(() => {
    // Clear all known application storage keys
    const knownKeys = [
      'tutorial-progress',
      'production-config',
      'llm-cache',
      'pipeline-state',
    ];
    knownKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // noop
      }
    });
    logger.info('[CorruptionOverlay] Reset all known storage keys to defaults');
    setDismissedIds(new Set(reportsRef.current.map(r => r.id)));
  }, []);

  const visibleReports = reports.filter(r => !dismissedIds.has(r.id));

  if (visibleReports.length === 0) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md space-y-2 ${className}`}
      role="alert"
      aria-live="polite"
      data-testid="corruption-overlay"
    >
      {visibleReports.map(report => (
        <Alert
          key={report.id}
          variant="default"
          className="border-orange-300 bg-orange-50 dark:bg-orange-950/30"
        >
          <AlertTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="text-orange-700">
                {report.source}
              </Badge>
              {report.recovered ? 'Recovered' : 'Needs Attention'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => dismiss(report.id)}
              aria-label="Dismiss"
            >
              ×
            </Button>
          </AlertTitle>
          <AlertDescription>
            <p className="text-sm text-muted-foreground">{report.detail}</p>
            <div className="mt-2 flex gap-2">
              {extractStorageKey(report.detail) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearCorruptKey(report.detail);
                    dismiss(report.id);
                  }}
                >
                  Clear Key
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dismiss(report.id)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
      {visibleReports.length > 1 && (
        <div className="flex gap-2">
          {visibleReports.some(r => extractStorageKey(r.detail)) && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={clearAllCorruptKeys}
            >
              Clear All Corrupt Keys
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="flex-1"
            onClick={resetToDefaults}
          >
            Reset All to Defaults
          </Button>
        </div>
      )}
    </div>
  );
};
