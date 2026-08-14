/**
 * Shared freeze-guard helper: ONE discovery walk + ONE rule-sweep shape for
 * every "frozen constant literal" single-source guard.
 *
 * Background (round 8 of the single-source campaign): rounds 4-7 closed six
 * families of independently frozen literals (DEFAULT_FPS, layout-quality 0.7,
 * scene-duration 2000/15000/30000/5000, TARGET_ASPECT_RATIO, node dimensions
 * 120/60, quality-gate defaults) and each family hand-rolled its own
 * ~120-line guard test with its own src/ walk, its own comment-skip policy,
 * and its own offender formatting. The walks drifted (recursive vs flat,
 * ts-only vs ts+tsx) and adding family #7 meant copying a test file again.
 *
 * This module is the extraction: a rule is data (patterns + roots + documented
 * exclusions), the sweep is code. A new frozen-constant family costs one entry
 * in tests/guards/frozen-literal-rules.ts — the registry test sweeps it with
 * the same walk, the same comment-skip policy, and the same failure format as
 * every other family.
 *
 * Conventions shared by every rule (deliberately stricter/simpler than the
 * ad-hoc guards they replace):
 *   - Source anchors use import.meta.url, NOT process.cwd() — cwd-relative
 *     reads flake under --maxWorkers>1 (TC-302/313, AGENTS.md テスト規約).
 *   - Comment-only lines are never offenders (comments cannot freeze a copy;
 *     they often QUOTE the historical literal in migration notes).
 *   - Every excluded file carries a reason string — an undocumented exclusion
 *     is itself a defect (enforced by the registry test).
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

/** Repo root, anchored to THIS file so jest worker cwd cannot poison it. */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Read a repo-relative production source file. */
export function readSource(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

/** True for comment-only lines (`// x`, ` * x`, `/* x`). */
export function isCommentLine(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

/**
 * Recursively list repo-relative production source files under `rootRel`.
 * Skips __tests__ directories, *.test.* / *.spec.* files, and any nested
 * node_modules/dist/coverage (defensive; they do not exist under src/ today).
 */
export function walkProductionFiles(rootRel: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(REPO_ROOT, rootRel))) {
    const rel = `${rootRel}/${entry}`;
    if (statSync(join(REPO_ROOT, rel)).isDirectory()) {
      if (['__tests__', 'node_modules', 'dist', 'coverage'].includes(entry)) continue;
      walkProductionFiles(rel, acc);
    } else if (/\.(ts|tsx)$/.test(rel) && !/\.(test|spec)\./.test(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

/** A line-level literal matcher: either a regex or an arbitrary predicate. */
export type LinePattern = RegExp | ((line: string) => boolean);

function matches(line: string, pattern: LinePattern): boolean {
  return typeof pattern === 'function' ? pattern(line) : pattern.test(line);
}

/**
 * One frozen-literal family: where to look and which line shapes are freezes.
 *
 * `roots` (recursive discovery) and `files` (explicit pin list) are mutually
 * exclusive: a rule either sweeps a module boundary for NEW sites, or pins
 * known files that must never re-grow a banned shape.
 */
export interface FrozenLiteralRule {
  /** Stable id, used as the registry test's test name. */
  id: string;
  /** Repo-relative directories to sweep recursively (catches NEW files). */
  roots?: string[];
  /** Explicit repo-relative files to check (no discovery). */
  files?: string[];
  /**
   * Files allowed to carry the literal, each with a documented reason
   * (usually the canonical source itself). An entry without a reason fails
   * the registry test — undocumented exclusions are how guards rot.
   */
  exclude?: Record<string, string>;
  /** Line shapes that re-freeze the constant. */
  patterns: LinePattern[];
  /**
   * Skip comment-only lines. Default true; set false only for patterns that
   * cannot appear in prose (rare — prefer the default).
   */
  skipCommentLines?: boolean;
  /**
   * Sanity floor on swept file count — proves the walk actually traversed
   * the module boundary instead of silently matching nothing.
   */
  minSweptFiles?: number;
}

/**
 * Sweep one rule; return `rel:line: content` offender strings (empty = clean).
 * Shared by the registry test (green sweep) and by anyone needing the offender
 * list for a focused assertion.
 */
export function sweepFrozenLiteralRule(rule: FrozenLiteralRule): string[] {
  const skipComments = rule.skipCommentLines !== false;
  const targets =
    rule.roots !== undefined
      ? rule.roots.flatMap((root) => walkProductionFiles(root))
      : (rule.files ?? []);

  const offenders: string[] = [];
  for (const rel of targets) {
    if (rule.exclude !== undefined && rel in rule.exclude) continue;
    const lines = readSource(rel).split('\n');
    lines.forEach((line, i) => {
      if (skipComments && isCommentLine(line)) return;
      if (rule.patterns.some((p) => matches(line, p))) {
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return offenders;
}

/**
 * Sanity-assert helper: the sweep actually traversed the module boundary.
 * Returns the swept file count for `expect(count).toBeGreaterThanOrEqual(n)`.
 */
export function sweptFileCount(rule: FrozenLiteralRule): number {
  return rule.roots !== undefined
    ? rule.roots.flatMap((root) => walkProductionFiles(root)).length
    : (rule.files?.length ?? 0);
}
