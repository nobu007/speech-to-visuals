---
title: Module src-transcription
genre: repository-analysis
type: entity
sources:
  - extract-skill-meta planning artifacts
related:
  - Module Index
  - Repository Risk Register
  - File Inventory
created: 2026-05-20
updated: 2026-05-20
status: generated
---
# Module src-transcription

## Role

- Rationale: Files under src form a shared path-level boundary.
- Roots: src
- Languages: typescript
- Files: 15
- Bytes: 230655

## Key Files

- `src/transcription/audio-preprocessor.ts`
- `src/transcription/browser-transcriber.ts`
- `src/transcription/index.ts`
- `src/transcription/srt-generator.ts`
- `src/transcription/streaming-quality-monitor.ts`
- `src/transcription/streaming-transcriber.ts`
- `src/transcription/transcriber.ts`
- `src/transcription/types.ts`

## Risk Signals

- RISK-0752 (medium, Parser Or Heuristic) in `src/transcription/__tests__/audio-preprocessor.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L329: // 16000 bytes ≈ 1 second at 128kbps heuristic
- RISK-0753 (low, High Attention File) in `src/transcription/__tests__/audio-preprocessor.test.ts`: The digest found several implementation signals worth manual review. Evidence: L10: * 6. Buffer-size fallback estimation
- RISK-0754 (medium, Concurrency Or Timing) in `src/transcription/__tests__/browser-transcriber.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L184: it('getBrowserCompatibility() がブラウザ情報を返す', async () => {
- RISK-0755 (low, High Attention File) in `src/transcription/__tests__/browser-transcriber.test.ts`: The digest found several implementation signals worth manual review. Evidence: L5: * Covers: start/stop, interim results, browser compatibility, error handling, pause/resume.
- RISK-0756 (medium, Concurrency Or Timing) in `src/transcription/__tests__/streaming-transcriber.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L131: const loadModule = async () => {
- RISK-0757 (medium, Concurrency Or Timing) in `src/transcription/__tests__/transcriber.test.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L103: it('should return fallback segments when whisper fails', async () => {
- RISK-0758 (medium, Parser Or Heuristic) in `src/transcription/__tests__/transcriber.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L35: // Default: whisper returns failure so fallback segments are used
- RISK-0759 (low, High Attention File) in `src/transcription/__tests__/transcriber.test.ts`: The digest found several implementation signals worth manual review. Evidence: L35: // Default: whisper returns failure so fallback segments are used
- RISK-0760 (medium, Network Or IPC) in `src/transcription/__tests__/whisper-transcriber.test.ts`: Cross-process or network boundaries can fail through protocol, timeout, and trust assumptions. Evidence: L155: // Use generateSrt as proxy for segment handling
- RISK-0761 (medium, Parser Or Heuristic) in `src/transcription/__tests__/whisper-transcriber.test.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L125: // by creating a transcriber that returns Japanese content via the fallback
- RISK-0762 (low, High Attention File) in `src/transcription/__tests__/whisper-transcriber.test.ts`: The digest found several implementation signals worth manual review. Evidence: L123: // We need to use a different approach: override internal method
- RISK-0763 (medium, Parser Or Heuristic) in `src/transcription/audio-preprocessor.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L416: * Assumes ~128kbps MP3-like encoding as a rough heuristic.
- RISK-0764 (low, High Attention File) in `src/transcription/audio-preprocessor.ts`: The digest found several implementation signals worth manual review. Evidence: L140: private readonly config: AudioPreprocessorConfig;
- RISK-0765 (medium, Parser Or Heuristic) in `src/transcription/browser-transcriber.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L27: * Uses Web Speech API and fallback strategies for cross-browser compatibility
- RISK-0766 (medium, Persistence Or State) in `src/transcription/browser-transcriber.ts`: Persistent state needs consistency, schema, and partial-write handling. Evidence: L38: private state: TranscriptionState = 'idle';
- RISK-0767 (low, High Attention File) in `src/transcription/browser-transcriber.ts`: The digest found several implementation signals worth manual review. Evidence: L18: * Browser compatibility info
- RISK-0768 (high, Security Boundary) in `src/transcription/streaming-quality-monitor.ts`: Authentication, authorization, or credential handling can create trust-boundary failures. Evidence: L60: /** Alerts emitted during the session */
- RISK-0769 (low, High Attention File) in `src/transcription/streaming-quality-monitor.ts`: The digest found several implementation signals worth manual review. Evidence: L60: /** Alerts emitted during the session */
- RISK-0770 (medium, Concurrency Or Timing) in `src/transcription/streaming-transcriber.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L158: await new Promise(resolve => setTimeout(resolve, 100));
- RISK-0771 (low, High Attention File) in `src/transcription/streaming-transcriber.ts`: The digest found several implementation signals worth manual review. Evidence: L41: private config: StreamingTranscriptionConfig;
- RISK-0772 (medium, Concurrency Or Timing) in `src/transcription/transcriber.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L96: private async runWhisperTranscription(audioPath: string): Promise<TranscriptionSegment[]> {
- RISK-0773 (medium, Parser Or Heuristic) in `src/transcription/transcriber.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L93: * Enhanced transcription using Whisper with fallback strategies
- RISK-0774 (low, High Attention File) in `src/transcription/transcriber.ts`: The digest found several implementation signals worth manual review. Evidence: L13: private config: TranscriptionConfig;
- RISK-0775 (medium, Concurrency Or Timing) in `src/transcription/whisper-transcriber.ts`: Timing-sensitive code needs retry, cancellation, and race-condition review. Evidence: L77: private async initializeWhisper(): Promise<void> {
- RISK-0776 (medium, Parser Or Heuristic) in `src/transcription/whisper-transcriber.ts`: Parsing and heuristics are often brittle around malformed or adversarial input. Evidence: L54: * Real implementation with fallback strategies (段階的フォールバック)
- RISK-0777 (low, High Attention File) in `src/transcription/whisper-transcriber.ts`: The digest found several implementation signals worth manual review. Evidence: L54: * Real implementation with fallback strategies (段階的フォールバック)

## Files

- `src/transcription/__tests__/audio-preprocessor.test.ts` — typescript, 389 lines, attention 100
- `src/transcription/__tests__/browser-transcriber.test.ts` — typescript, 1423 lines, attention 100
- `src/transcription/__tests__/srt-generator.test.ts` — typescript, 240 lines, attention 0
- `src/transcription/__tests__/streaming-transcriber.test.ts` — typescript, 1667 lines, attention 14
- `src/transcription/__tests__/transcriber.test.ts` — typescript, 284 lines, attention 100
- `src/transcription/__tests__/whisper-transcriber.test.ts` — typescript, 307 lines, attention 98
- `src/transcription/audio-preprocessor.ts` — typescript, 444 lines, attention 98
- `src/transcription/browser-transcriber.ts` — typescript, 492 lines, attention 100
- `src/transcription/index.ts` — typescript, 34 lines, attention 0
- `src/transcription/srt-generator.ts` — typescript, 79 lines, attention 0
- `src/transcription/streaming-quality-monitor.ts` — typescript, 270 lines, attention 100
- `src/transcription/streaming-transcriber.ts` — typescript, 469 lines, attention 100
- `src/transcription/transcriber.ts` — typescript, 343 lines, attention 100
- `src/transcription/types.ts` — typescript, 78 lines, attention 14
- `src/transcription/whisper-transcriber.ts` — typescript, 435 lines, attention 100
