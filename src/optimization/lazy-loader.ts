/**
 * Lazy Loader - Dynamic import wrapper with caching
 * Defers loading of heavy modules until they are actually needed
 */

export interface LazyModule<T> {
  module: T;
  loadTimeMs: number;
}

export interface LazyLoaderStats {
  loadedModules: number;
  totalLoadTimeMs: number;
  averageLoadTimeMs: number;
}

type ModuleLoader<T> = () => Promise<T>;

/**
 * Lazy loading utility for deferring heavy module imports.
 *
 * Wraps dynamic import calls with caching so that modules are only
 * loaded once, on first access, and reused for subsequent requests.
 */
export class LazyLoader {
  private cache: Map<string, LazyModule<unknown>> = new Map();
  private loadPromises: Map<string, Promise<unknown>> = new Map();
  private totalLoadTimeMs = 0;

  /**
   * Load a module lazily. The loader function is called only once;
   * subsequent calls with the same key return the cached result.
   *
   * Concurrent calls with the same key will share the same in-flight
   * promise to avoid duplicate loading.
   */
  async load<T>(key: string, loader: ModuleLoader<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached) {
      return cached.module as T;
    }

    // Deduplicate concurrent loads for the same key
    const inFlight = this.loadPromises.get(key);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const loadPromise = this.executeLoad(key, loader);
    this.loadPromises.set(key, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.loadPromises.delete(key);
    }
  }

  private async executeLoad<T>(key: string, loader: ModuleLoader<T>): Promise<T> {
    const start = performance.now();
    const mod = await loader();
    const loadTimeMs = performance.now() - start;

    this.cache.set(key, { module: mod, loadTimeMs });
    this.totalLoadTimeMs += loadTimeMs;

    return mod;
  }

  /**
   * Check if a module has already been loaded.
   */
  isLoaded(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get a previously loaded module without triggering a load.
   * Returns undefined if the module has not been loaded.
   */
  getIfLoaded<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    return cached ? (cached.module as T) : undefined;
  }

  /**
   * Preload a module without waiting for the result.
   * Useful for warming the cache during idle time.
   */
  preload<T>(key: string, loader: ModuleLoader<T>): void {
    if (!this.cache.has(key)) {
      this.load(key, loader).catch(() => {
        // Preload failures are non-critical; the next explicit load will retry.
      });
    }
  }

  /**
   * Remove a cached module entry.
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached modules.
   */
  clear(): void {
    this.cache.clear();
    this.loadPromises.clear();
    this.totalLoadTimeMs = 0;
  }

  /**
   * Return loader statistics.
   */
  getStats(): LazyLoaderStats {
    const loadedModules = this.cache.size;
    return {
      loadedModules,
      totalLoadTimeMs: this.totalLoadTimeMs,
      averageLoadTimeMs: loadedModules > 0
        ? this.totalLoadTimeMs / loadedModules
        : 0,
    };
  }

  /**
   * Create a reusable lazy handle for a specific module.
   * The handle wraps the loader and key so callers don't need to pass them each time.
   */
  createHandle<T>(key: string, loader: ModuleLoader<T>): {
    get: () => Promise<T>;
    isLoaded: () => boolean;
    invalidate: () => boolean;
  } {
    return {
      get: () => this.load(key, loader),
      isLoaded: () => this.isLoaded(key),
      invalidate: () => this.invalidate(key),
    };
  }
}
