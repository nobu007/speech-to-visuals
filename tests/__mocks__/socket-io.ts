/**
 * Mock for Socket.IO server used in WebSocket handler tests.
 */

export interface MockSocket {
  id: string;
  handshake: { auth: { token?: string } };
  data: Record<string, unknown>;
  on: jest.Mock;
  emit: jest.Mock;
  join: jest.Mock;
  leave: jest.Mock;
  disconnect: jest.Mock;
}

export interface MockIo {
  on: jest.Mock;
  to: jest.Mock;
  emit: jest.Mock;
}

export function createMockSocket(): MockSocket {
  return {
    id: 'socket-1',
    handshake: { auth: {} },
    data: {},
    on: jest.fn(),
    emit: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
  };
}

export function createMockIo(): MockIo {
  return {
    on: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    emit: jest.fn(),
  };
}
