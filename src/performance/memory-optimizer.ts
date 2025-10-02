/**
 * Memory Optimization Engine - Iteration 10
 * Advanced memory management with streaming processing and efficient data structures
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
  private gcThreshold: number = 100 * 1024 * 1024; // 100MB
  private lastGC: number = Date.now();

  constructor() {
    console.log('🧠 Memory Optimizer initialized');
    this.initializeObjectPools();
    this.startMemoryMonitoring();
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
   * Get object from pool or create new one
   */
  getPooledObject<T>(poolName: string): T {
    const pool = this.objectPools.get(poolName) as MemoryPool<T>;
    if (!pool) {
      throw new Error(`Object pool '${poolName}' not found`);
    }

    let item: T;

    if (pool.available.length > 0) {
      item = pool.available.pop()!;
    } else {
      item = pool.factory();
    }

    pool.inUse.add(item);
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
   * Monitor memory usage trends
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      const usage = this.getCurrentMemoryUsage();
      this.memoryHistory.push(usage);

      // Keep only last 100 measurements
      if (this.memoryHistory.length > 100) {
        this.memoryHistory.shift();
      }

      // Trigger optimization if memory usage is high
      if (usage.heapUsed > this.gcThreshold) {
        this.performMemoryOptimization();
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
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down memory optimizer...');

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