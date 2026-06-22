import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PipelineConfigError } from '../../pipeline/pipeline-errors';
import { logger } from '../../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new PipelineConfigError('jwtSecret', 'JWT_SECRET or SUPABASE_JWT_SECRET environment variable is required');
  }
  return secret;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { sub?: string; email?: string; role?: string };
    if (!decoded || !decoded.sub) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid JWT token' },
      });
      return;
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email || '',
      role: decoded.role || 'authenticated',
    };
    next();
  } catch (err) {
    logger.error(`[auth] JWT verification failed: ${err instanceof Error ? err.message : String(err)}`);
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_ERROR', message: 'Failed to process JWT token' },
    });
  }
}
