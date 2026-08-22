/**
 * spine anchor role 一括正規化 generator — Phase 186 / TASK-0270 / REQ-388 / MW-052.
 *
 *   npx tsx scripts/sync-spine-anchor-roles.ts            → sync（書き込み）
 *   npx tsx scripts/sync-spine-anchor-roles.ts --check    → verify, no write
 *
 * make-run steering の指摘（Phase 185 feedback）:
 *
 *   「repo内に依然90件超のrole行なしspecが残る。次回は spineManifestValidator を
 *    緑に保ったまま、SPINE_ANCHOR_ROLES から role を一括割当する有界な正規化
 *    pass を 1 回実行し、2行ずつの滴下を繰り返さないこと」
 *   「末端掃込みコミット('chore(make-run): commit N remaining change(s)')で
 *    anchor スキーマ修正を雑扱いしないこと。role 行は anchor 生成・更新と同じ
 *    タスク内で出力・コミットし、各 run の diff が自己説明するようにする」
 *
 * に対する実装。hub 側 doc-spine engine（spine.py）の role 導出規則を
 * tests/guards/spine-anchor-contract.ts に移植済みで、本 CLI はそれを使って
 * specs/** を一括 sweep する:
 *
 *   - anchor block は有るが role 行が無い file → 導出 role の 1 行を挿入
 *     （Phase 186 時点で 93 file = 滴下で取り残された TASK-0109〜0222 群）
 *   - tasks/TASK-*.md に anchor block が無い file → 正規形 block を H1 直後に挿入
 *     （Phase 186 時点で 47 file = TASK-0223〜0269 群・anchor 追加をやめていた時代）
 *   - それ以外の specs file には **触れない**（engine の outsider 判断を
 *     捏造しない境界 — 有界性の担保）
 *
 * 既存 role 行の値の不一致は書き換えず fail-loud（contract 側の設計と同じ）。
 * jest guard（tests/guards/spine-anchor-role-census.test.ts）が同じ純関数で
 * CI gate を持つため、本 CLI を回し忘れても滴下は RED で捕まる。
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, posix } from 'node:path';
import {
  auditSpineAnchors,
  deriveTaskAnchorDefaults,
  normalizeAnchorRole,
  type AnchorCensusReport,
} from '../tests/guards/spine-anchor-contract';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SPECS_DIR = join(REPO_ROOT, 'specs');

/** specs/ 以下の .md を再帰的に列挙し、specs-relative rel を返す。 */
function listSpecsFiles(dir: string, prefix: string): Array<{ rel: string; abs: string }> {
  const out: Array<{ rel: string; abs: string }> = [];
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(abs).isDirectory()) {
      out.push(...listSpecsFiles(abs, rel));
    } else if (name.endsWith('.md')) {
      out.push({ rel, abs });
    }
  }
  return out;
}

function runCensus(): AnchorCensusReport {
  const files = listSpecsFiles(SPECS_DIR, '').map(({ rel, abs }) => ({
    rel,
    content: readFileSync(abs, 'utf-8'),
  }));
  return auditSpineAnchors(files);
}

function main(): void {
  const args = process.argv.slice(2);
  const checkMode =
    args.includes('--check') || args.includes('check') || args.includes('--verify');

  if (checkMode) {
    const report = runCensus();
    console.log(`\n=== Spine Anchor Role Census ===`);
    console.log(`Files checked: ${report.filesChecked}`);
    console.log(`Anchor blocks: ${report.anchorBlocks}`);
    console.log(`Blocks with role line: ${report.roleLines}`);
    console.log(`Violations: ${report.violations.length}`);
    if (report.violations.length > 0) {
      console.log('\n❌ ANCHOR VIOLATIONS:');
      for (const v of report.violations) console.log(`  [${v.kind}] ${v.detail}`);
      console.log(
        `\n→ 'npx tsx scripts/sync-spine-anchor-roles.ts' を anchor 生成と同じ` +
          ` タスク内で実行し、自己説明的 commit として land させること` +
          `（末端掃込みコミット禁止 — REQ-388）。`,
      );
      process.exitCode = 1;
      return;
    }
    console.log('\n✅ 全 spine anchor block が role 行を持ち導出規則と一致。');
    return;
  }

  // sync mode
  const files = listSpecsFiles(SPECS_DIR, '').map(({ rel, abs }) => ({
    rel,
    content: readFileSync(abs, 'utf-8'),
    abs,
  }));
  const defaults = deriveTaskAnchorDefaults(files);
  let insertedRole = 0;
  let insertedBlock = 0;
  for (const { rel, content, abs } of files) {
    const result = normalizeAnchorRole(rel, content, defaults);
    if (result.action === 'none') continue;
    writeFileSync(abs, result.content, 'utf-8');
    if (result.action === 'inserted-role') {
      insertedRole++;
      console.log(`🔧 ${posix.join('specs', rel)} — role \`${result.role}\` 行を挿入`);
    } else {
      insertedBlock++;
      console.log(`🔧 ${posix.join('specs', rel)} — 正規形 anchor block（role \`${result.role}\`）を挿入`);
    }
  }
  console.log(
    `\n=== Spine Anchor Role Sync ===\n` +
      `role 行挿入: ${insertedRole} file / anchor block 挿入: ${insertedBlock} file`,
  );

  // 再生成後に残る違反 = role 値の不一致・構造違反（人手 curation が必要な分）
  const report = runCensus();
  console.log(
    `post-sync census: violations ${report.violations.length}` +
      ` (blocks ${report.anchorBlocks} / role lines ${report.roleLines})`,
  );
  if (report.violations.length > 0) {
    console.log('\n❌ 残存違反（role 値不一致・構造違反 — 人手での確認が必要）:');
    for (const v of report.violations) console.log(`  [${v.kind}] ${v.detail}`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ 全 anchor block が正規形（census GREEN）。');
}

// Run only when invoked directly (tsx), not when imported by tests/hook 側.
const invokedAs = process.argv[1];
if (invokedAs && import.meta.url === pathToFileURL(invokedAs).href) {
  main();
}
