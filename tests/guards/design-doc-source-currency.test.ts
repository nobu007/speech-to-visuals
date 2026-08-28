/**
 * REQ-420: 設計正本3文書の出典パス現勢性（stv-core コア分割同期）.
 *
 * stv-core コア分割（PR #7・2026-08-18）で `src/{types,config,lib,utils}` は
 * `@stv/core`（git タグ完全 pin）へ移管・消滅したが、設計正本3文書は
 * 第208/209回検証（2026-08-06）のまま取り残され、53件の dead-path 出典と
 * ディレクトリ木の消滅4行・境界 section の欠落が発生していた（第237回検証）。
 * 本 guard は同期状態を CI で固定する:
 *
 * - leg 1: dead-path 出典 exact-0（`src/(types|utils|lib|config)/`）
 *   - 出典は `@stv/core/<area>/<module>` 形式（第218回検証と同一規約）
 *   - 歴史的 mutation 記述（round 41/42/43 の注入対象）は「当時 src 配下
 *     utils/guards・現 @stv/core/utils/guards」注記形で `src/.../` path 形式を
 *     残さない（履歴と出典を regex で区別できないため）
 * - leg 2: ディレクトリ木の現勢性 — `fs.readdir(src)` 導出（`__tests__` 除外）
 *   の全ディレクトリが木に列挙されていること（導出式 pin: 新規 dir 追加で
 *   RED・裸 pin 不使用）+ 消滅4ディレクトリ行の不在
 * - leg 3: 「外部コアパッケージ（@stv/core）」section の存在 + 依存 pin 表記の
 *   package.json 実値との完全一致（REQ-311 浮動 ref 禁止・更新の同一 commit 化）
 *   + 3文書それぞれが `@stv/core/` 出典を1件以上含むこと
 *
 * MW-093 で (a) dead-path 再注入 (b) 木に消滅 dir 行再注入 (c) section 見出し
 * 削除 の各変異 RED を実証済み。
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DESIGN_DOCS = [
  'specs/speech-to-visuals/architecture.md',
  'specs/speech-to-visuals/dataflow.md',
  'specs/speech-to-visuals/interfaces.ts',
] as const;

/** 移管済み（消滅）src サブディレクトリへの出典 path 形式。 */
const DEAD_PATH_REGEX = /src\/(types|utils|lib|config)\//;

/** 移管で消滅した src 直下ディレクトリ（木に再出現してはならない）。 */
const REMOVED_SRC_DIRS = ['config', 'lib', 'types', 'utils'] as const;

/** 木の列挙対象外とする src 直下ディレクトリ（テスト専用・木に非掲載）。 */
const TREE_EXCLUDED_DIRS = new Set(['__tests__']);

const BOUNDARY_HEADING = '## 外部コアパッケージ（@stv/core）';

/** git タグ pin の字句（semver タグ = 英数字 + . _ -）。REQ-311 準拠の完全 pin のみ許容。 */
const CORE_PIN_REGEX = /github:nobu007\/stv-core#[A-Za-z0-9._-]+/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DesignDoc {
  rel: string;
  text: string;
}

function readDesignDocs(): DesignDoc[] {
  return DESIGN_DOCS.map((rel) => ({ rel, text: readFileSync(join(REPO_ROOT, rel), 'utf-8') }));
}

/** package.json の `@stv/core` 指定（依存 pin の実値）。 */
function resolveCorePin(): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const pin = pkg.dependencies?.['@stv/core'] ?? pkg.devDependencies?.['@stv/core'];
  if (typeof pin !== 'string' || !pin.startsWith('github:')) {
    throw new Error(`package.json の @stv/core 指定が github: 形式ではない: ${String(pin)}`);
  }
  return pin;
}

/** `## 見出し` から次の `## ` 見出し（または文書末）までの section 本文。 */
function extractSection(text: string, heading: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return '';
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

/** 木行（`│   ├── name/` / `├── name/`）の存在判定 regex（m flag で行頭に match）。 */
function treeEntryRegex(dirName: string): RegExp {
  return new RegExp(`^(?:│\\s*)?[├└]──\\s*${escapeRegExp(dirName)}/`, 'm');
}

describe('REQ-420: 設計正本の出典パス現勢性（stv-core 分割同期）', () => {
  const docs = readDesignDocs();
  const architecture = docs[0].text;

  it('leg1: 移管済み src/(types|utils|lib|config)/ 出典は3文書で exact-0', () => {
    const violations: string[] = [];
    for (const { rel, text } of docs) {
      text.split('\n').forEach((line, index) => {
        if (DEAD_PATH_REGEX.test(line)) {
          violations.push(`${rel}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it('leg2: ディレクトリ木は fs.readdir(src) 導出の全ディレクトリを列挙（新規 dir 追加で RED）', () => {
    const liveDirs = readdirSync(join(REPO_ROOT, 'src'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !TREE_EXCLUDED_DIRS.has(entry.name))
      .map((entry) => entry.name)
      .sort();

    // 導出が空 = src/ 消滅等の環境破壊を検知（vacuous GREEN 防止）
    expect(liveDirs.length).toBeGreaterThanOrEqual(1);

    const missingFromTree = liveDirs.filter((name) => !treeEntryRegex(name).test(architecture));
    expect(missingFromTree).toEqual([]);
  });

  it('leg2: 消滅済み4ディレクトリ（config/lib/types/utils）の木行は存在しない', () => {
    const resurrected = REMOVED_SRC_DIRS.filter((name) => treeEntryRegex(name).test(architecture));
    expect([...resurrected]).toEqual([]);
  });

  it('leg3: architecture.md は「外部コアパッケージ（@stv/core）」section を持つ', () => {
    expect(architecture).toContain(BOUNDARY_HEADING);
  });

  it('leg3: 依存 pin 表記は package.json 実値と完全一致（浮動 ref・ドリフトで RED）', () => {
    const pin = resolveCorePin();
    const mentions = architecture.match(CORE_PIN_REGEX) ?? [];
    expect(mentions.length).toBeGreaterThanOrEqual(1);

    const drifted = [...new Set(mentions.filter((mention) => mention !== pin))];
    expect(drifted).toEqual([]);

    // 境界 section 内に pin が最低1件（section 本文からの除去を検知）
    const section = extractSection(architecture, BOUNDARY_HEADING);
    expect(section).toContain(pin);
  });

  it('leg3: 3文書それぞれが @stv/core/ 出典を1件以上含む（同期の最小証拠）', () => {
    const lacking = docs.filter((doc) => !doc.text.includes('@stv/core/')).map((doc) => doc.rel);
    expect(lacking).toEqual([]);
  });
});
