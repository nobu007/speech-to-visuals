/**
 * WAV header 由来の音声長導出 helper（TASK-0314・REQ-422 RTF 分母の単一ソース）。
 *
 * pure 関数のみで構成する（fs import なし・timestamp なし）— 合成 bytes で test 可能。
 * 戻り値はすべて ms。fs wrapper（readFileSync した bytes を渡す薄い層）は測定 script 側に置く。
 */
import { TranscriptionError } from './types';

/** parseWavHeader が `fmt ` / `data` chunk から抽出した field 群。単位は各 field 名の通り（byteRate は byte/秒・dataChunkSize は byte）。 */
export interface WavHeader {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  bitsPerSample: number;
  dataChunkSize: number;
}

const FMT_CHUNK_ID = 'fmt ';
const DATA_CHUNK_ID = 'data';
const PCM_AUDIO_FORMAT = 1;
const FMT_CHUNK_MIN_SIZE = 16;

/** 4-byte ASCII identifier comparison without byte→string conversion (dead-idiom from-char-code 回避 — 比較は charCodeAt 方向で行う). */
function isAscii(bytes: Uint8Array, offset: number, literal: string): boolean {
  return (
    bytes[offset] === literal.charCodeAt(0) &&
    bytes[offset + 1] === literal.charCodeAt(1) &&
    bytes[offset + 2] === literal.charCodeAt(2) &&
    bytes[offset + 3] === literal.charCodeAt(3)
  );
}

/** Unknown chunk identifier for error messages, as hex (diagnosable without a string conversion). */
function asciiHex(bytes: Uint8Array, offset: number): string {
  const hex = (b: number) => b.toString(16).padStart(2, '0');
  return `0x${hex(bytes[offset])} 0x${hex(bytes[offset + 1])} 0x${hex(bytes[offset + 2])} 0x${hex(bytes[offset + 3])}`;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

/**
 * RIFF chunk walk により WAV header を解析する（`RIFF`/`WAVE` magic 検証 → chunk directory
 * を順に走査し `fmt ` の各 field と `data` の size を取得。chunk 順序に依存しない）。
 *
 * 非 PCM（`audioFormat !== 1`）・magic 欠損・`fmt `/`data` chunk 欠損・chunk size が bytes 長を
 * 超過する場合は throw する（fail-loud — 呼び出し側は file を skipped 扱いにできる）。
 */
export function parseWavHeader(bytes: Uint8Array): WavHeader {
  if (bytes.length < 12 || !isAscii(bytes, 0, 'RIFF') || !isAscii(bytes, 8, 'WAVE')) {
    throw new TranscriptionError(
      'not a RIFF/WAVE byte sequence (magic missing or shorter than the 12-byte header)',
    );
  }

  let fmt: Omit<WavHeader, 'dataChunkSize'> | null = null;
  let dataChunkSize: number | null = null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const isFmt = isAscii(bytes, offset, FMT_CHUNK_ID);
    const isData = isAscii(bytes, offset, DATA_CHUNK_ID);
    const chunkSize = readU32(bytes, offset + 4);
    const payloadStart = offset + 8;
    if (payloadStart + chunkSize > bytes.length) {
      throw new TranscriptionError(
        `WAV chunk ${isFmt ? '"fmt "' : isData ? '"data"' : asciiHex(bytes, offset)} declares ${chunkSize} bytes which exceeds the remaining ${bytes.length - payloadStart} bytes`,
      );
    }
    if (isFmt) {
      if (chunkSize < FMT_CHUNK_MIN_SIZE) {
        throw new TranscriptionError(
          `fmt chunk is ${chunkSize} bytes; at least ${FMT_CHUNK_MIN_SIZE} (PCM fields) is required`,
        );
      }
      fmt = {
        audioFormat: readU16(bytes, payloadStart),
        channels: readU16(bytes, payloadStart + 2),
        sampleRate: readU32(bytes, payloadStart + 4),
        byteRate: readU32(bytes, payloadStart + 8),
        bitsPerSample: readU16(bytes, payloadStart + 14),
      };
    } else if (isData) {
      dataChunkSize = chunkSize;
    }
    // 未知 chunk（LIST 等）は読み飛ばす。chunk は word 境界で pad される。
    offset = payloadStart + chunkSize + (chunkSize % 2);
  }

  if (fmt === null) {
    throw new TranscriptionError('fmt chunk not found in WAV byte sequence');
  }
  if (dataChunkSize === null) {
    throw new TranscriptionError('data chunk not found in WAV byte sequence');
  }
  if (fmt.audioFormat !== PCM_AUDIO_FORMAT) {
    throw new TranscriptionError(
      `unsupported WAV audioFormat ${fmt.audioFormat} (only PCM = 1 is supported)`,
    );
  }
  return { ...fmt, dataChunkSize };
}

/**
 * WAV bytes から音声長を導出する。戻り値は ms（`dataChunkSize / byteRate * 1000`）。
 * 丸めない — `byteRate` で割り切れない場合はそのまま浮動小数で返す（rounding は呼び出し側の
 * report 整形で行う）。fail-loud 条件は parseWavHeader に準拠し、加えて分母 `byteRate` が
 * 0 以下の場合も throw する（Infinity を返さない）。
 */
export function readWavDurationMs(bytes: Uint8Array): number {
  const header = parseWavHeader(bytes);
  if (header.byteRate <= 0) {
    throw new TranscriptionError(
      `WAV byteRate is ${header.byteRate}; duration is undefined for a zero denominator`,
    );
  }
  return (header.dataChunkSize / header.byteRate) * 1000;
}
