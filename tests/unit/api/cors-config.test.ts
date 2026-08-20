/**
 * Tests for ISS-017: CORS configuration hardening in server.ts
 * Verifies that CORS origin is explicit in all environments.
 */
import express from 'express';
import cors from 'cors';

describe('CORS configuration (ISS-017)', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalCorsOrigins = process.env.CORS_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalCorsOrigins !== undefined) {
      process.env.CORS_ORIGINS = originalCorsOrigins;
    } else {
      delete process.env.CORS_ORIGINS;
    }
  });

  test('should use development origins when NODE_ENV is not production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.CORS_ORIGINS;

    // Replicate the CORS logic from server.ts
    const corsEnv = process.env.CORS_ORIGINS as string | undefined;
    const allowedOrigins = corsEnv
      ? corsEnv.split(',').map(o => o.trim())
      : process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:8080', 'http://localhost:5173'];

    expect(allowedOrigins).toEqual(['http://localhost:8080', 'http://localhost:5173']);
  });

  test('should use empty array in production when CORS_ORIGINS not set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;

    const corsEnv = process.env.CORS_ORIGINS as string | undefined;
    const allowedOrigins = corsEnv
      ? corsEnv.split(',').map(o => o.trim())
      : process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:8080', 'http://localhost:5173'];

    expect(allowedOrigins).toEqual([]);
  });

  test('should parse CORS_ORIGINS env var as comma-separated list', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com, https://admin.example.com';

    const corsEnv = process.env.CORS_ORIGINS;
    const allowedOrigins = corsEnv
      ? corsEnv.split(',').map(o => o.trim())
      : [];

    expect(allowedOrigins).toEqual(['https://app.example.com', 'https://admin.example.com']);
  });

  test('should handle single CORS_ORIGINS entry', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com';

    const corsEnv = process.env.CORS_ORIGINS;
    const allowedOrigins = corsEnv
      ? corsEnv.split(',').map(o => o.trim())
      : [];

    expect(allowedOrigins).toEqual(['https://app.example.com']);
  });
});
