/**
 * TASK-0047: WebSocket Real-time Progress Notification
 *
 * Socket.IO event handler implementing:
 * - Room management (join:job / leave:job)
 * - Job progress, completion, error notifications
 * - Per-file status changes
 * - Stage progress notifications
 * - Streaming transcription events (REQ-036)
 * - Error recovery events (REQ-037)
 * - JWT auth middleware on connection
 */

import type { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { requireJwtSecret } from './jwt-secret';
import { UUID_V4_RE } from './uuid-validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobProgressPayload {
  jobId: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
}

interface JobCompletePayload {
  jobId: string;
  status: 'completed';
  completedAt: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
}

interface JobErrorPayload {
  jobId: string;
  error: {
    code: string;
    message: string;
    fileId?: string;
  };
}

interface FileStatusPayload {
  jobId: string;
  fileId: string;
  fileName: string;
  status: string;
  progress: number;
}

interface StageProgressPayload {
  jobId: string;
  fileId: string;
  stage: string;
  progress: number;
  message: string;
}

interface StreamingSegmentPayload {
  jobId: string;
  fileId: string;
  segmentIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface StreamingCompletePayload {
  jobId: string;
  fileId: string;
  totalSegments: number;
  fullText: string;
  duration: number;
}

interface ErrorRecoveryPayload {
  jobId: string;
  fileId: string;
  error: {
    code: string;
    message: string;
  };
  recoveryOptions: Array<{ type: string; label: string }>;
}

interface ErrorRecoveredPayload {
  jobId: string;
  fileId: string;
  recoveryType: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Auth Middleware
// ---------------------------------------------------------------------------

interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  };
}

export function createWsAuthMiddleware() {
  return (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, requireJwtSecret()) as {
        sub?: string;
        email?: string;
        role?: string;
      };

      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      socket.data.user = {
        id: decoded.sub ?? '',
        email: decoded.email ?? '',
        role: decoded.role ?? '',
      };

      next();
    } catch (err) {
      next(new Error(err instanceof Error ? err.message : 'Authentication failed'));
    }
  };
}

// ---------------------------------------------------------------------------
// Payload validation helper (ISS-042)
// ---------------------------------------------------------------------------

function validateEventPayload(data: unknown, requiredFields: string[]): { valid: boolean; error?: string } {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Payload must be a non-null object' };
  }
  for (const field of requiredFields) {
    if (!(field in (data as Record<string, unknown>))) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }
  // Reject payloads with excessive keys to prevent DoS
  const keys = Object.keys(data as Record<string, unknown>);
  if (keys.length > 20) {
    return { valid: false, error: 'Payload has too many fields (max 20)' };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Connection Handler
// ---------------------------------------------------------------------------

export function registerWebSocketHandler(io: SocketServer): void {
  io.on('connection', (socket: AuthenticatedSocket) => {
    // Join a job room
    socket.on('join:job', (data: { jobId?: string }) => {
      // ISS-042: validate payload shape before accessing fields
      const payloadCheck = validateEventPayload(data, ['jobId']);
      if (!payloadCheck.valid) {
        socket.emit('error', { message: payloadCheck.error });
        return;
      }
      const { jobId } = data as { jobId: string };
      if (!jobId || typeof jobId !== 'string') {
        socket.emit('error', { message: 'Missing required field: jobId' });
        return;
      }
      // ISS-025: validate jobId is a valid UUID v4 to prevent injection
      if (!UUID_V4_RE.test(jobId)) {
        socket.emit('error', { message: 'Invalid jobId: must be a valid UUID v4' });
        return;
      }
      socket.join(`job:${jobId}`);
      socket.emit('job:joined', { jobId });
    });

    // Leave a job room
    socket.on('leave:job', (data: { jobId?: string }) => {
      // ISS-042: validate payload shape before accessing fields
      const payloadCheck = validateEventPayload(data, ['jobId']);
      if (!payloadCheck.valid) {
        socket.emit('error', { message: payloadCheck.error });
        return;
      }
      const { jobId } = data as { jobId: string };
      if (!jobId || typeof jobId !== 'string') {
        socket.emit('error', { message: 'Missing required field: jobId' });
        return;
      }
      // ISS-025: validate jobId is a valid UUID v4 to prevent injection
      if (!UUID_V4_RE.test(jobId)) {
        socket.emit('error', { message: 'Invalid jobId: must be a valid UUID v4' });
        return;
      }
      socket.leave(`job:${jobId}`);
      socket.emit('job:left', { jobId });
    });

    // Clean up on disconnect
    socket.on('disconnect', (_reason: string) => {
      // Socket.IO handles room cleanup automatically
    });
  });
}

// ---------------------------------------------------------------------------
// Server-side emit helpers
// ---------------------------------------------------------------------------

export function emitJobProgress(io: SocketServer, data: JobProgressPayload): void {
  io.to(`job:${data.jobId}`).emit('job:progress', data);
}

export function emitJobComplete(io: SocketServer, data: JobCompletePayload): void {
  io.to(`job:${data.jobId}`).emit('job:complete', data);
}

export function emitJobError(io: SocketServer, data: JobErrorPayload): void {
  io.to(`job:${data.jobId}`).emit('job:error', data);
}

export function emitFileStatus(io: SocketServer, data: FileStatusPayload): void {
  io.to(`job:${data.jobId}`).emit('file:status', data);
}

export function emitStageProgress(io: SocketServer, data: StageProgressPayload): void {
  io.to(`job:${data.jobId}`).emit('stage:progress', data);
}

export function emitStreamingSegment(io: SocketServer, data: StreamingSegmentPayload): void {
  io.to(`job:${data.jobId}`).emit('streaming:segment', data);
}

export function emitStreamingComplete(io: SocketServer, data: StreamingCompletePayload): void {
  io.to(`job:${data.jobId}`).emit('streaming:complete', data);
}

export function emitErrorRecovery(io: SocketServer, data: ErrorRecoveryPayload): void {
  io.to(`job:${data.jobId}`).emit('error:recovery', data);
}

export function emitErrorRecovered(io: SocketServer, data: ErrorRecoveredPayload): void {
  io.to(`job:${data.jobId}`).emit('error:recovered', data);
}
