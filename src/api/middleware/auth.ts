import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
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
    const decoded = jwt.decode(token) as { sub?: string; email?: string; role?: string } | null;
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
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_ERROR', message: 'Failed to process JWT token' },
    });
  }
}
