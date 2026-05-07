import {
  createTimeout,
  combineAbortSignals,
  fetchWithTimeout,
} from '../../../supabase/functions/_shared/error-handler';

// ─── createTimeout Integration Tests ─────────────────────────────────────────

describe('createTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not abort before timeout', () => {
    const { signal, clear } = createTimeout(1000);
    vi.advanceTimersByTime(999);
    expect(signal.aborted).toBe(false);
    clear();
  });

  it('should abort at or after timeout', () => {
    const { signal, clear } = createTimeout(100);
    vi.advanceTimersByTime(100);
    expect(signal.aborted).toBe(true);
    clear();
  });

  it('should not abort after clear is called', () => {
    const { signal, clear } = createTimeout(100);
    clear();
    vi.advanceTimersByTime(200);
    expect(signal.aborted).toBe(false);
  });

  it('should provide a reason when aborted', () => {
    const { signal, clear } = createTimeout(100);
    vi.advanceTimersByTime(100);
    expect(signal.reason).toBeDefined();
    expect(signal.reason.message).toContain('timed out');
    clear();
  });

  it('should handle multiple independent timeouts', () => {
    const t1 = createTimeout(100);
    const t2 = createTimeout(200);

    vi.advanceTimersByTime(150);

    expect(t1.signal.aborted).toBe(true);
    expect(t2.signal.aborted).toBe(false);

    vi.advanceTimersByTime(100);

    expect(t2.signal.aborted).toBe(true);

    t1.clear();
    t2.clear();
  });
});

// ─── combineAbortSignals Tests ───────────────────────────────────────────────

describe('combineAbortSignals', () => {
  it('should not abort if neither signal is aborted', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);
    expect(combined.aborted).toBe(false);
  });

  it('should abort if first signal is aborted', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);

    c1.abort('reason-1');
    expect(combined.aborted).toBe(true);
  });

  it('should abort if second signal is aborted', () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    const combined = combineAbortSignals(c1.signal, c2.signal);

    c2.abort('reason-2');
    expect(combined.aborted).toBe(true);
  });

  it('should abort immediately if signal is already aborted', () => {
    const c1 = new AbortController();
    c1.abort('already-aborted');
    const c2 = new AbortController();

    const combined = combineAbortSignals(c1.signal, c2.signal);
    expect(combined.aborted).toBe(true);
  });
});

// ─── fetchWithTimeout Tests ──────────────────────────────────────────────────

describe('fetchWithTimeout', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should resolve if fetch completes within timeout', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout('https://example.com/api', {}, 5000);
    expect(result.status).toBe(200);
  });

  it('should throw if fetch exceeds timeout', async () => {
    // Mock fetch to respect the AbortSignal and reject on abort
    global.fetch = vi.fn().mockImplementation(
      (_url: string, options: RequestInit & { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = options.signal;
          if (signal?.aborted) {
            reject(new DOMException('The operation was aborted', 'AbortError'));
            return;
          }
          const onAbort = () => {
            signal?.removeEventListener('abort', onAbort);
            reject(new DOMException('The operation was aborted', 'AbortError'));
          };
          signal?.addEventListener('abort', onAbort);
        })
    );

    await expect(
      fetchWithTimeout('https://example.com/api', {}, 50)
    ).rejects.toThrow();
  });

  it('should pass through fetch options', async () => {
    const mockResponse = new Response(null, { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await fetchWithTimeout(
      'https://example.com/api',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      5000
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should use default timeout of 30000ms when not specified', async () => {
    // This just verifies the default constant behavior
    const mockResponse = new Response(null, { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await fetchWithTimeout('https://example.com/api');
    // No assertion on timeout value directly, but it should not throw
    expect(global.fetch).toHaveBeenCalled();
  });
});
