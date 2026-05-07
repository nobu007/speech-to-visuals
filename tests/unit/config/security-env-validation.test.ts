/**
 * ISS-045: Tests for security environment variable validation.
 * Verifies JWT_SECRET complexity and CORS_ORIGINS format validation.
 */
import {
  validateJwtSecret,
  validateCorsOrigins,
  validateSecurityEnv,
} from '../../../src/config/validate';

describe('ISS-045: Security environment variable validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ---------------------------------------------------------------------------
  // validateJwtSecret
  // ---------------------------------------------------------------------------

  describe('validateJwtSecret', () => {
    it('should return warnings for a short secret (< 32 chars)', () => {
      const warnings = validateJwtSecret('short-secret');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].field).toBe('JWT_SECRET');
      expect(warnings[0].message).toContain('at least 32 characters');
    });

    it('should return warnings for a secret with only one character type', () => {
      // Only lowercase letters — 40 chars but single type
      const warnings = validateJwtSecret('a'.repeat(40));
      expect(warnings.some(w => w.message.includes('character types'))).toBe(true);
    });

    it('should pass for a complex secret with 32+ chars and multiple types', () => {
      const warnings = validateJwtSecret('My-Super-Secret-Key-2026!@#$%^&*()');
      expect(warnings).toHaveLength(0);
    });

    it('should pass for a secret with 2 character types and 32+ chars', () => {
      // Uppercase + lowercase
      const warnings = validateJwtSecret('MySecretKeyThatIsLongEnoughForSecurity');
      expect(warnings).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateCorsOrigins
  // ---------------------------------------------------------------------------

  describe('validateCorsOrigins', () => {
    it('should pass for valid http and https URLs', () => {
      const errors = validateCorsOrigins('http://localhost:3000,https://example.com');
      expect(errors).toHaveLength(0);
    });

    it('should pass for a single valid URL', () => {
      const errors = validateCorsOrigins('https://example.com');
      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid URL', () => {
      const errors = validateCorsOrigins('not-a-url');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('CORS_ORIGINS');
      expect(errors[0].message).toContain('not a valid URL');
    });

    it('should reject a non-http/https protocol', () => {
      const errors = validateCorsOrigins('ftp://example.com');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('http: or https: protocol');
    });

    it('should handle mixed valid and invalid origins', () => {
      const errors = validateCorsOrigins('http://localhost:3000,bad-origin,ftp://evil.com');
      expect(errors).toHaveLength(2);
    });

    it('should ignore empty segments from trailing commas', () => {
      const errors = validateCorsOrigins('http://localhost:3000,');
      expect(errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // validateSecurityEnv (integration)
  // ---------------------------------------------------------------------------

  describe('validateSecurityEnv', () => {
    it('should return empty results when no security env vars are set in dev', () => {
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;
      delete process.env.CORS_ORIGINS;
      process.env.NODE_ENV = 'development';

      const result = validateSecurityEnv();
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return errors in production when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      delete process.env.SUPABASE_JWT_SECRET;
      process.env.NODE_ENV = 'production';

      const result = validateSecurityEnv();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('required in production'))).toBe(true);
    });

    it('should return warnings (not errors) for weak JWT_SECRET in development', () => {
      process.env.JWT_SECRET = 'short';
      process.env.NODE_ENV = 'development';

      const result = validateSecurityEnv();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for weak JWT_SECRET in production', () => {
      process.env.JWT_SECRET = 'short';
      process.env.NODE_ENV = 'production';

      const result = validateSecurityEnv();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate CORS_ORIGINS format', () => {
      process.env.CORS_ORIGINS = 'not-valid,http://ok.com';
      process.env.NODE_ENV = 'development';

      const result = validateSecurityEnv();
      expect(result.warnings.some(w => w.field === 'CORS_ORIGINS')).toBe(true);
    });

    it('should accept SUPABASE_JWT_SECRET as alternative to JWT_SECRET', () => {
      delete process.env.JWT_SECRET;
      process.env.SUPABASE_JWT_SECRET = 'a'.repeat(32) + 'A1!';
      process.env.NODE_ENV = 'production';

      const result = validateSecurityEnv();
      expect(result.errors.some(e => e.message.includes('required in production'))).toBe(false);
    });
  });
});
