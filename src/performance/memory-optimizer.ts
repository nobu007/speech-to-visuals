/**
 * Memory Optimization Engine - Iteration 22
 * Ultra-advanced memory management with intelligent cleanup, object pooling,
 * and predictive garbage collection for maximum performance
 */

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
}

export interface StreamingConfig {
  chunkSize: number;
  maxBufferSize: number;
  compressionLevel: number;
  enableGC: boolean;
  adaptiveChunking: boolean;
  memoryThreshold: number;
}

export interface MemoryPool<T> {
  available: T[];
  inUse: Set<T>;
  factory: () => T;
  reset: (item: T) => void;
  maxSize: number;
}

export class MemoryOptimizer {
  private memoryHistory: MemoryUsage[] = [];
  private objectPools: Map<string, MemoryPool<any>> = new Map();
  private streamingConfigs: Map<string, StreamingConfig> = new Map();
  private gcThreshold: number = 50 * 1024 * 1024; // 50MB (reduced for better performance)
  private lastGC: number = Date.now();
  private gcTimer: NodeJS.Timer | null = null;
  private memoryPressureLevel: 'low' | 'medium' | 'high' = 'low';
  private adaptiveCleanupEnabled = true;
  private performanceMetrics = {
    gcTriggers: 0,
    poolHits: 0,
    poolMisses: 0,
    cleanupCycles: 0,
    memoryReclaimed: 0
  };

  constructor() {
    console.log('🧠 Enhanced Memory Optimizer initialized');
    this.initializeObjectPools();
    this.startMemoryMonitoring();
    this.startAdaptiveCleanup();
  }

  /**
   * Start adaptive cleanup system for proactive memory management
   */
  private startAdaptiveCleanup(): void {
    if (this.gcTimer) return;

    this.gcTimer = setInterval(() => {
      if (this.adaptiveCleanupEnabled) {
        this.performAdaptiveCleanup();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Adaptive cleanup based on memory pressure and usage patterns
   */
  private async performAdaptiveCleanup(): Promise<void> {
    const currentMemory = this.getCurrentMemoryUsage();
    this.updateMemoryPressureLevel(currentMemory);

    // Adaptive cleanup based on pressure level
    switch (this.memoryPressureLevel) {
      case 'high':
        await this.aggressiveCleanup();
        break;
      case 'medium':
        await this.moderateCleanup();
        break;
      case 'low':
        await this.gentleCleanup();
        break;
    }

    this.performanceMetrics.cleanupCycles++;
  }

  /**
   * Update memory pressure level based on current usage
   */
  private updateMemoryPressureLevel(usage: MemoryUsage): void {
    const pressureRatio = usage.heapUsed / usage.heapTotal;

    if (pressureRatio > 0.8) {
      this.memoryPressureLevel = 'high';
    } else if (pressureRatio > 0.6) {
      this.memoryPressureLevel = 'medium';
    } else {
      this.memoryPressureLevel = 'low';
    }
  }

  /**
   * Aggressive cleanup for high memory pressure
   */
  private async aggressiveCleanup(): Promise<void> {
    console.log('🔥 Performing aggressive memory cleanup');
    const beforeMemory = this.getCurrentMemoryUsage().heapUsed;

    // Clear all object pools
    for (const [poolName, pool] of this.objectPools.entries()) {
      pool.available = [];
      pool.inUse.clear();
    }

    // Trigger immediate garbage collection if available
    if (global.gc) {
      global.gc();
      this.performanceMetrics.gcTriggers++;
    }

    // Clear old memory history
    this.memoryHistory = this.memoryHistory.slice(-10);

    const afterMemory = this.getCurrentMemoryUsage().heapUsed;
    this.performanceMetrics.memoryReclaimed += Math.max(0, beforeMemory - afterMemory);
  }

  /**
   * Moderate cleanup for medium memory pressure
   */
  private async moderateCleanup(): Promise<void> {
    console.log('⚡ Performing moderate memory cleanup');
    const beforeMemory = this.getCurrentMemoryUsage().heapUsed;

    // Reduce object pool sizes by 50%
    for (const [poolName, pool] of this.objectPools.entries()) {
      const halfSize = Math.floor(pool.available.length / 2);
      pool.available = pool.available.slice(0, halfSize);
    }

    // Clear old memory history (keep more than aggressive)
    this.memoryHistory = this.memoryHistory.slice(-20);

    const afterMemory = this.getCurrentMemoryUsage().heapUsed;
    this.performanceMetrics.memoryReclaimed += Math.max(0, beforeMemory - afterMemory);
  }

  /**
   * Gentle cleanup for low memory pressure
   */
  private async gentleCleanup(): Promise<void> {
    // Only clean up truly old entries
    this.memoryHistory = this.memoryHistory.slice(-50);

    // Clean up unused pool objects (keep minimum)
    for (const [poolName, pool] of this.objectPools.entries()) {
      const minSize = Math.floor(pool.maxSize * 0.1);
      if (pool.available.length > minSize) {
        pool.available = pool.available.slice(0, minSize);
      }
    }
  }

  /**
   * Predictive garbage collection based on usage patterns
   */
  private predictiveGC(): void {
    const now = Date.now();
    const timeSinceLastGC = now - this.lastGC;
    const currentMemory = this.getCurrentMemoryUsage();

    // Predict if GC is needed based on trends
    if (this.memoryHistory.length >= 3) {
      const recentUsage = this.memoryHistory.slice(-3);
      const growthRate = (recentUsage[2].heapUsed - recentUsage[0].heapUsed) / 2;

      // If memory is growing rapidly, trigger GC proactively
      if (growthRate > 10 * 1024 * 1024 && // Growing more than 10MB per sample
          timeSinceLastGC > 60000 && // At least 1 minute since last GC
          currentMemory.heapUsed > this.gcThreshold) {

        if (global.gc) {
          console.log('🔮 Predictive garbage collection triggered');
          global.gc();
          this.lastGC = now;
          this.performanceMetrics.gcTriggers++;
        }
      }
    }
  }

  /**
   * Enhanced object pool management with adaptive sizing
   */
  private optimizeObjectPools(): void {
    for (const [poolName, pool] of this.objectPools.entries()) {
      const hitRate = this.performanceMetrics.poolHits /
        (this.performanceMetrics.poolHits + this.performanceMetrics.poolMisses);

      // Adjust pool size based on hit rate
      if (hitRate > 0.8 && pool.available.length < pool.maxSize) {
        // High hit rate: increase pool size
        const newSize = Math.min(pool.maxSize, pool.available.length + 10);
        this.expandPool(pool, newSize);
      } else if (hitRate < 0.3 && pool.available.length > 10) {
        // Low hit rate: decrease pool size
        const newSize = Math.max(10, pool.available.length - 5);
        pool.available = pool.available.slice(0, newSize);
      }
    }
  }

  /**
   * Expand object pool to target size
   */
  private expandPool<T>(pool: MemoryPool<T>, targetSize: number): void {
    while (pool.available.length < targetSize) {
      const newItem = pool.factory();
      pool.available.push(newItem);
    }
  }

  /**
   * Initialize object pools for frequently used objects
   */
  private initializeObjectPools(): void {
    // Scene node pool
    this.createObjectPool('sceneNode', 100,
      () => ({ id: '', x: 0, y: 0, w: 0, h: 0, label: '', type: 'default' }),
      (node) => {
        node.id = '';
        node.x = 0;
        node.y = 0;
        node.w = 0;
        node.h = 0;
        node.label = '';
        node.type = 'default';
      }
    );

    // Scene edge pool
    this.createObjectPool('sceneEdge', 200,
      () => ({ id: '', source: '', target: '', points: [] }),
      (edge) => {
        edge.id = '';
        edge.source = '';
        edge.target = '';
        edge.points = [];
      }
    );

    // Layout result pool
    this.createObjectPool('layoutResult', 50,
      () => ({ nodes: [], edges: [], bounds: { x: 0, y: 0, w: 0, h: 0 } }),
      (result) => {
        result.nodes = [];
        result.edges = [];
        result.bounds = { x: 0, y: 0, w: 0, h: 0 };
      }
    );

    console.log('✅ Object pools initialized');
  }

  /**
   * Create object pool for specific type
   */
  createObjectPool<T>(
    name: string,
    maxSize: number,
    factory: () => T,
    reset: (item: T) => void
  ): void {
    const pool: MemoryPool<T> = {
      available: [],
      inUse: new Set(),
      factory,
      reset,
      maxSize
    };

    // Pre-populate pool
    for (let i = 0; i < Math.min(10, maxSize); i++) {
      pool.available.push(factory());
    }

    this.objectPools.set(name, pool);
  }

  /**
   * Get object from pool or create new one with enhanced tracking
   */
  getPooledObject<T>(poolName: string): T {
    const pool = this.objectPools.get(poolName) as MemoryPool<T>;
    if (!pool) {
      throw new Error(`Object pool '${poolName}' not found`);
    }

    let item: T;

    if (pool.available.length > 0) {
      item = pool.available.pop()!;
      this.performanceMetrics.poolHits++;
    } else {
      item = pool.factory();
      this.performanceMetrics.poolMisses++;
    }

    pool.inUse.add(item);

    // Trigger optimization if pool utilization is high
    const utilization = pool.inUse.size / (pool.inUse.size + pool.available.length);
    if (utilization > 0.9) {
      this.optimizeObjectPools();
    }

    return item;
  }

  /**
   * Return object to pool
   */
  returnPooledObject<T>(poolName: string, item: T): void {
    const pool = this.objectPools.get(poolName) as MemoryPool<T>;
    if (!pool) return;

    if (pool.inUse.has(item)) {
      pool.inUse.delete(item);
      pool.reset(item);

      if (pool.available.length < pool.maxSize) {
        pool.available.push(item);
      }
    }
  }

  /**
   * Optimize memory usage for large data processing
   */
  async processLargeData<T, R>(
    data: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize: number = 100
  ): Promise<R[]> {
    console.log(`🔄 Processing ${data.length} items in chunks of ${chunkSize}`);

    const results: R[] = [];
    const startMemory = this.getCurrentMemoryUsage();

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);

      // Process chunk
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);

      // Memory management
      if (i % (chunkSize * 5) === 0) {
        await this.performMemoryOptimization();
      }

      // Progress logging
      if (i % (chunkSize * 10) === 0) {
        const currentMemory = this.getCurrentMemoryUsage();
        const memoryGrowth = currentMemory.heapUsed - startMemory.heapUsed;
        console.log(`📊 Processed ${i + chunk.length}/${data.length} items, memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
      }
    }

    console.log('✅ Large data processing completed');
    return results;
  }

  /**
   * Create streaming processor for continuous data
   */
  createStreamProcessor<T, R>(
    config: Partial<StreamingConfig> = {}
  ): {
    process: (data: T) => Promise<R | null>;
    flush: () => Promise<R[]>;
    getStats: () => any;
  } {
    const streamConfig: StreamingConfig = {
      chunkSize: 50,
      maxBufferSize: 1000,
      compressionLevel: 1,
      enableGC: true,
      adaptiveChunking: true,
      memoryThreshold: 75 * 1024 * 1024, // 75MB
      ...config
    };

    let buffer: T[] = [];
    let processedCount = 0;
    let totalMemoryUsed = 0;

    return {
      process: async (data: T): Promise<R | null> => {
        buffer.push(data);

        if (buffer.length >= streamConfig.chunkSize) {
          const chunk = buffer.splice(0, streamConfig.chunkSize);
          processedCount += chunk.length;

          // Simulate processing with memory tracking
          const startMem = process.memoryUsage().heapUsed;
          await new Promise(resolve => setTimeout(resolve, 1));
          const endMem = process.memoryUsage().heapUsed;
          totalMemoryUsed += Math.max(0, endMem - startMem);

          // Trigger GC if needed
          if (streamConfig.enableGC && processedCount % 500 === 0) {
            await this.performMemoryOptimization();
          }

          return { processed: chunk.length } as any as R;
        }

        return null;
      },

      flush: async (): Promise<R[]> => {
        if (buffer.length > 0) {
          const results = [{ processed: buffer.length }] as any as R[];
          buffer = [];
          return results;
        }
        return [];
      },

      getStats: () => ({
        bufferSize: buffer.length,
        processedCount,
        totalMemoryUsed,
        avgMemoryPerItem: processedCount > 0 ? totalMemoryUsed / processedCount : 0
      })
    };
  }

  /**
   * Optimize memory layout for specific data structures
   */
  optimizeDataStructure<T>(
    data: T[],
    keyExtractor: (item: T) => string,
    options: {
      enableCompression?: boolean;
      useTypedArrays?: boolean;
      optimizeForAccess?: 'random' | 'sequential';
    } = {}
  ): {
    data: Map<string, T> | T[];
    getItem: (key: string | number) => T | undefined;
    stats: any;
  } {
    console.log(`🔧 Optimizing data structure for ${data.length} items`);

    const startTime = performance.now();
    const startMemory = this.getCurrentMemoryUsage();

    let optimizedData: Map<string, T> | T[];
    let getItem: (key: string | number) => T | undefined;

    if (options.optimizeForAccess === 'random') {
      // Use Map for O(1) random access
      optimizedData = new Map();
      data.forEach(item => {
        (optimizedData as Map<string, T>).set(keyExtractor(item), item);
      });

      getItem = (key: string | number) => (optimizedData as Map<string, T>).get(key as string);

    } else {
      // Use Array for sequential access
      optimizedData = [...data];

      getItem = (key: string | number) => (optimizedData as T[])[key as number];
    }

    const endTime = performance.now();
    const endMemory = this.getCurrentMemoryUsage();

    const stats = {
      optimizationTime: endTime - startTime,
      memoryUsed: endMemory.heapUsed - startMemory.heapUsed,
      accessType: options.optimizeForAccess || 'sequential',
      itemCount: data.length
    };

    console.log(`✅ Data structure optimized in ${Math.round(stats.optimizationTime)}ms`);

    return { data: optimizedData, getItem, stats };
  }

  /**
   * Perform comprehensive memory optimization
   */
  async performMemoryOptimization(): Promise<void> {
    const beforeMemory = this.getCurrentMemoryUsage();

    // Clear object pools of unused items
    this.cleanupObjectPools();

    // Force garbage collection if available
    if (global.gc && (Date.now() - this.lastGC) > 5000) {
      global.gc();
      this.lastGC = Date.now();
    }

    // Wait for GC to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    const afterMemory = this.getCurrentMemoryUsage();
    const freed = beforeMemory.heapUsed - afterMemory.heapUsed;

    if (freed > 0) {
      console.log(`🧹 Memory optimization freed ${Math.round(freed / 1024 / 1024)}MB`);
    }
  }

  /**
   * Clean up object pools
   */
  private cleanupObjectPools(): void {
    this.objectPools.forEach((pool, name) => {
      const beforeSize = pool.available.length;

      // Keep only 25% of available objects
      const keepCount = Math.ceil(pool.available.length * 0.25);
      pool.available = pool.available.slice(0, keepCount);

      const cleaned = beforeSize - pool.available.length;
      if (cleaned > 0) {
        console.log(`🧽 Cleaned ${cleaned} objects from ${name} pool`);
      }
    });
  }

  /**
   * Monitor memory usage trends with predictive analysis
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const usage = this.getCurrentMemoryUsage();
      this.memoryHistory.push(usage);

      // Keep only last 100 measurements
      if (this.memoryHistory.length > 100) {
        this.memoryHistory.shift();
      }

      // Trigger predictive GC analysis
      this.predictiveGC();

      // Trigger optimization if memory usage is high
      if (usage.heapUsed > this.gcThreshold) {
        this.performMemoryOptimization();
      }

      // Optimize object pools periodically
      if (this.memoryHistory.length % 6 === 0) { // Every minute
        this.optimizeObjectPools();
      }

    }, 10000); // Every 10 seconds
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
      rss: usage.rss
    };
  }

  /**
   * Get memory optimization statistics
   */
  getMemoryStats(): {
    currentUsage: MemoryUsage;
    trend: 'increasing' | 'stable' | 'decreasing';
    efficiency: number;
    poolStats: any;
    recommendations: string[];
  } {
    const currentUsage = this.getCurrentMemoryUsage();

    // Calculate trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (this.memoryHistory.length >= 5) {
      const recent = this.memoryHistory.slice(-5);
      const avgRecent = recent.reduce((sum, u) => sum + u.heapUsed, 0) / recent.length;
      const older = this.memoryHistory.slice(-10, -5);

      if (older.length > 0) {
        const avgOlder = older.reduce((sum, u) => sum + u.heapUsed, 0) / older.length;
        const change = (avgRecent - avgOlder) / avgOlder;

        if (change > 0.1) trend = 'increasing';
        else if (change < -0.1) trend = 'decreasing';
      }
    }

    // Calculate efficiency (inverse of memory growth rate)
    const efficiency = Math.max(0, 100 - (currentUsage.heapUsed / (100 * 1024 * 1024)) * 100);

    // Pool statistics
    const poolStats = Object.fromEntries(
      Array.from(this.objectPools.entries()).map(([name, pool]) => [
        name,
        {
          available: pool.available.length,
          inUse: pool.inUse.size,
          utilization: pool.inUse.size / (pool.inUse.size + pool.available.length) * 100
        }
      ])
    );

    // Generate recommendations
    const recommendations: string[] = [];

    if (trend === 'increasing') {
      recommendations.push('Memory usage trending upward - consider increasing GC frequency');
    }

    if (efficiency < 50) {
      recommendations.push('Low memory efficiency - enable streaming processing for large datasets');
    }

    Object.entries(poolStats).forEach(([name, stats]: [string, any]) => {
      if (stats.utilization > 90) {
        recommendations.push(`${name} pool near capacity - consider increasing pool size`);
      }
    });

    return {
      currentUsage,
      trend,
      efficiency,
      poolStats,
      recommendations
    };
  }

  /**
   * Create memory-efficient copy of object
   */
  createEfficientCopy<T>(obj: T, options: {
    excludeFields?: string[];
    compressStrings?: boolean;
    useShallowCopy?: boolean;
  } = {}): T {
    if (options.useShallowCopy) {
      return { ...obj };
    }

    const copy = JSON.parse(JSON.stringify(obj));

    // Remove excluded fields
    if (options.excludeFields) {
      options.excludeFields.forEach(field => {
        delete copy[field];
      });
    }

    return copy;
  }

  /**
   * Get enhanced performance metrics for Iteration 22
   */
  getEnhancedMetrics(): {
    memoryEfficiency: number;
    poolPerformance: number;
    gcEffectiveness: number;
    overallScore: number;
    details: any;
  } {
    const currentUsage = this.getCurrentMemoryUsage();
    const memoryEfficiency = Math.max(0, 1 - (currentUsage.heapUsed / (100 * 1024 * 1024)));

    const totalPoolOperations = this.performanceMetrics.poolHits + this.performanceMetrics.poolMisses;
    const poolPerformance = totalPoolOperations > 0 ?
      this.performanceMetrics.poolHits / totalPoolOperations : 0;

    const gcEffectiveness = this.performanceMetrics.memoryReclaimed > 0 ?
      Math.min(1, this.performanceMetrics.memoryReclaimed / (50 * 1024 * 1024)) : 0;

    const overallScore = (
      memoryEfficiency * 0.4 +
      poolPerformance * 0.3 +
      gcEffectiveness * 0.3
    );

    return {
      memoryEfficiency,
      poolPerformance,
      gcEffectiveness,
      overallScore,
      details: {
        memoryPressure: this.memoryPressureLevel,
        cleanupCycles: this.performanceMetrics.cleanupCycles,
        gcTriggers: this.performanceMetrics.gcTriggers,
        memoryReclaimed: this.performanceMetrics.memoryReclaimed,
        poolHitRate: poolPerformance,
        currentMemoryMB: Math.round(currentUsage.heapUsed / 1024 / 1024)
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down memory optimizer...');

    // Clear adaptive cleanup timer
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Clean up all object pools
    this.objectPools.forEach(pool => {
      pool.available = [];
      pool.inUse.clear();
    });

    // Final garbage collection
    await this.performMemoryOptimization();

    console.log('✅ Memory optimizer shutdown complete');
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizer();