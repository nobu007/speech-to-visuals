/**
 * Cross-path parity witness (session-259 parked C1): CacheWarmupManager と
 * LLMService は同じ LLMCache インスタンスを共有しているが、
 * `LlmService.makeRequest` 経路 (llm-service.ts:264/348/463) は
 * `'unified-llm-service'` namespace prefix を必ず渡す。一方
 * `CacheWarmupManager.warmup` (cache-warmup.ts:228/236) は namespace を
 * 渡さないため、prefix なしの key に書き込む。結果として warmup の成果は
 * LLMService の read 経路からは不可視 — warmup が事実上 no-op になる。
 *
 * この test は `namespace` オプションを受け取った時に限り、
 * warmup の write が同 namespace の read から観測可能になる事を pin する。
 * fix 前の状態では warmupManager 側 namespace が未実装なので必ず RED する。
 */
import { CacheWarmupManager, WarmupPattern } from '@/optimization/cache-warmup';
import { LLMCache } from '@/analysis/llm-cache';

describe('CacheWarmupManager namespace parity', () => {
  let cache: LLMCache<string>;

  beforeEach(() => {
    cache = new LLMCache<string>({ maxSize: 50, ttlMinutes: 60, enableSemantic: false });
  });

  test('namespace option を渡すと warmup write が同 namespace read で見える', async () => {
    const manager = new CacheWarmupManager<string>(cache, { namespace: 'unified-llm-service' });
    const patterns: WarmupPattern[] = [
      { text: 'tutorial warmup text', category: 'tutorial', language: 'ja' },
    ];
    const resolver = async (text: string): Promise<string> => `resolved:${text}`;

    await manager.warmup(patterns, resolver);

    // LLMService と同じ namespace で読んだ時に warmed-up result が見える事
    expect(cache.get('tutorial warmup text', 'unified-llm-service')).toBe(
      'resolved:tutorial warmup text'
    );
  });

  test('namespace 未指定の既存挙動 (backward compat): unprefixed key に書く', async () => {
    // 既存 test と production caller (warmup-cache-backend-failure 等の
    // 統合 test) は namespace を渡さない形式のままなので、prefix なしの
    // key に書く既存挙動を後方互換として保持する。
    const manager = new CacheWarmupManager<string>(cache);
    const patterns: WarmupPattern[] = [
      { text: 'legacy warmup text', category: 'tutorial', language: 'ja' },
    ];
    const resolver = async (text: string): Promise<string> => `resolved:${text}`;

    await manager.warmup(patterns, resolver);

    // prefix なしの read で warmed-up result が見える事 (既存挙動)
    expect(cache.get('legacy warmup text')).toBe('resolved:legacy warmup text');
  });

  test('namespace 付き write は namespace なし read からは不可視 (parity の双方向 pin)', async () => {
    // 対称 leg: namespace 付き write が namespace なし read で見えない事。
    // これは「namespace を渡した warmup は prefix なしの reader を汚染しない」
    // という cross-path 契約の第二面。fix 前の状態では namespace 機能が無いので
    // 全て prefix なしで書き込まれており、prefix なし read では見えてしまう
    // (逆に prefix 付き read では不可視)。fix 後はこの leg が PASS する。
    const manager = new CacheWarmupManager<string>(cache, { namespace: 'unified-llm-service' });
    const patterns: WarmupPattern[] = [
      { text: 'isolated warmup text', category: 'tutorial', language: 'ja' },
    ];
    const resolver = async (text: string): Promise<string> => `resolved:${text}`;

    await manager.warmup(patterns, resolver);

    // prefix なし read では warmed-up result が見えない事 (namespace 分離)
    expect(cache.get('isolated warmup text')).toBeNull();
    // prefix 付き read では見える事 (主 leg)
    expect(cache.get('isolated warmup text', 'unified-llm-service')).toBe(
      'resolved:isolated warmup text'
    );
  });
});
