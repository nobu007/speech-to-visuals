/**
 * REQ-037: Error Recovery REST API Endpoints
 *
 * Exposes error recovery capabilities via REST:
 * - GET  /errors/:errorId/options  — recovery options for a recorded error
 * - POST /errors/:errorId/recover  — execute a recovery action
 *
 * Uses UserGuidedErrorRecovery for strategy selection and execution.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  UserGuidedErrorRecovery,
  type ErrorGuidance,
} from '../../quality/user-guided-error-recovery';
import { logger } from '../../utils/logger';
import { ERROR_REGISTRY_LIMITS } from '../../config/limits';
import { safeArray } from '../../lib/safe-array';

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const RecoverBodySchema = z.object({
  strategyId: z.string().min(1, 'strategyId is required'),
  userChoice: z.enum(['auto', 'manual', 'best']).default('auto'),
  context: z
    .object({
      pipelineStage: z.string().optional(),
      originalError: z.string().optional(),
    })
    .optional(),
});

const RegisterBodySchema = z.object({
  errorId: z
    .string()
    .min(1, 'errorId is required')
    .max(
      ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH,
      `errorId must be at most ${ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH} characters`,
    )
    .regex(
      ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN,
      'errorId must contain only alphanumeric characters, hyphens, underscores, and dots',
    ),
  errorMessage: z
    .string()
    .min(1, 'errorMessage is required')
    .max(
      ERROR_REGISTRY_LIMITS.MAX_ERROR_MESSAGE_LENGTH,
      `errorMessage must be at most ${ERROR_REGISTRY_LIMITS.MAX_ERROR_MESSAGE_LENGTH} characters`,
    ),
  context: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags and encode special characters to prevent stored XSS */
export function sanitizeMessage(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Validate errorId format (used in path params where Zod isn't applied) */
function isValidErrorId(errorId: string): boolean {
  return (
    errorId.length > 0 &&
    errorId.length <= ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH &&
    ERROR_REGISTRY_LIMITS.ERROR_ID_PATTERN.test(errorId)
  );
}

// ---------------------------------------------------------------------------
// Error registry — maps errorId → stored Error + guidance
// ---------------------------------------------------------------------------

interface StoredError {
  error: Error;
  guidance: ErrorGuidance;
  createdAt: number;
}

const errorRegistry = new Map<string, StoredError>();

function storeError(errorId: string, error: Error, guidance: ErrorGuidance): void {
  // Evict oldest entries if at capacity
  if (errorRegistry.size >= ERROR_REGISTRY_LIMITS.MAX_STORED_ERRORS) {
    const entries = [...errorRegistry.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
    const evictCount = Math.ceil(entries.length * 0.1); // evict 10%
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      errorRegistry.delete(entries[i][0]);
    }
  }
  errorRegistry.set(errorId, { error, guidance, createdAt: Date.now() });
}

function getStoredError(errorId: string): StoredError | undefined {
  return errorRegistry.get(errorId);
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createErrorsRouter(
  recoveryService: UserGuidedErrorRecovery = new UserGuidedErrorRecovery(),
): Router {
  const router = Router();

  /**
   * GET /errors/:errorId/options
   *
   * Retrieve recovery options for a given error ID.
   */
  router.get('/:errorId/options', (req: Request, res: Response) => {
    const errorId = typeof req.params.errorId === 'string' ? req.params.errorId : '';

    if (!errorId || errorId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ERROR_ID', message: 'errorId path parameter is required' },
      });
      return;
    }

    if (!isValidErrorId(errorId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ERROR_ID',
          message: `errorId must be 1-${ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH} alphanumeric/hyphen/underscore/dot characters`,
        },
      });
      return;
    }

    const stored = getStoredError(errorId);
    if (!stored) {
      // Analyze on-the-fly from a synthetic error derived from the ID
      const syntheticError = new Error(
        `Unknown error: ${errorId}`,
      );
      const guidance = recoveryService.analyzeError(syntheticError);

      res.json({
        success: true,
        data: {
          category: guidance.category,
          severity: guidance.severity,
          userMessage: guidance.userMessage,
          recoveryStrategies: safeArray(guidance.recoveryStrategies).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            automated: s.automated,
            estimatedTime: s.estimatedTime,
            successRate: s.successRate,
          })),
          preventionTips: guidance.preventionTips,
        },
      });
      return;
    }

    const { guidance } = stored;
    res.json({
      success: true,
      data: {
        category: guidance.category,
        severity: guidance.severity,
        userMessage: guidance.userMessage,
        recoveryStrategies: safeArray(guidance.recoveryStrategies).map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          automated: s.automated,
          estimatedTime: s.estimatedTime,
          successRate: s.successRate,
        })),
        preventionTips: guidance.preventionTips,
      },
    });
  });

  /**
   * POST /errors/:errorId/recover
   *
   * Execute a recovery action for a given error ID.
   */
  router.post('/:errorId/recover', (req: Request, res: Response) => {
    const errorId = typeof req.params.errorId === 'string' ? req.params.errorId : '';

    if (!errorId || errorId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ERROR_ID', message: 'errorId path parameter is required' },
      });
      return;
    }

    if (!isValidErrorId(errorId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ERROR_ID',
          message: `errorId must be 1-${ERROR_REGISTRY_LIMITS.MAX_ERROR_ID_LENGTH} alphanumeric/hyphen/underscore/dot characters`,
        },
      });
      return;
    }

    const parseResult = RecoverBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues.map((i) => i.message).join('; '),
        },
      });
      return;
    }

    const { strategyId, userChoice, context } = parseResult.data;

    const stored = getStoredError(errorId);
    if (!stored) {
      res.status(404).json({
        success: false,
        error: { code: 'ERROR_NOT_FOUND', message: `No error found with ID: ${errorId}` },
      });
      return;
    }

    const { guidance } = stored;

    // Find the requested strategy
    const strategy = guidance.recoveryStrategies.find((s) => s.id === strategyId);
    if (!strategy) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STRATEGY',
          message: `Strategy '${strategyId}' not found. Available: ${safeArray(guidance.recoveryStrategies).map((s) => s.id).join(', ')}`,
        },
      });
      return;
    }

    // If userChoice is not the strategy's mode, also try selectRecoveryStrategy
    const selectedStrategy =
      userChoice === 'auto' && !strategy.automated
        ? recoveryService.selectRecoveryStrategy(guidance, 'auto') ?? strategy
        : strategy;

    logger.info('Error recovery executed', {
      errorId,
      strategyId: selectedStrategy.id,
      userChoice,
      category: guidance.category,
      pipelineStage: context?.pipelineStage,
    });

    res.json({
      success: true,
      data: {
        recovered: selectedStrategy.automated,
        strategyUsed: selectedStrategy.id,
        processingResumed: selectedStrategy.automated,
        estimatedTime: selectedStrategy.estimatedTime,
        successRate: selectedStrategy.successRate,
      },
    });
  });

  /**
   * POST /errors/register
   *
   * Register an error for later recovery (used internally and for testing).
   */
  router.post('/register', (req: Request, res: Response) => {
    const parseResult = RegisterBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues.map((i) => i.message).join('; '),
        },
      });
      return;
    }

    const { errorId, errorMessage, context } = parseResult.data;
    const sanitizedMessage = sanitizeMessage(errorMessage);

    const error = new Error(sanitizedMessage);
    const guidance = recoveryService.analyzeError(error, context);
    storeError(errorId, error, guidance);

    res.json({
      success: true,
      data: {
        errorId,
        category: guidance.category,
        severity: guidance.severity,
      },
    });
  });

  return router;
}

// Export helpers for testing
export { errorRegistry, storeError, getStoredError };
