import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { createBatchRouter } from './routes/batch';
import { createPipelineRouter } from './routes/pipeline';
import { createMonitoringRouter } from './routes/monitoring';
import { createErrorsRouter } from './routes/errors';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter, uploadRateLimiter } from './middleware/rate-limit';
import { requestTimeout } from './middleware/timeout';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth';
import { correlationId } from './middleware/correlation-id';
import { requestLogger } from './middleware/request-logger';
import { requestMetrics } from './middleware/request-metrics';
import { RATE_LIMITS, SERVER_LIMITS } from '../config/limits';
import { validateSecurityEnv } from '../config/validate';
import { logger } from '../utils/logger';
import { PipelineConfigError } from '../pipeline/pipeline-errors';

// ISS-045: Validate security-critical env vars at startup
const securityResult = validateSecurityEnv();
if (securityResult.errors.length > 0) {
  throw new PipelineConfigError(
    'securityEnv',
    `Security configuration errors:\n${securityResult.errors.map(e => `  - ${e.field}: ${e.message}`).join('\n')}`,
  );
}
if (securityResult.warnings.length > 0) {
  for (const w of securityResult.warnings) {
    logger.warn(`[security] ${w.field}: ${w.message}`);
  }
}

// ISS-030: Conditional auth — enforced in production, bypassed in dev/test
const pipelineAuth = process.env.NODE_ENV === 'production'
  ? authMiddleware
  : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

const app = express();

// JSON body parser — ISS-044: limit from centralized config
app.use(express.json({ limit: SERVER_LIMITS.BODY_LIMIT }));

// CORS — ISS-017: explicit production whitelist instead of ambiguous false
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : process.env.NODE_ENV === 'production'
    ? []  // production: no cross-origin by default; set CORS_ORIGINS to allow specific domains
    : ['http://localhost:8080', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
}));

// Security headers
app.use(helmet());

// REQ-200: Correlation ID — assign or propagate X-Request-ID
app.use(correlationId);

// Structured request/response logging (uses correlation ID)
app.use(requestLogger);

// REQ-205: Per-route HTTP request metrics (uses correlation ID)
app.use(requestMetrics);

// Request timeout — all routes default to 30s
app.use(requestTimeout(SERVER_LIMITS.DEFAULT_TIMEOUT_MS));

// Rate limiting — ISS-044: values from centralized config
app.use(rateLimit({
  windowMs: RATE_LIMITS.API.WINDOW_MS,
  max: RATE_LIMITS.API.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Routes
app.use('/api/v1', healthRouter);
// TASK-0146: monitoring & cost metrics endpoints
app.use('/api/v1/monitoring', createMonitoringRouter());
// REQ-037: error recovery endpoints
app.use('/api/v1/errors', createErrorsRouter());
// ISS-026: apply upload rate limiter to batch job creation routes
app.use('/api/v1/batch', uploadRateLimiter, createBatchRouter());
// ISS-029: apply API rate limiter to pipeline routes to prevent abuse
// ISS-030: enforce JWT auth on pipeline routes in production
app.use('/api', apiRateLimiter, pipelineAuth, createPipelineRouter());

// Error handler (must be after routes)
app.use(errorHandler);

export { app };
export default app;
