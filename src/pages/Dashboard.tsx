import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import QualityDashboard from '@/components/QualityDashboard';
import PipelineMonitor from '@/components/PipelineMonitor';
import {
  Activity,
  Settings,
  BarChart3,
  FileAudio,
  Zap,
  Brain,
  Target,
  TrendingUp,
  CheckCircle
} from 'lucide-react';

interface SystemStats {
  totalProcessed: number;
  successRate: number;
  avgProcessingTime: number;
  systemUptime: number;
  cacheHitRate: number;
  activeOptimizations: number;
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats] = useState<SystemStats>({
    totalProcessed: 1247,
    successRate: 98.3,
    avgProcessingTime: 12.4,
    systemUptime: 99.8,
    cacheHitRate: 87.2,
    activeOptimizations: 4
  });

  const handlePipelineStart = (audioFile: File) => {
    console.log('Starting pipeline with file:', audioFile.name);
    // In real implementation, this would trigger the actual pipeline
  };

  const handlePipelineStop = () => {
    console.log('Stopping pipeline');
    // In real implementation, this would stop the pipeline
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold">Audio-to-Diagram Generator</h1>
                  <p className="text-sm text-muted-foreground">Production Monitoring Dashboard</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge variant="default" className="bg-green-100 text-green-800">
                System Online
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center space-x-2">
              <FileAudio className="h-4 w-4" />
              <span>Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Quality Monitor</span>
            </TabsTrigger>
            <TabsTrigger value="optimization" className="flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Optimization</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
                  <FileAudio className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.totalProcessed.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.successRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    +0.8% from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.avgProcessingTime}s</div>
                  <p className="text-xs text-muted-foreground">
                    -2.1s improvement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.systemUptime}%</div>
                  <p className="text-xs text-muted-foreground">
                    Last 30 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.cacheHitRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Smart caching active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Optimizations</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{systemStats.activeOptimizations}</div>
                  <p className="text-xs text-muted-foreground">
                    Self-optimization enabled
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest pipeline executions and system events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      timestamp: '2 minutes ago',
                      event: 'Pipeline completed successfully',
                      details: 'presentation_audio.mp3 → 4 diagrams generated',
                      status: 'success'
                    },
                    {
                      timestamp: '8 minutes ago',
                      event: 'Quality optimization applied',
                      details: 'Accuracy improved by 3.2% for technical content',
                      status: 'info'
                    },
                    {
                      timestamp: '15 minutes ago',
                      event: 'Pipeline completed successfully',
                      details: 'meeting_recording.wav → 6 diagrams generated',
                      status: 'success'
                    },
                    {
                      timestamp: '23 minutes ago',
                      event: 'Smart caching activated',
                      details: 'Similar content detected, using optimized processing',
                      status: 'info'
                    },
                    {
                      timestamp: '34 minutes ago',
                      event: 'System maintenance completed',
                      details: 'Memory cleanup and cache optimization',
                      status: 'maintenance'
                    }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 ${
                          activity.status === 'success'
                            ? 'bg-green-500'
                            : activity.status === 'info'
                            ? 'bg-blue-500'
                            : activity.status === 'maintenance'
                            ? 'bg-orange-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{activity.event}</div>
                        <div className="text-xs text-muted-foreground">{activity.details}</div>
                        <div className="text-xs text-muted-foreground mt-1">{activity.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline">
            <PipelineMonitor
              onStartPipeline={handlePipelineStart}
              onStopPipeline={handlePipelineStop}
            />
          </TabsContent>

          {/* Quality Monitor Tab */}
          <TabsContent value="quality">
            <QualityDashboard realtime={true} refreshInterval={3000} />
          </TabsContent>

          {/* Optimization Tab */}
          <TabsContent value="optimization" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Smart Optimization System</span>
                </CardTitle>
                <CardDescription>
                  Automated system optimization and performance tuning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Optimization Status */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Active Optimizations</h3>
                    <div className="space-y-3">
                      {[
                        {
                          name: 'Smart Parameter Tuning',
                          status: 'active',
                          improvement: '+15% accuracy',
                          description: 'Automatically adjusts detection thresholds'
                        },
                        {
                          name: 'Adaptive Processing',
                          status: 'active',
                          improvement: '+25% speed',
                          description: 'Selects optimal strategy based on content'
                        },
                        {
                          name: 'Intelligent Caching',
                          status: 'active',
                          improvement: '+50% cache hits',
                          description: 'Semantic similarity matching'
                        },
                        {
                          name: 'Predictive Maintenance',
                          status: 'monitoring',
                          improvement: '90% error prevention',
                          description: 'Proactive system health monitoring'
                        }
                      ].map((opt, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium text-sm">{opt.name}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                          <div className="text-right">
                            <Badge
                              variant={opt.status === 'active' ? 'default' : 'secondary'}
                              className="mb-1"
                            >
                              {opt.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground">{opt.improvement}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optimization Metrics */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Performance Improvements</h3>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="text-2xl font-bold text-green-600">23%</div>
                        <div className="text-sm font-medium">Processing Speed Gain</div>
                        <div className="text-xs text-muted-foreground">vs. baseline performance</div>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">87%</div>
                        <div className="text-sm font-medium">Cache Hit Rate</div>
                        <div className="text-xs text-muted-foreground">intelligent semantic matching</div>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">15%</div>
                        <div className="text-sm font-medium">Accuracy Improvement</div>
                        <div className="text-xs text-muted-foreground">smart parameter tuning</div>
                      </div>

                      <div className="p-3 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">94%</div>
                        <div className="text-sm font-medium">Error Reduction</div>
                        <div className="text-xs text-muted-foreground">predictive maintenance</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Optimization System Active</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    The system is continuously learning and optimizing based on usage patterns.
                    All optimizations are applied automatically with no manual intervention required.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;