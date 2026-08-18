/**
 * Tests for SimplePipelineInterface
 * Tests state machine transitions and component logic
 * Uses node test environment (no DOM rendering)
 */

import {
  pipelineReducer,
  initialPipelineState,
  PipelineState,
  PipelineAction,
} from '../SimplePipelineStateMachine';
import { ProcessingStatus } from '@stv/core/types/pipeline';

// Helper to create a mock File
function createMockFile(name = 'test.mp3', size = 1024 * 1024, type = 'audio/mp3'): File {
  return new File([''], name, { type, lastModified: Date.now() });
}

// ========================================
// Test Suite: State Machine Initial State
// ========================================

describe('SimplePipelineInterface State Machine', () => {
  describe('initial state', () => {
    it('should have idle status', () => {
      expect(initialPipelineState.status).toBe('idle');
    });

    it('should have no file selected', () => {
      expect(initialPipelineState.file).toBeNull();
    });

    it('should have zero progress', () => {
      expect(initialPipelineState.progress).toBe(0);
    });

    it('should have no error', () => {
      expect(initialPipelineState.error).toBeNull();
    });

    it('should have no result', () => {
      expect(initialPipelineState.result).toBeNull();
    });

    it('should have empty currentStep', () => {
      expect(initialPipelineState.currentStep).toBe('');
    });
  });

  // ========================================
  // Test Suite: State Transitions
  // ========================================

  describe('state transitions: idle -> uploading -> transcribing -> analyzing -> generating -> complete', () => {
    it('should transition from idle to uploading on START_PROCESSING', () => {
      const state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      expect(state.status).toBe('uploading');
      expect(state.progress).toBe(0);
      expect(state.error).toBeNull();
    });

    it('should transition from uploading to transcribing on TRANSCRIBE_START', () => {
      const uploadingState = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      const transcribingState = pipelineReducer(uploadingState, { type: 'TRANSCRIBE_START' });
      expect(transcribingState.status).toBe('transcribing');
      expect(transcribingState.progress).toBe(30);
      expect(transcribingState.currentStep).toContain('文字起こし');
    });

    it('should transition from transcribing to analyzing on ANALYZE_START', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      expect(state.status).toBe('analyzing');
      expect(state.progress).toBe(60);
      expect(state.currentStep).toContain('分析');
    });

    it('should transition from analyzing to generating on GENERATE_START', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      expect(state.status).toBe('generating');
      expect(state.progress).toBe(85);
      expect(state.currentStep).toContain('動画生成');
    });

    it('should transition from generating to complete on PROCESSING_COMPLETE', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true, processingTime: 5000 },
      });
      expect(state.status).toBe('complete');
      expect(state.progress).toBe(100);
      expect(state.result).not.toBeNull();
      expect(state.result?.success).toBe(true);
    });

    it('should complete full pipeline flow from idle to complete', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      expect(state.status).toBe('uploading');

      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      expect(state.status).toBe('transcribing');

      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      expect(state.status).toBe('analyzing');

      state = pipelineReducer(state, { type: 'GENERATE_START' });
      expect(state.status).toBe('generating');

      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true, processingTime: 10000, scenes: [] },
      });
      expect(state.status).toBe('complete');
      expect(state.progress).toBe(100);
    });
  });

  // ========================================
  // Test Suite: Error Transitions
  // ========================================

  describe('error transitions', () => {
    it('should transition from uploading to error', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Upload failed' });
      expect(state.status).toBe('error');
      expect(state.error).toBe('Upload failed');
    });

    it('should transition from transcribing to error', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Transcription failed' });
      expect(state.status).toBe('error');
      expect(state.error).toBe('Transcription failed');
    });

    it('should transition from analyzing to error', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Analysis failed' });
      expect(state.status).toBe('error');
      expect(state.error).toBe('Analysis failed');
    });

    it('should transition from generating to error', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Video generation failed' });
      expect(state.status).toBe('error');
      expect(state.error).toBe('Video generation failed');
    });
  });

  // ========================================
  // Test Suite: Error Recovery
  // ========================================

  describe('error recovery', () => {
    it('should transition from error to idle on RETRY', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Something went wrong' });
      expect(state.status).toBe('error');

      state = pipelineReducer(state, { type: 'RETRY' });
      expect(state.status).toBe('idle');
      expect(state.error).toBeNull();
      expect(state.file).toBeNull();
      expect(state.result).toBeNull();
    });

    it('should transition from error to idle on RESET', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Error' });

      state = pipelineReducer(state, { type: 'RESET' });
      expect(state.status).toBe('idle');
    });

    it('should not allow RETRY from non-error state', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      const before = { ...state };
      state = pipelineReducer(state, { type: 'RETRY' });
      // State should remain unchanged since retry only works from error
      expect(state.status).toBe(before.status);
    });
  });

  // ========================================
  // Test Suite: Reset
  // ========================================

  describe('reset', () => {
    it('should reset to initial state from any processing state', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'RESET' });
      expect(state.status).toBe('idle');
      expect(state.progress).toBe(0);
      expect(state.file).toBeNull();
      expect(state.error).toBeNull();
    });

    it('should reset to initial state from complete state', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true },
      });
      expect(state.status).toBe('complete');

      state = pipelineReducer(state, { type: 'RESET' });
      expect(state.status).toBe('idle');
      expect(state.result).toBeNull();
    });
  });

  // ========================================
  // Test Suite: File Selection
  // ========================================

  describe('file selection', () => {
    it('should store selected file', () => {
      const mockFile = createMockFile('test-audio.mp3');
      const state = pipelineReducer(initialPipelineState, { type: 'SELECT_FILE', file: mockFile });
      expect(state.file).toBe(mockFile);
      expect(state.file?.name).toBe('test-audio.mp3');
    });

    it('should clear error when selecting a new file', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Previous error' });
      expect(state.error).toBe('Previous error');

      const mockFile = createMockFile('new-audio.wav');
      state = pipelineReducer(state, { type: 'SELECT_FILE', file: mockFile });
      expect(state.error).toBeNull();
    });

    it('should clear result when selecting a new file', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true },
      });
      expect(state.result).not.toBeNull();

      state = pipelineReducer(state, { type: 'SELECT_FILE', file: createMockFile() });
      expect(state.result).toBeNull();
    });
  });

  // ========================================
  // Test Suite: Progress Updates
  // ========================================

  describe('progress updates', () => {
    it('should update progress with SET_PROGRESS', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'SET_PROGRESS', step: 'Uploading... 50%', progress: 50 });
      expect(state.progress).toBe(50);
      expect(state.currentStep).toBe('Uploading... 50%');
    });

    it('should not change status on SET_PROGRESS', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      const statusBefore = state.status;
      state = pipelineReducer(state, { type: 'SET_PROGRESS', step: 'Progress update', progress: 75 });
      expect(state.status).toBe(statusBefore);
    });
  });

  // ========================================
  // Test Suite: Invalid Transitions
  // ========================================

  describe('invalid transitions', () => {
    it('should not allow TRANSCRIBE_START from idle', () => {
      const state = pipelineReducer(initialPipelineState, { type: 'TRANSCRIBE_START' });
      expect(state.status).toBe('idle');
    });

    it('should not allow ANALYZE_START from idle', () => {
      const state = pipelineReducer(initialPipelineState, { type: 'ANALYZE_START' });
      expect(state.status).toBe('idle');
    });

    it('should not allow GENERATE_START from idle', () => {
      const state = pipelineReducer(initialPipelineState, { type: 'GENERATE_START' });
      expect(state.status).toBe('idle');
    });

    it('should not allow PROCESSING_COMPLETE from idle', () => {
      const state = pipelineReducer(initialPipelineState, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true },
      });
      expect(state.status).toBe('idle');
    });

    it('should not allow START_PROCESSING from transcribing', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'START_PROCESSING' });
      expect(state.status).toBe('transcribing');
    });

    it('should not allow START_PROCESSING from complete', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, { type: 'PROCESSING_COMPLETE', result: { success: true } });
      state = pipelineReducer(state, { type: 'START_PROCESSING' });
      expect(state.status).toBe('complete');
    });
  });

  // ========================================
  // Test Suite: Complete State Details
  // ========================================

  describe('complete state', () => {
    it('should store result with transcript', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: {
          success: true,
          transcript: 'This is a test transcript',
          scenes: [{ id: 'scene-1', type: 'flow' }],
          processingTime: 5000,
        },
      });

      expect(state.status).toBe('complete');
      expect(state.result?.transcript).toBe('This is a test transcript');
      expect(state.result?.scenes).toHaveLength(1);
      expect(state.result?.processingTime).toBe(5000);
      expect(state.currentStep).toBe('処理完了！');
    });

    it('should store result with video URL', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: {
          success: true,
          videoUrl: 'blob:video-output.mp4',
        },
      });

      expect(state.result?.videoUrl).toBe('blob:video-output.mp4');
    });
  });

  // ========================================
  // Test Suite: All Stage UI Display Data
  // ========================================

  describe('all stages display correct data', () => {
    it('idle stage shows no progress', () => {
      expect(initialPipelineState.status).toBe('idle');
      expect(initialPipelineState.progress).toBe(0);
      expect(initialPipelineState.currentStep).toBe('');
    });

    it('uploading stage has correct step text', () => {
      const state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      expect(state.currentStep).toContain('開始');
    });

    it('transcribing stage has correct step text', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      expect(state.currentStep).toContain('文字起こし');
      expect(state.progress).toBe(30);
    });

    it('analyzing stage has correct step text', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      expect(state.currentStep).toContain('分析');
      expect(state.progress).toBe(60);
    });

    it('generating stage has correct step text', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      expect(state.currentStep).toContain('動画生成');
      expect(state.progress).toBe(85);
    });

    it('complete stage has 100% progress', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'TRANSCRIBE_START' });
      state = pipelineReducer(state, { type: 'ANALYZE_START' });
      state = pipelineReducer(state, { type: 'GENERATE_START' });
      state = pipelineReducer(state, {
        type: 'PROCESSING_COMPLETE',
        result: { success: true },
      });
      expect(state.progress).toBe(100);
      expect(state.currentStep).toBe('処理完了！');
    });

    it('error stage preserves error message', () => {
      let state = pipelineReducer(initialPipelineState, { type: 'START_PROCESSING' });
      state = pipelineReducer(state, { type: 'PROCESSING_ERROR', error: 'Network error' });
      expect(state.error).toBe('Network error');
    });
  });
});
