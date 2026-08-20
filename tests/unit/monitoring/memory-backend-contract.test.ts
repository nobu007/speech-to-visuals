/**
 * REQ-358: memory-backend output contract — the SINGLE verification point.
 *
 * Phase 157–162 (REQ-347~354) routed the same "memory backend omitted /
 * non-finite heap fields" signal through three separate consumer layers
 * (checkMemoryHealth, generateRecommendations, checkLiveness), each with its
 * own isFiniteMetric/typeof guard. This suite is the source-side replacement:
 * `readMemoryBackend()` (src/monitoring/memory-backend.ts) is the ONE boundary
 * over `@stv/core/utils/memory-usage`, and its contract is:
 *
 *   every field is EITHER a finite number OR explicit null —
 *   never undefined, never NaN, never ±Infinity.
 *
 * `null` means "the runtime exposes no memory API (or the backend returned a
 * non-finite value)". Consumers branch on `=== null`; they can no longer
 * receive a NaN that silently FALSE-ifies every comparison.
 *
 * The backend is MOCKED with the adversarial shapes the real stv-core paths
 * can produce (node path = finite numbers; browser/performance.memory path =
 * finite numbers without rss/external; fallback path = zeroed/omitted fields;
 * plus hypothetical non-finite drift). The REAL backend's own behavior is
 * pinned separately in tests/unit/utils/memory-usage.test.ts.
 */

import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';

const mockGetMemoryUsage = jest.fn();

// `getMemoryUsage` is a DIRECT ESM namespace export from @stv/core, so the
// module must be mocked before the SUT (which reads it transitively through
// src/monitoring/memory-backend.ts) is imported. [[jest-esm-mock-pattern]]
jest.unstable_mockModule('@stv/core/utils/memory-usage', () => ({
  __esModule: true,
  getMemoryUsage: mockGetMemoryUsage,
}));

type MemoryBackendModule = typeof import('../../../src/monitoring/memory-backend');

let readMemoryBackend: MemoryBackendModule['readMemoryBackend'];
let heapUsagePercentOrNull: MemoryBackendModule['heapUsagePercentOrNull'];
let mbRoundedOrNull: MemoryBackendModule['mbRoundedOrNull'];

beforeAll(async () => {
  const mod = await import('../../../src/monitoring/memory-backend');
  ({ readMemoryBackend, heapUsagePercentOrNull, mbRoundedOrNull } = mod);
});

beforeEach(() => {
  mockGetMemoryUsage.mockReset();
});

/** Contract predicate: finite number or null — nothing else is acceptable. */
function assertFiniteOrNull(field: string, value: unknown): void {
  // The core claim: never undefined (omission must become an explicit null)…
  expect(value).not.toBeUndefined();
  // …never a non-finite number (NaN/±Infinity must become null)…
  if (typeof value === 'number') {
    expect(Number.isFinite(value)).toBe(true);
  }
  // …and never any other type.
  expect(typeof value === 'number' || value === null).toBe(true);
}

describe('memory-backend output contract (REQ-358)', () => {
  describe('node path — finite backend reading passes through unchanged', () => {
    test('all four fields keep their finite byte values', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: 107374182,
        heapTotal: 268435456,
        rss: 268435456,
        external: 8388608,
      });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBe(107374182);
      expect(reading.heapTotal).toBe(268435456);
      expect(reading.rss).toBe(268435456);
      expect(reading.external).toBe(8388608);
    });

    test('fallback zeros are finite readings, not null (unavailable-API ≠ zero reading)', () => {
      // stv-core's own fallback returns { heapUsed: 0, heapTotal: 0 } — a real
      // finite reading that must stay a number. Only OMISSION / non-finite
      // becomes null.
      mockGetMemoryUsage.mockReturnValue({ heapUsed: 0, heapTotal: 0 });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBe(0);
      expect(reading.heapTotal).toBe(0);
      expect(reading.rss).toBeNull(); // optional field omitted by the fallback
      expect(reading.external).toBeNull();
    });
  });

  describe('browser-path omission — omitted fields become EXPLICIT null', () => {
    test('heapUsed/heapTotal omitted wholesale → null (never undefined/NaN)', () => {
      // The REQ-347 shape: the browser path omits ALL heap fields. Before the
      // wrapper, `undefined` flowed into bytesToMb/heapUsagePercent and came
      // out NaN — silently FALSE-ifying every downstream comparison.
      mockGetMemoryUsage.mockReturnValue({ rss: 0, external: 0 });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBeNull();
      expect(reading.heapTotal).toBeNull();
      assertFiniteOrNull('rss', reading.rss);
      assertFiniteOrNull('external', reading.external);
    });

    test('only heapUsed omitted → null for that field, heapTotal preserved', () => {
      mockGetMemoryUsage.mockReturnValue({ heapTotal: 536870912, rss: 0, external: 0 });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBeNull();
      expect(reading.heapTotal).toBe(536870912);
    });

    test('optional rss/external omitted (Chrome performance.memory path) → null', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
      });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBe(100 * 1024 * 1024);
      expect(reading.rss).toBeNull();
      expect(reading.external).toBeNull();
    });
  });

  describe('non-finite drift — NaN/Infinity poison becomes null', () => {
    test('NaN heap fields → null (the silent-CRITICAL-suppression channel)', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: Number.NaN,
        heapTotal: Number.NaN,
        rss: Number.NaN,
        external: Number.NaN,
      });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBeNull();
      expect(reading.heapTotal).toBeNull();
      expect(reading.rss).toBeNull();
      expect(reading.external).toBeNull();
    });

    test('Infinity heapTotal → null', () => {
      mockGetMemoryUsage.mockReturnValue({
        heapUsed: 1024,
        heapTotal: Number.POSITIVE_INFINITY,
      });

      const reading = readMemoryBackend();

      expect(reading.heapUsed).toBe(1024);
      expect(reading.heapTotal).toBeNull();
    });
  });

  describe('derived helpers propagate null instead of fabricating', () => {
    test('heapUsagePercentOrNull: finite pair → percent; ANY null side → null', () => {
      expect(
        heapUsagePercentOrNull({ heapUsed: 107374182, heapTotal: 268435456, rss: null, external: null }),
      ).toBeCloseTo(40, 5);
      // A fabricated 0 here would read as "healthy" to the 70/90 health
      // thresholds — null must survive.
      expect(
        heapUsagePercentOrNull({ heapUsed: null, heapTotal: 268435456, rss: null, external: null }),
      ).toBeNull();
      expect(
        heapUsagePercentOrNull({ heapUsed: 107374182, heapTotal: null, rss: null, external: null }),
      ).toBeNull();
      // The stv-core zero-fallback is a real reading: 0/0 is guarded to 0 by
      // heapUsageRatio, not turned into null.
      expect(
        heapUsagePercentOrNull({ heapUsed: 0, heapTotal: 0, rss: null, external: null }),
      ).toBe(0);
    });

    test('mbRoundedOrNull: finite bytes → rounded MB; null → null', () => {
      expect(mbRoundedOrNull(12 * 1024 * 1024 + 512 * 1024, 2)).toBeCloseTo(12.5, 5);
      expect(mbRoundedOrNull(0, 2)).toBe(0);
      expect(mbRoundedOrNull(null, 2)).toBeNull();
    });
  });

  describe('contract sweep — every field of every adversarial shape', () => {
    test('no reading field is ever undefined or non-finite, across all shapes', () => {
      const adversarialBackends: Array<Record<string, number | undefined>> = [
        { heapUsed: 1, heapTotal: 2, rss: 3, external: 4 },
        { heapUsed: 0, heapTotal: 0 },
        { rss: 0, external: 0 },
        { heapTotal: 536870912 },
        { heapUsed: Number.NaN, heapTotal: Number.NaN, rss: Number.NaN, external: Number.NaN },
        { heapUsed: 1024, heapTotal: Number.POSITIVE_INFINITY },
        { heapUsed: Number.NEGATIVE_INFINITY, heapTotal: 0, rss: Number.NaN },
      ];

      for (const backend of adversarialBackends) {
        mockGetMemoryUsage.mockReturnValue(backend);
        const reading = readMemoryBackend();
        for (const [field, value] of Object.entries(reading)) {
          assertFiniteOrNull(`${field} (backend=${JSON.stringify(backend)})`, value);
        }
      }
    });
  });
});
