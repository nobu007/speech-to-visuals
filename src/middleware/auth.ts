/**
 * JWT Authentication Middleware
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload, APIError } from '../types/api';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify JWT token and extract payload
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_MISSING_TOKEN',
          message: 'No authentication token provided',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        } as APIError,
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const payload = verifyToken(token);

    // Attach user info to request
    req.user = payload;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_INVALID_TOKEN',
        message: error instanceof Error ? error.message : 'Authentication failed',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      } as APIError,
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_NOT_AUTHENTICATED',
          message: 'User not authenticated',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        } as APIError,
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
          statusCode: 403,
          timestamp: new Date().toISOString(),
        } as APIError,
      });
      return;
    }

    next();
  };
}

/**
 * Permission-based authorization middleware
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_NOT_AUTHENTICATED',
          message: 'User not authenticated',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        } as APIError,
      });
      return;
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      req.user!.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_PERMISSIONS',
          message: `Missing required permissions: ${requiredPermissions.join(', ')}`,
          statusCode: 403,
          timestamp: new Date().toISOString(),
        } as APIError,
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for public endpoints that can benefit from user context
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
}
