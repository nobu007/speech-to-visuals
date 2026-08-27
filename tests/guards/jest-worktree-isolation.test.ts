/**
 * jest worktree isolation guard.
 *
 * 背景 (session 283 / feedback 2026-08-27 §1):
 *   AI Hub の自律ループは repo 直下に `worktrees/<timestamp>/` という完全な mirror を
 *   作る。`testMatch: ['**\/tests/**\/*.test.ts', …]` は .gitignore を尊重しない為、
 *   親 repo で jest を起動すると stale mirror 側の test も拾って偽 RED を出す。
 *   session 283 はこれを `testPathIgnorePatterns: ['/node_modules/', '/worktrees/']`
 *   で塞いだ。
 *
 * 本 guard が塞ぐ regression (session 283 の fix が持ち込んだ self-disabling 挙動):
 *   裸の `/worktrees/` は **パス中の任意位置** に一致する。ai-hub の実行体は
 *   `…/speech-to-visuals/worktrees/<ts>/` を rootDir として jest を起動する為、
 *   この pattern は *自分自身の* test path 全てに一致し、`--listTests` が 0 件・
 *   スイート全体が沈黙する (jest は "No tests found" を返し、`--passWithNoTests` を
 *   併用する経路では GREEN と区別できない)。CI は `/home/runner/work/…` で走る為
 *   この差は CI では観測できない = **ローカル検証だけが静かに死ぬ**。
 *
 * よって契約は「rootDir 相対で書く」事:
 *   - `<rootDir>/worktrees/` → 親 repo 起動時は nested mirror を除外 (原意保持)
 *   - worktree 自身を rootDir として起動した時は自分自身を除外しない
 *
 * 関連 memory: [[session-283-jest-worktree-isolation]]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CONFIG_PATH = join(REPO_ROOT, 'jest.config.cjs');
const SELF_TEST = fileURLToPath(import.meta.url);

const nodeRequire = createRequire(import.meta.url);
const config = nodeRequire(CONFIG_PATH) as {
  testPathIgnorePatterns?: string[];
  testMatch?: string[];
};

/** jest と同じ手順で `<rootDir>` token を実パスへ解決し RegExp 化する。 */
const toMatcher = (pattern: string, rootDir: string): RegExp =>
  new RegExp(pattern.replace('<rootDir>', rootDir.replace(/\/$/, '')));

/** いずれかの ignore pattern に一致したら jest はその test を捨てる。 */
const isIgnored = (testPath: string, patterns: string[], rootDir: string): boolean =>
  patterns.some((p) => toMatcher(p, rootDir).test(testPath));

describe('jest worktree isolation contract', () => {
  const patterns = config.testPathIgnorePatterns || [];

  it('testPathIgnorePatterns exists and still excludes node_modules', () => {
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns).toContain('/node_modules/');
  });

  it('the worktrees entry is rootDir-anchored (bare "/worktrees/" is forbidden)', () => {
    // 裸形は「パス中の任意位置」に一致して自分自身を除外する為、契約違反。
    expect(patterns).not.toContain('/worktrees/');
    const worktreeEntries = patterns.filter((p) => p.includes('worktrees'));
    expect(worktreeEntries).toEqual(['<rootDir>/worktrees/']);
  });

  it('this very test file is NOT excluded by the configured ignore patterns (self-disable witness)', () => {
    // 本 leg は「スイートがスイート自身を無効化していない」事を実行環境で直接証明する。
    // 裸 `/worktrees/` の下では worktree 実行時にのみ RED になる (CI では GREEN の儘)
    // — そのため環境依存に見えるが、沈黙が起きる環境で必ず RED するのが狙い。
    expect(isIgnored(SELF_TEST, patterns, REPO_ROOT)).toBe(false);
  });

  it('mutation witness: bare "/worktrees/" self-disables a worktree checkout, rootDir-anchored does not', () => {
    // ai-hub の実行形と同じ形の合成 rootDir (repo 自体が worktrees/<ts>/ 配下)。
    const worktreeRoot = '/home/user/speech-to-visuals/worktrees/20260827-103808-340936';
    const ownTest = `${worktreeRoot}/tests/guards/jest-worktree-isolation.test.ts`;

    // mutation (session 283 の元実装): 自分自身の test が除外される = 全件沈黙
    expect(isIgnored(ownTest, ['/node_modules/', '/worktrees/'], worktreeRoot)).toBe(true);

    // 現行 (rootDir-anchored): 自分自身は除外されない
    expect(isIgnored(ownTest, patterns, worktreeRoot)).toBe(false);
  });

  it('rootDir-anchored pattern still excludes the nested stale mirror (session 283 の原意保持)', () => {
    // 親 repo を rootDir として起動した場合、nested mirror 側の test は除外され続ける。
    const parentRoot = '/home/user/speech-to-visuals';
    const mirrorTest = `${parentRoot}/worktrees/20260827-103808-340936/tests/guards/x.test.ts`;
    const realTest = `${parentRoot}/tests/guards/x.test.ts`;

    expect(isIgnored(mirrorTest, patterns, parentRoot)).toBe(true);
    expect(isIgnored(realTest, patterns, parentRoot)).toBe(false);
  });

  it('testMatch still relies on ignore patterns for isolation (glob does not filter worktrees)', () => {
    // testMatch 側が `**` glob である限り mirror を拾う為、除外は
    // testPathIgnorePatterns の責務であるという前提を pin する
    // (testMatch を rootDir 直下限定へ絞る refactor が入ったらここが RED になり、
    //  ignore 契約の再評価を強制する)。
    const testMatch = config.testMatch || [];
    expect(testMatch.some((m) => m.startsWith('**/tests/'))).toBe(true);
    expect(testMatch.some((m) => m.startsWith('**/src/'))).toBe(true);
  });

  it('the config documents the self-disable trap (rationale stays with the pattern)', () => {
    // source-anchored: 将来の refactor で裸形へ戻す誘惑を、理由込みで残す。
    const src = readFileSync(CONFIG_PATH, 'utf-8');
    expect(src).toMatch(/<rootDir>\/worktrees\//);
    expect(src).toMatch(/self-disabling|自分自身|0 件/);
  });
});
