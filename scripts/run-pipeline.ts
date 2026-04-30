#!/usr/bin/env -S node
/**
 * Run the end-to-end audio→diagram pipeline from Node.
 * Usage:
 *   npx tsx scripts/run-pipeline.ts <audioPath> [--no-video] [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type SimplePipeline = typeof import('../src/pipeline/simple-pipeline');

function guessMime(ext: string): string {
  const map: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.txt': 'text/plain',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

async function createNodeFile(audioPath: string): Promise<File> {
  const buf = fs.readFileSync(audioPath);
  const stat = fs.statSync(audioPath);
  const ext = path.extname(audioPath);
  const type = guessMime(ext);
  const blob = new Blob([buf], { type });

  // If global File exists (Node >= 20), use it. Otherwise attach props to Blob.
  const FileCtor: unknown = (globalThis as Record<string, unknown>).File;
  if (typeof FileCtor === 'function') {
    return new (FileCtor as new (parts: Blob[], name: string, opts?: { type?: string; lastModified?: number }) => File)([blob], path.basename(audioPath), { type, lastModified: stat.mtimeMs });
  }
  const fileLike: Record<string, unknown> = blob as Record<string, unknown>;
  fileLike.name = path.basename(audioPath);
  fileLike.type = type;
  fileLike.lastModified = stat.mtimeMs;
  fileLike.size = buf.length;
  return fileLike as unknown as File;
}

function parseArgs(argv: string[]) {
  const args = { audioPath: '', withVideo: true, outDir: path.join(process.cwd(), 'test-output') };
  const rest = [...argv];
  rest.shift(); // node
  rest.shift(); // script
  const snd = rest.shift(); // audioPath or flag
  if (!snd || snd.startsWith('--')) {
    console.error('Usage: npx tsx scripts/run-pipeline.ts <audioPath> [--no-video] [--out <dir>]');
    process.exit(1);
  }
  args.audioPath = path.resolve(process.cwd(), snd);
  while (rest.length) {
    const token = rest.shift()!;
    if (token === '--no-video') args.withVideo = false;
    else if (token === '--out') {
      const d = rest.shift();
      if (!d) {
        console.error('--out requires a directory');
        process.exit(1);
      }
      args.outDir = path.resolve(process.cwd(), d);
    } else {
      console.warn(`Ignoring unknown arg: ${token}`);
    }
  }
  return args;
}

async function main() {
  const { audioPath, withVideo, outDir } = parseArgs(process.argv);
  if (!fs.existsSync(audioPath)) {
    console.error(`❌ Audio not found: ${audioPath}`);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const { simplePipeline }: SimplePipeline = await import('../src/pipeline/simple-pipeline');

  console.log('🎧 Preparing audio...');
  const file = await createNodeFile(audioPath);

  console.log('🚀 Running pipeline...');
  const result = await simplePipeline.process(
    { audioFile: file, options: { includeVideoGeneration: withVideo, useEnhancedLayout: false } },
    (stage, progress) => {
      const pct = Math.floor(progress);
      if (pct % 10 === 0) process.stdout.write(`\r   📊 ${stage}: ${pct}%`);
    }
  );
  console.log('\n');

  if (!result.success) {
    console.error('❌ Pipeline failed:', result.error);
    process.exit(1);
  }

  // Write transcript and scene JSON with fixed filenames (no timestamps)
  if (result.transcript) {
    const transcriptPath = path.join(outDir, 'transcript.txt');
    fs.writeFileSync(transcriptPath, result.transcript, 'utf8');
    console.log(`📝 Transcript: ${transcriptPath}`);
  }
  if (result.scenes) {
    const scenePath = path.join(outDir, 'scene-data.json');
    fs.writeFileSync(scenePath, JSON.stringify({ scenes: result.scenes }, null, 2), 'utf8');
    console.log(`🗺️  Scenes: ${scenePath}`);
  }

  if (withVideo && result.videoUrl) {
    console.log(`🎬 Video: ${result.videoUrl}`);
  } else if (withVideo) {
    console.log('⚠️  Video generation requested but no URL returned.');
  }

  console.log('✅ Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

