/**
 * REQ-138: logger.ts Unit Tests
 *
 * Tests the logger utility:
 * - LogLevel enum values and ordering
 * - Log level filtering (current level = INFO)
 * - Structured prefixes ([DEBUG], [INFO], [WARN], [ERROR])
 * - Extra arguments pass-through
 */

import { jest } from '@jest/globals';

// Spy on console methods before importing logger
const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

import { LogLevel, logger } from '@stv/core/utils/logger';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logger (REQ-138)', () => {
  beforeEach(() => {
    debugSpy.mockClear();
    infoSpy.mockClear();
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  // =========================================================================
  // LogLevel enum
  // =========================================================================

  describe('LogLevel enum', () => {
    test('DEBUG should be 0', () => {
      expect(LogLevel.DEBUG).toBe(0);
    });

    test('INFO should be 1', () => {
      expect(LogLevel.INFO).toBe(1);
    });

    test('WARN should be 2', () => {
      expect(LogLevel.WARN).toBe(2);
    });

    test('ERROR should be 3', () => {
      expect(LogLevel.ERROR).toBe(3);
    });

    test('SILENT should be 4', () => {
      expect(LogLevel.SILENT).toBe(4);
    });

    test('levels should be strictly ascending', () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.SILENT);
    });
  });

  // =========================================================================
  // Log level filtering (default level = INFO)
  // =========================================================================

  describe('log level filtering (default: INFO)', () => {
    test('debug should be suppressed (level DEBUG < INFO)', () => {
      logger.debug('test-debug');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    test('info should be emitted', () => {
      logger.info('test-info');
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    test('warn should be emitted', () => {
      logger.warn('test-warn');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    test('error should be emitted', () => {
      logger.error('test-error');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Structured prefixes
  // =========================================================================

  describe('structured prefixes', () => {
    test('info messages have [INFO] prefix', () => {
      logger.info('hello');
      expect(infoSpy).toHaveBeenCalledWith('[INFO] hello');
    });

    test('warn messages have [WARN] prefix', () => {
      logger.warn('caution');
      expect(warnSpy).toHaveBeenCalledWith('[WARN] caution');
    });

    test('error messages have [ERROR] prefix', () => {
      logger.error('failure');
      expect(errorSpy).toHaveBeenCalledWith('[ERROR] failure');
    });
  });

  // =========================================================================
  // Extra arguments pass-through
  // =========================================================================

  describe('extra arguments', () => {
    test('info passes extra args through', () => {
      const obj = { key: 'value' };
      logger.info('msg', obj, 42);
      expect(infoSpy).toHaveBeenCalledWith('[INFO] msg', obj, 42);
    });

    test('warn passes extra args through', () => {
      logger.warn('msg', 'extra');
      expect(warnSpy).toHaveBeenCalledWith('[WARN] msg', 'extra');
    });

    test('error passes extra args through', () => {
      const err = new Error('test');
      logger.error('msg', err);
      expect(errorSpy).toHaveBeenCalledWith('[ERROR] msg', err);
    });

    test('debug passes extra args when called (even if suppressed)', () => {
      // debug is suppressed at INFO level, so no call happens at all
      logger.debug('msg', 'extra');
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // REQ-138 Acceptance Criteria
  // =========================================================================

  describe('REQ-138 acceptance criteria', () => {
    test('TC-138-L01: LogLevel enum has all 5 values', () => {
      const values = Object.values(LogLevel).filter(v => typeof v === 'number');
      expect(values).toHaveLength(5);
    });

    test('TC-138-L02: default level filters out DEBUG', () => {
      logger.debug('should not appear');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    test('TC-138-L03: all non-debug levels produce output', () => {
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
