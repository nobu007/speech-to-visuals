import type { Request, Response, NextFunction } from 'express';

/**
 * Create a partial mock of an Express Request object.
 * Provides sensible defaults for body, params, query, and headers.
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

/**
 * Create a partial mock of an Express Response object with chained jest fns.
 */
export function createMockResponse(): Partial<Response> {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res as unknown as Partial<Response>;
}

/**
 * Create a mock NextFunction (jest fn).
 */
export function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

/**
 * Wait for a given number of milliseconds. Useful in async tests.
 */
export async function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Temporarily set environment variables and return a restore function.
 */
export function createTestEnv(vars: Record<string, string>): () => void {
  const originalEnv = { ...process.env };
  Object.assign(process.env, vars);
  return () => {
    process.env = originalEnv;
  };
}

/**
 * Suppress console.log / warn / error with jest fns and return a restore function.
 */
export function suppressConsole(): () => void {
  const originalConsole = { ...console };
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  return () => {
    Object.assign(console, originalConsole);
  };
}
