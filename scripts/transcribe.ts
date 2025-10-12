#!/usr/bin/env tsx
/**
 * Simple transcription runner.
 * Usage: tsx scripts/transcribe.ts <audioPath>
 */
import fs from 'node:fs';
import path from 'node:path';
import { TranscriptionPipeline } from '../src/transcription/transcriber';
import type { Caption } from '@remotion/captions';

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = Math.floor(ms % 1000);
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0');
  const padMs = (n: number) => n.toString().padStart(3, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${padMs(msRem)}`;
}

function captionsToSrt(captions: Caption[]): string {
  return captions
    .map((c, i) => {
      const start = msToSrtTime(c.startMs);
      const end = msToSrtTime(c.endMs);
      return `${i + 1}\n${start} --> ${end}\n${c.text}\n`;
    })
    .join('\n');
}

async function main() {
  const audioPath = process.argv[2] || 'public/jfk.wav';
  const absAudio = path.isAbsolute(audioPath) ? audioPath : path.join(process.cwd(), audioPath);

  console.log(`🎤 Transcribing: ${absAudio}`);
  const pipeline = new TranscriptionPipeline();
  const result = await pipeline.transcribe(absAudio);

  if (!result.success || !result.captions || result.captions.length === 0) {
    console.error('❌ Transcription failed or no captions produced');
    process.exit(1);
  }

  const base = path.basename(audioPath).replace(path.extname(audioPath), '');
  const outDir = path.join(process.cwd(), 'public', 'srt');
  fs.mkdirSync(outDir, { recursive: true });
  const srtPath = path.join(outDir, `${base}.srt`);
  const jsonPath = path.join(outDir, `${base}.captions.json`);

  fs.writeFileSync(srtPath, captionsToSrt(result.captions));
  fs.writeFileSync(jsonPath, JSON.stringify(result.captions, null, 2), 'utf-8');

  console.log('✅ Transcription complete');
  console.log(`📝 SRT: ${srtPath}`);
  console.log(`🧾 JSON: ${jsonPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

