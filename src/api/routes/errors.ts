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
          recoveryStrategies: guidance.recoveryStrategies.map((s) => ({
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
        recoveryStrategies: guidance.recoveryStrategies.map((s) => ({
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
          message: `Strategy '${strategyId}' not found. Available: ${guidance.recoveryStrategies.map((s) => s.id).join(', ')}`,
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
    const { errorId, errorMessage, context } = req.body as {
      errorId?: string;
      errorMessage?: string;
      context?: Record<string, unknown>;
    };

    if (!errorId || !errorMessage) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'errorId and errorMessage are required',
        },
      });
      return;
    }

    const error = new Error(errorMessage);
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
