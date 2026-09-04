/**
 * AGENTS.md テスト規約「src 内 test code（__tests__ 配下・*.test.ts(x)）は
 * 型検査ゼロ（compile-error 検出前提は禁止）」の前提設定を pinned truth 化する
 * sentinel（TASK-0319 補強3: run 20260904-180029-511354 eval 96点の残 suggestion 閉塞）。
 *
 * 規約文は次の3前提で成立している:
 *   P1: src 配下 test file（__tests__ 配下・*.test.ts(x)）が tsconfig.app.json の
 *       exclude で型検査対象外
 *   P2: tsconfig.test.json は exclude を override せず app config を継承
 *       （app/test『両 config』から除外されていることの根拠）
 *   P3: jest の ts-jest 変換が isolatedModules（transpile-only）で動く —
 *       src test file は jest 実行でも型検査されない（2026-09-05 実測:
 *       型 error 挿入 probe で suite が落ちない事を確認済み）
 *
 * これらの前提が tsconfig / jest.config.cjs 側で変わっても、規約文は静かに
 * stale 化するだけだった。本 guard は設定ファイル実値を読んで前提を固定する:
 * 前提を変える変更は本 guard を RED させ、AGENTS.md 規約文と同 commit での
 * 更新を強制する（読み込みは cwd 相対禁止なので import.meta.url 基準）。
 *
 * - leg1 (P1): tsconfig.app.json の exclude は src テスト3項目の exact 配列
 *   + include === ['src']（exclude が効くのは include が src 全体を掴むから）
 * - leg2 (P2): tsconfig.test.json は './tsconfig.app.json' を extends し
 *   exclude を override していない + include が src を含む
 * - leg3 (P3): app config の compilerOptions.isolatedModules === true を
 *   test config が override せず継承 + jest.config.cjs の ts/tsx 変換が
 *   ts-jest に tsconfig.test.json を渡している
 * - leg4: AGENTS.md が規約 section 見出しと主要な tests ディレクトリ glob を
 *   verbatim に持つ（規約文側の存在 anchor — 削除・改題で RED）
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';
// Type-only: erased at compile time, so the CJS `typescript` package still
// loads via createRequire below.
import type * as TS from 'typescript';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
// `typescript` ships CJS; createRequire keeps the import ESM-safe under
// jest ESM (same pattern as non-null-assertion-census.test.ts).
const ts = require('typescript') as typeof TS;

/** AGENTS.md 規約が前提とする exclude 項目（tsconfig.app.json 実値と exact 比較）。 */
const SRC_TEST_EXCLUDE = ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.test.tsx'];

/** pin 対象の AGENTS.md テスト規約見出し（verbatim）。 */
const RULE_HEADING = '#### src/**/__tests__ のテストコードは型検査ゼロ（compile-error 検出前提は禁止）';

interface TsConfig {
  include?: string[];
  exclude?: string[];
  extends?: string;
  compilerOptions?: { isolatedModules?: boolean };
}

interface TsJestTransformOptions {
  useESM?: boolean;
  tsconfig?: string;
}

type TransformEntry = string | [string, TsJestTransformOptions];

/** tsconfig は JSONC（block comment を含む）で、文字列内に `/*` 系 glob もあるため
 * 独自 comment-strip は誤爆する — TypeScript 自身の config reader で読む。 */
function readTsConfig(rel: string): TsConfig {
  const loaded = ts.readConfigFile(join(REPO_ROOT, rel), ts.sys.readFile);
  if (loaded.error) {
    throw new Error(`tsconfig 読み込み失敗: ${rel} (${String(loaded.error.messageText)})`);
  }
  return loaded.config as TsConfig;
}

const appConfig = readTsConfig('tsconfig.app.json');
const testConfig = readTsConfig('tsconfig.test.json');
// jest.config.cjs は CJS — ESM test からは createRequire で読む（js-yaml と同規約）。
const jestConfig = require(join(REPO_ROOT, 'jest.config.cjs')) as {
  transform?: Record<string, TransformEntry>;
};
const agentsMd = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf-8');

describe('AGENTS.md 型検査ゼロ規約の前提 pin（tsconfig / jest.config 実値）', () => {
  it('leg1: tsconfig.app.json は src テスト3項目を exclude し include は ["src"]', () => {
    // exclude 変更（項目の削除・追加・書換いずれも）は AGENTS.md 規約の前提変更 —
    // 規約文と同 commit で更新すること。include が src を離すと exclude が
    // vacuous になるため併せて pin する。
    expect(appConfig.exclude).toEqual(SRC_TEST_EXCLUDE);
    expect(appConfig.include).toEqual(['src']);
  });

  it('leg2: tsconfig.test.json は app config を extends し exclude を override しない', () => {
    // 『両 config から exclude されている』は test config が継承しているから成立する。
    // override 追加で app 側 exclude と test 側 exclude が分岐すると規約文の
    // 前提が崩れるため、override の不在自体を pin する。
    expect(testConfig.extends).toBe('./tsconfig.app.json');
    expect(Object.prototype.hasOwnProperty.call(testConfig, 'exclude')).toBe(false);
    expect(testConfig.include).toContain('src');
  });

  it('leg3: isolatedModules transpile-only 前提 — flag の継承と jest transform の wiring', () => {
    expect(appConfig.compilerOptions?.isolatedModules).toBe(true);
    expect(
      Object.prototype.hasOwnProperty.call(testConfig.compilerOptions ?? {}, 'isolatedModules'),
    ).toBe(false);

    // jest の ts/tsx 変換が tsconfig.test.json（= 上記継承連鎖）を参照していること。
    // この参照が外れると P3 の『jest 実行でも型検査されない』が崩れる。
    const tsTransform = jestConfig.transform?.['^.+\\.(ts|tsx)$'];
    expect(Array.isArray(tsTransform)).toBe(true);
    if (Array.isArray(tsTransform)) {
      expect(tsTransform[0]).toBe('ts-jest');
      expect(tsTransform[1].tsconfig).toBe('tsconfig.test.json');
    }
  });

  it('leg4: AGENTS.md は規約 section 見出しと主要 glob を verbatim に持つ', () => {
    expect(agentsMd).toContain(RULE_HEADING);
    expect(agentsMd).toContain('src/**/__tests__/**');
  });
});
