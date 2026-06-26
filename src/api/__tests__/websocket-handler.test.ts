/**
 * Tests for WebSocket Handler
 *
 * Verifies:
 * - Auth middleware: valid/invalid/missing JWT tokens
 * - Room management: join:job / leave:job with UUID validation
 * - Payload validation: non-null object, required fields, max key limit
 * - UUID v4 injection prevention
 * - Emit helpers: correct room targeting and event names
 * - Disconnect handling
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock socket.io types
interface MockSocket {
  handshake: { auth: { token?: string } };
  data: { user?: { id: string; email: string; role: string } };
  rooms: Set<string>;
  emitted: Array<{ event: string; data: unknown }>;
  joinedRooms: string[];
  leftRooms: string[];
  eventHandlers: Map<string, (...args: unknown[]) => void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  emit(event: string, data: unknown): void;
  join(room: string): void;
  leave(room: string): void;
}

function createMockSocket(token?: string): MockSocket {
  return {
    handshake: { auth: { token } },
    data: {},
    rooms: new Set(),
    emitted: [],
    joinedRooms: [],
    leftRooms: [],
    eventHandlers: new Map(),
    on(event: string, handler: (...args: unknown[]) => void) {
      this.eventHandlers.set(event, handler);
    },
    emit(event: string, data: unknown) {
      this.emitted.push({ event, data });
    },
    join(room: string) {
      this.rooms.add(room);
      this.joinedRooms.push(room);
    },
    leave(room: string) {
      this.rooms.delete(room);
      this.leftRooms.push(room);
    },
  };
}

interface MockIo {
  on(event: string, handler: (socket: MockSocket) => void): void;
  emitted: Array<{ room: string; event: string; data: unknown }>;
  to(room: string): { emit(event: string, data: unknown): void };
}

function createMockIo(): MockIo {
  const io: MockIo = {
    on(_event: string, _handler: (socket: MockSocket) => void) {},
    emitted: [],
    to(room: string) {
      return {
        emit(event: string, data: unknown) {
          io.emitted.push({ room, event, data });
        },
      };
    },
  };
  return io;
}

// Helper to generate a valid JWT for tests
function makeToken(payload: Record<string, unknown>, secret: string): string {
  return jwt.sign(payload, secret);
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const JWT_SECRET = 'test-jwt-secret-for-websocket';

describe('WebSocket Handler — Auth Middleware', () => {
  let originalJwtSecret: string | undefined;
  let originalSupabaseSecret: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    originalSupabaseSecret = process.env.SUPABASE_JWT_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
    jest.resetModules();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.SUPABASE_JWT_SECRET = originalSupabaseSecret;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should call next() without error for valid JWT', () => {
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const token = makeToken({ sub: 'user1', email: 'test@test.com', role: 'admin' }, JWT_SECRET);
    const socket = createMockSocket(token);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeUndefined();
    expect(socket.data.user).toBeDefined();
    expect(socket.data.user.id).toBe('user1');
    expect(socket.data.user.email).toBe('test@test.com');
    expect(socket.data.user.role).toBe('admin');
  });

  it('should call next() with error when token is missing', () => {
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const socket = createMockSocket(undefined);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeDefined();
    expect(nextError!.message).toBe('Authentication required');
  });

  it('should call next() with error for invalid JWT', () => {
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const socket = createMockSocket('invalid.token.here');
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeDefined();
    expect(nextError!.message).toBeTruthy();
  });

  it('should call next() with error for expired JWT', () => {
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const expiredToken = jwt.sign(
      { sub: 'user1', email: 'test@test.com' },
      JWT_SECRET,
      { expiresIn: '-1s' },
    );
    const socket = createMockSocket(expiredToken);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeDefined();
  });

  it('should call next() with error when JWT secret env var is missing', () => {
    delete process.env.JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const token = makeToken({ sub: 'user1' }, 'different-secret');
    const socket = createMockSocket(token);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeDefined();
  });

  it('should use SUPABASE_JWT_SECRET when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    process.env.SUPABASE_JWT_SECRET = 'supabase-secret';
    const token = makeToken({ sub: 'user1' }, 'supabase-secret');
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const socket = createMockSocket(token);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeUndefined();
    expect(socket.data.user.id).toBe('user1');
  });

  it('should handle JWT with missing sub/email/role fields', () => {
    const { createWsAuthMiddleware } = require('../websocket-handler');
    const token = makeToken({}, JWT_SECRET);
    const socket = createMockSocket(token);
    const middleware = createWsAuthMiddleware();
    let nextError: Error | undefined;
    middleware(socket, (err?: Error) => { nextError = err; });

    expect(nextError).toBeUndefined();
    expect(socket.data.user.id).toBe('');
    expect(socket.data.user.email).toBe('');
    expect(socket.data.user.role).toBe('');
  });
});

describe('WebSocket Handler — registerWebSocketHandler', () => {
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
    jest.resetModules();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('should register connection handler on io', () => {
    const mockIo = createMockIo();
    let connectionCallCount = 0;
    mockIo.on = (_event: string, _handler: (socket: MockSocket) => void) => {
      connectionCallCount++;
    };

    const { registerWebSocketHandler } = require('../websocket-handler');
    registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

    expect(connectionCallCount).toBe(1);
  });

  describe('join:job handler', () => {
    function setupConnection() {
      const mockIo = createMockIo();
      let connectionHandler: ((socket: MockSocket) => void) | undefined;
      mockIo.on = (_event: string, handler: (socket: MockSocket) => void) => {
        connectionHandler = handler;
      };

      const { registerWebSocketHandler } = require('../websocket-handler');
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const socket = createMockSocket();
      expect(connectionHandler).toBeDefined();
      connectionHandler!(socket);
      return socket;
    }

    it('should join job room on valid UUID', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');
      expect(handler).toBeDefined();

      handler!({ jobId: VALID_UUID });
      expect(socket.joinedRooms).toContain(`job:${VALID_UUID}`);
      expect(socket.emitted.some(e => e.event === 'job:joined')).toBe(true);
    });

    it('should emit error for non-UUID jobId', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      handler!({ jobId: 'not-a-uuid' });
      expect(socket.emitted.some(e => e.event === 'error' && (e.data as { message: string }).message.includes('UUID'))).toBe(true);
      expect(socket.joinedRooms).toHaveLength(0);
    });

    it('should emit error for missing jobId', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      handler!({});
      expect(socket.emitted.some(e => e.event === 'error')).toBe(true);
    });

    it('should emit error for null payload', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      handler!(null);
      expect(socket.emitted.some(e => e.event === 'error' && (e.data as { message: string }).message.includes('non-null'))).toBe(true);
    });

    it('should emit error for array payload', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      handler!([1, 2, 3]);
      expect(socket.emitted.some(e => e.event === 'error' && (e.data as { message: string }).message.includes('non-null'))).toBe(true);
    });

    it('should reject SQL injection attempts in jobId', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      const injections = [
        "'; DROP TABLE jobs; --",
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        'job:1 OR 1=1',
      ];

      for (const payload of injections) {
        socket.emitted = [];
        handler!({ jobId: payload });
        expect(socket.emitted.some(e => e.event === 'error')).toBe(true);
        expect(socket.joinedRooms).toHaveLength(0);
      }
    });

    it('should reject payload with too many keys (>20)', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');

      const bloated: Record<string, unknown> = { jobId: VALID_UUID };
      for (let i = 0; i < 25; i++) bloated[`key${i}`] = 'x';

      handler!(bloated);
      expect(socket.emitted.some(e => e.event === 'error' && (e.data as { message: string }).message.includes('too many'))).toBe(true);
    });
  });

  describe('leave:job handler', () => {
    function setupConnection() {
      const mockIo = createMockIo();
      let connectionHandler: ((socket: MockSocket) => void) | undefined;
      mockIo.on = (_event: string, handler: (socket: MockSocket) => void) => {
        connectionHandler = handler;
      };

      const { registerWebSocketHandler } = require('../websocket-handler');
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const socket = createMockSocket();
      connectionHandler!(socket);
      return socket;
    }

    it('should leave job room on valid UUID', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('leave:job');

      // First join
      socket.rooms.add(`job:${VALID_UUID}`);

      handler!({ jobId: VALID_UUID });
      expect(socket.leftRooms).toContain(`job:${VALID_UUID}`);
      expect(socket.emitted.some(e => e.event === 'job:left')).toBe(true);
    });

    it('should emit error for invalid UUID on leave', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('leave:job');

      handler!({ jobId: 'invalid' });
      expect(socket.emitted.some(e => e.event === 'error')).toBe(true);
    });

    it('should emit error for missing jobId on leave', () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('leave:job');

      handler!({});
      expect(socket.emitted.some(e => e.event === 'error')).toBe(true);
    });
  });

  describe('disconnect handler', () => {
    it('should register disconnect handler without errors', () => {
      const mockIo = createMockIo();
      let connectionHandler: ((socket: MockSocket) => void) | undefined;
      mockIo.on = (_event: string, handler: (socket: MockSocket) => void) => {
        connectionHandler = handler;
      };

      const { registerWebSocketHandler } = require('../websocket-handler');
      registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

      const socket = createMockSocket();
      connectionHandler!(socket);

      const disconnectHandler = socket.eventHandlers.get('disconnect');
      expect(disconnectHandler).toBeDefined();
      expect(() => disconnectHandler!('transport close')).not.toThrow();
    });
  });
});

describe('WebSocket Handler — emit helpers', () => {
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
    jest.resetModules();
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('emitJobProgress should target correct room', () => {
    const mockIo = createMockIo();
    const { emitJobProgress } = require('../websocket-handler');

    emitJobProgress(mockIo, {
      jobId: VALID_UUID,
      progress: { total: 10, completed: 5, failed: 0, percentage: 50 },
    });

    expect(mockIo.emitted).toHaveLength(1);
    expect(mockIo.emitted[0].room).toBe(`job:${VALID_UUID}`);
    expect(mockIo.emitted[0].event).toBe('job:progress');
  });

  it('emitJobComplete should target correct room', () => {
    const mockIo = createMockIo();
    const { emitJobComplete } = require('../websocket-handler');

    emitJobComplete(mockIo, {
      jobId: VALID_UUID,
      status: 'completed',
      completedAt: '2024-01-01T00:00:00Z',
      progress: { total: 10, completed: 10, failed: 0, percentage: 100 },
    });

    expect(mockIo.emitted[0].event).toBe('job:complete');
  });

  it('emitJobError should target correct room', () => {
    const mockIo = createMockIo();
    const { emitJobError } = require('../websocket-handler');

    emitJobError(mockIo, {
      jobId: VALID_UUID,
      error: { code: 'PIPELINE_ERROR', message: 'Something went wrong' },
    });

    expect(mockIo.emitted[0].event).toBe('job:error');
  });

  it('emitFileStatus should target correct room', () => {
    const mockIo = createMockIo();
    const { emitFileStatus } = require('../websocket-handler');

    emitFileStatus(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      fileName: 'audio.mp3',
      status: 'processing',
      progress: 45,
    });

    expect(mockIo.emitted[0].event).toBe('file:status');
  });

  it('emitStageProgress should target correct room', () => {
    const mockIo = createMockIo();
    const { emitStageProgress } = require('../websocket-handler');

    emitStageProgress(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      stage: 'transcription',
      progress: 80,
      message: 'Transcribing audio',
    });

    expect(mockIo.emitted[0].event).toBe('stage:progress');
  });

  it('emitStreamingSegment should target correct room', () => {
    const mockIo = createMockIo();
    const { emitStreamingSegment } = require('../websocket-handler');

    emitStreamingSegment(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      segmentIndex: 0,
      text: 'Hello world',
      startTime: 0,
      endTime: 2.5,
      confidence: 0.95,
    });

    expect(mockIo.emitted[0].event).toBe('streaming:segment');
  });

  it('emitStreamingComplete should target correct room', () => {
    const mockIo = createMockIo();
    const { emitStreamingComplete } = require('../websocket-handler');

    emitStreamingComplete(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      totalSegments: 10,
      fullText: 'Complete transcription',
      duration: 30,
    });

    expect(mockIo.emitted[0].event).toBe('streaming:complete');
  });

  it('emitErrorRecovery should target correct room', () => {
    const mockIo = createMockIo();
    const { emitErrorRecovery } = require('../websocket-handler');

    emitErrorRecovery(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      error: { code: 'TIMEOUT', message: 'Operation timed out' },
      recoveryOptions: [{ type: 'retry', label: 'Retry' }],
    });

    expect(mockIo.emitted[0].event).toBe('error:recovery');
  });

  it('emitErrorRecovered should target correct room', () => {
    const mockIo = createMockIo();
    const { emitErrorRecovered } = require('../websocket-handler');

    emitErrorRecovered(mockIo, {
      jobId: VALID_UUID,
      fileId: 'file-1',
      recoveryType: 'retry',
      message: 'Recovered successfully',
    });

    expect(mockIo.emitted[0].event).toBe('error:recovered');
  });
});

describe('WebSocket Handler — UUID v4 validation', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  function setupConnection() {
    const mockIo = createMockIo();
    let connectionHandler: ((socket: MockSocket) => void) | undefined;
    mockIo.on = (_event: string, handler: (socket: MockSocket) => void) => {
      connectionHandler = handler;
    };

    const { registerWebSocketHandler } = require('../websocket-handler');
    registerWebSocketHandler(mockIo as unknown as Parameters<typeof registerWebSocketHandler>[0]);

    const socket = createMockSocket();
    connectionHandler!(socket);
    return socket;
  }

  const validUuids = [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
    '12345678-1234-4234-8234-123456789012',
  ];

  const invalidUuids = [
    'not-a-uuid',
    '550e8400-e29b-31d4-a716-446655440000', // version 3, not 4
    '550e8400-e29b-51d4-a716-446655440000', // version 5, not 4
    '550e8400-e29b-41d4-c716-446655440000', // variant c, not 8/9/a/b
    '',
    '550e8400e29b41d4a716446655440000',     // missing hyphens
    'GGGe8400-e29b-41d4-a716-446655440000', // non-hex chars
  ];

  for (const uuid of validUuids) {
    it(`should accept valid UUID v4: ${uuid}`, () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');
      handler!({ jobId: uuid });
      expect(socket.joinedRooms).toContain(`job:${uuid}`);
    });
  }

  for (const uuid of invalidUuids) {
    it(`should reject invalid UUID: ${uuid}`, () => {
      const socket = setupConnection();
      const handler = socket.eventHandlers.get('join:job');
      handler!({ jobId: uuid });
      expect(socket.joinedRooms).toHaveLength(0);
      expect(socket.emitted.some(e => e.event === 'error')).toBe(true);
    });
  }
});
