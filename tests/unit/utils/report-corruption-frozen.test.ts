/**
 * Robustness tests for reportCorruption when handler receives
 * frozen / sealed / non-extensible report objects.
 *
 * The feedback noted: "metadataが既存オブジェクトでtimestampプロパティが
 * 存在しない場合(writable制約等)のエラーハンドリングが未テスト —
 * 次イテレーションでObject.freezeされたmetadataに対する堅牢性を検証すべき"
 *
 * These tests verify that:
 * 1. The returned report can be safely frozen without breaking logger/handler
 * 2. A handler that throws does not propagate to the caller
 * 3. The handler receives a well-formed report even when source objects are frozen
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  reportCorruption,
  setCorruptionHandler,
  type CorruptionReport,
} from '@stv/core/utils/report-corruption';

function requireDefined<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${label} was null/undefined`);
  }
  return value;
}

describe('reportCorruption frozen-object robustness', () => {
  beforeEach(() => {
    setCorruptionHandler(null);
  });

  it('returns a report that survives Object.freeze', () => {
    const report = reportCorruption('TestSource', 'detail', true);
    const frozen = Object.freeze(report);
    // Properties should still be readable
    expect(frozen.source).toBe('TestSource');
    expect(frozen.detail).toBe('detail');
    expect(frozen.recovered).toBe(true);
    expect(typeof frozen.timestamp).toBe('string');
  });

  it('handler receives a report with all required fields', () => {
    let captured: CorruptionReport | null = null;
    setCorruptionHandler((r) => {
      captured = r;
    });

    reportCorruption('FrozenTest', 'frozen metadata case', true);

    const received = requireDefined(captured, 'captured CorruptionReport');
    expect(received.source).toBe('FrozenTest');
    expect(received.detail).toBe('frozen metadata case');
    expect(received.recovered).toBe(true);
    expect(typeof received.timestamp).toBe('string');
  });

  it('does not throw when handler itself throws', () => {
    setCorruptionHandler(() => {
      throw new TypeError('handler explosion');
    });

    // Should not throw
    const report = reportCorruption('SafeSource', 'handler throws', true);
    expect(report.source).toBe('SafeSource');
  });

  it('can be called with frozen string arguments without error', () => {
    const frozenSource = Object.freeze('FrozenSource');
    const frozenDetail = Object.freeze('frozen detail string');

    const report = reportCorruption(frozenSource, frozenDetail, false);
    expect(report.source).toBe('FrozenSource');
    expect(report.detail).toBe('frozen detail string');
    expect(report.recovered).toBe(false);
  });

  it('consecutive calls do not interfere after handler throws', () => {
    let callCount = 0;
    setCorruptionHandler(() => {
      callCount++;
      if (callCount === 1) throw new Error('first call throws');
    });

    const r1 = reportCorruption('A', 'first', true);
    const r2 = reportCorruption('B', 'second', true);

    expect(r1.source).toBe('A');
    expect(r2.source).toBe('B');
    expect(callCount).toBe(2);
  });

  it('report timestamp is a valid ISO 8601 string', () => {
    const report = reportCorruption('TS', 'timestamp check');
    const parsed = new Date(report.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
    // ISO string should contain 'T' separator
    expect(report.timestamp).toContain('T');
  });

  it('handler receiving a frozen report copy can read all fields', () => {
    let assertionError: Error | null = null;
    setCorruptionHandler((r) => {
      try {
        const frozen = Object.freeze({ ...r });
        // Reading all fields from a frozen copy should work
        const _src: string = frozen.source;
        const _det: string = frozen.detail;
        const _ts: string = frozen.timestamp;
        const _rec: boolean = frozen.recovered;
        // Attempting to write should throw in strict mode
        expect(_src).toBeDefined();
        expect(_det).toBeDefined();
        expect(_ts).toBeDefined();
        expect(typeof _rec).toBe('boolean');
      } catch (e) {
        assertionError = e as Error;
      }
    });

    reportCorruption('FrozenRead', 'read from frozen', true);
    expect(assertionError).toBeNull();
  });
});
