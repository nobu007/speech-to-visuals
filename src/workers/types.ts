/**
 * Web Worker Message Types
 *
 * Defines the communication protocol between main thread and workers.
 * All data transferred between threads must be serializable (plain objects only).
 */

/** Worker message type identifiers for different processing categories */
export type WorkerMessageType =
  | 'EXPORT_RENDER'
  | 'LAYOUT_COMPUTE'
  | 'EXPORT_PROGRESS'
  | 'LAYOUT_PROGRESS';

/** Error structure returned from worker processing */
export interface WorkerError {
  code: string;
  message: string;
  stack?: string;
}

/** Message sent from main thread to worker */
export interface WorkerMessage<T = unknown> {
  id: string;
  type: WorkerMessageType;
  payload: T;
}

/** Response returned from worker to main thread */
export interface WorkerResponse<T = unknown> {
  id: string;
  type: WorkerMessageType;
  payload?: T;
  error?: WorkerError;
}

/** Payload for export render requests */
export interface ExportWorkerPayload {
  format: string;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
}

/** Response from export render processing */
export interface ExportWorkerResult {
  blobUrl?: string;
  outputSize?: number;
  duration?: number;
  warnings?: string[];
}

/** Payload for layout computation requests */
export interface LayoutWorkerPayload {
  nodes: Array<{ id: string; width: number; height: number; label?: string }>;
  edges: Array<{ source: string; target: string }>;
  config: {
    width: number;
    height: number;
    rankDirection: string;
    nodeSeparation: number;
    rankSeparation: number;
  };
}

/** Response from layout computation */
export interface LayoutWorkerResult {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ source: string; target: string; points?: Array<{ x: number; y: number }> }>;
  width: number;
  height: number;
}
