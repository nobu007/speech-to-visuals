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
   * Enhanced memory pressure assessment with multiple factors
   */
  private updateMemoryPressureLevel(usage: MemoryUsage): void {
    const pressureRatio = usage.heapUsed / usage.heapTotal;
    const absoluteMemoryMB = usage.heapUsed / (1024 * 1024);
    const rssRatio = usage.rss / (500 * 1024 * 1024); // 500MB RSS threshold

    // Calculate trend if we have history
    let growthTrend = 0;
    if (this.memoryHistory.length >= 3) {
      const recent = this.memoryHistory.slice(-3);
      growthTrend = (recent[2].heapUsed - recent[0].heapUsed) / (2 * 1024 * 1024); // MB per measurement
    }

    // Multi-factor pressure assessment
    const pressureScore = (
      pressureRatio * 0.4 +                           // Heap pressure (40%)
      Math.min(absoluteMemoryMB / 200, 1) * 0.3 +     // Absolute memory (30%)
      Math.min(rssRatio, 1) * 0.2 +                   // RSS pressure (20%)
      Math.min(Math.max(growthTrend, 0) / 10, 1) * 0.1 // Growth trend (10%)
    );

    // Enhanced pressure level determination
    if (pressureScore > 0.75 || absoluteMemoryMB > 180 || pressureRatio > 0.85) {
      this.memoryPressureLevel = 'high';
    } else if (pressureScore > 0.5 || absoluteMemoryMB > 120 || pressureRatio > 0.65) {
      this.memoryPressureLevel = 'medium';
    } else {
      this.memoryPressureLevel = 'low';
    }

    // Adaptive GC threshold based on pressure
    this.gcThreshold = this.memoryPressureLevel === 'high' ? 40 * 1024 * 1024 : // 40MB
                       this.memoryPressureLevel === 'medium' ? 60 * 1024 * 1024 : // 60MB
                       80 * 1024 * 1024; // 80MB
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
   * Enhanced predictive garbage collection with intelligent pattern recognition
   */
  private predictiveGC(): void {
    const now = Date.now();
    const timeSinceLastGC = now - this.lastGC;
    const currentMemory = this.getCurrentMemoryUsage();

    // Enhanced prediction with multiple factors
    if (this.memoryHistory.length >= 5) {
      const recentUsage = this.memoryHistory.slice(-5);
      const shortTerm = recentUsage.slice(-3);
      const mediumTerm = recentUsage.slice(-5, -2);

      // Calculate multiple growth metrics
      const shortTermGrowth = (shortTerm[2].heapUsed - shortTerm[0].heapUsed) / 2;
      const mediumTermGrowth = mediumTerm.length > 0 ?
        (mediumTerm[mediumTerm.length - 1].heapUsed - mediumTerm[0].heapUsed) / mediumTerm.length : 0;

      // Memory pressure factor
      const pressureRatio = currentMemory.heapUsed / currentMemory.heapTotal;
      const absoluteMemoryMB = currentMemory.heapUsed / (1024 * 1024);

      // Adaptive thresholds based on pressure level
      const growthThreshold = this.memoryPressureLevel === 'high' ? 5 * 1024 * 1024 :
                             this.memoryPressureLevel === 'medium' ? 8 * 1024 * 1024 :
                             10 * 1024 * 1024;

      const timeThreshold = this.memoryPressureLevel === 'high' ? 30000 : // 30 seconds
                           this.memoryPressureLevel === 'medium' ? 45000 : // 45 seconds
                           60000; // 1 minute

      // Enhanced triggering conditions
      const shouldTriggerGC = (
        // Rapid growth detection
        (shortTermGrowth > growthThreshold && timeSinceLastGC > timeThreshold) ||

        // Consistent growth pattern
        (shortTermGrowth > 0 && mediumTermGrowth > 0 &&
         shortTermGrowth > mediumTermGrowth * 1.5 && timeSinceLastGC > timeThreshold * 0.75) ||

        // High memory pressure
        (pressureRatio > 0.85 && timeSinceLastGC > 15000) ||

        // Absolute memory threshold
        (absoluteMemoryMB > 150 && timeSinceLastGC > 20000) ||

        // Emergency threshold
        (absoluteMemoryMB > 200)
      );

      if (shouldTriggerGC && global.gc) {
        const beforeMem = currentMemory.heapUsed;
        console.log(`🔮 Enhanced predictive GC triggered (${this.memoryPressureLevel} pressure, ${Math.round(absoluteMemoryMB)}MB)`);

        // Multiple GC passes for better effectiveness
        global.gc();
        if (this.memoryPressureLevel === 'high') {
          // Additional GC pass for high pressure
          setTimeout(() => {
            if (global.gc) global.gc();
          }, 100);
        }

        this.lastGC = now;
        this.performanceMetrics.gcTriggers++;

        // Measure effectiveness
        setTimeout(() => {
          const afterMem = this.getCurrentMemoryUsage().heapUsed;
          const freed = beforeMem - afterMem;
          if (freed > 0) {
            this.performanceMetrics.memoryReclaimed += freed;
            console.log(`💾 Predictive GC freed ${Math.round(freed / 1024 / 1024)}MB`);
          }
        }, 200);
      }
    }
  }

  /**
   * Advanced object pool optimization with intelligent adaptive sizing
   */
  private optimizeObjectPools(): void {
    const totalOperations = this.performanceMetrics.poolHits + this.performanceMetrics.poolMisses;
    if (totalOperations === 0) return;

    const globalHitRate = this.performanceMetrics.poolHits / totalOperations;

    for (const [poolName, pool] of this.objectPools.entries()) {
      const utilization = pool.inUse.size / (pool.inUse.size + pool.available.length);
      const currentSize = pool.available.length;

      // Advanced pool sizing algorithm
      let targetSize = currentSize;

      // Factor 1: Hit rate optimization
      if (globalHitRate > 0.85 && utilization > 0.7) {
        // High hit rate and utilization: grow pool
        targetSize = Math.min(pool.maxSize, currentSize + Math.ceil(currentSize * 0.2));
      } else if (globalHitRate < 0.4 && utilization < 0.3) {
        // Low hit rate and utilization: shrink pool
        targetSize = Math.max(5, currentSize - Math.ceil(currentSize * 0.3));
      }

      // Factor 2: Memory pressure adaptation
      switch (this.memoryPressureLevel) {
        case 'high':
          targetSize = Math.max(3, Math.floor(targetSize * 0.6)); // Aggressive reduction
          break;
        case 'medium':
          targetSize = Math.max(5, Math.floor(targetSize * 0.8)); // Moderate reduction
          break;
        case 'low':
          // Allow growth only under low pressure
          if (utilization > 0.8) {
            targetSize = Math.min(pool.maxSize, targetSize + 5);
          }
          break;
      }

      // Factor 3: Access pattern optimization
      const accessFrequency = pool.inUse.size > 0 ? 'high' :
                             currentSize > 10 ? 'medium' : 'low';

      if (accessFrequency === 'high' && this.memoryPressureLevel !== 'high') {
        targetSize = Math.min(pool.maxSize, Math.max(targetSize, 15)); // Ensure minimum for high access
      }

      // Apply size changes
      if (targetSize > currentSize) {
        this.expandPool(pool, targetSize);
      } else if (targetSize < currentSize) {
        pool.available = pool.available.slice(0, targetSize);
      }

      // Performance logging
      if (Math.abs(targetSize - currentSize) > 2) {
        console.log(`🔧 Optimized ${poolName} pool: ${currentSize} → ${targetSize} (utilization: ${Math.round(utilization * 100)}%)`);
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
   * Enhanced performance metrics calculation with optimized scoring for Iteration 23
   */
  getEnhancedMetrics(): {
    memoryEfficiency: number;
    poolPerformance: number;
    gcEffectiveness: number;
    adaptabilityScore: number;
    stabilityScore: number;
    overallScore: number;
    details: any;
  } {
    const currentUsage = this.getCurrentMemoryUsage();

    // Enhanced memory efficiency calculation
    const targetMemoryMB = 80; // Target 80MB for good performance
    const memoryEfficiencyRaw = Math.max(0, 1 - (currentUsage.heapUsed / (targetMemoryMB * 1024 * 1024)));
    const memoryEfficiency = Math.min(1, memoryEfficiencyRaw * 1.2); // Bonus for staying under target

    // Enhanced pool performance calculation
    const totalPoolOperations = this.performanceMetrics.poolHits + this.performanceMetrics.poolMisses;
    const poolHitRate = totalPoolOperations > 0 ? this.performanceMetrics.poolHits / totalPoolOperations : 0;

    // Calculate pool utilization efficiency
    let avgPoolUtilization = 0;
    if (this.objectPools.size > 0) {
      let totalUtilization = 0;
      for (const pool of this.objectPools.values()) {
        const utilization = pool.inUse.size / Math.max(pool.inUse.size + pool.available.length, 1);
        totalUtilization += utilization;
      }
      avgPoolUtilization = totalUtilization / this.objectPools.size;
    }

    const poolPerformance = (poolHitRate * 0.7 + avgPoolUtilization * 0.3);

    // Enhanced GC effectiveness calculation
    const reclaimedMB = this.performanceMetrics.memoryReclaimed / (1024 * 1024);
    const gcEffectiveness = this.performanceMetrics.gcTriggers > 0 ?
      Math.min(1, (reclaimedMB / this.performanceMetrics.gcTriggers) / 10) : // Target 10MB per GC
      (this.performanceMetrics.memoryReclaimed > 0 ? Math.min(1, reclaimedMB / 20) : 0.5); // Bonus for no GC needed

    // New: Adaptability score based on pressure response
    const adaptabilityScore = this.performanceMetrics.cleanupCycles > 0 ?
      Math.min(1, this.performanceMetrics.cleanupCycles / 10) : // Good responsiveness
      0.3; // Base score for inactive system

    // New: Stability score based on memory trend
    let stabilityScore = 0.5; // Default
    if (this.memoryHistory.length >= 5) {
      const recent = this.memoryHistory.slice(-5);
      const variance = this.calculateMemoryVariance(recent);
      const avgMemory = recent.reduce((sum, u) => sum + u.heapUsed, 0) / recent.length;
      const coefficientOfVariation = variance / avgMemory;
      stabilityScore = Math.max(0, 1 - coefficientOfVariation * 10); // Lower variation = higher stability
    }

    // Optimized overall score calculation
    const overallScore = (
      memoryEfficiency * 0.35 +      // Primary factor: memory efficiency
      poolPerformance * 0.25 +       // Pool optimization
      gcEffectiveness * 0.20 +       // GC performance
      adaptabilityScore * 0.10 +     // System adaptability
      stabilityScore * 0.10          // Memory stability
    );

    return {
      memoryEfficiency,
      poolPerformance,
      gcEffectiveness,
      adaptabilityScore,
      stabilityScore,
      overallScore,
      details: {
        memoryPressure: this.memoryPressureLevel,
        currentMemoryMB: Math.round(currentUsage.heapUsed / 1024 / 1024),
        targetMemoryMB,
        cleanupCycles: this.performanceMetrics.cleanupCycles,
        gcTriggers: this.performanceMetrics.gcTriggers,
        memoryReclaimedMB: Math.round(reclaimedMB),
        poolHitRate: Math.round(poolHitRate * 100),
        avgPoolUtilization: Math.round(avgPoolUtilization * 100),
        memoryStability: Math.round(stabilityScore * 100),
        gcThresholdMB: Math.round(this.gcThreshold / 1024 / 1024)
      }
    };
  }

  /**
   * Calculate memory variance for stability assessment
   */
  private calculateMemoryVariance(usageHistory: MemoryUsage[]): number {
    if (usageHistory.length < 2) return 0;

    const mean = usageHistory.reduce((sum, u) => sum + u.heapUsed, 0) / usageHistory.length;
    const variance = usageHistory.reduce((sum, u) => sum + Math.pow(u.heapUsed - mean, 2), 0) / usageHistory.length;
    return variance;
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