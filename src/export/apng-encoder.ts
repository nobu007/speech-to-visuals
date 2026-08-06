/**
 * Lightweight APNG (Animated PNG) encoder
 *
 * Produces a valid APNG binary from RGBA frame data without external
 * dependencies. Uses zlib "store" deflate blocks (valid but uncompressed)
 * so the output is a correct PNG that any decoder can read.
 *
 * Structure: PNG sig → IHDR → acTL → [fcTL + IDAT/fdAT per frame] → IEND
 */

import { EncodingError, FormatValidationError } from '@/pipeline/pipeline-errors';

// ---------- CRC-32 (ISO 3309 / ITU-T V.42) ----------

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf: Uint8Array, offset = 0, length = buf.length - offset): number {
  let crc = 0xffffffff;
  const end = offset + length;
  for (let i = offset; i < end; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ---------- Adler-32 (RFC 1950) ----------

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

// ---------- PNG helpers ----------

/** Big-endian uint32 writer */
function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

/** Build a PNG chunk: length(4) + type(4) + data + crc(4) */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length);
  // write type as ASCII
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const checksum = crc32(chunk, 4, 4 + data.length);
  writeU32(chunk, 8 + data.length, checksum);
  return chunk;
}

/** Wrap raw bytes in a zlib "store" (no-compression) container */
function zlibStore(raw: Uint8Array): Uint8Array {
  // zlib header (2) + blocks + adler32 (4)
  // Each stored block: BFINAL(1) + LEN(2) + NLEN(2) + data
  const maxBlock = 65535;
  const blockCount = Math.ceil(raw.length / maxBlock) || 1;
  const overhead = 2 + blockCount * 5 + 4;
  const out = new Uint8Array(overhead + raw.length);

  let pos = 0;
  // zlib header: CMF=78 (deflate, window=15), FLG=01 (level 0, check bits ok)
  out[pos++] = 0x78;
  out[pos++] = 0x01;

  for (let block = 0; block < blockCount; block++) {
    const start = block * maxBlock;
    const remaining = raw.length - start;
    const len = Math.min(remaining, maxBlock);
    const isFinal = block === blockCount - 1 ? 1 : 0;

    out[pos++] = isFinal; // BFINAL + BTYPE=00 (stored)
    out[pos++] = len & 0xff;
    out[pos++] = (len >>> 8) & 0xff;
    out[pos++] = ~len & 0xff;
    out[pos++] = (~len >>> 8) & 0xff;
    out.set(raw.subarray(start, start + len), pos);
    pos += len;
  }

  // Adler-32 checksum (big-endian)
  const a32 = adler32(raw);
  writeU32(out, pos, a32);
  return out;
}

// ---------- Public types ----------

export interface ApngFrameInput {
  /** RGBA pixel data, length = width * height * 4 */
  data: Uint8Array;
  width: number;
  height: number;
}

export interface ApngEncodeOptions {
  /** Frames per second — used to compute per-frame delay */
  fps: number;
  /** Number of animation loops (0 = infinite) */
  numPlays?: number;
}

// ---------- Encoder ----------

/**
 * Encode RGBA frames into an APNG Uint8Array.
 *
 * @throws {Error} if `frames` is empty or frame dimensions are invalid.
 */
export function encodeAPNG(
  frames: ApngFrameInput[],
  options: ApngEncodeOptions,
): Uint8Array {
  if (frames.length === 0) {
    throw new FormatValidationError('APNG requires at least one frame', 'apng');
  }

  const { fps } = options;
  if (fps <= 0) {
    throw new FormatValidationError('APNG fps must be positive', 'apng');
  }

  const { width, height } = frames[0];
  if (width <= 0 || height <= 0) {
    throw new FormatValidationError('APNG frame dimensions must be positive', 'apng');
  }

  const numPlays = options.numPlays ?? 0; // infinite loop by default

  // Per the APNG spec (Mozilla APNG Specification), the fcTL frame delay is
  // delay_num / delay_den in SECONDS. One frame period is 1/fps seconds, so we
  // encode it exactly as the rational 1/fps. (A prior implementation treated the
  // pair as milliseconds and wrote 3333/100 at 30fps, which decoders read as
  // 33.33 SECONDS per frame — an animation ~1000x too slow.)
  const delayNum = 1;
  const delayDen = Math.min(0xffff, Math.max(1, Math.round(fps)));

  // Build chunk arrays
  const chunks: Uint8Array[] = [];

  // PNG signature
  chunks.push(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  // IHDR
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(pngChunk('IHDR', ihdr));

  // acTL (animation control)
  const actl = new Uint8Array(8);
  writeU32(actl, 0, frames.length);
  writeU32(actl, 4, numPlays);
  chunks.push(pngChunk('acTL', actl));

  // Sequence counter for fcTL / fdAT
  let seq = 0;

  for (let fi = 0; fi < frames.length; fi++) {
    const frame = frames[fi];
    const rowBytes = frame.width * 4;

    // Prepend filter byte (0 = None) per row
    const raw = new Uint8Array(frame.height * (1 + rowBytes));
    for (let y = 0; y < frame.height; y++) {
      const dstOff = y * (1 + rowBytes);
      raw[dstOff] = 0; // filter: None
      raw.set(
        frame.data.subarray(y * rowBytes, y * rowBytes + rowBytes),
        dstOff + 1,
      );
    }

    const compressed = zlibStore(raw);

    // fcTL (frame control)
    const fctl = new Uint8Array(26);
    writeU32(fctl, 0, seq++); // sequence_number
    writeU32(fctl, 4, frame.width);
    writeU32(fctl, 8, frame.height);
    writeU32(fctl, 12, 0); // x_offset
    writeU32(fctl, 16, 0); // y_offset
    writeU16(fctl, 20, delayNum); // delay_num
    writeU16(fctl, 22, delayDen); // delay_den
    fctl[24] = 0; // dispose_op: APNG_DISPOSE_OP_NONE
    fctl[25] = 0; // blend_op: APNG_BLEND_OP_SOURCE
    chunks.push(pngChunk('fcTL', fctl));

    if (fi === 0) {
      // First frame → IDAT
      chunks.push(pngChunk('IDAT', compressed));
    } else {
      // Subsequent frames → fdAT (seq + data)
      const fdat = new Uint8Array(4 + compressed.length);
      writeU32(fdat, 0, seq++);
      fdat.set(compressed, 4);
      chunks.push(pngChunk('fdAT', fdat));
    }
  }

  // IEND
  chunks.push(pngChunk('IEND', new Uint8Array(0)));

  // Concatenate all chunks
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/** Big-endian uint16 writer */
function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = (value >>> 8) & 0xff;
  buf[offset + 1] = value & 0xff;
}

// ---------- Chunk parsing utilities (for testing) ----------

export interface PngChunkInfo {
  type: string;
  data: Uint8Array;
  offset: number;
}

/**
 * Parse a PNG/APNG binary into its constituent chunks.
 * Useful for verifying output structure in tests.
 */
export function parsePngChunks(apng: Uint8Array): PngChunkInfo[] {
  // Verify PNG signature
  const sig: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (apng[i] !== sig[i]) {
      throw new EncodingError(`Invalid PNG signature at byte ${i}`, 'apng');
    }
  }

  const chunks: PngChunkInfo[] = [];
  let pos = 8;

  while (pos < apng.length) {
    const length =
      (apng[pos] << 24) |
      (apng[pos + 1] << 16) |
      (apng[pos + 2] << 8) |
      apng[pos + 3];
    const type = String.fromCharCode(
      apng[pos + 4],
      apng[pos + 5],
      apng[pos + 6],
      apng[pos + 7],
    );
    const data = apng.slice(pos + 8, pos + 8 + length);
    chunks.push({ type, data, offset: pos });
    pos += 12 + length; // length(4) + type(4) + data(N) + crc(4)
  }

  return chunks;
}
