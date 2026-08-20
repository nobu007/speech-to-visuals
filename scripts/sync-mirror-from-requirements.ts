/**
 * specs mirror sync generator — 義務 B 後半 (TASK-0250 / REQ-356 / TC-351 / MW-032).
 *
 *   npm run specs:mirror:sync     (or: tsx scripts/sync-mirror-from-requirements.ts)
 *   npm run specs:mirror:check    (or: tsx scripts/sync-mirror-from-requirements.ts --check)
 *
 * TASK-0249（義務 B 前半）が固定した marker 契約の **machine-owned 部分だけ** を
 * 再生成する generator。契約上の所有権分割:
 *
 *   - 人間所有: marker 行（`<!-- mirror:…:start tokens="…" -->` / `:end -->`）と
 *     region 内の prose（正本節の事実の言い換え）と tokens の curation
 *   - generator 所有: region 内の sync-stamp 行 1 行
 *     （`<!-- sync:mirror source-digest="<正本節の正規化 sha256 先頭 12 hex>" -->`）
 *
 * 正本（requirements.md 等）の節が更新されると:
 *
 *   1. token 化された事実が動けば `TOKEN_MISSING_IN_SOURCE` / `TOKEN_MISSING_IN_MIRROR`
 *      （TASK-0249 の双方向検証）→ 人手で marker の tokens と prose を更新する
 *   2. それ以外の編集でも stamp との digest 不一致 = `STALE_SYNC_STAMP` →
 *      `npm run specs:mirror:sync` が stamp を機械再生成する
 *
 * つまり「正本を更新したら mirror 側に必ず作業が発生する」ことを保証しながら、
 * 機械に解できる分（stamp 再生成）を人間の手作業から切り離す — 義務 B
 * 「人間の手作業経由ではなく build hook での再生成」の実体。steering 指摘の
 * link:spine drift（正典 child 追加時に再生ブロックを同 commit に載せる）と
 * 同じ規律: 正本節を更新したら `npm run specs:mirror:sync` を同 commit で実行する。
 *
 * `--check` は jest guard（tests/guards/specs-mirror-contract.test.ts）と同じ
 * 検証を CLI で回す純粋な drift detector（書き込みなし）。`scripts/validate-spine-manifest.ts`
 * の CLI（spine:validate gate）からも呼ばれ、manifest が auto-gen・gitignored で
 * SKIPPED になる clean checkout でも specs/ は tracked なので mirror 契約検証が
 * 常に走る（TASK-0247 調査結果 2 の「manifest 側への hook 配線」の実装）。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import {
  SYNC_STAMP_DETECT_RE,
  computeSourceDigest,
  extractSection,
  parseMirrorMarkers,
  renderSyncStamp,
  validateMirrorRegions,
  type MirrorViolation,
} from '../tests/guards/specs-mirror-contract';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPECS_DIR = join(REPO_ROOT, 'specs', 'speech-to-visuals');

/**
 * 1 ファイル分の stamp 再生成（純関数・書き込みなし）。
 *
 * 構造違反（nest / orphan / empty region 等）があるファイルは **一切書き換えない**
 * （fail-loud: 破損した parse 結果の周辺を書き換えると偽 sync になる）。
 * 正本が読めない / 節が無い / stamp が重複している region も個別に skip し
 * errors に理由を残す。
 */
export function syncMirrorStamps(
  mirrorFile: string,
  content: string,
  readSource: (sourceFile: string) => string | null,
): { content: string; changedRegions: number; errors: string[] } {
  const { regions, violations } = parseMirrorMarkers(mirrorFile, content);
  if (violations.length > 0) {
    return {
      content,
      changedRegions: 0,
      errors: violations.map(v => v.detail),
    };
  }

  const lines = content.split('\n');
  const errors: string[] = [];
  let changedRegions = 0;

  // startLine 降順で処理: 前の region の splice が後の region の行番号を
  // ずらさないため（stamp 挿入は行数を変えうる）。
  for (const region of [...regions].sort((a, b) => b.startLine - a.startLine)) {
    const where = `${mirrorFile}:${region.startLine}`;
    const src = readSource(region.sourceFile);
    if (src === null) {
      errors.push(`${where} — 正本ファイル ${region.sourceFile} が読めない`);
      continue;
    }
    const sectionBody = extractSection(src, region.section);
    if (sectionBody === null) {
      errors.push(
        `${where} — 正本 ${region.sourceFile} に節 '## ${region.section}' が無い`,
      );
      continue;
    }
    const stamp = renderSyncStamp(computeSourceDigest(sectionBody));

    // body の 0-based 範囲: startLine（1-based marker 行）の次の行から
    // endLine（1-based end marker 行）の手前まで。
    const bodyStart = region.startLine;
    const bodyEnd = region.endLine - 1;
    const bodyLines = lines.slice(bodyStart, bodyEnd);
    const stampIdx = bodyLines.findIndex(l =>
      SYNC_STAMP_DETECT_RE.test(l.replace(/\r$/, '')),
    );
    const stampCount = bodyLines.filter(l =>
      SYNC_STAMP_DETECT_RE.test(l.replace(/\r$/, '')),
    ).length;
    if (stampCount > 1) {
      errors.push(
        `${where} — sync-stamp 行が ${stampCount} 個ある（1 region に 1 つ）。手で 1 つに整理してから再実行`,
      );
      continue;
    }
    if (stampIdx !== -1 && bodyLines[stampIdx].replace(/\r$/, '') === stamp) {
      continue; // 既に現行 digest
    }
    const newBody =
      stampIdx === -1
        ? [stamp, ...bodyLines]
        : bodyLines.map((l, i) => (i === stampIdx ? stamp : l));
    lines.splice(bodyStart, bodyEnd - bodyStart, ...newBody);
    changedRegions++;
  }

  return { content: lines.join('\n'), changedRegions, errors };
}

export interface MirrorContractReport {
  filesChecked: number;
  regionsChecked: number;
  violations: MirrorViolation[];
}

/**
 * specs ディレクトリ全体に対する契約検証（構造 + tokens 双方向 + sync-stamp）。
 * jest guard と同一ロジックを CLI/hook から使うための入口（書き込みなし）。
 */
export function runMirrorContractCheck(specsDir: string): MirrorContractReport {
  const files = readdirSync(specsDir).filter(f => f.endsWith('.md'));
  let regionsChecked = 0;
  const violations: MirrorViolation[] = [];
  for (const file of files) {
    const content = readFileSync(join(specsDir, file), 'utf-8');
    const { regions, violations: structural } = parseMirrorMarkers(file, content);
    regionsChecked += regions.length;
    violations.push(
      ...validateMirrorRegions(regions, structural, sourceFile => {
        const p = join(specsDir, sourceFile);
        return existsSync(p) ? readFileSync(p, 'utf-8') : null;
      }),
    );
  }
  return { filesChecked: files.length, regionsChecked, violations };
}

function formatViolation(v: MirrorViolation): string {
  return `  [${v.kind}] ${v.detail}`;
}

/**
 * CLI entry point.
 *
 *   tsx scripts/sync-mirror-from-requirements.ts           → sync (specs:mirror:sync)
 *   tsx scripts/sync-mirror-from-requirements.ts --check   → verify, no write (specs:mirror:check)
 *
 * sync mode は stamp を再生成したあと改めて全契約検証を回し、残った違反
 * （token drift = 人手 curation 済みでないもの）があれば exit 1 で知らせる。
 * check mode は一切書き込まない（hook から呼ばれても working tree を汚さない）。
 */
function main(): void {
  const args = process.argv.slice(2);
  const checkMode =
    args.includes('--check') || args.includes('check') || args.includes('--verify');

  if (checkMode) {
    const report = runMirrorContractCheck(SPECS_DIR);
    console.log(`\n=== Specs Mirror Contract ===`);
    console.log(`Files checked: ${report.filesChecked}`);
    console.log(`Mirror regions: ${report.regionsChecked}`);
    console.log(`Violations: ${report.violations.length}`);
    if (report.violations.length > 0) {
      console.log('\n❌ MIRROR VIOLATIONS:');
      for (const v of report.violations) console.log(formatViolation(v));
      console.log(
        `\n→ 正本節を更新した場合は 'npm run specs:mirror:sync' を同 commit で実行し、` +
          `token 事実の変更があれば marker の tokens と prose も更新すること。`,
      );
      process.exitCode = 1;
      return;
    }
    console.log('\n✅ Specs mirror contract is in sync.');
    return;
  }

  // sync mode
  const files = readdirSync(SPECS_DIR).filter(f => f.endsWith('.md'));
  const errors: string[] = [];
  let written = 0;
  for (const file of files) {
    const path = join(SPECS_DIR, file);
    const content = readFileSync(path, 'utf-8');
    const result = syncMirrorStamps(file, content, sourceFile => {
      const p = join(SPECS_DIR, sourceFile);
      return existsSync(p) ? readFileSync(p, 'utf-8') : null;
    });
    errors.push(...result.errors);
    if (result.content !== content) {
      writeFileSync(path, result.content, 'utf-8');
      written++;
      console.log(
        `🔧 ${file} — ${result.changedRegions} region の sync-stamp を再生成`,
      );
    }
  }
  if (errors.length > 0) {
    console.log('\n⚠️  書き換えを見送った region:');
    for (const e of errors) console.log(`  ${e}`);
  }

  // 再生成後に残る違反 = 人手 curation が必要な分（token drift・構造違反）
  const report = runMirrorContractCheck(SPECS_DIR);
  console.log(`\n=== Specs Mirror Contract (post-sync) ===`);
  console.log(`Files: ${report.filesChecked} / regions: ${report.regionsChecked} / violations: ${report.violations.length}`);
  if (report.violations.length > 0) {
    console.log('\n❌ 残存違反（人手の curation が必要）:');
    for (const v of report.violations) console.log(formatViolation(v));
    process.exitCode = 1;
    return;
  }
  console.log(
    `\n✅ 全 mirror region が正本と同期（files written: ${written}）。`,
  );
}

// Run only when invoked directly (tsx), not when imported by tests/hook 側.
const invokedAs = process.argv[1];
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  main();
}
