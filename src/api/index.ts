/**
 * Integrated API Server (HTTP + WebSocket)
 * AutoDiagram Video Generator - Iteration 67 Phase A1+A2
 */

import { createServer } from 'http';
import dotenv from 'dotenv';
import { createApp } from './server';
import { createWebSocketServer } from './websocket';

// Load environment variables
dotenv.config();

/**
 * Start integrated HTTP + WebSocket server
 */
export function startIntegratedServer(port: number = 3001): void {
  // Create Express app
  const app = createApp();

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server
  const io = createWebSocketServer(httpServer);

  // Start listening
  httpServer.listen(port, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 AutoDiagram Integrated API Server');
    console.log('   Iteration 67 - Phase A1 (REST API) + Phase A2 (WebSocket)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📡 HTTP Server: http://localhost:${port}`);
    console.log(`🔌 WebSocket Server: ws://localhost:${port}`);
    console.log(`🏥 Health Check: http://localhost:${port}/health`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n📋 REST API Endpoints:');
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
    console.log('\n🔌 WebSocket Events:');
    console.log('  Client → Server:');
    console.log('    - job:start         : Start a job');
    console.log('    - job:cancel        : Cancel a job');
    console.log('    - settings:update   : Update user settings');
    console.log('  Server → Client:');
    console.log('    - job:progress      : Job progress updates');
    console.log('    - job:complete      : Job completion notification');
    console.log('    - job:error         : Job error notification');
    console.log('    - system:notification : System notifications');
    console.log('═══════════════════════════════════════════════════════════════\n');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n[Server] SIGTERM received, shutting down gracefully...');
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      io.close(() => {
        console.log('[Server] WebSocket server closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    console.log('\n[Server] SIGINT received, shutting down gracefully...');
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      io.close(() => {
        console.log('[Server] WebSocket server closed');
        process.exit(0);
      });
    });
  });
}

// Auto-start server
const port = parseInt(process.env.API_PORT || '3001', 10);
startIntegratedServer(port);
