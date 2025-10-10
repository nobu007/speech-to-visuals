/**
 * WebSocket Server for Real-time Communication
 * AutoDiagram Video Generator - Iteration 67 Phase A2
 */

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/auth';
import { jobManager } from '../services/job-manager';
import {
  WebSocketEvents,
  JobStartRequest,
  JobCancelRequest,
  SettingsUpdate,
  JobProgress,
  JobComplete,
  JobError,
  SystemNotification,
  JWTPayload,
} from '../types/api';

/**
 * Extend Socket to include authenticated user
 */
interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

/**
 * Create and configure Socket.IO server
 */
export function createWebSocketServer(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for WebSocket
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyToken(token);
      socket.user = payload;

      console.log(`[WebSocket] User authenticated: ${payload.userId} (${payload.email})`);
      next();
    } catch (error) {
      console.error('[WebSocket] Authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.user?.userId || 'unknown';
    console.log(`[WebSocket] Client connected: ${socket.id} (User: ${userId})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Send welcome notification
    const welcomeNotification: SystemNotification = {
      type: 'success',
      message: 'Connected to AutoDiagram API Server',
      timestamp: new Date(),
    };
    socket.emit('system:notification', welcomeNotification);

    // =========================================================================
    // Job Events
    // =========================================================================

    /**
     * Handle job:start event
     */
    socket.on('job:start', (data: JobStartRequest) => {
      console.log(`[WebSocket] Job start requested: ${data.jobId} (User: ${userId})`);

      const job = jobManager.getJob(data.jobId);

      if (!job) {
        const error: JobError = {
          jobId: data.jobId,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found',
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        };
        socket.emit('job:error', error);
        return;
      }

      // Update job to processing
      jobManager.updateJob(data.jobId, {
        status: 'processing',
        progress: 0,
      });

      // Send initial progress
      const progress: JobProgress = {
        jobId: data.jobId,
        stage: 'transcription',
        progress: 0,
        estimatedTimeRemaining: 0,
        currentOperation: 'Starting job...',
      };
      socket.emit('job:progress', progress);
    });

    /**
     * Handle job:cancel event
     */
    socket.on('job:cancel', (data: JobCancelRequest) => {
      console.log(`[WebSocket] Job cancel requested: ${data.jobId} (User: ${userId})`);

      const job = jobManager.cancelJob(data.jobId);

      if (!job) {
        const error: JobError = {
          jobId: data.jobId,
          error: {
            code: 'JOB_NOT_FOUND',
            message: 'Job not found or already completed',
            statusCode: 404,
            timestamp: new Date().toISOString(),
          },
        };
        socket.emit('job:error', error);
        return;
      }

      const notification: SystemNotification = {
        type: 'info',
        message: `Job ${data.jobId} has been cancelled`,
        timestamp: new Date(),
      };
      socket.emit('system:notification', notification);
    });

    /**
     * Handle settings:update event
     */
    socket.on('settings:update', (data: SettingsUpdate) => {
      console.log(`[WebSocket] Settings update: ${userId}`, data.settings);

      // TODO: Store user settings
      const notification: SystemNotification = {
        type: 'success',
        message: 'Settings updated successfully',
        timestamp: new Date(),
      };
      socket.emit('system:notification', notification);
    });

    // =========================================================================
    // Disconnect Handler
    // =========================================================================

    socket.on('disconnect', (reason) => {
      console.log(`[WebSocket] Client disconnected: ${socket.id} (User: ${userId}), Reason: ${reason}`);
    });

    // =========================================================================
    // Error Handler
    // =========================================================================

    socket.on('error', (error) => {
      console.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });
  });

  // ============================================================================
  // Job Manager Event Listeners - Broadcast to relevant clients
  // ============================================================================

  /**
   * Broadcast job progress updates
   */
  jobManager.on('job:updated', (job) => {
    if (job.status === 'processing') {
      const progress: JobProgress = {
        jobId: job.jobId,
        stage: job.stage || 'transcription',
        progress: job.progress,
        estimatedTimeRemaining: job.estimatedTimeRemaining || 0,
        currentOperation: job.currentOperation || 'Processing...',
      };

      // Broadcast to all connected clients (in production, send to specific user)
      io.emit('job:progress', progress);
    }
  });

  /**
   * Broadcast job completion
   */
  jobManager.on('job:completed', (job) => {
    const complete: JobComplete = {
      jobId: job.jobId,
      result: job.result!,
    };

    // Broadcast to all connected clients (in production, send to specific user)
    io.emit('job:complete', complete);

    const notification: SystemNotification = {
      type: 'success',
      message: `Job ${job.jobId} completed successfully`,
      timestamp: new Date(),
    };
    io.emit('system:notification', notification);
  });

  /**
   * Broadcast job failures
   */
  jobManager.on('job:failed', (job) => {
    const error: JobError = {
      jobId: job.jobId,
      error: job.error!,
    };

    // Broadcast to all connected clients (in production, send to specific user)
    io.emit('job:error', error);

    const notification: SystemNotification = {
      type: 'error',
      message: `Job ${job.jobId} failed: ${job.error!.message}`,
      timestamp: new Date(),
    };
    io.emit('system:notification', notification);
  });

  console.log('[WebSocket] Socket.IO server configured successfully');

  return io;
}

/**
 * Broadcast system notification to all connected clients
 */
export function broadcastNotification(
  io: Server,
  notification: SystemNotification
): void {
  io.emit('system:notification', notification);
  console.log('[WebSocket] Broadcast notification:', notification.message);
}

/**
 * Send notification to specific user
 */
export function sendUserNotification(
  io: Server,
  userId: string,
  notification: SystemNotification
): void {
  io.to(`user:${userId}`).emit('system:notification', notification);
  console.log(`[WebSocket] Sent notification to user ${userId}:`, notification.message);
}
