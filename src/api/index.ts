import { Server } from 'http';
import { app, artifactStore, jobQueue } from './server';
import { logger } from '../utils/logger';
import { llmService } from '../analysis/llm-service';
import { triggerStartupWarmup } from './startup-warmup';
import { globalErrorRecovery } from '../quality/enhanced-error-recovery';
import { continuousLearner } from '../framework/continuous-learner';
import { realTimeMonitor } from '../monitoring/real-time-performance-monitor';
import { globalDashboard } from '../monitoring/performance-dashboard';
import { healthCheckService } from '../monitoring/health-check-service';

const PORT = parseInt(process.env.PORT || '3001', 10);
const SHUTDOWN_TIMEOUT_MS = 30_000;

const server: Server = app.listen(PORT, () => {
  logger.info(`API server listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  triggerStartupWarmup(llmService);
});

/**
 * Graceful shutdown: drain background intervals/timers so the process
 * exits cleanly in containerised environments (SIGTERM on pod termination).
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown…`);

  // Stop accepting new HTTP connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Clean up background services with a hard deadline
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([
        globalErrorRecovery.shutdown(),
        Promise.resolve(continuousLearner.stopLearning()),
        Promise.resolve(jobQueue.stop()),
        Promise.resolve(artifactStore.stop()),
        Promise.resolve(realTimeMonitor.stop()),
        Promise.resolve(globalDashboard.destroy()),
        Promise.resolve(healthCheckService.destroy()),
      ]),
      new Promise<void>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error('Shutdown timeout exceeded')),
          SHUTDOWN_TIMEOUT_MS,
        );
      }),
    ]);
    logger.info('All background services shut down');
  } catch (err) {
    logger.error('Error during graceful shutdown', err);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
  gracefulShutdown('unhandledRejection');
});
