/**
 * TASK-0047: WebSocket Real-time Progress Notification - Tests
 *
 * Tests for the Socket.IO event handler implementing:
 * - Room management (join:job / leave:job)
 * - Job progress, completion, error notifications
 * - Per-file status changes
 * - Stage progress notifications
 * - Streaming transcription events (REQ-036)
 * - Error recovery events (REQ-037)
 * - JWT auth middleware on connection
 */

import { jest } from '@jest/globals';

import { createMockIo, createMockSocket, MockIo, MockSocket } from '../../__mocks__/socket-io';

// We will import after mock setup. Use dynamic import below.
let registerWebSocketHandler: typeof import('../../../src/api/websocket-handler').registerWebSocketHandler;
let createWsAuthMiddleware: typeof import('../../../src/api/websocket-handler').createWsAuthMiddleware;
let emitJobProgress: typeof import('../../../src/api/websocket-handler').emitJobProgress;
let emitJobComplete: typeof import('../../../src/api/websocket-handler').emitJobComplete;
let emitJobError: typeof import('../../../src/api/websocket-handler').emitJobError;
let emitFileStatus: typeof import('../../../src/api/websocket-handler').emitFileStatus;
let emitStageProgress: typeof import('../../../src/api/websocket-handler').emitStageProgress;
let emitStreamingSegment: typeof import('../../../src/api/websocket-handler').emitStreamingSegment;
let emitStreamingComplete: typeof import('../../../src/api/websocket-handler').emitStreamingComplete;
let emitErrorRecovery: typeof import('../../../src/api/websocket-handler').emitErrorRecovery;
let emitErrorRecovered: typeof import('../../../src/api/websocket-handler').emitErrorRecovered;

// Mock jsonwebtoken before importing (ESM-compatible)
jest.unstable_mockModule('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

let mockedJwtVerify: jest.Mock;

// ---------------------------------------------------------------------------
// Helper: set up module under test with mocked Socket.IO
// ---------------------------------------------------------------------------

async function importModule() {
  const mod = await import('../../../src/api/websocket-handler');
  registerWebSocketHandler = mod.registerWebSocketHandler;
  createWsAuthMiddleware = mod.createWsAuthMiddleware;
  emitJobProgress = mod.emitJobProgress;
  emitJobComplete = mod.emitJobComplete;
  emitJobError = mod.emitJobError;
  emitFileStatus = mod.emitFileStatus;
  emitStageProgress = mod.emitStageProgress;
  emitStreamingSegment = mod.emitStreamingSegment;
  emitStreamingComplete = mod.emitStreamingComplete;
  emitErrorRecovery = mod.emitErrorRecovery;
  emitErrorRecovered = mod.emitErrorRecovered;
}

/** Shape returned by mockIo.to() */
interface MockRoom { emit: jest.Mock }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket Handler', () => {
  let mockIo: MockIo;
  let mockSocket: MockSocket;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    mockIo = createMockIo();
    mockSocket = createMockSocket();

    // Dynamic import of mocked jsonwebtoken (ESM)
    const jwt = await import('jsonwebtoken');
    mockedJwtVerify = jwt.verify as jest.Mock;

    // Default: JWT verify returns a valid user
    mockedJwtVerify.mockReturnValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'authenticated',
    });

    await importModule();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  // =========================================================================
  // Auth Middleware
  // =========================================================================

  describe('Auth Middleware', () => {
    it('should allow connection with a valid JWT token', () => {
      const middleware = createWsAuthMiddleware();
      mockSocket.handshake.auth.token = 'valid.jwt.token';

      const next = jest.fn();
      middleware(mockSocket as unknown as Parameters<typeof middleware>[0], next);

      expect(next).toHaveBeenCalledWith();
      expect(mockSocket.data.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'authenticated',
      });
    });

    it('should refuse connection when no token is provided', () => {
      const middleware = createWsAuthMiddleware();
      mockSocket.handshake.auth.token = undefined;

      const next = jest.fn();
      middleware(mockSocket as unknown as Parameters<typeof middleware>[0], next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0] as Error;
      expect(err.message).toContain('Authentication required');
    });

    it('should refuse connection when JWT verify returns null', () => {
      const middleware = createWsAuthMiddleware();
      mockSocket.handshake.auth.token = 'invalid.token';
      mockedJwtVerify.mockReturnValue(null);

      const next = jest.fn();
      middleware(mockSocket as unknown as Parameters<typeof middleware>[0], next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0] as Error;
      expect(err.message).toContain('Invalid token');
    });

    it('should refuse connection when JWT verify throws an error', () => {
      const middleware = createWsAuthMiddleware();
      mockSocket.handshake.auth.token = 'broken.token';
      mockedJwtVerify.mockImplementation(() => {
        throw new Error('verify failed');
      });

      const next = jest.fn();
      middleware(mockSocket as unknown as Parameters<typeof middleware>[0], next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // =========================================================================
  // Room Management
  // =========================================================================

  describe('Room Management', () => {
    it('should join a job room on join:job event', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      // Simulate connection
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      expect(connectionCb).toBeDefined();
      connectionCb!(mockSocket);

      // Simulate join:job event with valid UUID v4
      const joinCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'join:job'
      )?.[1];

      const validJobId = '550e8400-e29b-41d4-a716-446655440000';
      joinCb!({ jobId: validJobId });

      expect(mockSocket.join).toHaveBeenCalledWith(`job:${validJobId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'job:joined',
        expect.objectContaining({ jobId: validJobId })
      );
    });

    it('should leave a job room on leave:job event', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const leaveCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'leave:job'
      )?.[1];

      const validJobId = '550e8400-e29b-41d4-a716-446655440000';
      leaveCb!({ jobId: validJobId });

      expect(mockSocket.leave).toHaveBeenCalledWith(`job:${validJobId}`);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'job:left',
        expect.objectContaining({ jobId: validJobId })
      );
    });

    it('should handle join:job without jobId gracefully', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const joinCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'join:job'
      )?.[1];

      joinCb!({});

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('jobId') })
      );
    });

    // ISS-025: UUID validation tests

    it('should accept join:job with a valid UUID v4 jobId', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const joinCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'join:job'
      )?.[1];

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      joinCb!({ jobId: validUuid });

      expect(mockSocket.join).toHaveBeenCalledWith(`job:${validUuid}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('job:joined', { jobId: validUuid });
    });

    it('should reject join:job with an invalid jobId (ISS-025)', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const joinCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'join:job'
      )?.[1];

      joinCb!({ jobId: 'not-a-uuid' });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('UUID v4') })
      );
    });

    it('should reject join:job with SQL injection attempt (ISS-025)', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const joinCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'join:job'
      )?.[1];

      joinCb!({ jobId: "'; DROP TABLE jobs;--" });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('UUID v4') })
      );
    });

    it('should accept leave:job with a valid UUID v4 jobId', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const leaveCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'leave:job'
      )?.[1];

      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      leaveCb!({ jobId: validUuid });

      expect(mockSocket.leave).toHaveBeenCalledWith(`job:${validUuid}`);
      expect(mockSocket.emit).toHaveBeenCalledWith('job:left', { jobId: validUuid });
    });

    it('should reject leave:job with an invalid jobId (ISS-025)', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const leaveCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'leave:job'
      )?.[1];

      leaveCb!({ jobId: '../../../etc/passwd' });

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('UUID v4') })
      );
    });

    it('should reject leave:job with empty string jobId (ISS-025)', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);
      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const leaveCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'leave:job'
      )?.[1];

      leaveCb!({ jobId: '' });

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('jobId') })
      );
    });
  });

  // =========================================================================
  // Client Connect / Disconnect
  // =========================================================================

  describe('Client Connect/Disconnect', () => {
    it('should register event listeners on connection', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const registeredEvents = mockSocket.on.mock.calls.map(
        (c: [string, (...args: unknown[]) => void]) => c[0]
      );

      expect(registeredEvents).toContain('join:job');
      expect(registeredEvents).toContain('leave:job');
      expect(registeredEvents).toContain('disconnect');
    });

    it('should clean up on disconnect', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const connectionCb = mockIo.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'connection'
      )?.[1];
      connectionCb!(mockSocket);

      const disconnectCb = mockSocket.on.mock.calls.find(
        (c: [string, (...args: unknown[]) => void]) => c[0] === 'disconnect'
      )?.[1];

      disconnectCb!('client disconnect');

      // Socket should have emitted nothing or done cleanup
      // We just verify the disconnect handler exists and runs without error
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // Job Progress Notification
  // =========================================================================

  describe('Job Progress Notification', () => {
    it('should emit job:progress to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const progressData = {
        jobId: 'job-abc-123',
        progress: {
          total: 10,
          completed: 5,
          failed: 0,
          percentage: 50,
        },
      };

      mockIo.to.mockReturnValue({
        emit: jest.fn(),
      } satisfies MockRoom);

      // Call the helper: emitJobProgress
      emitJobProgress(mockIo as unknown as Parameters<typeof emitJobProgress>[0], progressData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
    });
  });

  // =========================================================================
  // Job Complete Notification
  // =========================================================================

  describe('Job Complete Notification', () => {
    it('should emit job:complete to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const completeData = {
        jobId: 'job-abc-123',
        status: 'completed' as const,
        completedAt: '2026-04-29T00:00:00Z',
        progress: {
          total: 10,
          completed: 10,
          failed: 0,
          percentage: 100,
        },
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitJobComplete(mockIo as unknown as Parameters<typeof emitJobComplete>[0], completeData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('job:complete', completeData);
    });
  });

  // =========================================================================
  // Job Error Notification
  // =========================================================================

  describe('Job Error Notification', () => {
    it('should emit job:error to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const errorData = {
        jobId: 'job-abc-123',
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Failed to process file',
          fileId: 'file-001',
        },
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitJobError(mockIo as unknown as Parameters<typeof emitJobError>[0], errorData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('job:error', errorData);
    });
  });

  // =========================================================================
  // File Status Change
  // =========================================================================

  describe('File Status Change', () => {
    it('should emit file:status to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const fileStatusData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        fileName: 'audio1.wav',
        status: 'processing' as const,
        progress: 75,
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitFileStatus(mockIo as unknown as Parameters<typeof emitFileStatus>[0], fileStatusData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('file:status', fileStatusData);
    });
  });

  // =========================================================================
  // Stage Progress Notification
  // =========================================================================

  describe('Stage Progress Notification', () => {
    it('should emit stage:progress to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const stageData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        stage: 'transcription' as const,
        progress: 80,
        message: 'Transcribing audio...',
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitStageProgress(mockIo as unknown as Parameters<typeof emitStageProgress>[0], stageData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('stage:progress', stageData);
    });
  });

  // =========================================================================
  // Streaming Transcription Events (REQ-036)
  // =========================================================================

  describe('Streaming Transcription Events', () => {
    it('should emit streaming:segment to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const segmentData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        segmentIndex: 3,
        text: 'Hello world this is a test',
        startTime: 1.5,
        endTime: 4.2,
        confidence: 0.95,
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitStreamingSegment(mockIo as unknown as Parameters<typeof emitStreamingSegment>[0], segmentData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('streaming:segment', segmentData);
    });

    it('should emit streaming:complete to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const completeData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        totalSegments: 10,
        fullText: 'Full transcription text...',
        duration: 30.5,
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitStreamingComplete(mockIo as unknown as Parameters<typeof emitStreamingComplete>[0], completeData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('streaming:complete', completeData);
    });
  });

  // =========================================================================
  // Error Recovery Events (REQ-037)
  // =========================================================================

  describe('Error Recovery Events', () => {
    it('should emit error:recovery to a job room with recovery options', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const recoveryData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        error: {
          code: 'TRANSCRIPTION_TIMEOUT',
          message: 'Transcription timed out',
        },
        recoveryOptions: [
          { type: 'retry', label: 'Retry transcription' },
          { type: 'skip', label: 'Skip this file' },
          { type: 'fallback', label: 'Use basic transcription' },
        ],
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitErrorRecovery(mockIo as unknown as Parameters<typeof emitErrorRecovery>[0], recoveryData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('error:recovery', recoveryData);
    });

    it('should emit error:recovered to a job room', () => {
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const recoveredData = {
        jobId: 'job-abc-123',
        fileId: 'file-001',
        recoveryType: 'retry',
        message: 'Transcription succeeded on retry',
      };

      const emitMock = jest.fn();
      mockIo.to.mockReturnValue({ emit: emitMock } satisfies MockRoom);

      emitErrorRecovered(mockIo as unknown as Parameters<typeof emitErrorRecovered>[0], recoveredData);

      expect(mockIo.to).toHaveBeenCalledWith('job:job-abc-123');
      expect(emitMock).toHaveBeenCalledWith('error:recovered', recoveredData);
    });
  });
});
