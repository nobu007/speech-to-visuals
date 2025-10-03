/**
 * 🛡️ Error Alert System UI Component
 * User-facing error notifications with recovery options
 * Following custom instructions for user experience excellence
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  X,
  RefreshCw,
  Clock,
  Settings,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { productionErrorHandler } from '@/monitoring/production-error-handler';
import type { ErrorAlert, ErrorMetrics } from '@/monitoring/production-error-handler';

interface ErrorAlertSystemProps {
  className?: string;
  showMetrics?: boolean;
  autoHide?: boolean;
}

export const ErrorAlertSystem: React.FC<ErrorAlertSystemProps> = ({
  className = '',
  showMetrics = false,
  autoHide = true
}) => {
  const [alerts, setAlerts] = useState<ErrorAlert[]>([]);
  const [metrics, setMetrics] = useState<ErrorMetrics | null>(null);
  const [executingRecovery, setExecutingRecovery] = useState<Set<string>>(new Set());
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Subscribe to error handler
  useEffect(() => {
    const updateAlerts = (alert: ErrorAlert) => {
      setAlerts(prev => {
        const exists = prev.find(a => a.id === alert.id);
        if (exists) return prev;

        const newAlerts = [alert, ...prev];

        // Auto-hide low priority alerts after 5 seconds
        if (autoHide && alert.severity === 'low') {
          setTimeout(() => {
            setDismissedAlerts(prev => new Set([...prev, alert.id]));
          }, 5000);
        }

        return newAlerts;
      });
    };

    productionErrorHandler.onError('ErrorAlertSystem', updateAlerts);

    // Periodically update metrics
    const metricsInterval = setInterval(() => {
      if (showMetrics) {
        setMetrics(productionErrorHandler.getMetrics());
      }
    }, 5000);

    // Initial load
    setAlerts(productionErrorHandler.getErrorQueue());
    if (showMetrics) {
      setMetrics(productionErrorHandler.getMetrics());
    }

    return () => {
      clearInterval(metricsInterval);
    };
  }, [showMetrics, autoHide]);

  /**
   * Get icon for error severity
   */
  const getSeverityIcon = (severity: ErrorAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <Info className="h-5 w-5 text-yellow-600" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  /**
   * Get severity color classes
   */
  const getSeverityColors = (severity: ErrorAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          border: 'border-red-200',
          background: 'bg-red-50',
          text: 'text-red-800',
          badge: 'bg-red-100 text-red-800'
        };
      case 'high':
        return {
          border: 'border-orange-200',
          background: 'bg-orange-50',
          text: 'text-orange-800',
          badge: 'bg-orange-100 text-orange-800'
        };
      case 'medium':
        return {
          border: 'border-yellow-200',
          background: 'bg-yellow-50',
          text: 'text-yellow-800',
          badge: 'bg-yellow-100 text-yellow-800'
        };
      case 'low':
        return {
          border: 'border-blue-200',
          background: 'bg-blue-50',
          text: 'text-blue-800',
          badge: 'bg-blue-100 text-blue-800'
        };
      default:
        return {
          border: 'border-gray-200',
          background: 'bg-gray-50',
          text: 'text-gray-800',
          badge: 'bg-gray-100 text-gray-800'
        };
    }
  };

  /**
   * Execute recovery strategy
   */
  const executeRecovery = async (errorId: string, strategyName: string) => {
    setExecutingRecovery(prev => new Set([...prev, `${errorId}-${strategyName}`]));

    try {
      const success = await productionErrorHandler.executeRecoveryStrategy(errorId, strategyName);

      if (success) {
        console.log('✅ Recovery executed successfully');
        // Optionally remove the alert on successful recovery
        setDismissedAlerts(prev => new Set([...prev, errorId]));
      } else {
        console.log('❌ Recovery execution failed');
      }
    } catch (error) {
      console.error('Recovery execution error:', error);
    } finally {
      setExecutingRecovery(prev => {
        const updated = new Set(prev);
        updated.delete(`${errorId}-${strategyName}`);
        return updated;
      });
    }
  };

  /**
   * Dismiss alert
   */
  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  /**
   * Toggle alert expansion
   */
  const toggleAlert = (alertId: string) => {
    setExpandedAlerts(prev => {
      const updated = new Set(prev);
      if (updated.has(alertId)) {
        updated.delete(alertId);
      } else {
        updated.add(alertId);
      }
      return updated;
    });
  };

  /**
   * Format time ago
   */
  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}時間前`;
    if (minutes > 0) return `${minutes}分前`;
    return `${seconds}秒前`;
  };

  // Filter out dismissed alerts
  const visibleAlerts = alerts.filter(alert => !dismissedAlerts.has(alert.id));

  if (visibleAlerts.length === 0 && !showMetrics) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metrics Display */}
      {showMetrics && metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Health Metrics
            </CardTitle>
            <CardDescription>
              Real-time error monitoring and system status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{metrics.criticalErrors}</div>
                <div className="text-xs text-red-600">Critical Errors</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.errorRate.toFixed(1)}
                </div>
                <div className="text-xs text-orange-600">Errors/min</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.meanTimeToRecovery.toFixed(0)}s
                </div>
                <div className="text-xs text-blue-600">Avg Recovery</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{metrics.affectedUsers}</div>
                <div className="text-xs text-green-600">Affected Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert List */}
      {visibleAlerts.map(alert => {
        const colors = getSeverityColors(alert.severity);
        const isExpanded = expandedAlerts.has(alert.id);

        return (
          <Alert
            key={alert.id}
            className={`${colors.border} ${colors.background} transition-all duration-200`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTitle className={colors.text}>
                      System Alert
                    </AlertTitle>
                    <Badge className={colors.badge}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(alert.timestamp)}
                    </span>
                  </div>

                  <AlertDescription className={colors.text}>
                    {alert.userMessage}
                  </AlertDescription>

                  {/* Recovery Options */}
                  {alert.recoveryOptions.length > 0 && (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAlert(alert.id)}
                        className="text-xs"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            回復オプションを隠す
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            回復オプションを表示 ({alert.recoveryOptions.length})
                          </>
                        )}
                      </Button>

                      {isExpanded && (
                        <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                          <p className="text-xs text-gray-600 mb-2">
                            以下の回復オプションを試すことができます：
                          </p>
                          {alert.recoveryOptions.map(strategy => {
                            const isExecuting = executingRecovery.has(`${alert.id}-${strategy.name}`);

                            return (
                              <div
                                key={strategy.name}
                                className="flex items-center justify-between p-2 bg-white rounded border"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{strategy.description}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    約 {strategy.estimatedTime}秒
                                    <span>優先度: {strategy.priority}</span>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => executeRecovery(alert.id, strategy.name)}
                                  disabled={isExecuting}
                                  className="ml-2"
                                >
                                  {isExecuting ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                      実行中...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      実行
                                    </>
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Dismiss Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissAlert(alert.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        );
      })}

      {/* Action Buttons */}
      {visibleAlerts.length > 0 && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const allIds = visibleAlerts.map(a => a.id);
              setDismissedAlerts(prev => new Set([...prev, ...allIds]));
            }}
          >
            <X className="h-4 w-4 mr-2" />
            すべて非表示
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const report = productionErrorHandler.exportErrorReport();
              const blob = new Blob([report], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `error-report-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            エラーレポートをダウンロード
          </Button>
        </div>
      )}
    </div>
  );
};

export default ErrorAlertSystem;