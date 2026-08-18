import rateLimit from 'express-rate-limit';
import { RATE_LIMITS } from '@stv/core/config/limits';

export const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.API.WINDOW_MS,
  max: RATE_LIMITS.API.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.UPLOAD.WINDOW_MS,
  max: RATE_LIMITS.UPLOAD.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Upload rate limit exceeded',
    },
  },
});

export const exportRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.EXPORT.WINDOW_MS,
  max: RATE_LIMITS.EXPORT.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'EXPORT_RATE_LIMIT_EXCEEDED',
      message: 'Too many export requests, please try again later',
    },
  },
});
