/**
 * ISS-042: WebSocket payload validation tests
 *
 * Verifies that WebSocket event handlers validate payload shape
 * (not just jobId) and reject malformed, oversized, or non-object payloads.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      events[event] = events[event] || [];
      events[event].push(handler);
    }),
    emit: vi.fn((event: string, data: unknown) => {
      emitted.push({ event, data });
    }),
    join: vi.fn((room: string) => {
      joinedRooms.push(room);
    }),
    leave: vi.fn((room: string) => {
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
    on: vi.fn((event: string, handler: (socket: unknown) => void) => {
      if (event === 'connection') {
        connectionHandlers.push(handler);
      }
    }),
    _connectionHandlers: connectionHandlers,
    _sockets: sockets,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ISS-042: WebSocket payload validation', () => {
  let mockIo: ReturnType<typeof createMockIo>;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(async () => {
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
      const handlers = mockSocket._events['join:job'];
      expect(handlers).toBeDefined();
      handlers![0](null);

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
      expect((errorEmit!.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject undefined payload', () => {
      const handlers = mockSocket._events['join:job'];
      handlers![0](undefined);

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
    });

    it('should reject array payload', () => {
      const handlers = mockSocket._events['join:job'];
      handlers![0]([{ jobId: 'valid' }]);

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
      expect((errorEmit!.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject payload with missing jobId', () => {
      const handlers = mockSocket._events['join:job'];
      handlers![0]({ notJobId: 'foo' });

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
      expect((errorEmit!.data as { message: string }).message).toContain('Missing required field: jobId');
    });

    it('should reject payload with too many fields (max 20)', () => {
      const oversizedPayload: Record<string, string> = { jobId: '550e8400-e29b-41d4-a716-446655440000' };
      for (let i = 0; i < 20; i++) {
        oversizedPayload[`extra${i}`] = `value${i}`;
      }

      const handlers = mockSocket._events['join:job'];
      handlers![0](oversizedPayload);

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
      expect((errorEmit!.data as { message: string }).message).toContain('too many fields');
    });

    it('should accept valid payload and join room', () => {
      const handlers = mockSocket._events['join:job'];
      handlers![0]({ jobId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(mockSocket._joinedRooms).toContain('job:550e8400-e29b-41d4-a716-446655440000');
      const joinedEmit = mockSocket._emitted.find(e => e.event === 'job:joined');
      expect(joinedEmit).toBeDefined();
    });
  });

  // ---- leave:job tests ----

  describe('leave:job payload validation', () => {
    it('should reject non-object payload for leave:job', () => {
      const handlers = mockSocket._events['leave:job'];
      expect(handlers).toBeDefined();
      handlers![0]('string-payload');

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
      expect((errorEmit!.data as { message: string }).message).toContain('non-null object');
    });

    it('should reject number payload for leave:job', () => {
      const handlers = mockSocket._events['leave:job'];
      handlers![0](12345);

      const errorEmit = mockSocket._emitted.find(e => e.event === 'error');
      expect(errorEmit).toBeDefined();
    });

    it('should accept valid payload and leave room', () => {
      const handlers = mockSocket._events['leave:job'];
      handlers![0]({ jobId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(mockSocket._leftRooms).toContain('job:550e8400-e29b-41d4-a716-446655440000');
      const leftEmit = mockSocket._emitted.find(e => e.event === 'job:left');
      expect(leftEmit).toBeDefined();
    });
  });
});
