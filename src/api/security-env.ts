/**
 * ISS-045: Security-critical environment validation (JWT secret complexity,
 * CORS origins format).
 *
 * Split out of `config/validate.ts` so the config core stays free of API-layer
 * dependencies: these checks resolve the JWT secret through the SAME env
 * fallback chain as the auth middlewares (`api/jwt-secret.ts`), which is a
 * product/API concern, not a config-schema concern.
 */

import type { ValidationError } from '@stv/core/config/validate';
import { SECURITY_LIMITS } from '@stv/core/config/limits';
import { getJwtSecretFromEnv } from './jwt-secret';

/**
 * ISS-045: Validates JWT secret complexity.
 * Checks minimum length and that the secret uses at least N distinct character types
 * (uppercase, lowercase, digit, special).
 * Returns an array of warnings (not fatal — the server can still start in dev).
 */
export function validateJwtSecret(secret: string): ValidationError[] {
  const warnings: ValidationError[] = [];

  if (secret.length < SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH) {
    warnings.push({
      field: 'JWT_SECRET',
      message: `JWT_SECRET should be at least ${SECURITY_LIMITS.JWT_SECRET_MIN_LENGTH} characters for adequate security (current: ${secret.length})`,
    });
  }

  const charTypes = [
    /[A-Z]/.test(secret),    // uppercase
    /[a-z]/.test(secret),    // lowercase
    /[0-9]/.test(secret),    // digit
    /[^A-Za-z0-9]/.test(secret), // special
  ].filter(Boolean).length;

  if (charTypes < SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES) {
    warnings.push({
      field: 'JWT_SECRET',
      message: `JWT_SECRET should use at least ${SECURITY_LIMITS.JWT_SECRET_MIN_CHAR_TYPES} character types (uppercase, lowercase, digit, special) for adequate complexity`,
    });
  }

  return warnings;
}

/**
 * ISS-045: Validates CORS_ORIGINS format.
 * Each comma-separated value must be a valid URL with http or https protocol.
 * Returns an array of errors.
 */
export function validateCorsOrigins(origins: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const parts = origins.split(',').map(o => o.trim()).filter(Boolean);

  for (const origin of parts) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        errors.push({
          field: 'CORS_ORIGINS',
          message: `CORS origin "${origin}" must use http: or https: protocol, got ${url.protocol}`,
        });
      }
    } catch {
      errors.push({
        field: 'CORS_ORIGINS',
        message: `CORS origin "${origin}" is not a valid URL`,
      });
    }
  }

  return errors;
}

/**
 * ISS-045: Validates environment variables that are not part of ConfigSchema
 * but are still critical for secure operation (JWT_SECRET, CORS_ORIGINS).
 *
 * Returns warnings (non-fatal) and errors (fatal in production).
 * In non-production environments, issues are logged as warnings only.
 */
export function validateSecurityEnv(): { warnings: ValidationError[]; errors: ValidationError[] } {
  const warnings: ValidationError[] = [];
  const errors: ValidationError[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // JWT_SECRET validation (same resolution chain as both auth middlewares)
  const jwtSecret = getJwtSecretFromEnv();
  if (jwtSecret) {
    const jwtWarnings = validateJwtSecret(jwtSecret);
    if (isProduction && jwtWarnings.length > 0) {
      errors.push(...jwtWarnings);
    } else {
      warnings.push(...jwtWarnings);
    }
  } else if (isProduction) {
    errors.push({
      field: 'JWT_SECRET',
      message: 'JWT_SECRET or SUPABASE_JWT_SECRET is required in production',
    });
  }

  // CORS_ORIGINS validation
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    const corsErrors = validateCorsOrigins(corsOrigins);
    if (isProduction && corsErrors.length > 0) {
      errors.push(...corsErrors);
    } else {
      warnings.push(...corsErrors);
    }
  }

  return { warnings, errors };
}
