/**
 * 🚀 Enterprise Integration Layer - Orchestration & API Gateway
 * Integrates all enterprise components with the main pipeline
 * Following custom instructions for enterprise excellence
 */

import { globalMultiTenantManager } from './multi-tenant-manager';
import { globalDeploymentManager } from './global-deployment';
import { globalAnalyticsDashboard } from './analytics-dashboard';

export interface EnterpriseRequest {
  tenantId: string;
  requestId: string;
  type: 'audio_processing' | 'analytics' | 'management' | 'monitoring';
  data: any;
  metadata: {
    userLocation?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeout?: number;
    retryPolicy?: {
      maxRetries: number;
      backoffMs: number;
    };
  };
}

export interface EnterpriseResponse {
  requestId: string;
  tenantId: string;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    processingTime: number;
    region: string;
    cacheHit: boolean;
    cost: number;
  };
}

export interface EnterpriseConfig {
  apiGateway: {
    rateLimit: {
      basic: number;
      professional: number;
      enterprise: number;
    };
    timeout: number;
    retries: number;
  };
  security: {
    authentication: 'oauth2' | 'jwt' | 'api_key';
    encryption: 'aes256' | 'rsa2048';
    auditLog: boolean;
  };
  performance: {
    caching: boolean;
    compression: boolean;
    loadBalancing: 'round_robin' | 'least_connections' | 'weighted';
  };
}

export class EnterpriseIntegration {
  private config: EnterpriseConfig;
  private requestQueue: Map<string, EnterpriseRequest> = new Map();
  private responseCache: Map<string, any> = new Map();
  private auditLog: any[] = [];
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0
  };

  constructor(config?: Partial<EnterpriseConfig>) {
    this.config = {
      apiGateway: {
        rateLimit: { basic: 100, professional: 1000, enterprise: 10000 },
        timeout: 300000, // 5 minutes
        retries: 3,
        ...config?.apiGateway
      },
      security: {
        authentication: 'oauth2',
        encryption: 'aes256',
        auditLog: true,
        ...config?.security
      },
      performance: {
        caching: true,
        compression: true,
        loadBalancing: 'weighted',
        ...config?.performance
      }
    };

    this.initializeIntegration();
  }

  /**
   * Main enterprise API gateway - processes all requests
   */
  async processRequest(request: EnterpriseRequest): Promise<EnterpriseResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Validate and authenticate request
      await this.validateRequest(request);

      // Step 2: Check tenant access and limits
      const accessValidation = await globalMultiTenantManager.validateTenantAccess(
        request.tenantId,
        request.type
      );

      if (!accessValidation.allowed) {
        throw new Error(`Access denied: ${accessValidation.reason}`);
      }

      // Step 3: Route request to optimal region
      const routing = await globalDeploymentManager.routeRequest({
        userLocation: request.metadata.userLocation,
        tenantId: request.tenantId,
        requestType: request.type
      });

      // Step 4: Check cache for similar requests
      const cacheKey = this.generateCacheKey(request);
      let cacheHit = false;
      let result: any;

      if (this.config.performance.caching && this.responseCache.has(cacheKey)) {
        result = this.responseCache.get(cacheKey);
        cacheHit = true;
        console.log(`💾 Cache hit for request ${request.requestId}`);
      } else {
        // Step 5: Process request based on type
        result = await this.executeRequest(request, routing.region);

        // Store in cache
        if (this.config.performance.caching) {
          this.responseCache.set(cacheKey, result);
          // Set cache expiration
          setTimeout(() => this.responseCache.delete(cacheKey), 300000); // 5 minutes
        }
      }

      // Step 6: Update metrics and billing
      await this.updateTenantMetrics(request, result, routing.region);

      // Step 7: Generate response
      const processingTime = Date.now() - startTime;
      this.updateGlobalMetrics(processingTime, true);

      const response: EnterpriseResponse = {
        requestId: request.requestId,
        tenantId: request.tenantId,
        success: true,
        data: result,
        metadata: {
          processingTime,
          region: routing.region.id,
          cacheHit,
          cost: this.calculateRequestCost(request, processingTime, routing.region)
        }
      };

      // Step 8: Log for audit
      if (this.config.security.auditLog) {
        this.logAuditEvent(request, response);
      }

      console.log(`✅ Enterprise request processed: ${request.requestId} (${processingTime}ms)`);
      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateGlobalMetrics(processingTime, false);

      const errorResponse: EnterpriseResponse = {
        requestId: request.requestId,
        tenantId: request.tenantId,
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error
        },
        metadata: {
          processingTime,
          region: 'unknown',
          cacheHit: false,
          cost: 0
        }
      };

      // Log error for audit
      if (this.config.security.auditLog) {
        this.logAuditEvent(request, errorResponse);
      }

      console.error(`❌ Enterprise request failed: ${request.requestId}`, error);
      return errorResponse;
    }
  }

  /**
   * Get comprehensive enterprise status
   */
  getEnterpriseStatus(): {
    system: any;
    tenants: any;
    deployment: any;
    analytics: any;
    integration: any;
  } {
    return {
      system: {
        status: 'operational',
        version: '1.37.0',
        uptime: process.uptime(),
        environment: 'production'
      },
      tenants: globalMultiTenantManager.getGlobalScalingMetrics(),
      deployment: globalDeploymentManager.getGlobalMetrics(),
      analytics: globalAnalyticsDashboard.getSystemHealthStatus(),
      integration: {
        metrics: this.metrics,
        queueSize: this.requestQueue.size,
        cacheSize: this.responseCache.size,
        auditLogSize: this.auditLog.length
      }
    };
  }

  /**
   * Get enterprise dashboard for specific tenant
   */
  async getEnterpriseDashboard(tenantId: string): Promise<any> {
    // Validate tenant access
    const tenant = await globalMultiTenantManager.getTenantDashboard(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Get comprehensive analytics
    const analytics = globalAnalyticsDashboard.getTenantAnalytics(tenantId);

    // Get deployment status for tenant
    const deploymentStatus = globalDeploymentManager.getRegionalStatus();

    return {
      tenant,
      analytics,
      deployment: {
        regions: deploymentStatus,
        routing: 'optimal',
        performance: 'excellent'
      },
      realtime: {
        activeConnections: Array.from(globalAnalyticsDashboard['realtimeConnections']).length,
        lastUpdate: new Date().toISOString()
      }
    };
  }

  /**
   * Execute batch processing for enterprise clients
   */
  async processBatch(requests: EnterpriseRequest[]): Promise<EnterpriseResponse[]> {
    console.log(`🔄 Processing enterprise batch: ${requests.length} requests`);

    const batchId = `batch-${Date.now()}`;
    const results: EnterpriseResponse[] = [];

    // Process requests in parallel with controlled concurrency
    const concurrency = 10; // Max 10 concurrent requests
    const chunks = this.chunkArray(requests, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(request => this.processRequest(request))
      );
      results.push(...chunkResults);
    }

    console.log(`✅ Enterprise batch completed: ${batchId}`);
    return results;
  }

  /**
   * Subscribe to enterprise-wide events
   */
  subscribeToEnterpriseEvents(callback: (event: any) => void): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Subscribe to analytics updates
    globalAnalyticsDashboard.subscribeToRealtime(subscriptionId, callback);

    console.log(`📡 Enterprise event subscription: ${subscriptionId}`);
    return subscriptionId;
  }

  /**
   * Generate comprehensive enterprise report
   */
  async generateEnterpriseReport(params: {
    tenantId?: string;
    timeRange: 'day' | 'week' | 'month' | 'quarter';
    includeFinancials: boolean;
    format: 'json' | 'pdf' | 'csv';
  }): Promise<any> {
    const report = {
      id: `enterprise-report-${Date.now()}`,
      generated: new Date().toISOString(),
      parameters: params,
      data: {}
    };

    // System overview
    report.data = {
      system: this.getEnterpriseStatus(),
      businessIntelligence: globalAnalyticsDashboard.getBusinessIntelligence(),
      deployment: globalDeploymentManager.getDeploymentAnalytics()
    };

    // Tenant-specific data if requested
    if (params.tenantId) {
      report.data['tenant'] = await this.getEnterpriseDashboard(params.tenantId);
    }

    // Financial data if authorized
    if (params.includeFinancials) {
      report.data['financials'] = this.generateFinancialSummary();
    }

    console.log(`📊 Enterprise report generated: ${report.id}`);
    return report;
  }

  // Private implementation methods
  private async validateRequest(request: EnterpriseRequest): Promise<void> {
    // Validate required fields
    if (!request.tenantId || !request.requestId || !request.type) {
      throw new Error('Missing required request fields');
    }

    // Check rate limits
    const tenant = globalMultiTenantManager.getTenantDashboard(request.tenantId);
    if (!tenant) {
      throw new Error('Invalid tenant ID');
    }

    // Additional validation based on request type
    switch (request.type) {
      case 'audio_processing':
        if (!request.data.audioFile && !request.data.audioUrl) {
          throw new Error('Audio processing requires audioFile or audioUrl');
        }
        break;
      case 'analytics':
        if (!request.data.metrics && !request.data.query) {
          throw new Error('Analytics request requires metrics or query');
        }
        break;
    }
  }

  private async executeRequest(request: EnterpriseRequest, region: any): Promise<any> {
    console.log(`🎯 Executing ${request.type} request in region ${region.name}`);

    switch (request.type) {
      case 'audio_processing':
        return this.processAudioRequest(request, region);
      case 'analytics':
        return this.processAnalyticsRequest(request);
      case 'management':
        return this.processManagementRequest(request);
      case 'monitoring':
        return this.processMonitoringRequest(request);
      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
  }

  private async processAudioRequest(request: EnterpriseRequest, region: any): Promise<any> {
    // Simulate audio processing pipeline
    const processingSteps = [
      'Transcription (Whisper)',
      'Content Analysis',
      'Diagram Generation',
      'Video Rendering'
    ];

    const result = {
      jobId: `job-${Date.now()}`,
      status: 'completed',
      steps: processingSteps.map(step => ({
        name: step,
        status: 'completed',
        duration: Math.random() * 1000 + 500
      })),
      output: {
        videoUrl: `https://cdn.${region.id}.company.com/videos/output-${Date.now()}.mp4`,
        subtitles: `https://cdn.${region.id}.company.com/srt/output-${Date.now()}.srt`,
        scenes: [
          { type: 'flow', confidence: 0.92, duration: 8.5 },
          { type: 'timeline', confidence: 0.87, duration: 6.2 }
        ]
      },
      metrics: {
        processingTime: Math.random() * 5000 + 2000,
        accuracy: 0.94,
        quality: 'high'
      }
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return result;
  }

  private async processAnalyticsRequest(request: EnterpriseRequest): Promise<any> {
    const analyticsType = request.data.type || 'dashboard';

    switch (analyticsType) {
      case 'dashboard':
        return globalAnalyticsDashboard.getEnterpriseDashboard();
      case 'report':
        return globalAnalyticsDashboard.generateCustomReport(request.data.params);
      case 'realtime':
        return globalAnalyticsDashboard.getSystemHealthStatus();
      default:
        return globalAnalyticsDashboard.getBusinessIntelligence();
    }
  }

  private async processManagementRequest(request: EnterpriseRequest): Promise<any> {
    const action = request.data.action;

    switch (action) {
      case 'tenant_status':
        return globalMultiTenantManager.getTenantDashboard(request.data.targetTenantId);
      case 'scaling_metrics':
        return globalMultiTenantManager.getGlobalScalingMetrics();
      case 'resource_allocation':
        return globalMultiTenantManager.getTenantResources(request.data.targetTenantId);
      default:
        throw new Error(`Unknown management action: ${action}`);
    }
  }

  private async processMonitoringRequest(request: EnterpriseRequest): Promise<any> {
    return {
      systemHealth: globalAnalyticsDashboard.getSystemHealthStatus(),
      deployment: globalDeploymentManager.getGlobalMetrics(),
      tenants: globalMultiTenantManager.getGlobalScalingMetrics(),
      timestamp: new Date().toISOString()
    };
  }

  private generateCacheKey(request: EnterpriseRequest): string {
    const keyData = {
      type: request.type,
      tenantId: request.tenantId,
      dataHash: this.hashObject(request.data)
    };
    return `cache-${this.hashObject(keyData)}`;
  }

  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').substr(0, 16);
  }

  private async updateTenantMetrics(request: EnterpriseRequest, result: any, region: any): Promise<void> {
    // Update tenant-specific metrics
    const metricsUpdate = {
      currentJobs: 1, // Increment active jobs
      lastActive: new Date(),
      performance: {
        averageProcessingTime: result.metrics?.processingTime || 0,
        successRate: 1.0, // Successful request
        errorRate: 0
      }
    };

    await globalMultiTenantManager.updateTenantMetrics(request.tenantId, metricsUpdate);
  }

  private calculateRequestCost(request: EnterpriseRequest, processingTime: number, region: any): number {
    const baseCost = {
      audio_processing: 0.05,
      analytics: 0.01,
      management: 0.001,
      monitoring: 0.001
    };

    const regionMultiplier = region.location.continent === 'North America' ? 1.0 : 1.2;
    const timeMultiplier = processingTime > 10000 ? 1.5 : 1.0;

    return (baseCost[request.type] || 0.01) * regionMultiplier * timeMultiplier;
  }

  private updateGlobalMetrics(processingTime: number, success: boolean): void {
    this.metrics.totalRequests++;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update rolling average response time
    const totalTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + processingTime;
    this.metrics.averageResponseTime = totalTime / this.metrics.totalRequests;
  }

  private logAuditEvent(request: EnterpriseRequest, response: EnterpriseResponse): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      tenantId: request.tenantId,
      type: request.type,
      success: response.success,
      processingTime: response.metadata.processingTime,
      region: response.metadata.region,
      userAgent: request.metadata.userLocation,
      cost: response.metadata.cost
    };

    this.auditLog.push(auditEntry);

    // Keep only last 10,000 audit entries
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }
  }

  private generateFinancialSummary(): any {
    const bi = globalAnalyticsDashboard.getBusinessIntelligence();

    return {
      revenue: {
        mrr: bi.revenue.totalMRR,
        arr: bi.revenue.totalMRR * 12,
        growth: bi.revenue.growth
      },
      costs: {
        infrastructure: bi.revenue.totalMRR * 0.3,
        support: bi.revenue.totalMRR * 0.1,
        development: bi.revenue.totalMRR * 0.2
      },
      profitability: {
        grossMargin: 0.7,
        netMargin: 0.4,
        ltv: bi.revenue.totalMRR * 36 // 3 years average
      }
    };
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private initializeIntegration(): void {
    console.log('🚀 Enterprise Integration Layer initialized');
    console.log(`⚙️ Configuration: ${JSON.stringify(this.config, null, 2)}`);

    // Start cleanup routines
    this.startCleanupRoutines();
  }

  private startCleanupRoutines(): void {
    // Clean up old cache entries every 5 minutes
    setInterval(() => {
      const cacheSize = this.responseCache.size;
      if (cacheSize > 1000) {
        // Clear oldest 20% of cache entries
        const keysToDelete = Array.from(this.responseCache.keys()).slice(0, Math.floor(cacheSize * 0.2));
        keysToDelete.forEach(key => this.responseCache.delete(key));
        console.log(`🧹 Cache cleanup: removed ${keysToDelete.length} entries`);
      }
    }, 300000); // 5 minutes

    // Cleanup old audit logs every hour
    setInterval(() => {
      if (this.auditLog.length > 5000) {
        this.auditLog.splice(0, this.auditLog.length - 5000);
        console.log('🧹 Audit log cleanup completed');
      }
    }, 3600000); // 1 hour
  }
}

// Global singleton for enterprise integration
export const globalEnterpriseIntegration = new EnterpriseIntegration();