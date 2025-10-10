/**
 * Express API Server
 * AutoDiagram Video Generator - Iteration 67 Phase A1
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from '../middleware/error-handler';
import authRoutes from '../routes/auth.routes';
import apiRoutes from '../routes/api.routes';
import { openAPISpec } from './openapi';

// Load environment variables
dotenv.config();

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ============================================================================
  // Security & Basic Middleware
  // ============================================================================

  // Helmet for security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    })
  );

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request ID middleware
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });

  // ============================================================================
  // Routes
  // ============================================================================

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      },
    });
  });

  // OpenAPI specification
  app.get('/api/openapi.json', (req, res) => {
    res.json(openAPISpec);
  });

  // API v1 routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', apiRoutes);

  // ============================================================================
  // Error Handling
  // ============================================================================

  // 404 handler
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Start the API server
 */
export function startServer(port: number = 3001): void {
  const app = createApp();

  app.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 AutoDiagram API Server - Iteration 67 Phase A1');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📡 Server running on: http://localhost:${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/health`);
    console.log(`📚 API Base URL: http://localhost:${port}/api/v1`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📋 Available Endpoints:');
    console.log('  POST   /api/v1/auth/login         - Login with credentials');
    console.log('  POST   /api/v1/auth/register      - Register new user');
    console.log('  POST   /api/v1/transcribe         - Transcribe audio file');
    console.log('  POST   /api/v1/generate-diagram   - Generate diagram from text');
    console.log('  POST   /api/v1/generate-video     - Generate video from diagram');
    console.log('  GET    /api/v1/jobs/:jobId        - Get job status');
    console.log('  DELETE /api/v1/jobs/:jobId        - Cancel job');
    console.log('  GET    /api/v1/jobs               - Get all user jobs');
    console.log('  GET    /api/v1/quota              - Get quota information');
    console.log('  GET    /api/v1/health             - Health check');
    console.log('═══════════════════════════════════════════════════════════════\n');
  });
}

// Note: Server startup is handled by index.ts
