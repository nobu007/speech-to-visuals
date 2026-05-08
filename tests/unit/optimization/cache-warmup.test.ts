import { CacheWarmupManager, WarmupPattern, WarmupResult } from '@/optimization/cache-warmup';
import { LLMCache } from '@/analysis/llm-cache';

describe('CacheWarmupManager', () => {
  let cache: LLMCache<string>;
  let warmupManager: CacheWarmupManager<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: true });
    warmupManager = new CacheWarmupManager<string>(cache);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('コールドスタート検出', () => {
    test('キャッシュが空の場合、コールドスタートと判定される', () => {
      expect(warmupManager.isColdStart()).toBe(true);
    });

    test('キャッシュにエントリが存在する場合、コールドスタートではない', () => {
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 1 });
      cache.set('test query', 'result');
      expect(manager.isColdStart()).toBe(false);
    });

    test('キャッシュが最小エントリ数未満の場合、コールドスタートと判定される', () => {
      // default threshold is 5
      cache.set('q1', 'r1');
      cache.set('q2', 'r2');
      expect(warmupManager.isColdStart()).toBe(true);
    });

    test('カスタム閾値でコールドスタート判定ができる', () => {
      const manager = new CacheWarmupManager<string>(cache, { coldStartThreshold: 3 });
      cache.set('q1', 'r1');
      cache.set('q2', 'r2');
      expect(manager.isColdStart()).toBe(true);
      cache.set('q3', 'r3');
      expect(manager.isColdStart()).toBe(false);
    });
  });

  describe('ウォームアップ戦略の実行', () => {
    test('ウォームアップパターンでキャッシュが事前填充される', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'チュートリアルのステップを説明してください', category: 'tutorial', language: 'ja' },
        { text: 'First, initialize the system. Next, configure parameters.', category: 'sequential', language: 'en' },
        { text: 'アルゴリズムは変数の初期化から始まります', category: 'algorithm', language: 'ja' },
      ];

      const resolver = async (text: string): Promise<string> => `resolved: ${text}`;
      const result = await warmupManager.warmup(patterns, resolver);

      expect(result.patternsProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      // Cache should now have entries
      expect(cache.getStats().size).toBeGreaterThanOrEqual(3);
    });

    test('リゾルバが失敗したパターンは失敗として記録される', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'good query', category: 'test', language: 'en' },
        { text: 'bad query', category: 'test', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => {
        if (text === 'bad query') throw new Error('resolution failed');
        return `result: ${text}`;
      };

      const result = await warmupManager.warmup(patterns, resolver);

      expect(result.patternsProcessed).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
    });

    test('コールドスタート時に自動でウォームアップが実行される', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'explain the process step by step', category: 'tutorial', language: 'en' },
        { text: 'システムのアーキテクチャについて', category: 'architecture', language: 'ja' },
      ];

      warmupManager.setWarmupPatterns(patterns);

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      const didWarmup = await warmupManager.warmupIfCold(resolver);

      expect(didWarmup).toBe(true);
      expect(cache.getStats().size).toBeGreaterThanOrEqual(2);
    });

    test('コールドスタートでない場合、ウォームアップは実行されない', async () => {
      // Fill cache beyond threshold
      for (let i = 0; i < 10; i++) {
        cache.set(`existing query ${i}`, `result ${i}`);
      }

      const patterns: WarmupPattern[] = [
        { text: 'should not be warmed up', category: 'test', language: 'en' },
      ];
      warmupManager.setWarmupPatterns(patterns);

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      const didWarmup = await warmupManager.warmupIfCold(resolver);

      expect(didWarmup).toBe(false);
    });
  });

  describe('ヒット率改善の追跡', () => {
    test('ウォームアップ前後のヒット率が記録される', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'First step in the process', category: 'sequential', language: 'en' },
        { text: '次のステップに進みます', category: 'sequential', language: 'ja' },
        { text: 'The algorithm starts by initializing', category: 'algorithm', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      const result = await warmupManager.warmup(patterns, resolver);

      // Before tracking, hit rate should be tracked as 0
      expect(result.hitRateBefore).toBe(0);
      // After warmup, simulate queries to check hit rate improvement
      expect(result.hitRateAfter).toBeGreaterThanOrEqual(0);
    });

    test('ウォームアップ後、類似クエリでヒット率が向上する', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'First, initialize the variables. Next, process the data.', category: 'algorithm', language: 'en' },
        { text: 'The system consists of three subsystems that handle data.', category: 'architecture', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      await warmupManager.warmup(patterns, resolver);

      // Simulate queries that should hit the warmed cache
      const testQueries = [
        'First, initialize the variables. Next, process the data.',  // exact match
        'The system consists of three subsystems that handle data.',  // exact match
      ];

      let hitCount = 0;
      for (const query of testQueries) {
        const result = cache.get(query);
        const wasHit = result !== null;
        if (wasHit) hitCount++;
        warmupManager.recordQuery(wasHit);
      }

      // Both should be hits (exact matches)
      expect(hitCount).toBe(2);

      // Check tracking report
      const report = warmupManager.getHitRateReport();
      expect(report.queriesAfterWarmup).toBe(2);
      expect(report.hitsAfterWarmup).toBe(2);
      expect(report.hitRateAfterWarmup).toBe(1.0);
    });

    test('ヒット率レポートにウォームアップの推移が含まれる', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'Tutorial step by step process', category: 'tutorial', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      await warmupManager.warmup(patterns, resolver);

      // Simulate some queries and record them
      const r1 = cache.get('Tutorial step by step process'); // should hit
      warmupManager.recordQuery(r1 !== null);
      const r2 = cache.get('completely unrelated query xyz'); // should miss
      warmupManager.recordQuery(r2 !== null);

      const report = warmupManager.getHitRateReport();
      expect(report.hitRateBefore).toBeDefined();
      expect(report.hitRateAfterWarmup).toBeGreaterThanOrEqual(0);
      expect(report.queriesAfterWarmup).toBe(2);
      expect(report.improvement).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TTL有効期限内のウォームアップ効果', () => {
    test('TTL期限内、ウォームアップされたエントリは有効', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'The process starts with initialization', category: 'tutorial', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      await warmupManager.warmup(patterns, resolver);

      // Within TTL (60 minutes default), entry should be valid
      jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

      const result = cache.get('The process starts with initialization');
      expect(result).not.toBeNull();
      expect(result).toBe('result: The process starts with initialization');
    });

    test('TTL期限後、ウォームアップされたエントリは無効', async () => {
      const ttlCache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 5, enableSemantic: true });
      const manager = new CacheWarmupManager<string>(ttlCache);

      const patterns: WarmupPattern[] = [
        { text: 'TTL test query content', category: 'test', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      await manager.warmup(patterns, resolver);

      // After TTL expires
      jest.advanceTimersByTime(6 * 60 * 1000); // 6 minutes (> 5 min TTL)

      const result = ttlCache.get('TTL test query content');
      expect(result).toBeNull();
    });
  });

  describe('デフォルトウォームアップパターン', () => {
    test('デフォルトパターンが提供される', () => {
      const defaultPatterns = warmupManager.getDefaultPatterns();
      expect(defaultPatterns.length).toBeGreaterThan(0);

      // Each pattern should have required fields
      for (const pattern of defaultPatterns) {
        expect(pattern.text).toBeTruthy();
        expect(pattern.category).toBeTruthy();
        expect(['en', 'ja']).toContain(pattern.language);
      }
    });

    test('デフォルトパターンには多様なカテゴリが含まれる', () => {
      const defaultPatterns = warmupManager.getDefaultPatterns();
      const categories = new Set(defaultPatterns.map(p => p.category));

      // Should include various categories
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });

    test('デフォルトパターンでウォームアップが実行できる', async () => {
      warmupManager.setWarmupPatterns(warmupManager.getDefaultPatterns());
      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      const didWarmup = await warmupManager.warmupIfCold(resolver);

      expect(didWarmup).toBe(true);
      expect(cache.getStats().size).toBeGreaterThan(0);
    });
  });

  describe('ウォームアップ結果の統計', () => {
    test('ウォームアップ結果に所要時間が含まれる', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'test query', category: 'test', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      const result = await warmupManager.warmup(patterns, resolver);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    test('ウォームアップ統計の取得', async () => {
      const patterns: WarmupPattern[] = [
        { text: 'stats query 1', category: 'test', language: 'en' },
        { text: 'stats query 2', category: 'test', language: 'en' },
      ];

      const resolver = async (text: string): Promise<string> => `result: ${text}`;
      await warmupManager.warmup(patterns, resolver);

      const stats = warmupManager.getWarmupStats();
      expect(stats.totalWarmups).toBe(1);
      expect(stats.totalPatternsProcessed).toBe(2);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(0);
    });
  });
});
