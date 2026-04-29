import {
  BatchOptimizer,
  batchProcess,
  BatchOptimizerOptions,
  BatchResult,
} from '@/optimization/batch-optimizer';

describe('BatchOptimizer', () => {
  const identityProcessor = async (item: number, _index: number) => item * 2;

  describe('基本並列処理', () => {
    test('全アイテムが処理され、結果が元の順序で返される', async () => {
      const optimizer = new BatchOptimizer({ concurrency: 4, chunkSize: 25 });
      const items = Array.from({ length: 100 }, (_, i) => i);

      const result = await optimizer.process(items, identityProcessor);

      expect(result.results).toHaveLength(100);
      expect(result.successCount).toBe(100);
      expect(result.failureCount).toBe(0);
      for (let i = 0; i < 100; i++) {
        expect(result.results[i]).toBe(i * 2);
      }
    });

    test('空の配列を処理できる', async () => {
      const optimizer = new BatchOptimizer();
      const result = await optimizer.process([], identityProcessor);

      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('単一アイテムを処理できる', async () => {
      const optimizer = new BatchOptimizer();
      const result = await optimizer.process([42], identityProcessor);

      expect(result.results[0]).toBe(84);
      expect(result.successCount).toBe(1);
    });

    test('チャンクサイズより少ないアイテムを処理できる', async () => {
      const optimizer = new BatchOptimizer({ chunkSize: 10, concurrency: 2 });
      const result = await optimizer.process([1, 2, 3], identityProcessor);

      expect(result.results).toEqual([2, 4, 6]);
    });
  });

  describe('フェイルファスト動作', () => {
    test('failFast=true の場合、最初のエラーで処理が中断される', async () => {
      const optimizer = new BatchOptimizer({
        failFast: true,
        concurrency: 1,
        chunkSize: 10,
      });

      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => {
        if (item === 3) throw new Error('fail at 3');
        return item;
      };

      // With failFast=true, the error propagates from process()
      await expect(optimizer.process(items, processor)).rejects.toThrow('fail at 3');
    });

    test('failFast=false の場合、全アイテムが処理される', async () => {
      const optimizer = new BatchOptimizer({
        failFast: false,
        concurrency: 1,
        chunkSize: 10,
      });

      const items = [1, 2, 3, 4, 5];
      const processor = async (item: number) => {
        if (item === 3) throw new Error('fail at 3');
        return item;
      };

      const result = await optimizer.process(items, processor);

      expect(result.results).toHaveLength(5);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(1);
      expect(result.errors[2]).toBeInstanceOf(Error);
      expect(result.results[0]).toBe(1);
      expect(result.results[1]).toBe(2);
      expect(result.results[4]).toBe(5);
    });
  });

  describe('進捗コールバック', () => {
    test('onProgress コールバックで進捗が通知される', async () => {
      const progressCalls: Array<{ completed: number; total: number }> = [];
      const optimizer = new BatchOptimizer({
        concurrency: 1,
        chunkSize: 5,
        onProgress: (completed, total) => {
          progressCalls.push({ completed, total });
        },
      });

      const items = Array.from({ length: 10 }, (_, i) => i);
      await optimizer.process(items, identityProcessor);

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].total).toBe(10);
      // Last progress should reflect all items processed
      const last = progressCalls[progressCalls.length - 1];
      expect(last.completed).toBe(10);
    });
  });

  describe('統計情報', () => {
    test('BatchResult の統計情報が正確に記録される', async () => {
      const optimizer = new BatchOptimizer({ concurrency: 2, chunkSize: 5 });
      const items = Array.from({ length: 20 }, (_, i) => i);

      const result = await optimizer.process(items, async (item) => item * 10);

      expect(result.results).toHaveLength(20);
      expect(result.successCount).toBe(20);
      expect(result.failureCount).toBe(0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.errors.every((e) => e === null)).toBe(true);
    });

    test('一部失敗時の統計情報が正確', async () => {
      const optimizer = new BatchOptimizer({ failFast: false, concurrency: 1, chunkSize: 10 });
      const items = [1, 2, 3, 4, 5];

      const result = await optimizer.process(items, async (item) => {
        if (item % 2 === 0) throw new Error(`even: ${item}`);
        return item;
      });

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(2);
      expect(result.errors[1]?.message).toBe('even: 2');
      expect(result.errors[3]?.message).toBe('even: 4');
    });
  });

  describe('batchProcess ヘルパー関数', () => {
    test('デフォルト設定で動作する', async () => {
      const result = await batchProcess([1, 2, 3], async (item) => item + 10);

      expect(result.results).toEqual([11, 12, 13]);
      expect(result.successCount).toBe(3);
    });

    test('カスタムオプションで動作する', async () => {
      const result = await batchProcess(
        [1, 2, 3],
        async (item) => item * 3,
        { concurrency: 1, chunkSize: 1 }
      );

      expect(result.results).toEqual([3, 6, 9]);
    });
  });

  describe('デフォルトオプション', () => {
    test('デフォルトオプションが正しく設定される', () => {
      const optimizer = new BatchOptimizer();
      // Process an item to verify defaults work
      return optimizer.process([1], async (x) => x).then((result) => {
        expect(result.successCount).toBe(1);
        expect(result.results[0]).toBe(1);
      });
    });
  });
});
