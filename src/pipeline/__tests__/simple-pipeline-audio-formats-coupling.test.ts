/**
 * Structural source-coupling guard for simple-pipeline audio formats (REQ-295).
 *
 * `SimplePipeline.getCapabilities()` previously returned a hardcoded
 * `supportedFormats: ['mp3', 'wav', 'ogg', 'm4a']`. That list coincides exactly
 * with the canonical `SUPPORTED_AUDIO_FORMATS` in `src/config/limits.ts`, but
 * was not bound to it — a latent-coincident constant-desync seed: adding a new
 * format to the canonical list would silently leave simple-pipeline advertising
 * the stale set. The sibling `whisper-transcriber.ts` already spreads
 * `[...SUPPORTED_AUDIO_FORMATS]`; simple-pipeline must do the same. Behavioral
 * RED→GREEN is impossible (values match today), so this test guards the COUPLING
 * at the source-text level.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SUPPORTED_AUDIO_FORMATS } from '@/config/limits';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PIPELINE_FILE = path.resolve(__dirname, '../simple-pipeline.ts');

describe('REQ-295: simple-pipeline audio formats are single-sourced', () => {
  test('canonical SUPPORTED_AUDIO_FORMATS holds its documented value', () => {
    // Locking the canonical value makes the "coincide today" desync detectable.
    expect([...SUPPORTED_AUDIO_FORMATS]).toEqual(['mp3', 'wav', 'ogg', 'm4a']);
  });

  test('simple-pipeline.ts imports SUPPORTED_AUDIO_FORMATS from config/limits', () => {
    const src = fs.readFileSync(PIPELINE_FILE, 'utf-8');
    expect(src).toMatch(/import\s*\{[^}]*\bSUPPORTED_AUDIO_FORMATS\b[^}]*\}\s*from\s*['"][^'']*config\/limits['"]/);
  });

  test('simple-pipeline.ts does not re-inline the audio-format list literal', () => {
    const src = fs.readFileSync(PIPELINE_FILE, 'utf-8');
    // The desync seed: a hand-maintained duplicate of the canonical list.
    expect(src).not.toMatch(/\[\s*['"]mp3['"]\s*,\s*['"]wav['"]\s*,\s*['"]ogg['"]\s*,\s*['"]m4a['"]\s*\]/);
  });
});
