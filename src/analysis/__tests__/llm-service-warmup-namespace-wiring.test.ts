/**
 * INV-CACHE-001 — production wiring side: LLMService → CacheWarmupManager の
 * namespace 接続 pin (session-259 parked C1 の caller 側境界)。
 *
 * 修正 (fb5a12bf) が触れたのは production 側の 2 接続点:
 *   - constructor  (llm-service.ts:188-190)
 *   - clearCache() (llm-service.ts:872-874)
 * 両方とも CacheWarmupManager に `{ namespace: 'unified-llm-service' }` を渡し、
 * runtime reader (execute の cache read, llm-service.ts:270
 * `this.cache.get(cacheKey, 'unified-llm-service')`) と同じ key-space に
 * warmup write を落とす。
 *
 * primitive 側 (LLMCache prefix 契約 / CacheWarmupManager の namespace 転送) は
 * tests/guards/llm-cache-namespace-contract.test.ts と
 * tests/unit/optimization/cache-warmup-namespace-parity.test.ts で pin 済み。
 * しかし「LLMService が接続点で namespace を渡している」事は何も pin されて
 * いない — 接続点から namespace を落とす退行 (= C1 再発, warmup が silent
 * no-op に戻る) は primitive 側 test 全部 green のまま通り抜ける。
 * この file がその盲点を埋める:
 *
 *   L1: warmupCache() → execute(context=warmup pattern) が fromCache:true
 *       (constructor 接続の end-to-end witness — provider は不達)
 *   L2: service 内蔵 cache への reader-namespace read が warmed 値を返す
 *       (namespace 転送の直接 observable)
 *   L3: clearCache() → 再 warmup → 再び fromCache:true
 *       (第2接続点 :872 の sibling-site isolate witness)
 *   L4: control — warmup 前の同一 context は fromCache:false
 *       (L1 の hit が warmup 由来である事の対証)
 *
 * provider は全 leg で throw sentinel に差し替える — cache hit なら一切触れず、
 * miss なら即時失敗する (sentinel は non-rate-limit error なので retry backoff
 * に入らず即 return, llm-service.ts:405-410 附近)。network には出ない。
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { LLMService } from '../llm-service';
import { LLMCache } from '../llm-cache';
import { CacheWarmupManager } from '@/optimization/cache-warmup';

/** reader namespace literal (execute の cache read と同一文字列である事が契約) */
const READER_NAMESPACE = 'unified-llm-service';

/**
 * Execute 経由の cache read key は `request.options?.cacheKey || request.context`
 * (llm-service.ts:269)。warmup は pattern.text をそのまま key に使う
 * (cache-warmup.ts:256) ので、default 先頭 pattern の text を context にすれば
 * reader key == warmup write key になる。default pattern 一覧を hardcode せず
 * CacheWarmupManager.getDefaultPatterns() から取得する (constant duplication 回避)。
 */
function firstDefaultPatternText(): string {
  const probe = new CacheWarmupManager<unknown>(
    new LLMCache<unknown>({ maxSize: 1, ttlMinutes: 1, enableSemantic: false })
  );
  return probe.getDefaultPatterns()[0].text;
}

type ServiceInternals = {
  /** llm-service.ts:119 `private genAI` — cache 経路到達には truthy が必要 */
  genAI: unknown;
  /** llm-service.ts:120 `private cache` — wiring 直接 observable 用 */
  cache: LLMCache<unknown>;
};

/**
 * provider sentinel: どの property 経路でも即 throw。cache hit leg では
 * 呼ばれてはならず、miss leg では即時失敗に落ちる。呼ばれた事自体を
 * observable にするため jest.fn で包む。
 */
function installThrowingProvider(service: LLMService): jest.Mock {
  const touch = jest.fn(() => {
    throw new Error('provider must not be called: warmup entry should be served from cache');
  });
  (service as unknown as ServiceInternals).genAI = { getGenerativeModel: touch };
  return touch;
}

function cacheOf(service: LLMService): LLMCache<unknown> {
  return (service as unknown as ServiceInternals).cache;
}

describe('LLMService cache warmup namespace wiring (INV-CACHE-001)', () => {
  let service: LLMService;
  let tmpDir: string;
  let patternText: string;
  let providerTouch: jest.Mock;

  beforeEach(() => {
    delete process.env.ANALYSIS_DISABLE_GEMINI;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-warmup-wiring-'));
    service = new LLMService('test-api-key', {
      cachePersistPath: path.join(tmpDir, 'test-cache.json'),
    });
    patternText = firstDefaultPatternText();
    providerTouch = installThrowingProvider(service);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    jest.restoreAllMocks();
  });

  test('L4 (control): warmup 前の同一 context は cache hit にならない', async () => {
    const res = await service.execute({
      prompt: 'control prompt',
      context: patternText,
      options: { maxRetries: 1 },
    });

    // provider sentinel が throw → 即時失敗。fromCache は false のみならず、
    // この失敗応答自体が「fresh cache + 未 warmup では reader は hit を
    // 捏造しない」事の対証 (L1 の hit が warmup 由来である前提)。
    expect(res.success).toBe(false);
    expect(res.metadata.fromCache).toBe(false);
    expect(providerTouch).toHaveBeenCalled();
  });

  test('L1: warmupCache() の write が execute() reader から見える (constructor 接続)', async () => {
    const warmed = await service.warmupCache(async () => 'warmed-payload');
    expect(warmed).toBe(true); // fresh cache → cold start → warmup 実行

    const res = await service.execute({
      prompt: 'runtime prompt',
      context: patternText,
      options: { maxRetries: 1 },
    });

    // 接続点が namespace を落とした退行では warmup write は prefixless key に
    // landing し、reader (:270, prefix 付き) は semantic gate
    // (llm-cache.ts:168 prefix && !startsWith) に弾かれて miss → provider
    // sentinel が throw → success:false。つまりこの leg が C1 再発を RED で
    // 捉える。
    expect(res.success).toBe(true);
    expect(res.metadata.fromCache).toBe(true);
    expect(res.metadata.model).toBe('cache');
    expect(res.data).toBe('warmed-payload');
    expect(providerTouch).not.toHaveBeenCalled();
  });

  test('L2: 内蔵 cache への reader-namespace read が warmed 値を返す (転送の直接 observable)', async () => {
    await service.warmupCache(async () => 'warmed-payload');

    // execute を介さず wiring を直接観測: reader と同じ namespace 引数で
    // 読めば warmed 値。namespace 未転送なら null (semantic fallback も
    // prefix gate で rescue しない — enableSemantic:true でも)。
    expect(cacheOf(service).get(patternText, READER_NAMESPACE)).toBe('warmed-payload');
  });

  test('L3: clearCache() 後の再 warmup も reader から見える (第2接続点 :872 の isolate)', async () => {
    await service.warmupCache(async () => 'warmed-payload');
    service.clearCache(); // cache も warmup manager も作り直される

    // clearCache 直後は cold (新 LLMCache, persistPath 無し) → 再 warmup が走る。
    // 第2接続点だけ namespace を落とす退行では、この再 warmup の write が
    // prefixless に landing して reader から miss になる — L1/L2 は green の
    // まま、当 leg のみが RED になる事で sibling site を独立検出する。
    const rewarmed = await service.warmupCache(async () => 'rewarmed-payload');
    expect(rewarmed).toBe(true);

    const res = await service.execute({
      prompt: 'runtime prompt after clearCache',
      context: patternText,
      options: { maxRetries: 1 },
    });

    expect(res.success).toBe(true);
    expect(res.metadata.fromCache).toBe(true);
    expect(res.data).toBe('rewarmed-payload');
    expect(providerTouch).not.toHaveBeenCalled();
  });
});
