/**
 * ISS-042: WebSocket payload validation tests
 *
 * Verifies that WebSocket event handlers validate payload shape
 * (not just jobId) and reject malformed, oversized, or non-object payloads.
 */

import type { Server as SocketServer, Socket } from 'socket.io';

// ---------------------------------------------------------------------------
// Mock Socket.IO
// ---------------------------------------------------------------------------

function createMockSocket() {
  const events: Record<string, Array<(...args: unknown[]) => void>> = {};
  const emitted: Array<{ event: string; data: unknown }> = [];
  const joinedRooms: string[] = [];
  const leftRooms: string[] = [];

  return {
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      events[event] = events[event] || [];
      events[event].push(handler);
    }),
    emit: jest.fn((event: string, data: unknown) => {
      emitted.push({ event, data });
    }),
    join: jest.fn((room: string) => {
      joinedRooms.push(room);
    }),
    leave: jest.fn((room: string) => {
      leftRooms.push(room);
    }),
    _events: events,
    _emitted: emitted,
    _joinedRooms: joinedRooms,
    _leftRooms: leftRooms,
  };
}

function createMockIo(sockets: ReturnType<typeof createMockSocket>[] = []) {
  const connectionHandlers: Array<(socket: unknown) => void> = [];

  return {
    on: jest.fn((event: string, handler: (socket: unknown) => void) => {
      if (event === 'connection') {
        connectionHandlers.push(handler);
      }
    }),
    _connectionHandlers: connectionHandlers,
    _sockets: sockets,
  };
}

// ---------------------------------------------------------------------------
// Fail-loud lookups (Phase 150 / TASK-0237): replace the `handlers![0]` /
// `errorEmit!` postfix assertions. A missing registration or emission used
// to surface as `undefined is not a function` / an opaque `undefined.data`
// TypeError; the helpers keep the RED verdict naming what was absent.
// ---------------------------------------------------------------------------

function requireFirstHandler(
  events: Record<string, Array<(...args: unknown[]) => void>>,
  event: string,
): (...args: unknown[]) => void {
  const handler = events[event]?.[0];
  if (handler === undefined) {
    throw new Error(`no handler registered for "${event}"`);
  }
  return handler;
}

function requireEmitted(
  emitted: Array<{ event: string; data: unknown }>,
  event: string,
): { event: string; data: unknown } {
  const found = emitted.find(e => e.event === event);
  if (found === undefined) {
    throw new Error(`expected a "${event}" emission, found none`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ISS-042: WebSocket payload validation', () => {
  let mockIo: ReturnType<typeof createMockIo>;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(async () => {
    jest.resetModules();
    mockIo = createMockIo();
    mockSocket = createMockSocket();

    const { registerWebSocketHandler } = await import('@/api/websocket-handler');
    registerWebSocketHandler(mockIo as unknown as SocketServer);

    // Trigger connection
    const handler = mockIo._connectionHandlers[0];
    handler(mockSocket);
  });

  // ---- join:job tests ----

  describe('join:job payload validation', () => {
    it('should reject null payload', () => {
      requireFirstHandler(mockSocket._events, 'join:job')(null);

      const errorEmit = requireEmitted(mockSocket._emitted, 'error');
      expect((errorEmit.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject undefined payload', () => {
      requireFirstHandler(mockSocket._events, 'join:job')(undefined);

      requireEmitted(mockSocket._emitted, 'error');
    });

    it('should reject array payload', () => {
      requireFirstHandler(mockSocket._events, 'join:job')([{ jobId: 'valid' }]);

      const errorEmit = requireEmitted(mockSocket._emitted, 'error');
      expect((errorEmit.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject payload with missing jobId', () => {
      requireFirstHandler(mockSocket._events, 'join:job')({ notJobId: 'foo' });

      const errorEmit = requireEmitted(mockSocket._emitted, 'error');
      expect((errorEmit.data as { message: string }).message).toContain('Missing required field: jobId');
    });

    it('should reject payload with too many fields (max 20)', () => {
      const oversizedPayload: Record<string, string> = { jobId: '550e8400-e29b-41d4-a716-446655440000' };
      for (let i = 0; i < 20; i++) {
        oversizedPayload[`extra${i}`] = `value${i}`;
      }

      requireFirstHandler(mockSocket._events, 'join:job')(oversizedPayload);

      const errorEmit = requireEmitted(mockSocket._emitted, 'error');
      expect((errorEmit.data as { message: string }).message).toContain('too many fields');
    });

    it('should accept valid payload and join room', () => {
      requireFirstHandler(mockSocket._events, 'join:job')({ jobId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(mockSocket._joinedRooms).toContain('job:550e8400-e29b-41d4-a716-446655440000');
      const joinedEmit = mockSocket._emitted.find(e => e.event === 'job:joined');
      expect(joinedEmit).toBeDefined();
    });
  });

  // ---- leave:job tests ----

  describe('leave:job payload validation', () => {
    it('should reject non-object payload for leave:job', () => {
      requireFirstHandler(mockSocket._events, 'leave:job')('string-payload');

      const errorEmit = requireEmitted(mockSocket._emitted, 'error');
      expect((errorEmit.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject number payload for leave:job', () => {
      requireFirstHandler(mockSocket._events, 'leave:job')(12345);

      requireEmitted(mockSocket._emitted, 'error');
    });

    it('should accept valid payload and leave room', () => {
      requireFirstHandler(mockSocket._events, 'leave:job')({ jobId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(mockSocket._leftRooms).toContain('job:550e8400-e29b-41d4-a716-446655440000');
      const leftEmit = mockSocket._emitted.find(e => e.event === 'job:left');
      expect(leftEmit).toBeDefined();
    });
  });
});
