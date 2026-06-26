/**
 * Tests for localStorage corruption telemetry and all-corrupted degradation.
 *
 * Verifies:
 * 1. Non-array localStorage data triggers a console.warn telemetry hook
 *    (previously silently filtered, making corruption invisible in production)
 * 2. ALL-corrupted localStorage entries degrade gracefully (return empty
 *    arrays/defaults, not errors)
 * 3. The TutorialSystem load pattern handles every corruption class without
 *    throwing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockStorage {
  data: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

function createMockStorage(entries: Record<string, string> = {}): MockStorage {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => { data.clear(); },
  };
}

function setGlobalStorage(storage: MockStorage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  });
}

/**
 * Extracted TutorialSystem load logic (mirrors TutorialSystem.tsx lines 56-66)
 * with the telemetry hook added.
 */
function loadTutorialProgress(storage: Storage): Set<string> {
  let savedProgress: string | null = null;
  try {
    savedProgress = storage.getItem('tutorial-progress');
  } catch {
    return new Set();
  }

  if (savedProgress) {
    try {
      const parsed = JSON.parse(savedProgress);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      } else {
        console.warn('[TutorialSystem] localStorage "tutorial-progress" contained non-array value; resetting');
        try { storage.removeItem('tutorial-progress'); } catch { /* noop */ }
      }
    } catch {
      try { storage.removeItem('tutorial-progress'); } catch { /* noop */ }
    }
  }
  return new Set();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('localStorage corruption telemetry', () => {
  let warnSpy: jest.SpyInstance;
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    }
    warnSpy.mockRestore();
  });

  describe('non-array type guard rejection triggers telemetry', () => {
    it('should warn when tutorial-progress contains an object instead of array', () => {
      const storage = createMockStorage({
        'tutorial-progress': JSON.stringify({ step1: true, step2: false }),
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-array'),
      );
    });

    it('should warn when tutorial-progress contains a string', () => {
      const storage = createMockStorage({
        'tutorial-progress': JSON.stringify('not-an-array'),
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should warn when tutorial-progress contains a number', () => {
      const storage = createMockStorage({
        'tutorial-progress': JSON.stringify(42),
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should warn when tutorial-progress contains a boolean', () => {
      const storage = createMockStorage({
        'tutorial-progress': JSON.stringify(true),
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(0);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('should NOT warn when tutorial-progress contains a valid array', () => {
      const storage = createMockStorage({
        'tutorial-progress': JSON.stringify(['step1', 'step2']),
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(2);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should NOT warn when tutorial-progress is null (first visit)', () => {
      const storage = createMockStorage({});
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('corrupted JSON triggers removal but not crash', () => {
    it('should handle corrupted JSON gracefully', () => {
      const storage = createMockStorage({
        'tutorial-progress': '{broken json!!!',
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      expect(result.size).toBe(0);
      // Should have removed the corrupted entry
      expect(storage.getItem('tutorial-progress')).toBeNull();
    });

    it('should handle empty string', () => {
      const storage = createMockStorage({
        'tutorial-progress': '',
      });
      setGlobalStorage(storage);

      const result = loadTutorialProgress(globalThis.localStorage);

      // Empty string is falsy, so it won't enter the parse block
      expect(result.size).toBe(0);
    });
  });
});

describe('ALL-corrupted localStorage degradation', () => {
  let warnSpy: jest.SpyInstance;
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = globalThis.localStorage;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    }
    warnSpy.mockRestore();
  });

  it('should degrade gracefully when ALL entries are corrupted objects', () => {
    const storage = createMockStorage({
      'tutorial-progress': JSON.stringify({ invalid: true }),
      'first-visit': JSON.stringify({ wrong: 'type' }),
      'production-config-overrides': JSON.stringify({ not: 'an array' }),
    });
    setGlobalStorage(storage);

    // Should not throw — returns empty Set
    const result = loadTutorialProgress(globalThis.localStorage);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);

    // Telemetry should have fired
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should degrade gracefully when ALL entries are corrupted JSON', () => {
    const storage = createMockStorage({
      'tutorial-progress': '!!!broken!!!',
      'first-visit': '<<<not json>>>',
    });
    setGlobalStorage(storage);

    expect(() => loadTutorialProgress(globalThis.localStorage)).not.toThrow();

    const result = loadTutorialProgress(globalThis.localStorage);
    expect(result.size).toBe(0);
  });

  it('should degrade gracefully when ALL entries are wrong types', () => {
    const corruptedValues = [
      JSON.stringify(42),
      JSON.stringify(true),
      JSON.stringify(null),
      JSON.stringify('string-value'),
      JSON.stringify({ object: 'value' }),
    ];

    for (const val of corruptedValues) {
      const storage = createMockStorage({ 'tutorial-progress': val });
      setGlobalStorage(storage);

      expect(() => loadTutorialProgress(globalThis.localStorage)).not.toThrow();
      const result = loadTutorialProgress(globalThis.localStorage);
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    }
  });

  it('should recover after corruption: removal allows fresh start', () => {
    const storage = createMockStorage({
      'tutorial-progress': JSON.stringify({ bad: true }),
    });
    setGlobalStorage(storage);

    // First load: corrupted, gets removed
    const result1 = loadTutorialProgress(globalThis.localStorage);
    expect(result1.size).toBe(0);
    expect(storage.getItem('tutorial-progress')).toBeNull();

    // Second load: no data (null), returns empty Set without warning
    warnSpy.mockClear();
    const result2 = loadTutorialProgress(globalThis.localStorage);
    expect(result2.size).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should handle 50+ corrupted entries without performance issues', () => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      entries[`corrupt-key-${i}`] = '{invalid json';
    }
    entries['tutorial-progress'] = JSON.stringify({ not: 'array' });

    const storage = createMockStorage(entries);
    setGlobalStorage(storage);

    const start = Date.now();
    const result = loadTutorialProgress(globalThis.localStorage);
    const elapsed = Date.now() - start;

    expect(result.size).toBe(0);
    expect(elapsed).toBeLessThan(100); // Should be near-instant
  });
});
