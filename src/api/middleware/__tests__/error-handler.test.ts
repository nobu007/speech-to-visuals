import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  errorHandler,
} from '../error-handler';

function createMockRequest(): Partial<Request> {
  return {} as Partial<Request>;
}

function createMockResponse(): {
  status: vi.Mock;
  json: vi.Mock;
} & Partial<Response> {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as { status: vi.Mock; json: vi.Mock } & Partial<Response>;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('AppError', () => {
  it('should create an AppError with correct properties', () => {
    const error = new AppError(400, 'TEST_ERROR', 'Test message', { field: 'value' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.message).toBe('Test message');
    expect(error.details).toEqual({ field: 'value' });
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should create an AppError without details', () => {
    const error = new AppError(500, 'NO_DETAILS', 'No details');
    expect(error.details).toBeUndefined();
  });
});

describe('ValidationError', () => {
  it('should create a ValidationError with status 400', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('should include details when provided', () => {
    const details = [{ field: 'email', message: 'Invalid email format' }];
    const error = new ValidationError('Validation failed', details);
    expect(error.details).toEqual(details);
  });
});

describe('AuthenticationError', () => {
  it('should create an AuthenticationError with status 401 and default message', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.message).toBe('Authentication required');
    expect(error.name).toBe('AuthenticationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('should accept a custom message', () => {
    const error = new AuthenticationError('Token expired');
    expect(error.message).toBe('Token expired');
  });
});

describe('AuthorizationError', () => {
  it('should create an AuthorizationError with status 403 and default message', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('AUTHORIZATION_ERROR');
    expect(error.message).toBe('Insufficient permissions');
    expect(error.name).toBe('AuthorizationError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('should accept a custom message', () => {
    const error = new AuthorizationError('Admin access only');
    expect(error.message).toBe('Admin access only');
  });
});

describe('NotFoundError', () => {
  it('should create a NotFoundError with status 404 and default resource', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('NotFoundError');
    expect(error).toBeInstanceOf(AppError);
  });

  it('should include the resource name in message', () => {
    const error = new NotFoundError('User');
    expect(error.message).toBe('User not found');
  });
});

describe('RateLimitError', () => {
  it('should create a RateLimitError with status 429', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.message).toBe('Too many requests, please try again later');
    expect(error.name).toBe('RateLimitError');
    expect(error).toBeInstanceOf(AppError);
  });
});

describe('errorHandler middleware', () => {
  let req: Partial<Request>;
  let res: { status: vi.Mock; json: vi.Mock } & Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  it('should handle AppError with correct status and format', () => {
    const error = new AppError(422, 'UNPROCESSABLE', 'Cannot process entity', { reason: 'bad data' });
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'UNPROCESSABLE',
        message: 'Cannot process entity',
        details: { reason: 'bad data' },
      },
    });
  });

  it('should handle ValidationError', () => {
    const error = new ValidationError('Invalid email', [{ field: 'email', message: 'bad format' }]);
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email',
        details: [{ field: 'email', message: 'bad format' }],
      },
    });
  });

  it('should handle AuthenticationError', () => {
    const error = new AuthenticationError();
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication required',
      },
    });
  });

  it('should handle AuthorizationError', () => {
    const error = new AuthorizationError();
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Insufficient permissions',
      },
    });
  });

  it('should handle NotFoundError', () => {
    const error = new NotFoundError('Project');
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Project not found',
      },
    });
  });

  it('should handle RateLimitError', () => {
    const error = new RateLimitError();
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    });
  });

  it('should handle unknown errors with 500 status', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Something went wrong');
    errorHandler(error, req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', error);
    consoleSpy.mockRestore();
  });

  it('should not expose internal error messages for unknown errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Database connection string: postgres://admin:password@host/db');
    errorHandler(error, req as Request, res as Response, next);

    const jsonCall = res.json.mock.calls[0][0] as { error: { message: string } };
    expect(jsonCall.error.message).toBe('An unexpected error occurred');
    expect(jsonCall.error.message).not.toContain('Database');
    vi.restoreAllMocks();
  });

  it('should omit details when AppError has no details', () => {
    const error = new NotFoundError('User');
    errorHandler(error, req as Request, res as Response, next);

    const jsonCall = res.json.mock.calls[0][0] as { error: { details?: unknown } };
    expect(jsonCall.error).not.toHaveProperty('details');
  });
});
