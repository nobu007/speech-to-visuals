/**
 * @jest-environment jsdom
 *
 * TASK-0159: AudioUploader component unit tests.
 * Covers file selection, validation errors, duration validation,
 * drag-and-drop, centralized validation integration, and processing state.
 */
import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockValidateAudioFile = jest.fn();
const mockValidateAudioDuration = jest.fn();

jest.unstable_mockModule('@stv/core/utils/audio-validation', () => ({
  validateAudioFile: mockValidateAudioFile,
  validateAudioDuration: mockValidateAudioDuration,
  MIN_AUDIO_DURATION_SECONDS: 1,
}));

jest.unstable_mockModule('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => React.createElement('button', { onClick, disabled, ...props }, children),
}));

jest.unstable_mockModule('@/components/ui/card', () => ({
  Card: ({ children, ...props }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('div', props, children),
}));

jest.unstable_mockModule('@stv/core/lib/utils', () => ({
  cn: (...args: (string | undefined | false)[]) => args.filter(Boolean).join(' '),
}));

const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

jest.unstable_mockModule('sonner', () => ({
  toast: {
    error: mockToastError,
    warning: mockToastWarning,
  },
}));

jest.unstable_mockModule('lucide-react', () => ({
  Upload: () => React.createElement('svg', { 'data-testid': 'icon-upload' }),
  FileAudio: () => React.createElement('svg', { 'data-testid': 'icon-file-audio' }),
}));

const mockLoggerWarn = jest.fn();

jest.unstable_mockModule('@stv/core/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: mockLoggerWarn,
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic imports (after mocks)
// ---------------------------------------------------------------------------

const { AudioUploader } = await import('@/components/AudioUploader');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAudioFile(
  name = 'test.mp3',
  type = 'audio/mpeg',
  size = 1024,
): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function selectFileViaInput(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const fileList = { 0: file, length: 1, item: () => file };
  Object.defineProperty(input, 'files', { value: fileList, configurable: true });
  fireEvent.change(input);
}

let mockAudioDuration = 30;

function setupAudioMock(duration: number) {
  mockAudioDuration = duration;
  const g = globalThis as typeof globalThis & { Audio?: unknown };
  g.Audio = jest.fn().mockImplementation(() => {
    const instance: Record<string, (() => void) | null> = {
      onloadedmetadata: null,
      onerror: null,
    };
    Object.defineProperty(instance, 'duration', {
      get: () => mockAudioDuration,
      configurable: true,
    });
    Object.defineProperty(instance, 'src', {
      set(_val: string) {
        queueMicrotask(() => {
          if (instance.onloadedmetadata) instance.onloadedmetadata();
        });
      },
      configurable: true,
    });
    return instance;
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const g = globalThis as typeof globalThis & { Audio?: unknown };
const originalAudio = g.Audio;

beforeEach(() => {
  jest.clearAllMocks();
  mockAudioDuration = 30;

  mockValidateAudioFile.mockReturnValue({ valid: true, errors: [], warnings: [] });
  mockValidateAudioDuration.mockReturnValue({ valid: true, errors: [], warnings: [] });

  setupAudioMock(30);

  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn().mockReturnValue('blob:mock'),
      configurable: true,
      writable: true,
    });
  } else {
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  }
  if (!URL.revokeObjectURL) {
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: jest.fn(),
      configurable: true,
      writable: true,
    });
  } else {
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  }
});

afterEach(() => {
  (globalThis as typeof globalThis & { Audio?: unknown }).Audio = originalAudio;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AudioUploader', () => {
  const defaultProps = {
    onUpload: jest.fn(),
    isProcessing: false,
  };

  // =========================================================================
  // Rendering
  // =========================================================================

  describe('rendering', () => {
    it('renders upload area with heading text', () => {
      render(React.createElement(AudioUploader, defaultProps));
      expect(screen.getByText('音声ファイルをアップロード')).toBeInTheDocument();
    });

    it('renders file selection button', () => {
      render(React.createElement(AudioUploader, defaultProps));
      expect(screen.getByText('ファイルを選択')).toBeInTheDocument();
    });

    it('renders hidden file input with audio/* accept', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('accept', 'audio/*');
    });

    it('shows upload icon when no file selected', () => {
      render(React.createElement(AudioUploader, defaultProps));
      expect(screen.getByTestId('icon-upload')).toBeInTheDocument();
    });

    it('shows file audio icon when file is selected', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('speech.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByTestId('icon-file-audio')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Processing state
  // =========================================================================

  describe('processing state', () => {
    it('disables file selection button when isProcessing is true', () => {
      render(React.createElement(AudioUploader, { ...defaultProps, isProcessing: true }));
      expect(screen.getByText('ファイルを選択')).toBeDisabled();
    });

    it('disables cancel button when isProcessing is true', async () => {
      const { container, rerender } = render(
        React.createElement(AudioUploader, { ...defaultProps, isProcessing: false }),
      );
      const file = createAudioFile('speech.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      // Re-render with isProcessing = true (preserves state)
      rerender(
        React.createElement(AudioUploader, { ...defaultProps, isProcessing: true }),
      );

      expect(screen.getByText('キャンセル')).toBeDisabled();
    });

    it('disables upload button when isProcessing is true', async () => {
      const { container, rerender } = render(
        React.createElement(AudioUploader, { ...defaultProps, isProcessing: false }),
      );
      const file = createAudioFile('speech.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      rerender(
        React.createElement(AudioUploader, { ...defaultProps, isProcessing: true }),
      );

      expect(screen.getByText('処理を開始')).toBeDisabled();
    });
  });

  // =========================================================================
  // Normal file selection
  // =========================================================================

  describe('normal file selection', () => {
    it('displays file name after selecting a valid MP3 file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('recording.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('recording.mp3')).toBeInTheDocument();
    });

    it('displays file name after selecting a valid WAV file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('audio.wav', 'audio/wav');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('audio.wav')).toBeInTheDocument();
    });

    it('displays file name after selecting a valid OGG file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('sound.ogg', 'audio/ogg');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('sound.ogg')).toBeInTheDocument();
    });

    it('displays file name after selecting a valid M4A file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('voice.m4a', 'audio/mp4');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('voice.m4a')).toBeInTheDocument();
    });

    it('displays file size in MB', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('big.mp3', 'audio/mpeg', 5 * 1024 * 1024);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText(/サイズ:.*5\.00 MB/)).toBeInTheDocument();
    });

    it('calls onUpload callback when upload button is clicked', async () => {
      const onUpload = jest.fn();
      const { container } = render(
        React.createElement(AudioUploader, { ...defaultProps, onUpload }),
      );
      const file = createAudioFile('test.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('処理を開始'));
      });

      expect(onUpload).toHaveBeenCalledWith(file);
    });

    it('clears selection after upload', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('test.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('test.mp3')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('処理を開始'));
      });

      expect(screen.queryByText('test.mp3')).not.toBeInTheDocument();
      expect(screen.getByText('音声ファイルをアップロード')).toBeInTheDocument();
    });

    it('clears selection when cancel button is clicked', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('test.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('test.mp3')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('キャンセル'));
      });

      expect(screen.queryByText('test.mp3')).not.toBeInTheDocument();
      expect(screen.getByText('音声ファイルをアップロード')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Drag and drop
  // =========================================================================

  describe('drag and drop', () => {
    it('accepts audio file via drop', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('dropped.mp3');
      const dropZone = container.querySelector('[class*="border-dashed"]')!;

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('dropped.mp3')).toBeInTheDocument();
    });

    it('rejects non-audio file via drop with error toast', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = new File([new ArrayBuffer(100)], 'document.pdf', { type: 'application/pdf' });
      const dropZone = container.querySelector('[class*="border-dashed"]')!;

      act(() => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file] },
        });
      });

      expect(mockToastError).toHaveBeenCalledWith('音声ファイルを選択してください');
    });

    it('selects first audio file from mixed drop', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const pdf = new File([new ArrayBuffer(100)], 'doc.pdf', { type: 'application/pdf' });
      const mp3 = createAudioFile('audio.mp3');
      const dropZone = container.querySelector('[class*="border-dashed"]')!;

      await act(async () => {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [pdf, mp3] },
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(screen.getByText('audio.mp3')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Validation errors (file-level)
  // =========================================================================

  describe('validation errors — empty file (EDGE-001)', () => {
    it('rejects empty file and shows error via toast', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const emptyFile = new File([], 'empty.mp3', { type: 'audio/mpeg' });

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Audio file is empty (0 bytes)'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, emptyFile);
      });

      expect(mockValidateAudioFile).toHaveBeenCalledWith(emptyFile);
      expect(mockToastError).toHaveBeenCalledWith('Audio file is empty (0 bytes)');
      expect(screen.queryByText('empty.mp3')).not.toBeInTheDocument();
    });

    it('does not call onUpload for empty file', () => {
      const onUpload = jest.fn();
      const { container } = render(
        React.createElement(AudioUploader, { ...defaultProps, onUpload }),
      );
      const emptyFile = new File([], 'empty.wav', { type: 'audio/wav' });

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Audio file is empty (0 bytes)'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, emptyFile);
      });

      expect(onUpload).not.toHaveBeenCalled();
    });
  });

  describe('validation errors — size exceeded (EDGE-101)', () => {
    it('rejects file exceeding 50MB and shows error', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const largeFile = createAudioFile('huge.mp3', 'audio/mpeg', 1024);

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['File size 51.0MB exceeds maximum allowed size 50MB'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, largeFile);
      });

      expect(mockValidateAudioFile).toHaveBeenCalledWith(largeFile);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('exceeds maximum'),
      );
      expect(screen.queryByText('huge.mp3')).not.toBeInTheDocument();
    });
  });

  describe('validation errors — unsupported format', () => {
    it('rejects non-audio file type with error toast', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const textFile = new File([new ArrayBuffer(100)], 'notes.txt', { type: 'text/plain' });

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Unsupported audio file: "notes.txt" (type: text/plain)'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, textFile);
      });

      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported'),
      );
      expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
    });

    it('shows multiple validation errors at once', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const badFile = new File([], 'doc.pdf', { type: 'application/pdf' });

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: [
          'Audio file is empty (0 bytes)',
          'Unsupported audio file: "doc.pdf" (type: application/pdf)',
        ],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, badFile);
      });

      expect(mockToastError).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Duration validation
  // =========================================================================

  describe('duration validation — sub-1s rejection (EDGE-102)', () => {
    it('rejects audio shorter than 1 second', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('short.mp3');

      mockValidateAudioDuration.mockReturnValue({
        valid: false,
        errors: ['Audio duration 0.50s is below minimum 1s'],
        warnings: [],
      });

      setupAudioMock(0.5);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(0.5);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('below minimum'),
      );
      expect(screen.queryByText('short.mp3')).not.toBeInTheDocument();
    });

    it('rejects zero-duration audio', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('zero.mp3');

      mockValidateAudioDuration.mockReturnValue({
        valid: false,
        errors: ['Audio duration 0.00s is below minimum 1s'],
        warnings: [],
      });

      setupAudioMock(0);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(0);
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining('below minimum'),
      );
    });
  });

  describe('duration validation — long audio warning (EDGE-103)', () => {
    it('shows warning for audio exceeding 1 hour but still selects the file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('long-lecture.mp3');

      mockValidateAudioDuration.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Audio duration 61min exceeds recommended maximum of 60min'],
      });

      setupAudioMock(3660);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(3660);
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining('exceeds recommended maximum'),
      );
      // File should still be selected (warning, not error)
      expect(screen.getByText('long-lecture.mp3')).toBeInTheDocument();
    });

    it('accepts audio exactly at 1 hour without warning', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('hour.mp3');

      mockValidateAudioDuration.mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      setupAudioMock(3600);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(3600);
      expect(mockToastWarning).not.toHaveBeenCalled();
      expect(screen.getByText('hour.mp3')).toBeInTheDocument();
    });

    it('accepts normal duration audio without warning', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('normal.mp3');

      setupAudioMock(30);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(30);
      expect(mockToastWarning).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
      expect(screen.getByText('normal.mp3')).toBeInTheDocument();
    });
  });

  describe('duration validation — fallback on audio load failure', () => {
    it('still selects file if duration cannot be determined', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('unknown.mp3');

      // Mock Audio that triggers onerror
      (globalThis as typeof globalThis & { Audio?: unknown }).Audio = jest.fn().mockImplementation(() => {
        const instance: Record<string, (() => void) | null> = {
          onloadedmetadata: null,
          onerror: null,
        };
        Object.defineProperty(instance, 'src', {
          set(_val: string) {
            queueMicrotask(() => {
              if (instance.onerror) instance.onerror();
            });
          },
          configurable: true,
        });
        return instance;
      });

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      // File should still be selected even if duration validation fails
      expect(screen.getByText('unknown.mp3')).toBeInTheDocument();
      expect(mockValidateAudioDuration).not.toHaveBeenCalled();
    });

    it('logs warning when duration cannot be determined', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('unknown.mp3');

      // Mock Audio that triggers onerror
      (globalThis as typeof globalThis & { Audio?: unknown }).Audio = jest.fn().mockImplementation(() => {
        const instance: Record<string, (() => void) | null> = {
          onloadedmetadata: null,
          onerror: null,
        };
        Object.defineProperty(instance, 'src', {
          set(_val: string) {
            queueMicrotask(() => {
              if (instance.onerror) instance.onerror();
            });
          },
          configurable: true,
        });
        return instance;
      });

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('[AudioUploader] Could not determine audio duration'),
        expect.any(Error),
      );
    });
  });

  // =========================================================================
  // Centralized validation integration
  // =========================================================================

  describe('centralized validation integration', () => {
    it('calls validateAudioFile with the selected file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('test.mp3');

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioFile).toHaveBeenCalledWith(file);
    });

    it('calls validateAudioDuration with the file duration', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('test.mp3');

      setupAudioMock(45.5);

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockValidateAudioDuration).toHaveBeenCalledWith(45.5);
    });

    it('displays error messages matching centralized validation output', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('bad.mp3');

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Audio file is empty (0 bytes)', 'Unsupported audio file'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, file);
      });

      // Both error messages should be displayed via toast
      expect(mockToastError).toHaveBeenCalledWith('Audio file is empty (0 bytes)');
      expect(mockToastError).toHaveBeenCalledWith('Unsupported audio file');
    });

    it('shows warnings from centralized validation while still selecting file', async () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('warn.mp3');

      mockValidateAudioFile.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['File has unusual encoding'],
      });

      await act(async () => {
        selectFileViaInput(container, file);
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockToastWarning).toHaveBeenCalledWith('File has unusual encoding');
      // File still selected despite warning
      expect(screen.getByText('warn.mp3')).toBeInTheDocument();
    });

    it('does not select file when validateAudioFile returns invalid', () => {
      const { container } = render(React.createElement(AudioUploader, defaultProps));
      const file = createAudioFile('bad.mp3');

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Audio file is empty (0 bytes)'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, file);
      });

      // validateAudioDuration should NOT be called since file validation failed
      expect(mockValidateAudioDuration).not.toHaveBeenCalled();
    });

    it('does not call onUpload when file validation fails', () => {
      const onUpload = jest.fn();
      const { container } = render(
        React.createElement(AudioUploader, { ...defaultProps, onUpload }),
      );
      const file = createAudioFile('bad.mp3');

      mockValidateAudioFile.mockReturnValue({
        valid: false,
        errors: ['Error'],
        warnings: [],
      });

      act(() => {
        selectFileViaInput(container, file);
      });

      expect(onUpload).not.toHaveBeenCalled();
    });
  });
});
