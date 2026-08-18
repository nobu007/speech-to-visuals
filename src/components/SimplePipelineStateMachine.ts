/**
 * State Machine for SimplePipelineInterface
 * Manages 7-state transitions: idle -> uploading -> transcribing -> analyzing -> generating -> complete
 * Any state can transition to error, error -> idle for retry/reset
 */

import { ProcessingStatus } from '@stv/core/types/pipeline';

// ========================================
// State Machine Types
// ========================================

export interface PipelineState {
  status: ProcessingStatus;
  file: File | null;
  progress: number;
  currentStep: string;
  error: string | null;
  result: SimplePipelineResult | null;
}

export interface SimplePipelineResult {
  success: boolean;
  audioUrl?: string;
  transcript?: string;
  scenes?: Record<string, unknown>[];
  videoUrl?: string;
  error?: string;
  processingTime?: number;
}

export type PipelineAction =
  | { type: 'SELECT_FILE'; file: File }
  | { type: 'START_PROCESSING' }
  | { type: 'UPLOAD_START' }
  | { type: 'TRANSCRIBE_START' }
  | { type: 'ANALYZE_START' }
  | { type: 'GENERATE_START' }
  | { type: 'SET_PROGRESS'; step: string; progress: number }
  | { type: 'PROCESSING_COMPLETE'; result: SimplePipelineResult }
  | { type: 'PROCESSING_ERROR'; error: string }
  | { type: 'RESET' }
  | { type: 'RETRY' };

// ========================================
// Initial State
// ========================================

export const initialPipelineState: PipelineState = {
  status: 'idle',
  file: null,
  progress: 0,
  currentStep: '',
  error: null,
  result: null,
};

// ========================================
// Valid Transitions
// ========================================

const VALID_TRANSITIONS: Record<ProcessingStatus, ProcessingStatus[]> = {
  idle: ['uploading'],
  uploading: ['transcribing', 'error'],
  transcribing: ['analyzing', 'error'],
  analyzing: ['generating', 'error'],
  generating: ['complete', 'error'],
  complete: [],
  error: ['idle'],
};

function isValidTransition(from: ProcessingStatus, to: ProcessingStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ========================================
// Reducer
// ========================================

export function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case 'SELECT_FILE':
      return {
        ...state,
        file: action.file,
        error: null,
        result: null,
      };

    case 'START_PROCESSING': {
      if (state.status !== 'idle') return state;
      const nextStatus: ProcessingStatus = 'uploading';
      if (!isValidTransition(state.status, nextStatus)) return state;
      return {
        ...state,
        status: nextStatus,
        progress: 0,
        currentStep: '処理を開始しています...',
        error: null,
      };
    }

    case 'UPLOAD_START': {
      if (!isValidTransition(state.status, 'uploading')) return state;
      return {
        ...state,
        status: 'uploading',
        currentStep: 'ファイルをアップロード中...',
        progress: 10,
      };
    }

    case 'TRANSCRIBE_START': {
      if (!isValidTransition(state.status, 'transcribing')) return state;
      return {
        ...state,
        status: 'transcribing',
        currentStep: '音声を文字起こし中...',
        progress: 30,
      };
    }

    case 'ANALYZE_START': {
      if (!isValidTransition(state.status, 'analyzing')) return state;
      return {
        ...state,
        status: 'analyzing',
        currentStep: '図解分析中...',
        progress: 60,
      };
    }

    case 'GENERATE_START': {
      if (!isValidTransition(state.status, 'generating')) return state;
      return {
        ...state,
        status: 'generating',
        currentStep: '動画生成中...',
        progress: 85,
      };
    }

    case 'SET_PROGRESS': {
      return {
        ...state,
        currentStep: action.step,
        progress: action.progress,
      };
    }

    case 'PROCESSING_COMPLETE': {
      if (!isValidTransition(state.status, 'complete')) return state;
      return {
        ...state,
        status: 'complete',
        progress: 100,
        currentStep: '処理完了！',
        result: action.result,
      };
    }

    case 'PROCESSING_ERROR': {
      return {
        ...state,
        status: 'error',
        error: action.error,
      };
    }

    case 'RESET': {
      return {
        ...initialPipelineState,
      };
    }

    case 'RETRY': {
      if (state.status !== 'error') return state;
      return {
        ...initialPipelineState,
      };
    }

    default:
      return state;
  }
}
