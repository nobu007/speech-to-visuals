import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health';
import { createBatchRouter } from './routes/batch';
import { createPipelineRouter } from './routes/pipeline';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter, uploadRateLimiter } from './middleware/rate-limit';

const app = express();

// JSON body parser (50MB limit per REQ-402)
app.use(express.json({ limit: '50mb' }));

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

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
  standardHeaders: true,
  legacyHeaders: false,
}));

// Routes
app.use('/api/v1', healthRouter);
// ISS-026: apply upload rate limiter to batch job creation routes
app.use('/api/v1/batch', uploadRateLimiter, createBatchRouter());
// ISS-029: apply API rate limiter to pipeline routes to prevent abuse
app.use('/api', apiRateLimiter, createPipelineRouter());

// Error handler (must be after routes)
app.use(errorHandler);

// Root health check (direct path)
app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

export { app };
export default app;
