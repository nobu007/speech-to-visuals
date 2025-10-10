/**
 * Rate Limiting & Quota Management Middleware
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { APIError, QuotaInfo } from '../types/api';

// ============================================================================
// Rate Limiter Configurations
// ============================================================================

/**
 * General API rate limiter - 100 requests per 15 minutes
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    } as APIError,
  },
  // Use default keyGenerator which handles IPv6 correctly
});

/**
 * Strict rate limiter for resource-intensive operations - 10 requests per hour
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED_STRICT',
      message: 'Processing limit reached. Please wait before submitting more requests',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    } as APIError,
  },
  // Use default keyGenerator which handles IPv6 correctly
});

/**
 * Authentication rate limiter - 5 attempts per 15 minutes
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
    } as APIError,
  },
  // Use default keyGenerator which handles IPv6 correctly
});

// ============================================================================
// Quota Management
// ============================================================================

/**
 * In-memory quota storage (in production, use Redis or database)
 */
interface UserQuota {
  monthlyProcessingLimit: number;
  monthlyProcessingUsed: number;
  storageLimit: number;
  storageUsed: number;
  concurrentJobsLimit: number;
  concurrentJobsActive: number;
  resetDate: Date;
}

const quotaStore = new Map<string, UserQuota>();

/**
 * Get default quota based on user role
 */
function getDefaultQuota(role: string): UserQuota {
  const quotas = {
    owner: {
      monthlyProcessingLimit: 10000,
      storageLimit: 100 * 1024 * 1024 * 1024, // 100GB
      concurrentJobsLimit: 10,
    },
    admin: {
      monthlyProcessingLimit: 5000,
      storageLimit: 50 * 1024 * 1024 * 1024, // 50GB
      concurrentJobsLimit: 5,
    },
    editor: {
      monthlyProcessingLimit: 1000,
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
      concurrentJobsLimit: 3,
    },
    viewer: {
      monthlyProcessingLimit: 100,
      storageLimit: 1 * 1024 * 1024 * 1024, // 1GB
      concurrentJobsLimit: 1,
    },
  };

  const defaults = quotas[role as keyof typeof quotas] || quotas.viewer;

  return {
    ...defaults,
    monthlyProcessingUsed: 0,
    storageUsed: 0,
    concurrentJobsActive: 0,
    resetDate: getNextMonthStart(),
  };
}

/**
 * Get the start of next month
 */
function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Get user quota
 */
export function getUserQuota(userId: string, role: string): UserQuota {
  if (!quotaStore.has(userId)) {
    quotaStore.set(userId, getDefaultQuota(role));
  }

  const quota = quotaStore.get(userId)!;

  // Reset quota if we've passed the reset date
  if (new Date() >= quota.resetDate) {
    quota.monthlyProcessingUsed = 0;
    quota.resetDate = getNextMonthStart();
  }

  return quota;
}

/**
 * Update quota usage
 */
export function updateQuotaUsage(
  userId: string,
  updates: Partial<Pick<UserQuota, 'monthlyProcessingUsed' | 'storageUsed' | 'concurrentJobsActive'>>
): void {
  const quota = quotaStore.get(userId);
  if (quota) {
    Object.assign(quota, updates);
  }
}

/**
 * Check processing quota middleware
 */
export function checkProcessingQuota(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_NOT_AUTHENTICATED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      } as APIError,
    });
    return;
  }

  const quota = getUserQuota(req.user.userId, req.user.role);

  if (quota.monthlyProcessingUsed >= quota.monthlyProcessingLimit) {
    res.status(429).json({
      success: false,
      error: {
        code: 'QUOTA_EXCEEDED_MONTHLY_PROCESSING',
        message: `Monthly processing limit of ${quota.monthlyProcessingLimit} exceeded`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        details: {
          limit: quota.monthlyProcessingLimit,
          used: quota.monthlyProcessingUsed,
          resetDate: quota.resetDate,
        },
      } as APIError,
    });
    return;
  }

  next();
}

/**
 * Check concurrent jobs quota middleware
 */
export function checkConcurrentJobsQuota(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_NOT_AUTHENTICATED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      } as APIError,
    });
    return;
  }

  const quota = getUserQuota(req.user.userId, req.user.role);

  if (quota.concurrentJobsActive >= quota.concurrentJobsLimit) {
    res.status(429).json({
      success: false,
      error: {
        code: 'QUOTA_EXCEEDED_CONCURRENT_JOBS',
        message: `Concurrent jobs limit of ${quota.concurrentJobsLimit} exceeded`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        details: {
          limit: quota.concurrentJobsLimit,
          active: quota.concurrentJobsActive,
        },
      } as APIError,
    });
    return;
  }

  next();
}

/**
 * Check storage quota middleware
 */
export function checkStorageQuota(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_NOT_AUTHENTICATED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      } as APIError,
    });
    return;
  }

  const quota = getUserQuota(req.user.userId, req.user.role);

  if (quota.storageUsed >= quota.storageLimit) {
    res.status(429).json({
      success: false,
      error: {
        code: 'QUOTA_EXCEEDED_STORAGE',
        message: `Storage limit of ${(quota.storageLimit / 1024 / 1024 / 1024).toFixed(2)}GB exceeded`,
        statusCode: 429,
        timestamp: new Date().toISOString(),
        details: {
          limit: quota.storageLimit,
          used: quota.storageUsed,
        },
      } as APIError,
    });
    return;
  }

  next();
}

/**
 * Get quota info endpoint handler
 */
export function getQuotaInfo(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_NOT_AUTHENTICATED',
        message: 'Authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      } as APIError,
    });
    return;
  }

  const quota = getUserQuota(req.user.userId, req.user.role);

  const quotaInfo: QuotaInfo = {
    monthlyProcessingLimit: quota.monthlyProcessingLimit,
    monthlyProcessingUsed: quota.monthlyProcessingUsed,
    storageLimit: quota.storageLimit,
    storageUsed: quota.storageUsed,
    concurrentJobsLimit: quota.concurrentJobsLimit,
    concurrentJobsActive: quota.concurrentJobsActive,
  };

  res.json({
    success: true,
    data: quotaInfo,
    meta: {
      requestId: req.headers['x-request-id'] as string,
      timestamp: new Date().toISOString(),
      version: 'v1',
    },
  });
}
