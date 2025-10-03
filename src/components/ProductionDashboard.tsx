/**
 * 🏭 Production Configuration Dashboard
 * Manage production settings, monitoring, and optimization
 * Following custom instructions for production readiness enhancement
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Server,
  Monitor,
  Zap,
  FileText,
  RefreshCw
} from 'lucide-react';
import { productionConfig, ProductionEnvironment } from '@/config/production-config';

export const ProductionDashboard: React.FC = () => {
  const [config, setConfig] = useState<ProductionEnvironment>(productionConfig.getConfig());
  const [report, setReport] = useState(productionConfig.generatePerformanceReport());
  const [isOptimized, setIsOptimized] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setConfig(productionConfig.getConfig());
    setReport(productionConfig.generatePerformanceReport());
  };

  const handleConfigUpdate = (updates: Partial<ProductionEnvironment>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setUnsavedChanges(true);
  };

  const saveChanges = () => {
    productionConfig.updateConfig(config);
    setUnsavedChanges(false);
    refreshData();
  };

  const resetConfig = () => {
    productionConfig.resetConfig();
    setUnsavedChanges(false);
    refreshData();
  };

  const optimizeConfig = () => {
    const optimized = productionConfig.getOptimizedConfig();
    setConfig(optimized);
    setIsOptimized(true);
    setUnsavedChanges(true);
  };

  const getEnvironmentBadgeColor = (env: string) => {
    switch (env) {
      case 'production': return 'bg-green-100 text-green-800';
      case 'staging': return 'bg-yellow-100 text-yellow-800';
      case 'development': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const EnvironmentOverview = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="w-5 h-5" />
          Environment Overview
        </CardTitle>
        <CardDescription>Current environment configuration and status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Environment</Label>
            <Badge className={getEnvironmentBadgeColor(config.name)}>
              {config.name.toUpperCase()}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">API Base URL</Label>
            <p className="text-sm font-mono truncate">{config.apiBaseUrl}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Max File Size</Label>
            <p className="text-sm">{Math.round(config.performance.maxFileSize / 1024 / 1024)}MB</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Concurrent Jobs</Label>
            <p className="text-sm">{config.performance.maxConcurrentJobs}</p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <h4 className="font-medium">System Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label>Available Memory</Label>
              <p>{report.systemInfo.availableMemory}MB</p>
            </div>
            <div>
              <Label>CPU Cores</Label>
              <p>{report.systemInfo.cpuCores}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const PerformanceSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Performance Configuration
        </CardTitle>
        <CardDescription>Optimize system performance settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxConcurrentJobs">Max Concurrent Jobs</Label>
            <Input
              id="maxConcurrentJobs"
              type="number"
              value={config.performance.maxConcurrentJobs}
              onChange={(e) => handleConfigUpdate({
                performance: {
                  ...config.performance,
                  maxConcurrentJobs: parseInt(e.target.value) || 1
                }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
            <Input
              id="memoryLimit"
              type="number"
              value={config.performance.memoryLimit}
              onChange={(e) => handleConfigUpdate({
                performance: {
                  ...config.performance,
                  memoryLimit: parseInt(e.target.value) || 512
                }
              })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={config.performance.timeoutMs}
              onChange={(e) => handleConfigUpdate({
                performance: {
                  ...config.performance,
                  timeoutMs: parseInt(e.target.value) || 60000
                }
              })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cacheStrategy">Cache Strategy</Label>
            <Select
              value={config.performance.cacheStrategy}
              onValueChange={(value: 'memory' | 'redis' | 'hybrid') =>
                handleConfigUpdate({
                  performance: {
                    ...config.performance,
                    cacheStrategy: value
                  }
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="redis">Redis</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="compression"
            checked={config.performance.enableCompression}
            onCheckedChange={(checked) => handleConfigUpdate({
              performance: {
                ...config.performance,
                enableCompression: checked
              }
            })}
          />
          <Label htmlFor="compression">Enable Compression</Label>
        </div>
      </CardContent>
    </Card>
  );

  const MonitoringSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Monitoring & Alerts
        </CardTitle>
        <CardDescription>Configure monitoring and alerting thresholds</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="errorTracking"
              checked={config.monitoring.enableErrorTracking}
              onCheckedChange={(checked) => handleConfigUpdate({
                monitoring: {
                  ...config.monitoring,
                  enableErrorTracking: checked
                }
              })}
            />
            <Label htmlFor="errorTracking" className="text-sm">Error Tracking</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="performanceMonitoring"
              checked={config.monitoring.enablePerformanceMonitoring}
              onCheckedChange={(checked) => handleConfigUpdate({
                monitoring: {
                  ...config.monitoring,
                  enablePerformanceMonitoring: checked
                }
              })}
            />
            <Label htmlFor="performanceMonitoring" className="text-sm">Performance</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="userAnalytics"
              checked={config.monitoring.enableUserAnalytics}
              onCheckedChange={(checked) => handleConfigUpdate({
                monitoring: {
                  ...config.monitoring,
                  enableUserAnalytics: checked
                }
              })}
            />
            <Label htmlFor="userAnalytics" className="text-sm">User Analytics</Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="logLevel">Log Level</Label>
            <Select
              value={config.monitoring.logLevel}
              onValueChange={(value: 'error' | 'warn' | 'info' | 'debug') =>
                handleConfigUpdate({
                  monitoring: {
                    ...config.monitoring,
                    logLevel: value
                  }
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="metricsInterval">Metrics Interval (ms)</Label>
            <Input
              id="metricsInterval"
              type="number"
              value={config.monitoring.metricsCollectionInterval}
              onChange={(e) => handleConfigUpdate({
                monitoring: {
                  ...config.monitoring,
                  metricsCollectionInterval: parseInt(e.target.value) || 5000
                }
              })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Alert Thresholds</Label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="errorRate" className="text-xs">Error Rate</Label>
              <Input
                id="errorRate"
                type="number"
                step="0.01"
                value={config.monitoring.alertThresholds.errorRate}
                onChange={(e) => handleConfigUpdate({
                  monitoring: {
                    ...config.monitoring,
                    alertThresholds: {
                      ...config.monitoring.alertThresholds,
                      errorRate: parseFloat(e.target.value) || 0.01
                    }
                  }
                })}
              />
            </div>
            <div>
              <Label htmlFor="responseTime" className="text-xs">Response Time (ms)</Label>
              <Input
                id="responseTime"
                type="number"
                value={config.monitoring.alertThresholds.responseTime}
                onChange={(e) => handleConfigUpdate({
                  monitoring: {
                    ...config.monitoring,
                    alertThresholds: {
                      ...config.monitoring.alertThresholds,
                      responseTime: parseInt(e.target.value) || 2000
                    }
                  }
                })}
              />
            </div>
            <div>
              <Label htmlFor="memoryUsage" className="text-xs">Memory Usage</Label>
              <Input
                id="memoryUsage"
                type="number"
                step="0.1"
                value={config.monitoring.alertThresholds.memoryUsage}
                onChange={(e) => handleConfigUpdate({
                  monitoring: {
                    ...config.monitoring,
                    alertThresholds: {
                      ...config.monitoring.alertThresholds,
                      memoryUsage: parseFloat(e.target.value) || 0.7
                    }
                  }
                })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const RecommendationsPanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Optimization Recommendations
        </CardTitle>
        <CardDescription>System-generated recommendations for better performance</CardDescription>
      </CardHeader>
      <CardContent>
        {report.recommendations.length > 0 ? (
          <div className="space-y-3">
            {report.recommendations.map((rec, index) => (
              <Alert key={index}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Recommendation {index + 1}</AlertTitle>
                <AlertDescription>{rec}</AlertDescription>
              </Alert>
            ))}
            <Button onClick={optimizeConfig} className="w-full">
              <Zap className="w-4 h-4 mr-2" />
              Apply All Optimizations
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium mb-2">Configuration Optimized</h3>
            <p className="text-sm text-gray-600">Your current configuration is optimal for this system.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const ValidationStatus = () => {
    const validation = report.configValidation;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validation.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            Configuration Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validation.isValid ? (
            <div className="text-center py-4">
              <p className="text-green-600 font-medium">✅ Configuration is valid</p>
            </div>
          ) : (
            <div className="space-y-2">
              {validation.errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Production Dashboard</h1>
          <p className="text-gray-600">Manage production configuration and monitoring</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={resetConfig}>
            Reset to Defaults
          </Button>
          <Button
            onClick={saveChanges}
            disabled={!unsavedChanges}
            className={unsavedChanges ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            {unsavedChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      {unsavedChanges && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsaved Changes</AlertTitle>
          <AlertDescription>
            You have unsaved configuration changes. Remember to save them before leaving.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <EnvironmentOverview />
        </div>
        <div className="lg:col-span-1">
          <ValidationStatus />
        </div>
        <div className="lg:col-span-1">
          <RecommendationsPanel />
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <PerformanceSettings />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringSettings />
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>Enable or disable specific features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(config.features).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Switch
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => handleConfigUpdate({
                        features: {
                          ...config.features,
                          [key]: checked
                        }
                      })}
                    />
                    <Label htmlFor={key} className="text-sm">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionDashboard;