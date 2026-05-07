/**
 * Mock for Socket.IO server used in WebSocket handler tests.
 */

export interface MockSocket {
  id: string;
  handshake: { auth: { token?: string } };
  data: Record<string, unknown>;
  on: vi.Mock;
  emit: vi.Mock;
  join: vi.Mock;
  leave: vi.Mock;
  disconnect: vi.Mock;
}

export interface MockIo {
  on: vi.Mock;
  to: vi.Mock;
  emit: vi.Mock;
}

export function createMockSocket(): MockSocket {
  return {
    id: 'socket-1',
    handshake: { auth: {} },
    data: {},
    on: vi.fn(),
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    disconnect: vi.fn(),
  };
}

export function createMockIo(): MockIo {
  return {
    on: vi.fn(),
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    emit: vi.fn(),
  };
}
