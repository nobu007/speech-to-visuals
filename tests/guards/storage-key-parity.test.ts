/**
 * Storage key read/write parity guard (Phase 141 / REQ-329).
 *
 * AI Hub steering asked for a one-shot sweep of "readers of a storage key no
 * writer ever writes" (their named symbols `STORAGE_KEYS` / commit `b86ddeb6`
 * exist in a sibling hub repo, not here — grep 0 hits; the META-intent is
 * adopted, see interview-record A141). This repo's persistent surface is the
 * `@stv/core/utils/safe-storage` pair plus CorruptionOverlay's dynamic
 * removeItem. The sweep itself found NO live dead-read (both keys have
 * load+save parity); this guard keeps it that way mechanically:
 *
 *   1. every key literal that is LOADED must also be SAVED somewhere
 *      (the dead-read defect class can never re-enter silently),
 *   2. the literal key set is pinned exactly — a new key without its
 *      counterparty fails this suite,
 *   3. non-literal (dynamic) storage access is allowed ONLY in
 *      CorruptionOverlay, whose keys come from corruption-event strings.
 *
 * Mutation-verified (Phase 141): changing TutorialSystem's save key
 * (`'tutorial-progress'` → anything else) turns the parity check RED.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const LOAD_RE = /safeLoadFromStorage[\s\S]{0,120}?\(\s*['"]([^'"]+)['"]/g;
const SAVE_RE = /safeSaveToStorage\(\s*['"]([^'"]+)['"]/g;
const RAW_RE = /localStorage\.(getItem|setItem|removeItem)\(\s*([^)]*)\)/g;

const PINNED_KEYS = ['first-visit', 'tutorial-progress'] as const;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '__mocks__' || entry === 'node_modules' || entry === '.git') continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

interface StorageUsage {
  loaded: Set<string>;
  saved: Set<string>;
  dynamicAccess: string[]; // file:line of non-literal raw localStorage calls
}

function scanTrees(relDirs: string[]): StorageUsage {
  const usage: StorageUsage = { loaded: new Set(), saved: new Set(), dynamicAccess: [] };
  for (const rel of relDirs) {
    for (const file of walk(join(REPO_ROOT, rel))) {
      const src = readFileSync(file, 'utf-8');
      for (const m of src.matchAll(LOAD_RE)) usage.loaded.add(m[1]);
      for (const m of src.matchAll(SAVE_RE)) usage.saved.add(m[1]);
      const lines = src.split('\n');
      lines.forEach((line, idx) => {
        for (const m of line.matchAll(/localStorage\.(getItem|setItem|removeItem)\(/g)) {
          if (m.index === undefined) continue;
          const rest = line.slice(m.index + m[0].length);
          if (!/^\s*['"]/.test(rest)) {
            usage.dynamicAccess.push(`${file.replace(REPO_ROOT, '')}:${idx + 1}`);
          }
        }
      });
    }
  }
  return usage;
}

describe('storage key read/write parity (REQ-329)', () => {
  const usage = scanTrees(['src', 'supabase']);

  it('every LOADED key literal has a writer (no dead reads)', () => {
    const deadReads = [...usage.loaded].filter(k => !usage.saved.has(k));
    expect(deadReads).toEqual([]);
  });

  it('every SAVED key literal has a reader (no dead writes)', () => {
    const deadWrites = [...usage.saved].filter(k => !usage.loaded.has(k));
    expect(deadWrites).toEqual([]);
  });

  it('the literal storage key set is pinned', () => {
    expect([...usage.loaded].sort()).toEqual([...PINNED_KEYS]);
    expect([...usage.saved].sort()).toEqual([...PINNED_KEYS]);
  });

  it('non-literal localStorage access exists only in CorruptionOverlay (dynamic corruption keys)', () => {
    const offenders = usage.dynamicAccess.filter(f => !f.startsWith('src/components/CorruptionOverlay.tsx'));
    expect(offenders).toEqual([]);
    // The overlay's dynamic keys are extracted from corruption events, not
    // stored literals — pin the extractor so the exemption stays justified.
    const overlay = readFileSync(join(REPO_ROOT, 'src/components/CorruptionOverlay.tsx'), 'utf-8');
    expect(overlay).toContain('extractStorageKey');
  });
});
