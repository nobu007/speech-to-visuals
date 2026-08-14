/**
 * Structural guard: UUID v4 validation regex has ONE source (round 12).
 *
 * Before round 12, four API-layer sites (batch routes, export routes,
 * export-job routes, websocket handler) each hand-rolled the IDENTICAL
 * `UUID_V4_RE` regex. A drift in any copy (dropping the `[89ab]` variant
 * nibble or the `/i` flag) would make the same jobId 400-reject on one
 * endpoint while passing on another — the producers (`uuidv4()` in batch.ts,
 * `crypto.randomUUID()` in export-artifact-store) always emit v4.
 *
 * This file pins BEHAVIOR and CONSUMER IMPORTS. The "no src/api file outside
 * the canonical module redeclares the regex" discovery sweep lives in the
 * shared registry — tests/guards/frozen-literal-registry.test.ts, rule
 * 'UUID v4 validation regex single-sourced in uuid-validation' (covers both
 * the `const *UUID*_RE = /` declaration shape and the raw character-class
 * body, so a rename cannot smuggle a copy past the sweep).
 */

import { describe, it, expect } from '@jest/globals';
import { readSource } from './freeze-guard';
import { UUID_V4_RE } from '@/api/uuid-validation';

const CONSUMERS = [
  'src/api/routes/batch.ts',
  'src/api/routes/export.ts',
  'src/api/routes/export-jobs.ts',
  'src/api/websocket-handler.ts',
];

describe('round 12: UUID v4 validation single source', () => {
  it('accepts a canonical v4 UUID (version 4, variant [89ab])', () => {
    expect(UUID_V4_RE.test('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
  });

  it('accepts uppercase v4 UUIDs (/i contract — ids arrive from clients)', () => {
    expect(UUID_V4_RE.test('123E4567-E89B-42D3-A456-426614174000')).toBe(true);
  });

  it('rejects v1-shape UUID (version nibble != 4)', () => {
    expect(UUID_V4_RE.test('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
  });

  it('rejects wrong-variant v4 (variant nibble outside [89ab])', () => {
    // Variant nibble 'c' — legal UUID spelling, NOT the v4 random variant.
    expect(UUID_V4_RE.test('123e4567-e89b-42d3-c456-426614174000')).toBe(false);
  });

  it('rejects non-UUID strings and injections', () => {
    expect(UUID_V4_RE.test('')).toBe(false);
    expect(UUID_V4_RE.test('../jobs/../../etc/passwd')).toBe(false);
    expect(UUID_V4_RE.test('123e4567e89b42d3a456426614174000')).toBe(false);
    expect(UUID_V4_RE.test('%00-123e-4567-e89b-12d3-a456426614')).toBe(false);
  });

  it.each(CONSUMERS)('%s imports the canonical module', (file) => {
    expect(readSource(file)).toMatch(/from '\.\.?(\/\.\.)?\/uuid-validation'/);
  });
});
