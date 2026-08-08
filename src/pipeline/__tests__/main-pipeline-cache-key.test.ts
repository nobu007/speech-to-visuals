/**
 * @jest-environment node
 */
/**
 * Pipeline transcription cache-key — content-vs-metadata invariant.
 *
 * `main-pipeline.generateCacheKey` is the 4th keying layer on the content path
 * (after `buildContentCacheKey`, `LLMCache.generateKey`, `IntelligentCache`).
 * The 08y fix (5071f017) replaced a name+size-derived key with sha256 over the
 * audio bytes, because two distinct audios that shared a name AND a byte-size
 * collapsed onto one transcription-cache slot: `globalCache` stored the first
 * audio's transcription under a key built from `audioFile.name::audioFile.size`,
 * and the second audio — same name, same size, different bytes — looked up that
 * exact key and got the FIRST audio's transcription back. `IntelligentCache`'s
 * `sourceContent` guard could not catch the collision: the "content" it stored
 * and compared WAS that metadata-derived key string, identical for both files.
 *
 * That fix landed with NO test of its own. This file locks the contract as a
 * property so the metadata-vs-content / hash-equality-vs-content-equality class
 * cannot silently return at this layer — the same structural role
 * `llm-cache-integrity.test.ts` plays for `LLMCache` and
 * `intelligent-cache-integrity.test.ts` plays for the storage layer. The 08y
 * lesson was that this keying layer lived OUTSIDE the analysis/performance
 * structural guard; a property test on the layer itself is what closes the loop.
 *
 * `generateCacheKey` is private (TS keyword, lives on the prototype) and reads
 * only `this.config.transcription.model` and `input.audioFile`. A minimal stub
 * bound as `this` exercises the keying logic in isolation without constructing
 * the heavy pipeline (TranscriptionPipeline/Whisper, LayoutEngine, framework…).
 */
import { describe, it, expect } from '@jest/globals';
import { MainPipeline } from '@/pipeline/main-pipeline';
import type { PipelineInput } from '@/pipeline/types';

type GenerateCacheKey = (input: PipelineInput) => Promise<string>;
type TranscriptionModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

/** Bind the private key-builder to a stub carrying only the model it reads. */
function keyBuilderFor(model: TranscriptionModel): GenerateCacheKey {
  const fn = (MainPipeline as unknown as {
    prototype: { generateCacheKey: GenerateCacheKey };
  }).prototype.generateCacheKey;
  return fn.bind({ config: { transcription: { model } } } as unknown as MainPipeline);
}

function audioFile(content: string, name = 'audio.wav', type = 'audio/wav'): File {
  return new File([content], name, { type });
}

describe('main-pipeline.generateCacheKey — content-derived, not metadata-derived', () => {
  const key = keyBuilderFor('tiny');

  it('distinct content with identical name AND size yields distinct keys (08y regression)', async () => {
    // The original bug: same name + same byte-size + different bytes → one slot,
    // so the second audio got the first's transcription. Each distinct audio
    // must resolve to its own key — never a sibling's.
    const size = 100;
    const a = audioFile('A'.repeat(size), 'recording.wav');
    const b = audioFile('B'.repeat(size), 'recording.wav');

    // Premise: identical name and size, distinct bytes.
    expect(a.name).toBe(b.name);
    expect(a.size).toBe(b.size);
    expect(new Uint8Array(await a.arrayBuffer())).not.toEqual(new Uint8Array(await b.arrayBuffer()));

    const keyA = await key({ audioFile: a });
    const keyB = await key({ audioFile: b });
    expect(keyA).not.toBe(keyB);
  });

  it('identical content under different names yields the SAME key (name-agnostic)', async () => {
    // Identity is the audio bytes, not the filename. Renaming a file must not
    // fork its cache slot, and two same-content files must share one slot.
    const byNameA = await key({ audioFile: audioFile('the-same-bytes', 'a.wav') });
    const byNameB = await key({ audioFile: audioFile('the-same-bytes', 'b.wav') });
    expect(byNameA).toBe(byNameB);
  });

  it('keys do not embed the filename; the middle segment is a 16-hex content digest', async () => {
    // Belt-and-suspenders for the metadata-vs-content class: the key string
    // must carry the content digest, never the filename. Size is NOT a key
    // component — that is proven separately by the injectivity test (many
    // same-size files map to distinct keys).
    const k = await key({ audioFile: audioFile('payload', 'secret-name.wav') });
    expect(k).toMatch(/^transcription:[0-9a-f]{16}:tiny$/);
    expect(k).not.toContain('secret-name');
    // The middle segment is purely hex (the sha256 digest), so no name/size
    // token can hide in it.
    expect(k.split(':')[1]).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is injective over many distinct audios that share one name and one size', async () => {
    // Property form of the 08y invariant: 50 audios, all named 'clip.wav', all
    // exactly 61 bytes, but each unique. Under the metadata key every one
    // collapsed to a single slot; under the content key each must be distinct.
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      // `idx` + 4-digit index (7 chars) + 50 filler + 'TAIL' (4) => 61 bytes each.
      const content = `idx${String(i).padStart(4, '0')}` + 'x'.repeat(50) + 'TAIL';
      keys.add(await key({ audioFile: audioFile(content, 'clip.wav') }));
    }
    expect(keys.size).toBe(50);
  });

  it('scopes the key by transcription model (same content, different model → different key)', async () => {
    const tiny = keyBuilderFor('tiny');
    const base = keyBuilderFor('base');
    const f = audioFile('shared-bytes', 'a.wav');

    expect(await tiny({ audioFile: f })).not.toBe(await base({ audioFile: f }));
    // Same model still round-trips to the same key.
    expect(await tiny({ audioFile: f })).toBe(await tiny({ audioFile: f }));
  });

  it('string-path input yields a path-scoped key; distinct paths stay distinct', async () => {
    // The pipeline also accepts a filesystem path (best-effort identifier when
    // no bytes are accessible, e.g. a browser bundle). Distinct paths must not
    // collide, and the path is reflected verbatim.
    const k1 = await key({ audioFile: '/data/audio/a.wav' });
    const k2 = await key({ audioFile: '/data/audio/b.wav' });
    expect(k1).toBe('transcription:path:/data/audio/a.wav:tiny');
    expect(k2).not.toBe(k1);
  });

  it('content key is stable across calls (no randomness / timestamp in the digest)', async () => {
    // A key derived purely from content + model must be deterministic, so a
    // cached transcription is reusable across calls for the same audio.
    const f = audioFile('stable-content', 'a.wav');
    expect(await key({ audioFile: f })).toBe(await key({ audioFile: f }));
  });
});
